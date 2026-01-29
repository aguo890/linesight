"""
Production Writer - Database Writing Layer with Atomic Transactions.
Extracted from file_processor.py to handle all database writes.

CRITICAL: All writes happen in a single transaction block for atomicity.
If any step fails, the entire transaction is rolled back.
"""
import logging
import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import EfficiencyMetric
from app.models.data_quality import DataQualityIssue, IssueSeverity, IssueType
from app.models.events import EventType, ProductionEvent
from app.models.production import Order, ProductionRun, Style
from app.models.quality import InspectionType, QualityInspection
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

# Batch size for bulk inserts (avoids MySQL packet size limits)
BATCH_SIZE = 1000


def _parse_time(value: Any) -> time | None:
    """Parse time string (e.g., '08:00', '14:30:00') to Python time object."""
    if value is None:
        return None
    if isinstance(value, time):
        return value
    if isinstance(value, datetime):
        return value.time()
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        # Try common formats
        for fmt in ("%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M:%S %p"):
            try:
                return datetime.strptime(value, fmt).time()
            except ValueError:
                continue
        logger.warning(f"Could not parse time value: {value}")
    return None


class ProductionWriter:
    """
    Handles all database writes for ingestion with atomic transactions.
    
    Responsibilities:
    - Prepare ProductionRun inserts/updates
    - Create ProductionEvents for audit trail
    - Create EfficiencyMetrics and QualityInspection records
    - Execute all writes in a single transaction
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def write_production_data(
        self,
        records: list[dict[str, Any]],
        style_map: dict[str, Style],
        order_map: dict[tuple[str, str], Order],
        existing_run_map: dict[tuple[str, date, str], ProductionRun],
        factory_id: str,
        data_source_id: str,
        raw_import_id: str,
    ) -> dict[str, Any]:
        """
        Process all records and write to database atomically.
        
        Returns dict with:
            - inserted: count of new runs
            - updated: count of updated runs
            - events: count of events created
            - errors: count of processing errors
        """
        runs_to_insert: list[dict] = []
        runs_to_update: list[dict] = []
        production_events: list[dict] = []
        efficiency_metrics: list[dict] = []
        quality_inspections: list[dict] = []
        quality_issues: list[dict] = []
        error_count = 0
        now = datetime.utcnow()

        # Process each record
        for idx, record in enumerate(records):
            try:
                result = self._process_record(
                    idx=idx,
                    record=record,
                    style_map=style_map,
                    order_map=order_map,
                    existing_run_map=existing_run_map,
                    factory_id=factory_id,
                    data_source_id=data_source_id,
                    raw_import_id=raw_import_id,
                    now=now,
                )
                
                if result is None:
                    error_count += 1
                    continue
                
                # Collect prepared data
                if result.get("run_insert"):
                    runs_to_insert.append(result["run_insert"])
                if result.get("run_update"):
                    runs_to_update.append(result["run_update"])
                if result.get("event"):
                    production_events.append(result["event"])
                if result.get("efficiency"):
                    efficiency_metrics.append(result["efficiency"])
                if result.get("quality"):
                    quality_inspections.append(result["quality"])
                if result.get("issues"):
                    quality_issues.extend(result["issues"])
                    
            except (ValueError, TypeError, KeyError) as e:
                logger.warning(f"Data error in row {idx}: {e}")
                error_count += 1
            except Exception as e:
                logger.error(f"Internal error processing row {idx}: {e}")
                raise

        # Execute all writes atomically, getting actual IDs from RETURNING
        id_map = await self._execute_writes(
            runs_to_insert=runs_to_insert,
            runs_to_update=runs_to_update,
            production_events=production_events,
            efficiency_metrics=efficiency_metrics,
            quality_inspections=quality_inspections,
            quality_issues=quality_issues,
        )

        return {
            "inserted": len(runs_to_insert),
            "updated": len(runs_to_update),
            "events": len(production_events),
            "errors": error_count,
        }

    def _process_record(
        self,
        idx: int,
        record: dict[str, Any],
        style_map: dict[str, Style],
        order_map: dict[tuple[str, str], Order],
        existing_run_map: dict[tuple[str, date, str], ProductionRun],
        factory_id: str,
        data_source_id: str,
        raw_import_id: str,
        now: datetime,
    ) -> dict[str, Any] | None:
        """
        Process a single record and return prepared data for DB operations.
        Returns None if record should be skipped.
        """
        # Lookup Style
        sn = record.get("style_number")
        if not sn or sn not in style_map:
            return None
        style = style_map[sn]

        # Lookup Order
        po = record.get("po_number", "UNKNOWN_PO")
        order_key = (str(po), style.id)
        if order_key not in order_map:
            return None
        order = order_map[order_key]

        # Determine production date and shift
        p_date = record.get("production_date", datetime.now(timezone.utc).date())
        if isinstance(p_date, datetime):
            p_date = p_date.date()
        shift = record.get("shift", "day")
        run_key = (order.id, p_date, shift)

        new_qty = record.get("actual_qty", 0)
        run_sam = record.get("sam") or style.base_sam or Decimal(0)

        # Common run data
        run_data_base = {
            "actual_qty": new_qty,
            "sam": run_sam,
            "operators_present": record.get("operators_present", 0),
            "helpers_present": record.get("helpers_present", 0),
            "worked_minutes": record.get("worked_minutes", 0),
            "downtime_minutes": record.get("downtime_minutes"),
            "downtime_reason": record.get("downtime_reason"),
            "updated_at": now,
            # --- DENORMALIZED FIELDS (Phase 2) ---
            "start_time": _parse_time(record.get("start_time")),
            "end_time": _parse_time(record.get("end_time")),
            "style_number": sn,  # From style lookup
            "buyer": style.buyer if style else record.get("buyer"),
            "season": style.season if style else record.get("season"),
            "po_number": po,  # From order lookup
            "color": order.color if order else record.get("color"),
            "size": record.get("size"),
            "defects": int(record.get("defects", 0)),
            "dhu": Decimal(str(record.get("dhu", 0))) if record.get("dhu") else None,
            "line_efficiency": Decimal(str(record.get("line_efficiency", 0))) if record.get("line_efficiency") else None,
        }

        # Physics validation
        issues = []
        physics_warnings = AnalyticsService.validate_production_physics(record)
        if physics_warnings:
            for warning in physics_warnings:
                issues.append({
                    "id": str(uuid.uuid4()),
                    "raw_import_id": raw_import_id,
                    "row_number": idx + 1,
                    "issue_type": IssueType.PHYSICS_VIOLATION.value,
                    "severity": IssueSeverity.WARNING.value,
                    "message": warning,
                    "field_name": None,
                    "field_value": None,
                })

        result: dict[str, Any] = {"issues": issues}

        # Differential logic: Update existing or Insert new
        if run_key in existing_run_map:
            # UPDATE EXISTING
            existing_run = existing_run_map[run_key]
            delta_qty = new_qty - existing_run.actual_qty

            if delta_qty != 0:
                # Update run
                update_payload = run_data_base.copy()
                update_payload["id"] = existing_run.id
                result["run_update"] = update_payload

                # Create differential event
                result["event"] = {
                    "id": str(uuid.uuid4()),
                    "production_run_id": existing_run.id,
                    "data_source_id": data_source_id,
                    "order_id": order.id,
                    "style_id": style.id,
                    "timestamp": datetime.combine(p_date, time(12, 0)).replace(
                        tzinfo=timezone.utc
                    ),
                    "event_type": EventType.BATCH_UPLOAD.value,
                    "quantity": delta_qty,
                    "source_import_id": raw_import_id,
                    "raw_data": {"row": idx, "logic": "differential_update"},
                }
        else:
            # INSERT NEW
            new_id = str(uuid.uuid4())

            # Create run
            run_production_date = record.get("production_date", now.date())
            # Convert date to naive datetime for TIMESTAMP WITHOUT TIME ZONE
            if isinstance(run_production_date, date) and not isinstance(run_production_date, datetime):
                run_production_date = datetime.combine(run_production_date, time.min)
            elif isinstance(run_production_date, datetime):
                run_production_date = run_production_date.replace(tzinfo=None)

            run_payload = run_data_base.copy()
            run_payload.update({
                "id": new_id,
                "factory_id": factory_id,
                "order_id": order.id,
                "data_source_id": data_source_id,
                "source_import_id": raw_import_id,
                "production_date": run_production_date,
                "shift": shift,
                "planned_qty": record.get("planned_qty", 0),
                "created_at": now,
            })
            result["run_insert"] = run_payload

            # Create initial event
            result["event"] = {
                "id": str(uuid.uuid4()),
                "production_run_id": new_id,
                "data_source_id": data_source_id,
                "order_id": order.id,
                "style_id": style.id,
                "timestamp": datetime.combine(p_date, time(12, 0)).replace(
                    tzinfo=timezone.utc
                ),
                "event_type": EventType.BATCH_UPLOAD.value,
                "quantity": new_qty,
                "source_import_id": raw_import_id,
                "raw_data": {"row": idx, "logic": "initial_insert"},
            }

            # Efficiency metric (only for new runs)
            actual_qty = Decimal(str(new_qty))
            sam_val = Decimal(str(run_sam))
            earned = actual_qty * sam_val
            worked_mins = Decimal(str(record.get("worked_minutes", 0)))
            manpower = Decimal(
                str(record.get("operators_present", 0) + record.get("helpers_present", 0))
            )
            available = worked_mins * manpower
            eff = (earned / available * 100) if available > 0 else Decimal(0)

            result["efficiency"] = {
                "id": str(uuid.uuid4()),
                "production_run_id": new_id,
                "efficiency_pct": eff,
                "sam_target": available,
                "sam_actual": earned,
                "calculated_at": now,
                "created_at": now,
                "updated_at": now,
            }

            # Quality inspection (always for new runs)
            result["quality"] = {
                "id": str(uuid.uuid4()),
                "production_run_id": new_id,
                "inspection_type": InspectionType.ENDLINE,
                "units_checked": new_qty,
                "defects_found": int(float(record.get("defects", 0))),
                "dhu": Decimal(str(record.get("dhu", 0))) if record.get("dhu") else None,
                "inspected_at": now,
                "created_at": now,
                "updated_at": now,
            }

        return result

    async def _execute_writes(
        self,
        runs_to_insert: list[dict],
        runs_to_update: list[dict],
        production_events: list[dict],
        efficiency_metrics: list[dict],
        quality_inspections: list[dict],
        quality_issues: list[dict],
    ) -> dict[str, str]:
        """
        Execute all database writes atomically.
        
        CRITICAL: Uses RETURNING to get actual IDs from UPSERT operations,
        then remaps child records (events, metrics, quality) to use the
        real IDs (which may differ from proposed IDs on conflict resolution).
        
        Returns:
            Dict mapping proposed_id -> actual_id for all runs
        """
        id_map: dict[str, str] = {}  # proposed_id -> actual_id
        
        try:
            # 1. Insert new runs (with UPSERT + RETURNING)
            if runs_to_insert:
                logger.info(f"Inserting/Upserting {len(runs_to_insert)} runs...")
                for idx, row in enumerate(runs_to_insert):
                    proposed_id = row["id"]
                    try:
                        stmt = pg_insert(ProductionRun).values([row])
                        stmt = stmt.on_conflict_do_update(
                            constraint="uq_production_run",
                            set_={
                                "actual_qty": stmt.excluded.actual_qty,
                                "planned_qty": stmt.excluded.planned_qty,
                                "sam": stmt.excluded.sam,
                                "shift": stmt.excluded.shift,
                                "operators_present": stmt.excluded.operators_present,
                                "helpers_present": stmt.excluded.helpers_present,
                                "worked_minutes": stmt.excluded.worked_minutes,
                                "downtime_minutes": stmt.excluded.downtime_minutes,
                                "downtime_reason": stmt.excluded.downtime_reason,
                                "updated_at": stmt.excluded.updated_at,
                                "source_import_id": stmt.excluded.source_import_id,
                                "lot_number": stmt.excluded.lot_number,
                                "shade_band": stmt.excluded.shade_band,
                                "batch_number": stmt.excluded.batch_number,
                                # DENORMALIZED FIELDS
                                "start_time": stmt.excluded.start_time,
                                "end_time": stmt.excluded.end_time,
                                "style_number": stmt.excluded.style_number,
                                "buyer": stmt.excluded.buyer,
                                "season": stmt.excluded.season,
                                "po_number": stmt.excluded.po_number,
                                "color": stmt.excluded.color,
                                "size": stmt.excluded.size,
                                "defects": stmt.excluded.defects,
                                "dhu": stmt.excluded.dhu,
                                "line_efficiency": stmt.excluded.line_efficiency,
                            }
                        ).returning(ProductionRun.id)
                        
                        result = await self.db.execute(stmt)
                        actual_id = result.scalar_one()
                        id_map[proposed_id] = actual_id
                        
                        if proposed_id != actual_id:
                            logger.info(f"UPSERT conflict: {proposed_id} -> {actual_id}")
                            
                    except Exception as e:
                        logger.error(f"❌ CRASH ON ProductionRun UPSERT (Row {idx})")
                        logger.error(f"DATA: {row}")
                        logger.error(f"ERROR: {e}")
                        raise

            # 2. Update existing runs (these already have correct IDs)
            if runs_to_update:
                logger.info(f"Updating {len(runs_to_update)} existing runs...")
                try:
                    await self.db.execute(update(ProductionRun), runs_to_update)
                    # Map updates to themselves (ID doesn't change)
                    for row in runs_to_update:
                        id_map[row["id"]] = row["id"]
                except Exception as e:
                    logger.error(f"❌ CRASH ON ProductionRun UPDATE")
                    logger.error(f"DATA (first 3): {runs_to_update[:3]}")
                    logger.error(f"ERROR: {e}")
                    raise

            # CRITICAL: Flush to make ProductionRuns visible for FK constraints
            if runs_to_insert or runs_to_update:
                logger.info("Flushing ProductionRun writes before inserting children...")
                await self.db.flush()

            # 3. REMAP child records to use actual IDs
            def remap_run_id(records: list[dict], field: str = "production_run_id") -> list[dict]:
                """Replace proposed IDs with actual IDs from database."""
                remapped = []
                for rec in records:
                    proposed = rec.get(field)
                    if proposed and proposed in id_map:
                        rec = rec.copy()
                        rec[field] = id_map[proposed]
                    remapped.append(rec)
                return remapped

            production_events = remap_run_id(production_events)
            efficiency_metrics = remap_run_id(efficiency_metrics)
            quality_inspections = remap_run_id(quality_inspections)

            # 4. Insert events
            if production_events:
                logger.info(f"Inserting {len(production_events)} events...")
                for i in range(0, len(production_events), BATCH_SIZE):
                    batch = production_events[i : i + BATCH_SIZE]
                    try:
                        await self.db.execute(pg_insert(ProductionEvent).values(batch))
                    except Exception as e:
                        logger.error(f"❌ CRASH ON ProductionEvent INSERT (Batch {i // BATCH_SIZE})")
                        logger.error(f"DATA (first record): {batch[0] if batch else 'empty'}")
                        logger.error(f"ERROR: {e}")
                        raise

            # 5. Insert/Update efficiency metrics (UPSERT to handle existing runs)
            if efficiency_metrics:
                logger.info(f"Upserting {len(efficiency_metrics)} efficiency metrics...")
                for i in range(0, len(efficiency_metrics), BATCH_SIZE):
                    batch = efficiency_metrics[i : i + BATCH_SIZE]
                    try:
                        stmt = pg_insert(EfficiencyMetric).values(batch)
                        stmt = stmt.on_conflict_do_update(
                            index_elements=["production_run_id"],
                            set_={
                                "efficiency_pct": stmt.excluded.efficiency_pct,
                                "sam_target": stmt.excluded.sam_target,
                                "sam_actual": stmt.excluded.sam_actual,
                                "calculated_at": stmt.excluded.calculated_at,
                                "updated_at": stmt.excluded.updated_at,
                            }
                        )
                        await self.db.execute(stmt)
                    except Exception as e:
                        logger.error(f"❌ CRASH ON EfficiencyMetric UPSERT (Batch {i // BATCH_SIZE})")
                        logger.error(f"DATA (first record): {batch[0] if batch else 'empty'}")
                        logger.error(f"ERROR: {e}")
                        raise

            # 6. Insert/Update quality inspections (UPSERT to handle existing runs)
            if quality_inspections:
                logger.info(f"Upserting {len(quality_inspections)} quality inspections...")
                for i in range(0, len(quality_inspections), BATCH_SIZE):
                    batch = quality_inspections[i : i + BATCH_SIZE]
                    try:
                        stmt = pg_insert(QualityInspection).values(batch)
                        stmt = stmt.on_conflict_do_update(
                            index_elements=["production_run_id"],
                            set_={
                                "units_checked": stmt.excluded.units_checked,
                                "defects_found": stmt.excluded.defects_found,
                                "dhu": stmt.excluded.dhu,
                                "inspected_at": stmt.excluded.inspected_at,
                                "updated_at": stmt.excluded.updated_at,
                            }
                        )
                        await self.db.execute(stmt)
                    except Exception as e:
                        logger.error(f"❌ CRASH ON QualityInspection UPSERT (Batch {i // BATCH_SIZE})")
                        logger.error(f"DATA (first record): {batch[0] if batch else 'empty'}")
                        logger.error(f"ERROR: {e}")
                        raise

            # 6. Insert data quality issues
            if quality_issues:
                logger.info(f"Persisting {len(quality_issues)} data quality issues...")
                for i in range(0, len(quality_issues), BATCH_SIZE):
                    batch = quality_issues[i : i + BATCH_SIZE]
                    try:
                        await self.db.execute(pg_insert(DataQualityIssue).values(batch))
                    except Exception as e:
                        logger.error(f"❌ CRASH ON DataQualityIssue INSERT (Batch {i // BATCH_SIZE})")
                        logger.error(f"DATA (first record): {batch[0] if batch else 'empty'}")
                        logger.error(f"ERROR: {e}")
                        raise

            return id_map

        except Exception as e:
            # Rollback to reset transaction state before re-raising
            logger.error("Rolling back transaction due to write failure...")
            await self.db.rollback()
            raise
