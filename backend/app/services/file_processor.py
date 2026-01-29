"""
File Processing Service - Schema Mapping & Preview Layer.
Refactored to delegate promote_to_production to IngestionOrchestrator.

Responsibilities (Retained):
- infer_schema_mapping: Column matching via MatchingEngine
- preview_dry_run: HITL preview of first 20 rows

Responsibilities (Delegated to app.services.ingestion):
- promote_to_production: Now delegated to IngestionOrchestrator
"""
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

from app.models.datasource import DataSource, SchemaMapping
from app.models.raw_import import RawImport
from app.repositories.production_repo import ProductionRepository
from app.services.ingestion.date_parser import parse_date

# Import the new Orchestrator for promote_to_production
from app.services.ingestion.orchestrator import IngestionOrchestrator

# Import the new Engine and Types
from app.services.matching.engine import MatchingEngine
from app.services.matching.types import ColumnMatchResult


class FileProcessingService:
    """
    Orchestrates file processing:
    1. Infer Schema (Matching Engine) - RETAINED
    2. Preview (Dry Run) - RETAINED
    3. Promote (Production Insert) - DELEGATED to IngestionOrchestrator
    """

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.prod_repo = ProductionRepository(db_session)
        self.matcher = MatchingEngine()
        # Delegate complex promotion logic to orchestrator
        self._orchestrator = IngestionOrchestrator(db_session)

    async def infer_schema_mapping(self, raw_import_id: str) -> dict[str, Any]:
        """
        Analyzes the file columns and suggests a schema mapping using Hash & Fuzzy logic.
        Creates/Updates a SchemaMapping record.
        """
        raw_import = await self.db.get(RawImport, raw_import_id)
        if not raw_import:
            raise ValueError("RawImport not found")

        # 1. Read Headers (non-blocking)
        file_path = Path(raw_import.file_path)
        if file_path.suffix.lower() == ".csv":
            df = await run_in_threadpool(
                pd.read_csv,
                file_path,
                nrows=0,
                encoding=raw_import.encoding_detected or "utf-8",
            )
        else:
            df = await run_in_threadpool(pd.read_excel, file_path, nrows=0)

        columns = df.columns.tolist()

        # 2. Run Matching Engine
        column_results = []
        mapping_dict = {}

        for col in columns:
            match = self.matcher.match_column(col)

            # Create detailed result for UI
            col_result = ColumnMatchResult(
                source_column=col,
                target_field=match.canonical,
                confidence=match.confidence,
                tier=match.tier,
                fuzzy_score=match.fuzzy_score,
            )

            # If high confidence, auto-select
            if match.canonical and match.confidence > 0.6:
                mapping_dict[col] = match.canonical

            column_results.append(col_result.to_dict())

        # 3. Save Suggested Mapping to DB
        mapping = SchemaMapping(
            data_source_id=raw_import.data_source_id,
            version=1,
            column_map=mapping_dict,
            is_active=False,
            config={"column_details": column_results},
        )
        self.db.add(mapping)
        await self.db.commit()

        return {
            "raw_import_id": raw_import_id,
            "columns_processed": len(columns),
            "suggestions": column_results,
            "mapping_id": mapping.id,
        }

    async def preview_dry_run(self, raw_import_id: str) -> dict[str, Any]:
        """
        HITL Step: Simulates import on first 20 rows using ACTIVE mapping.
        """
        # Fetch Import + DataSource + Active Mapping
        result = await self.db.execute(
            select(RawImport)
            .where(RawImport.id == raw_import_id)
            .options(
                selectinload(RawImport.data_source).selectinload(
                    DataSource.schema_mappings
                )
            )
        )
        raw_import = result.scalar_one_or_none()
        if not raw_import:
            raise ValueError("Import not found")

        if not raw_import.data_source:
            raise ValueError("Data source not found")

        # Find active mapping
        active_map = next(
            (m for m in raw_import.data_source.schema_mappings if m.is_active), None
        )
        if not active_map:
            raise ValueError(
                "No active schema mapping found. Please confirm mapping first."
            )

        column_map = active_map.column_map
        date_format = raw_import.data_source.time_format

        # Read Data (non-blocking)
        file_path = Path(raw_import.file_path)
        if file_path.suffix.lower() == ".csv":
            df = await run_in_threadpool(
                pd.read_csv,
                file_path,
                nrows=20,
                encoding=raw_import.encoding_detected or "utf-8",
            )
        else:
            df = await run_in_threadpool(pd.read_excel, file_path, nrows=20)

        preview_rows = []
        for idx, row in df.iterrows():
            clean_data = {}
            issues = []

            for src, target in column_map.items():
                if src in row:
                    val = row[src]
                    clean_val = self._clean_value(val, target, date_format)
                    clean_data[target] = clean_val

                    # Date Sanity Check
                    if (
                        target == "production_date"
                        and isinstance(val, str)
                        and len(val) < 6
                    ):
                        issues.append(f"Auto-fixed date '{val}' assumed current year")

            preview_rows.append(
                {
                    "row": idx,
                    "raw": {
                        k: (str(v) if pd.notna(v) else None)
                        for k, v in row.to_dict().items()
                    },
                    "clean": clean_data,
                    "issues": issues,
                    "status": "warning" if issues else "valid",
                }
            )

        return {
            "preview_records": preview_rows,
            "mapping_used": column_map,
            "raw_import_id": raw_import_id,
            "total_rows": raw_import.row_count or len(preview_rows),
            "overall_status": "needs_review"
            if any(r["issues"] for r in preview_rows)
            else "ready",
        }

    async def promote_to_production(
        self,
        raw_import_id: str,
        on_progress: Callable[[int], None] | None = None,
    ) -> dict[str, Any]:
        """
        Final Step: Writes data to ProductionRun table.

        REFACTORED: Now delegates to IngestionOrchestrator which coordinates:
        - RecordValidator: Style/Order/Run resolution
        - ProductionWriter: Atomic database writes
        """
        return await self._orchestrator.promote_to_production(
            raw_import_id=raw_import_id,
            on_progress=on_progress,
        )

    def _clean_value(self, val: Any, target_field: str, date_format: str | None = None) -> Any:
        """Robust cleaning logic."""
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

        # Dates
        if "date" in target_field:
            return parse_date(
                val,
                format_spec=date_format,
                auto_detect=True,
                assume_year=datetime.now().year,
            )

        return str_val

