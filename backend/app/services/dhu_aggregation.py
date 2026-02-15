# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
DHU Aggregation Service.
Computes and stores DHUReport records from QualityInspection data.
Runs as a scheduled job for optimal scalability.
"""

import json
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import PeriodType
from app.models.analytics import DHUReport
from app.models.production import ProductionRun
from app.models.quality import Defect, QualityInspection

logger = logging.getLogger(__name__)


async def aggregate_dhu_for_date(
    db: AsyncSession,
    target_date: date,
    factory_id: str | None = None,
) -> list[dict[str, Any]]:
    """
    Aggregate DHU data for a specific date.

    Groups by factory and computes:
    - avg_dhu: Average DHU across all inspections
    - min_dhu / max_dhu: Range
    - total_inspected / total_defects / total_rejected
    - top_defects: Most common defect types (JSON)

    Returns list of aggregated results per factory.
    """
    # Base query: Join QualityInspection -> ProductionRun -> Factory
    # Filter by production_date matching target_date
    base_query = (
        select(
            ProductionRun.factory_id,
            func.avg(QualityInspection.dhu).label("avg_dhu"),
            func.min(QualityInspection.dhu).label("min_dhu"),
            func.max(QualityInspection.dhu).label("max_dhu"),
            func.sum(QualityInspection.units_checked).label("total_inspected"),
            func.sum(QualityInspection.defects_found).label("total_defects"),
            func.sum(QualityInspection.units_rejected).label("total_rejected"),
        )
        .join(ProductionRun, QualityInspection.production_run_id == ProductionRun.id)
        .where(ProductionRun.production_date == target_date)
        .where(QualityInspection.dhu.is_not(None))
        .group_by(ProductionRun.factory_id)
    )

    if factory_id:
        base_query = base_query.where(ProductionRun.factory_id == factory_id)

    result = await db.execute(base_query)
    rows = result.all()

    aggregations = []
    for row in rows:
        factory_id_val = row[0]

        # Get top defects for this factory and date
        defect_query = (
            select(
                Defect.defect_type,
                func.sum(Defect.count).label("count"),
            )
            .join(QualityInspection, Defect.inspection_id == QualityInspection.id)
            .join(
                ProductionRun, QualityInspection.production_run_id == ProductionRun.id
            )
            .where(ProductionRun.production_date == target_date)
            .where(ProductionRun.factory_id == factory_id_val)
            .group_by(Defect.defect_type)
            .order_by(func.sum(Defect.count).desc())
            .limit(5)
        )
        defect_result = await db.execute(defect_query)
        defect_rows = defect_result.all()

        total_defects = row[4] or 0
        top_defects = []
        for defect_row in defect_rows:
            pct = (defect_row[1] / total_defects * 100) if total_defects > 0 else 0
            top_defects.append(
                {
                    "type": defect_row[0],
                    "count": int(defect_row[1]),
                    "pct": round(pct, 1),
                }
            )

        aggregations.append(
            {
                "factory_id": factory_id_val,
                "report_date": target_date,
                "period_type": PeriodType.DAILY,
                "avg_dhu": Decimal(str(round(row[1] or 0, 2))),
                "min_dhu": Decimal(str(round(row[2] or 0, 2))),
                "max_dhu": Decimal(str(round(row[3] or 0, 2))),
                "total_inspected": int(row[4] or 0),
                "total_defects": int(row[5] or 0),
                "total_rejected": int(row[6] or 0),
                "top_defects": json.dumps(top_defects) if top_defects else None,
            }
        )

    return aggregations


async def upsert_dhu_reports(
    db: AsyncSession,
    aggregations: list[dict[str, Any]],
) -> int:
    """
    Insert or update DHUReport records.
    Uses MySQL upsert (INSERT ... ON DUPLICATE KEY UPDATE).

    Returns count of records upserted.
    """
    if not aggregations:
        return 0

    count = 0
    for agg in aggregations:
        # Try to find existing report
        existing_query = select(DHUReport).where(
            DHUReport.factory_id == agg["factory_id"],
            DHUReport.report_date == agg["report_date"],
            DHUReport.period_type == agg["period_type"],
        )
        result = await db.execute(existing_query)
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing
            existing.avg_dhu = agg["avg_dhu"]
            existing.min_dhu = agg["min_dhu"]
            existing.max_dhu = agg["max_dhu"]
            existing.total_inspected = agg["total_inspected"]
            existing.total_defects = agg["total_defects"]
            existing.total_rejected = agg["total_rejected"]
            existing.top_defects = agg["top_defects"]
        else:
            # Create new
            report = DHUReport(**agg)
            db.add(report)

        count += 1

    await db.commit()
    return count


async def run_dhu_aggregation(
    db: AsyncSession,
    days_back: int = 7,
    factory_id: str | None = None,
) -> dict[str, Any]:
    """
    Main entry point for DHU aggregation job.

    Aggregates DHU data for the last N days and upserts reports.

    Args:
        db: Database session
        days_back: Number of days to look back (default 7)
        factory_id: Optional filter for specific factory

    Returns:
        Summary of aggregation results
    """
    from datetime import timezone

    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=days_back - 1)

    total_upserted = 0
    dates_processed = []

    current = start_date
    while current <= today:
        try:
            aggregations = await aggregate_dhu_for_date(db, current, factory_id)
            count = await upsert_dhu_reports(db, aggregations)
            total_upserted += count
            if count > 0:
                dates_processed.append(current.isoformat())
            logger.info(f"DHU aggregation for {current}: {count} reports upserted")
        except Exception as e:
            logger.error(f"DHU aggregation failed for {current}: {e}")

        current += timedelta(days=1)

    return {
        "status": "completed",
        "days_processed": days_back,
        "reports_upserted": total_upserted,
        "dates_with_data": dates_processed,
        "timestamp": datetime.utcnow().isoformat(),
    }
