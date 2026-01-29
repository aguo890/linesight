"""
Ingestion Orchestrator - Coordinates validation and writing.
Extracted from file_processor.py to provide a clean separation of concerns.

This is the main entry point for the promote_to_production flow,
coordinating RecordValidator and ProductionWriter.
"""
import contextlib
import logging
from collections.abc import Callable
from datetime import datetime
from decimal import InvalidOperation
from pathlib import Path
from typing import Any

import pandas as pd  # type: ignore[import-untyped]
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.datasource import DataSource
from app.models.raw_import import RawImport
from app.services.ingestion.date_parser import parse_date
from app.services.ingestion.date_profiler import detect_column_format
from app.services.ingestion.validator import RecordValidator
from app.services.ingestion.writer import ProductionWriter
from app.services.socket_manager import manager

logger = logging.getLogger(__name__)


class IngestionOrchestrator:
    """
    Orchestrates the promote_to_production flow.
    
    Responsibilities:
    1. Read file and transform data using schema mapping
    2. Coordinate RecordValidator for relationship resolution
    3. Coordinate ProductionWriter for atomic DB writes
    4. Handle progress callbacks and WebSocket broadcasts
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.validator = RecordValidator(db)
        self.writer = ProductionWriter(db)

    async def promote_to_production(
        self,
        raw_import_id: str,
        on_progress: Callable[[int], None] | None = None,
    ) -> dict[str, Any]:
        """
        Main entry point for promoting staged data to production.
        
        Steps:
        1. Load RawImport and validate state
        2. Read file and transform using active schema mapping
        3. Resolve relationships (Style, Order, existing Runs)
        4. Process records and execute atomic writes
        5. Finalize and broadcast updates
        """
        # Idempotency check
        existing_import = await self.db.get(RawImport, raw_import_id)
        if existing_import and existing_import.status == "promoted":
            logger.info(f"Skipping promote for {raw_import_id} - Already Promoted")
            if on_progress:
                on_progress(100)
            return {
                "status": "promoted",
                "message": "Already processed",
                "records_processed": 0,
            }

        # --- DEEP DEBUGGING START ---
        print(f"\n{'='*50}")
        print("🚀 DEBUG: promote_to_production CALLED")
        print(f"🆔 raw_import_id: {raw_import_id}")

        # 1. Enable SQL Echo
        # This forces SQLAlchemy to print every SQL statement to stdout/stderr
        self.db.bind.echo = True
        print("🔊 SQL Logging Enabled")
        print(f"{'='*50}\n")
        # --- DEEP DEBUGGING END ---

        logger.info(f"ORCHESTRATOR: promote_to_production for {raw_import_id}")

        # Fetch RawImport context
        result = await self.db.execute(
            select(RawImport)
            .where(RawImport.id == raw_import_id)
            .options(
                selectinload(RawImport.data_source).selectinload(
                    DataSource.schema_mappings
                )
            )
            .execution_options(populate_existing=True)
        )
        raw_import = result.scalar_one_or_none()
        if not raw_import or not raw_import.data_source:
            raise ValueError(f"RawImport {raw_import_id} invalid or missing datasource")

        logger.info(f"DEBUG: Checking mappings for DS {raw_import.data_source.id}")
        if raw_import.data_source.schema_mappings:
            for m in raw_import.data_source.schema_mappings:
                logger.info(f"DEBUG: Mapping {m.id} | Ver: {m.version} | Active: {m.is_active}")
        else:
            logger.info("DEBUG: No schema mappings loaded!")

        # Find active mapping
        active_map = next(
            (m for m in raw_import.data_source.schema_mappings if m.is_active), None
        )
        if not active_map:
            raise ValueError("No active schema mapping found.")

        column_map = active_map.column_map
        factory_id = raw_import.factory_id
        data_source_id = raw_import.data_source_id

        # Get date format from DataSource configuration
        date_format = raw_import.data_source.time_format

        if on_progress:
            on_progress(10)

        # =====================================================================
        # STEP 1: Read & Transform Data
        # =====================================================================
        records = await self._read_and_transform(raw_import, column_map, date_format)

        if not records:
            return {
                "status": "promoted",
                "records_processed": 0,
                "success_count": 0,
                "error_count": 0,
            }

        if on_progress:
            on_progress(20)

        # =====================================================================
        # STEP 2: Resolve Relationships
        # =====================================================================
        style_map = await self.validator.resolve_styles(records, factory_id)
        order_map = await self.validator.resolve_orders(records, style_map)

        if on_progress:
            on_progress(40)

        # =====================================================================
        # STEP 3: Resolve Existing Runs (Differential Logic)
        # =====================================================================
        logger.info("Resolving existing runs for differential calculation...")
        existing_run_map = await self.validator.resolve_existing_runs(
            records, style_map, order_map, data_source_id
        )
        logger.info(f"Found {len(existing_run_map)} existing runs to update.")

        if on_progress:
            on_progress(60)

        # =====================================================================
        # STEP 4: Process Records & Execute Writes (Atomically)
        # =====================================================================
        write_result = await self.writer.write_production_data(
            records=records,
            style_map=style_map,
            order_map=order_map,
            existing_run_map=existing_run_map,
            factory_id=factory_id,
            data_source_id=data_source_id,
            raw_import_id=raw_import_id,
        )

        if on_progress:
            on_progress(90)

        # =====================================================================
        # STEP 5: Finalize & Broadcast
        # =====================================================================
        raw_import.status = "promoted"
        await self.db.commit()

        # Broadcast if events occurred
        if write_result["events"] > 0:
            with contextlib.suppress(Exception):
                await manager.broadcast(
                    {
                        "type": "DATA_UPDATE",
                        "event": "BATCH_UPLOAD",
                        "count": write_result["events"],
                        "data_source_id": data_source_id,
                    },
                    line_id=data_source_id,
                )

        # Cache invalidation
        try:
            from app.core.cache import invalidate_analytics_cache
            await invalidate_analytics_cache()
        except Exception:
            pass  # Non-critical

        if on_progress:
            on_progress(100)

        return {
            "status": "promoted",
            "inserted": write_result["inserted"],
            "updated": write_result["updated"],
            "events": write_result["events"],
            "errors": write_result["errors"],
        }

    async def _read_and_transform(
        self, raw_import: RawImport, column_map: dict[str, str], date_format: str | None = None
    ) -> list[dict[str, Any]]:
        """Read file and transform data using schema mapping."""
        file_path = Path(raw_import.file_path)

        if file_path.suffix.lower() == ".csv":
            df = await run_in_threadpool(
                pd.read_csv, file_path, encoding=raw_import.encoding_detected or "utf-8"
            )
        else:
            df = await run_in_threadpool(pd.read_excel, file_path)

        # =====================================================================
        # COLUMN-LEVEL DATE FORMAT PROFILING (Constraint Elimination)
        # =====================================================================
        # If no explicit date format is configured, profile the date column(s)
        # to detect whether data is YYYY-MM-DD or YYYY-DD-MM
        effective_date_format = date_format

        if not effective_date_format or effective_date_format == "auto":
            # Find date column(s) from column_map
            date_source_cols = [
                src for src, tgt in column_map.items()
                if "date" in tgt.lower()
            ]

            for date_col in date_source_cols:
                if date_col in df.columns:
                    # Extract sample values as strings
                    sample_values = df[date_col].dropna().astype(str).head(100).tolist()

                    if sample_values:
                        profile_result = detect_column_format(sample_values)

                        logger.info(
                            f"DATE COLUMN PROFILED: '{date_col}' -> "
                            f"{profile_result.format_label} "
                            f"(confidence: {profile_result.confidence:.0%})"
                        )

                        if profile_result.ambiguous:
                            logger.warning(
                                f"AMBIGUOUS DATE COLUMN '{date_col}': "
                                f"All sampled values could be YYYY-MM-DD or YYYY-DD-MM. "
                                f"Defaulting to ISO 8601. Consider configuring explicit format."
                            )

                        # Use the detected format for parsing
                        effective_date_format = profile_result.format
                        break  # Use first date column's format for all dates

        records = []
        for _, row in df.iterrows():
            record = {}
            for source_col, target_field in column_map.items():
                if source_col in row and pd.notna(row[source_col]):
                    record[target_field] = self._clean_value(
                        row[source_col], target_field, effective_date_format
                    )

            if record:
                records.append(record)

        return records

    def _clean_value(self, val: Any, target_field: str, date_format: str | None = None) -> Any:
        """Robust cleaning logic with configurable date format."""
        if pd.isna(val) or val == "":
            return None

        str_val = str(val).strip()

        # Percentages
        if target_field == "line_efficiency":
            try:
                if isinstance(val, str) and "%" in str_val:
                    return float(str_val.replace("%", "")) / 100
                num = float(val)
                return num / 100 if num > 1 else num
            except (ValueError, TypeError):
                return None

        # Numerics
        if target_field in [
            "sam",
            "worked_minutes",
            "earned_minutes",
            "downtime_minutes",
        ]:
            try:
                return float(str_val)
            except (ValueError, TypeError, InvalidOperation):
                return 0.0

        # Integers
        if target_field in [
            "actual_qty",
            "planned_qty",
            "operators_present",
            "helpers_present",
            "defects",
        ]:
            try:
                return int(float(str_val))
            except (ValueError, TypeError):
                return 0

        # Dates - use date_parser with configured format
        if "date" in target_field:
            return parse_date(
                val,
                format_spec=date_format,
                auto_detect=True,  # Fallback to auto-detect if format fails
                assume_year=datetime.now().year,
            )

        return str_val

