"""
Analytics Service - Centralized logic for manufacturing metrics.
Source of Truth for: Efficiency, Earned Minutes, and Physics Validation.
Fixes the '1700% Bug' by enforcing strict weighted aggregation rules.
"""

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.production import Order, ProductionRun

logger = get_logger(__name__)


class AnalyticsService:
    """
    Central logic for manufacturing metrics.
    Source of Truth for: Efficiency, Earned Minutes, and Physics Validation.
    """

    def __init__(self, db: AsyncSession | None = None):
        self.db = db

    # --- CORE FORMULAS (The Source of Truth) ---

    @staticmethod
    def calculate_earned_minutes(produced_qty: int, sam: float) -> float:
        """Core formula: Units * SAM"""
        return float(produced_qty) * float(sam)

    @staticmethod
    def calculate_available_minutes(
        operators: int, helpers: int, minutes_worked: int
    ) -> float:
        """Core formula: (Operators + Helpers) * Shift Duration"""
        total_headcount = (operators or 0) + (helpers or 0)
        return float(total_headcount) * float(minutes_worked)

    @staticmethod
    def calculate_efficiency(earned_minutes: float, available_minutes: float) -> float:
        """
        Weighted Efficiency = Sum(Earned) / Sum(Available).
        Prevents the 'averaging averages' bug.
        """
        if available_minutes <= 0:
            return 0.0
        return round((earned_minutes / available_minutes) * 100, 2)

    @classmethod
    def aggregate_production_stats(cls, logs: list[Any]) -> dict[str, Any]:
        """
        Aggregates a list of production logs (SQLAlchemy models or dicts)
        to return a weighted efficiency score.
        """
        total_earned = 0.0
        total_available = 0.0
        total_qty = 0

        for log in logs:
            # Handle both dicts and ORM objects safely (mapping to ProductionRun fields)
            qty = (
                getattr(log, "actual_qty", 0)
                if not isinstance(log, dict)
                else log.get("actual_qty", 0)
            )
            sam = (
                getattr(log, "sam", 0.0)
                if not isinstance(log, dict)
                else log.get("sam", 0.0)
            )
            ops = (
                getattr(log, "operators_present", 0)
                if not isinstance(log, dict)
                else log.get("operators_present", 0)
            )
            helpers = (
                getattr(log, "helpers_present", 0)
                if not isinstance(log, dict)
                else log.get("helpers_present", 0)
            )
            worked = (
                getattr(log, "worked_minutes", 0.0)
                if not isinstance(log, dict)
                else log.get("worked_minutes", 0.0)
            )

            earned = cls.calculate_earned_minutes(qty, sam)
            available = cls.calculate_available_minutes(ops, helpers, worked)

            total_earned += earned
            total_available += available
            total_qty += int(qty)

        efficiency = cls.calculate_efficiency(total_earned, total_available)

        return {
            "total_produced": total_qty,
            "total_earned_minutes": round(total_earned, 2),
            "total_available_minutes": round(total_available, 2),
            "weighted_efficiency": efficiency,
        }

    @staticmethod
    def validate_production_physics(log_data: dict[str, Any]) -> list[str]:
        """
        Returns a list of warnings if the data violates physical possibilities.
        Prevents the '1700% Efficiency' anomalies.
        """
        warnings = []

        qty = log_data.get("actual_qty", 0) or 0
        sam = log_data.get("sam") or log_data.get("base_sam") or 0.0
        ops = log_data.get("operators_present", 0) or 0
        helpers = log_data.get("helpers_present", 0) or 0
        worked = log_data.get("worked_minutes", 0.0) or 0.0

        if qty < 0:
            warnings.append("Quantity cannot be negative.")

        # Physics Check 1: Impossible Efficiency (>150%)
        earned = float(qty) * float(sam)
        available = float(ops + helpers) * float(worked)

        if available > 0:
            eff = (earned / available) * 100
            if eff > 150:
                warnings.append(
                    f"Efficiency Suspiciously High: {eff:.1f}% (Limit: 150%)"
                )
            if eff > 1000:
                warnings.append(
                    "CRITICAL: Extreme anomaly detected (Possible cumulative data upload)."
                )

        return warnings

    # --- ASYNC DATA ACCESS METHODS (For FastAPI Endpoints) ---

    async def get_aggregated_stats(
        self, line_id: str | None, start_date: date, end_date: date
    ) -> dict[str, Any]:
        """
        Database-backed version of aggregate_production_stats for a specific date range.
        Used by the dashboard overview.
        """
        if not self.db:
            raise ValueError("Database session required for this method.")

        # Build query with OPTIONAL line_id filter
        query = select(ProductionRun).where(
            func.date(ProductionRun.production_date) >= start_date,
            func.date(ProductionRun.production_date) <= end_date,
        )

        # Only add line_id filter if explicitly provided
        if line_id:
            query = query.where(ProductionRun.data_source_id == line_id)

        result = await self.db.execute(query)
        logs = result.scalars().all()

        stats = self.aggregate_production_stats(logs)

        # Add a flag for UI
        stats["is_suspicious"] = stats["weighted_efficiency"] > 150

        return stats

    async def get_target_realization(
        self,
        line_id: str | None = None,
        reference_date: date | None = None,
    ) -> dict[str, Any]:
        """
        Get target realization stats (Actual vs Planned) for a specific date.
        """
        if reference_date:
            ref_date = reference_date
        else:
            from datetime import timezone

            ref_date = datetime.now(timezone.utc).date()

        query = select(
            func.sum(ProductionRun.actual_qty).label("actual"),
            func.sum(ProductionRun.planned_qty).label("target"),
        ).where(func.date(ProductionRun.production_date) == ref_date)

        if line_id:
            query = query.where(ProductionRun.data_source_id == line_id)

        result = await self.db.execute(query)
        stats = result.one()

        actual = int(stats.actual or 0)
        target = int(stats.target or 0)
        percentage = round((actual / target * 100), 1) if target > 0 else 0.0
        delta = actual - target

        return {
            "actual": actual,
            "target": target,
            "percentage": percentage,
            "delta": delta,
            "variance": delta,  # Actual - Target
            "is_mock": False,
        }

    async def get_complexity_analysis(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        line_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Analyze correlation between Style Complexity (SAM) and Efficiency.
        Returns: [{ name, sam, efficiency, volume }]
        """
        if not self.db:
            return []

        try:
            # 1. Resolve date range (default to today if not provided)
            # Since we calculate efficiency which requires headcount/worked_minutes,
            # we need to join ProductionRun with Order/Style.

            from app.models.production import Order

            query = (
                select(ProductionRun)
                .options(selectinload(ProductionRun.order).selectinload(Order.style))
                .where(ProductionRun.worked_minutes > 0)
            )

            if line_id:
                query = query.where(ProductionRun.data_source_id == line_id)

            if start_time:
                query = query.where(ProductionRun.production_date >= start_time.date())
            if end_time:
                query = query.where(ProductionRun.production_date <= end_time.date())

            result = await self.db.execute(query)
            runs = result.scalars().all()

            # 2. Group by Style
            style_stats = {}
            for run in runs:
                if not run.order or not run.order.style:
                    continue

                name = run.order.style.style_name or run.order.style.style_number
                # Use the Run's recorded SAM (or Style's base SAM)
                sam = float(run.sam or run.order.style.base_sam or 0)

                if name not in style_stats:
                    style_stats[name] = {
                        "total_earned": 0.0,
                        "total_available": 0.0,
                        "sam": sam,
                        "volume": 0,
                    }

                earned = self.calculate_earned_minutes(run.actual_qty, sam)
                available = self.calculate_available_minutes(
                    run.operators_present, run.helpers_present, run.worked_minutes
                )

                style_stats[name]["total_earned"] += earned
                style_stats[name]["total_available"] += available
                style_stats[name]["volume"] += run.actual_qty or 0

            # 3. Format for Scatter Plot
            results = []
            for name, stats in style_stats.items():
                if stats["total_available"] > 0:
                    eff = (stats["total_earned"] / stats["total_available"]) * 100
                    results.append(
                        {
                            "name": name,
                            "sam": round(stats["sam"], 2),  # X-Axis
                            "efficiency": round(eff, 1),  # Y-Axis
                            "volume": stats["volume"],  # Z-Axis (Bubble size)
                        }
                    )

            return results

        except Exception as e:
            logger.error(f"Error calculating complexity analysis: {e}")
            return []

    async def get_sam_performance_metrics(
        self,
        line_id: str | None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        """
        Get SAM performance metrics for a date range and its trend.
        Used by the SAM Performance Widget.
        """
        # Default to today if no dates
        from datetime import timezone

        if not end_date:
            end_date = datetime.now(timezone.utc).date()
        if not start_date:
            start_date = end_date

        # Calculate duration of the period
        duration = (end_date - start_date).days + 1
        
        # Calculate Previous Period (Same duration immediately before)
        prev_end = start_date - timedelta(days=1)
        prev_start = prev_end - timedelta(days=duration - 1)

        current = await self.get_aggregated_stats(line_id, start_date, end_date)
        prev = await self.get_aggregated_stats(line_id, prev_start, prev_end)

        eff_change = current["weighted_efficiency"] - prev["weighted_efficiency"]

        # Avg SAM per hour
        avg_sam_hr = 0.0
        if current["total_available_minutes"] > 0:
            avg_sam_hr = current["total_earned_minutes"] / (
                current["total_available_minutes"] / 60
            )

        # --- BREAKDOWN BY STYLE ---
        breakdown = []
        if self.db:
            try:
                # Query production runs with eager-loaded order->style relationships
                query = (
                    select(ProductionRun)
                    .options(
                        selectinload(ProductionRun.order).selectinload(Order.style)
                    )
                    .where(
                        func.date(ProductionRun.production_date) >= start_date,
                        func.date(ProductionRun.production_date) <= end_date,
                    )
                )

                # Only add line_id filter if explicitly provided
                if line_id:
                    query = query.where(ProductionRun.data_source_id == line_id)

                result = await self.db.execute(query)
                runs = result.scalars().all()

                # Group by style
                style_data: dict[str, dict[str, float]] = {}
                for run in runs:
                    style_name = "Unknown"
                    style_sam = 0.0
                    if run.order and run.order.style:
                        style_name = (
                            run.order.style.style_number
                            or run.order.style.style_name
                            or "Unknown"
                        )
                        style_sam = float(run.order.style.base_sam or 0)

                    if style_name not in style_data:
                        style_data[style_name] = {
                            "earned": 0.0,
                            "available": 0.0,
                            "base_sam": style_sam,
                        }

                    qty = run.actual_qty or 0
                    sam = float(run.sam or 0)
                    ops = run.operators_present or 0
                    helpers = run.helpers_present or 0
                    worked = float(run.worked_minutes or 0)

                    style_data[style_name]["earned"] += self.calculate_earned_minutes(
                        qty, sam
                    )
                    style_data[style_name]["available"] += (
                        self.calculate_available_minutes(ops, helpers, worked)
                    )

                # Build breakdown array for chart
                for name, data in style_data.items():
                    earned = data["earned"]
                    available = data["available"]
                    efficiency = self.calculate_efficiency(earned, available)

                    # 'standard' represents expected earned minutes at 100% efficiency
                    # Use actual available minutes as the target baseline
                    standard = round(available, 0) if available > 0 else 400

                    breakdown.append(
                        {
                            "name": name[:12],  # Truncate for chart readability
                            "actual": round(earned, 0),
                            "standard": standard,
                            "efficiency": efficiency,
                        }
                    )

                # Sort by earned (descending) and limit to top 5 for chart readability
                breakdown = sorted(breakdown, key=lambda x: x["actual"], reverse=True)[
                    :5
                ]

            except Exception as e:
                logger.warning(f"Failed to calculate breakdown: {e}")
                breakdown = []

        return {
            "efficiency": current["weighted_efficiency"],
            "efficiency_change": round(eff_change, 2),
            "avg_sam_per_hour": round(avg_sam_hr, 2),
            "total_sam": int(current["total_earned_minutes"]),
            "is_suspicious": current["is_suspicious"],
            "is_mock": False,
            "breakdown": breakdown,
        }
