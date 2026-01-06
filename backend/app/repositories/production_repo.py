"""
Production Repository - Data Access Layer for Production Domain.

Encapsulates all database queries related to production runs, orders, and styles.
Separates data access logic from business logic for better testability and maintainability.
"""

from datetime import date, datetime, timezone

try:
    from zoneinfo import ZoneInfo
except ImportError:
    pass
from decimal import Decimal

from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import EfficiencyMetric
from app.models.events import ProductionEvent
from app.models.factory import Factory, ProductionLine
from app.models.production import Order, ProductionRun, Style


class ProductionRepository:
    """Repository for production-related data access operations."""

    def __init__(self, db: AsyncSession):
        """
        Initialize the repository with a database session.

        Args:
            db: Async SQLAlchemy session
        """
        self.db = db

    async def get_daily_output(
        self,
        line_id: str,
        date_obj: date,
    ) -> int:
        """
        Get total output for a specific production line on a given date.

        Args:
            line_id: Production line ID
            date_obj: Date to query

        Returns:
            Total actual quantity produced
        """
        query = select(func.sum(ProductionRun.actual_qty)).where(
            ProductionRun.line_id == line_id,
            func.date(ProductionRun.production_date) == date_obj,
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_production_chart_data(
        self,
        start_date: date,
        end_date: date,
        line_id: str | None = None,
    ) -> list[dict]:
        """
        Get aggregated production data for chart visualization.

        Args:
            start_date: Start date for the range
            end_date: End date for the range
            line_id: Optional production line filter

        Returns:
            List of dictionaries with production_date, actual, and target values
        """
        query = (
            select(
                func.date(ProductionRun.production_date).label("production_date"),
                func.sum(ProductionRun.actual_qty).label("actual"),
                func.sum(ProductionRun.planned_qty).label("target"),
            )
            .where(func.date(ProductionRun.production_date) >= start_date)
            .where(func.date(ProductionRun.production_date) <= end_date)
            .group_by(func.date(ProductionRun.production_date))
            .order_by(func.date(ProductionRun.production_date))
        )

        if line_id:
            query = query.where(ProductionRun.line_id == line_id)

        result = await self.db.execute(query)
        rows = result.all()

        def parse_date(d):
            if isinstance(d, str):
                return datetime.strptime(d, "%Y-%m-%d").date()
            return d

        return [
            {
                "production_date": parse_date(row[0]),
                "actual": row.actual or 0,
                "target": row.target or 0,
            }
            for row in rows
        ]

    async def get_overview_stats(
        self,
        today: date,
        yesterday: date,
        line_id: str | None = None,
    ) -> dict:
        """
        Get aggregated overview statistics for dashboard.

        Args:
            today: Today's date
            yesterday: Yesterday's date
            line_id: Optional production line filter

        Returns:
            Dictionary with output and efficiency stats for today and yesterday
        """

    async def get_effective_date(
        self, line_id: str | None = None, timezone_str: str = "UTC"
    ) -> date:
        """
        Get the most recent date with production data, defaulting to 'Today' in the specific Timezone.

        Args:
            line_id: Optional production line filter
            timezone_str: IANA timezone string (e.g. 'Asia/Tokyo', 'America/New_York')

        Returns:
            The most recent production date found, or today (Factory Time) if no data exists.
        """
        # 0. Auto-detect timezone from Line ID if provided and default was used
        if line_id and timezone_str == "UTC":
            tz_query = (
                select(Factory.timezone)
                .join(ProductionLine, ProductionLine.factory_id == Factory.id)
                .where(ProductionLine.id == line_id)
            )
            res_tz = await self.db.execute(tz_query)
            fetched_tz = res_tz.scalar()
            if fetched_tz:
                timezone_str = fetched_tz

        from datetime import time, timedelta

        try:
            from zoneinfo import ZoneInfo
        except ImportError:
            from backports.zoneinfo import ZoneInfo

        try:
            FACTORY_TZ = ZoneInfo(timezone_str)
        except Exception:
            # Fallback if invalid timezone string provided
            FACTORY_TZ = ZoneInfo("UTC")

        # 1. Get truly "Today" relative to the factory context
        now_utc = datetime.now(timezone.utc)
        factory_time = now_utc.astimezone(FACTORY_TZ)
        today = factory_time.date()

        # Define "Today" range in UTC
        start_of_day_factory = datetime.combine(today, time.min).replace(
            tzinfo=FACTORY_TZ
        )
        # Use next day for exclusive upper bound
        start_of_next_day_utc = (start_of_day_factory + timedelta(days=1)).astimezone(
            timezone.utc
        )
        start_of_day_utc = start_of_day_factory.astimezone(timezone.utc)

        # 2. Check if we have data for 'today' (favoring Events, then Runs)
        # Check Events using UTC Range
        check_events = select(func.count(ProductionEvent.id)).where(
            ProductionEvent.timestamp >= start_of_day_utc,
            ProductionEvent.timestamp < start_of_next_day_utc,
        )
        if line_id:
            check_events = check_events.where(ProductionEvent.line_id == line_id)

        res_events = await self.db.execute(check_events)
        if (res_events.scalar() or 0) > 0:
            return today

        # Check Runs (Legacy) - ProductionRun.production_date is already a Date (Factory/Business Date)
        check_runs = select(func.count(ProductionRun.id)).where(
            func.date(ProductionRun.production_date) == today
        )
        if line_id:
            check_runs = check_runs.where(ProductionRun.line_id == line_id)

        res_runs = await self.db.execute(check_runs)
        if (res_runs.scalar() or 0) > 0:
            return today

        # 3. If no data for today, find the latest available date

        # Latest Event Timestamp (UTC) -> Convert to Factory Date
        latest_event_q = select(func.max(ProductionEvent.timestamp))
        if line_id:
            latest_event_q = latest_event_q.where(ProductionEvent.line_id == line_id)
        res_latest_event = await self.db.execute(latest_event_q)
        latest_ts = res_latest_event.scalar()

        latest_event_date = None
        if latest_ts:
            # Ensure UTC awareness (SQLAlchemy/Driver nuance)
            if latest_ts.tzinfo is None:
                latest_ts = latest_ts.replace(tzinfo=timezone.utc)
            latest_event_date = latest_ts.astimezone(FACTORY_TZ).date()

        # Latest Run Date (Already Factory Date)
        latest_run_q = select(func.max(func.date(ProductionRun.production_date)))
        if line_id:
            latest_run_q = latest_run_q.where(ProductionRun.line_id == line_id)
        res_latest_run = await self.db.execute(latest_run_q)
        latest_run_date = res_latest_run.scalar()
        if isinstance(latest_run_date, str):
            latest_run_date = datetime.strptime(latest_run_date, "%Y-%m-%d").date()

        # Compare and return
        if latest_event_date and latest_run_date:
            return max(latest_event_date, latest_run_date)
        elif latest_event_date:
            return latest_event_date
        elif latest_run_date:
            return latest_run_date

        return today

    async def get_overview_stats(
        self,
        today: date,
        yesterday: date,
        line_id: str | None = None,
    ) -> dict:
        """
        Get aggregated overview statistics for dashboard.

        Args:
            today: Today's date (reference)
            yesterday: Yesterday's date (reference)
            line_id: Optional production line filter

        Returns:
            Dictionary with output and efficiency stats for today and yesterday
        """
        # 1. Determine effective date (use helper)
        effective_today = await self.get_effective_date(line_id)
        effective_yesterday = yesterday  # Default

        if effective_today != today:
            # Calculate effective yesterday relative to effective today
            from datetime import timedelta

            effective_yesterday = effective_today - timedelta(days=1)
        else:
            # Re-ensure yesterday is valid relative to today (simple sanity check)
            from datetime import timedelta

            effective_yesterday = today - timedelta(days=1)

        # 3. Consolidated Output and Efficiency (Effective Today vs Effective Yesterday)
        stats_query = (
            select(
                func.sum(
                    case(
                        (
                            ProductionRun.production_date == effective_today,
                            ProductionRun.actual_qty,
                        ),
                        else_=0,
                    )
                ).label("output_today"),
                func.sum(
                    case(
                        (
                            ProductionRun.production_date == effective_yesterday,
                            ProductionRun.actual_qty,
                        ),
                        else_=0,
                    )
                ).label("output_yesterday"),
                func.avg(
                    case(
                        (
                            ProductionRun.production_date == effective_today,
                            EfficiencyMetric.efficiency_pct,
                        ),
                        else_=None,
                    )
                ).label("eff_today"),
                func.avg(
                    case(
                        (
                            ProductionRun.production_date == effective_yesterday,
                            EfficiencyMetric.efficiency_pct,
                        ),
                        else_=None,
                    )
                ).label("eff_yesterday"),
            )
            .outerjoin(
                EfficiencyMetric, EfficiencyMetric.production_run_id == ProductionRun.id
            )
            .where(
                ProductionRun.production_date.in_(
                    [effective_today, effective_yesterday]
                )
            )
        )

        # Apply line_id filter if provided
        if line_id:
            stats_query = stats_query.where(ProductionRun.line_id == line_id)

        result = await self.db.execute(stats_query)
        stats = result.one()

        return {
            "output_today": stats.output_today or 0,
            "output_yesterday": stats.output_yesterday or 0,
            "eff_today": stats.eff_today or Decimal("0"),
            "eff_yesterday": stats.eff_yesterday or Decimal("0"),
            "effective_date": effective_today,
        }

    async def create_run(self, run_data: dict) -> ProductionRun:
        """
        Create a new production run.

        Args:
            run_data: Dictionary containing production run data

        Returns:
            Created ProductionRun instance

        Note:
            Caller is responsible for committing the transaction
        """
        run = ProductionRun(**run_data)
        self.db.add(run)
        await self.db.flush()  # Flush but don't commit - let caller handle transactions
        return run

    async def get_run_by_id(self, run_id: str) -> ProductionRun | None:
        """
        Get a production run by ID.

        Args:
            run_id: Production run ID

        Returns:
            ProductionRun instance or None if not found
        """
        query = select(ProductionRun).where(ProductionRun.id == run_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_runs_by_line(
        self,
        line_id: str,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[ProductionRun]:
        """
        Get all production runs for a specific line.

        Args:
            line_id: Production line ID
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of ProductionRun instances
        """
        query = select(ProductionRun).where(ProductionRun.line_id == line_id)

        if start_date:
            query = query.where(func.date(ProductionRun.production_date) >= start_date)
        if end_date:
            query = query.where(func.date(ProductionRun.production_date) <= end_date)

        query = query.order_by(ProductionRun.production_date.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_runs_filtered(
        self,
        order_id: str | None = None,
        line_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        skip: int = 0,
        limit: int = 1000,
        sort_asc: bool = False,
    ) -> list[ProductionRun]:
        """List production runs with comprehensive filtering."""
        query = select(ProductionRun)
        if order_id:
            query = query.where(ProductionRun.order_id == order_id)
        if line_id:
            query = query.where(ProductionRun.line_id == line_id)
        if date_from:
            query = query.where(func.date(ProductionRun.production_date) >= date_from)
        if date_to:
            query = query.where(func.date(ProductionRun.production_date) <= date_to)

        order_clause = (
            ProductionRun.production_date.asc()
            if sort_asc
            else ProductionRun.production_date.desc()
        )
        query = query.offset(skip).limit(limit).order_by(order_clause)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_or_create_style(
        self, style_number: str, factory_id: str, defaults: dict | None = None
    ) -> Style:
        """
        Get a style by style_number or create it if it doesn't exist.

        Args:
            style_number: Style identification number
            factory_id: Factory ID
            defaults: Default values for creation

        Returns:
            Style instance
        """
        from sqlalchemy.exc import IntegrityError

        query = select(Style).where(
            Style.style_number == style_number, Style.factory_id == factory_id
        )
        result = await self.db.execute(query)
        style = result.scalars().first()

        if not style:
            style_data = {"style_number": style_number, "factory_id": factory_id}
            if defaults:
                style_data.update(defaults)
            style = Style(**style_data)
            self.db.add(style)
            try:
                await self.db.flush()
            except IntegrityError:
                # Race condition: another transaction inserted the same style
                # Rollback the failed statement and re-query
                await self.db.rollback()
                result = await self.db.execute(query)
                style = result.scalars().first()
                if not style:
                    # If still not found, re-raise the error
                    raise

        return style

    async def get_or_create_order(
        self, po_number: str, style_id: str, defaults: dict | None = None
    ) -> Order:
        """
        Get an order by po_number and style_id or create it if it doesn't exist.

        Args:
            po_number: Purchase order number
            style_id: Style UUID
            defaults: Default values for creation

        Returns:
            Order instance
        """
        query = select(Order).where(
            Order.po_number == po_number, Order.style_id == style_id
        )
        result = await self.db.execute(query)
        order = result.scalar_one_or_none()

        if not order:
            from app.enums import OrderPriority, OrderStatus

            order_data = {
                "po_number": po_number,
                "style_id": style_id,
                "quantity": 0,  # Default to 0 if not provided
                "status": OrderStatus.PENDING,
                "priority": OrderPriority.NORMAL,
            }
            if defaults:
                order_data.update(defaults)
            order = Order(**order_data)
            self.db.add(order)
            await self.db.flush()

        return order

    async def update_run(self, run_id: str, update_data: dict) -> ProductionRun | None:
        """Update a production run."""
        run = await self.get_run_by_id(run_id)
        if not run:
            return None

        for field, value in update_data.items():
            setattr(run, field, value)

        await self.db.flush()
        return run

    async def delete_run(self, run_id: str) -> bool:
        """Delete a production run."""
        run = await self.get_run_by_id(run_id)
        if not run:
            return False

        await self.db.delete(run)
        return True

    # =============================================================================
    # Styles Operations
    # =============================================================================

    async def get_styles(
        self,
        factory_id: str | None = None,
        buyer: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Style]:
        """List styles with filters."""
        query = select(Style)
        if factory_id:
            query = query.where(Style.factory_id == factory_id)
        if buyer:
            query = query.where(Style.buyer == buyer)

        query = query.offset(skip).limit(limit).order_by(desc(Style.created_at))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_style(self, style_data: dict) -> Style:
        """Create a new style."""
        style = Style(**style_data)
        self.db.add(style)
        await self.db.flush()
        return style

    async def get_style_by_id(self, style_id: str) -> Style | None:
        """Get style by ID."""
        query = select(Style).where(Style.id == style_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def update_style(self, style_id: str, update_data: dict) -> Style | None:
        """Update a style."""
        style = await self.get_style_by_id(style_id)
        if not style:
            return None

        for field, value in update_data.items():
            setattr(style, field, value)

        await self.db.flush()
        return style

    async def delete_style(self, style_id: str) -> bool:
        """Delete a style."""
        style = await self.get_style_by_id(style_id)
        if not style:
            return False

        await self.db.delete(style)
        return True

    # =============================================================================
    # Orders Operations
    # =============================================================================

    async def get_orders(
        self,
        style_id: str | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Order]:
        """List orders with filters."""
        query = select(Order)
        if style_id:
            query = query.where(Order.style_id == style_id)
        if status:
            query = query.where(Order.status == status)

        query = query.offset(skip).limit(limit).order_by(desc(Order.created_at))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_order(self, order_data: dict) -> Order:
        """Create a new order."""
        order = Order(**order_data)
        self.db.add(order)
        await self.db.flush()
        return order

    async def get_order_by_id(self, order_id: str) -> Order | None:
        """Get order by ID."""
        query = select(Order).where(Order.id == order_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def update_order(self, order_id: str, update_data: dict) -> Order | None:
        """Update an order."""
        order = await self.get_order_by_id(order_id)
        if not order:
            return None

        for field, value in update_data.items():
            setattr(order, field, value)

        await self.db.flush()
        return order

    async def delete_order(self, order_id: str) -> bool:
        """Delete an order."""
        order = await self.get_order_by_id(order_id)
        if not order:
            return False

        await self.db.delete(order)
        return True
