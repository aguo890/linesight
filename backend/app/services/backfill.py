import logging
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import EfficiencyMetric
from app.models.production import ProductionRun
from app.services.dhu_aggregation import run_dhu_aggregation

logger = logging.getLogger(__name__)


class BackfillService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def recalculate_metrics(self, days_back: int = 30) -> dict:
        """
        Finds ProductionRuns without EfficiencyMetrics in the last N days
        and calculates them. Then triggers DHU aggregation.
        """
        from datetime import timezone

        start_date = datetime.now(timezone.utc).date() - timedelta(days=days_back)

        # 1. Find ProductionRuns missing EfficiencyMetric
        # Left join EfficiencyMetric where id is null
        query = (
            select(ProductionRun)
            .outerjoin(EfficiencyMetric, ProductionRun.efficiency_metric)
            .where(
                ProductionRun.production_date >= start_date,
                EfficiencyMetric.id.is_(None),
            )
        )

        result = await self.db.execute(query)
        runs = result.scalars().all()

        recalculated_count = 0
        factories_touched = set()

        for run in runs:
            # Calculate Efficiency
            earned = (
                Decimal(str(run.earned_minutes)) if run.earned_minutes else Decimal(0)
            )
            worked = (
                Decimal(str(run.worked_minutes)) if run.worked_minutes else Decimal(0)
            )
            eff_pct = (earned / worked * 100) if worked > 0 else Decimal(0)

            metric = EfficiencyMetric(
                production_run_id=run.id,
                efficiency_pct=eff_pct,
                sam_target=worked,
                sam_actual=earned,
                calculated_at=datetime.utcnow(),
            )
            self.db.add(metric)
            recalculated_count += 1
            if run.factory_id:
                factories_touched.add(run.factory_id)

        await self.db.commit()

        # 2. Trigger DHU Aggregation for affected factories
        # We'll just run it for the whole period for simplicity to ensure coverage
        dhu_upserted = 0
        for factory_id in factories_touched:
            try:
                res = await run_dhu_aggregation(
                    self.db, days_back=days_back, factory_id=factory_id
                )
                dhu_upserted += res.get("reports_upserted", 0)
            except Exception as e:
                logger.error(f"Failed to backfill DHU for factory {factory_id}: {e}")

        return {
            "status": "completed",
            "runs_recalculated": recalculated_count,
            "dhu_reports_updated": dhu_upserted,
            "period_days": days_back,
        }
