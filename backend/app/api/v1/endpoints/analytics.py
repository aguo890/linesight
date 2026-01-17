"""
Analytics endpoints for LineSight.
Dashboard data, efficiency metrics, and worker rankings.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import case, desc, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, get_db
from app.models import ProductionLine  # Alias for DataSource
from app.models.analytics import DHUReport, EfficiencyMetric

# from app.models.compliance import TraceabilityRecord, VerificationStatus
from app.models.events import ProductionEvent
from app.models.factory import Factory
from app.models.production import Order, OrderStatus, ProductionRun, Style
from app.models.workforce import Worker, WorkerSkill
from app.schemas.analytics import (
    ComplexityAnalysisResponse,
    ComplexityPoint,
    DhuPoint,
    DiscrepanciesResponse,
    DiscrepancyItem,
    DowntimeAnalysisResponse,
    DowntimeReason,
    EarnedMinutesStats,
    LowestPerformersResponse,
    OverviewStats,
    ProductionChartData,
    ProductionDataPoint,
    ProductionEventItem,
    SamPerformanceResponse,
    SpeedQualityPoint,
    SpeedQualityResponse,
    StyleProgressItem,
    StyleProgressResponse,
    TargetRealizationResponse,
    WorkerPerformance,
    WorkforceStats,
)
from app.services.analytics_service import AnalyticsService

# Diagnostic logging for Silent Failover debugging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/overview", response_model=OverviewStats)
async def get_overview_stats(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """
    Get dashboard overview statistics.
    If date range provided, calculates stats for that range vs previous period.
    Otherwise defaults to "Effective Date" (Today/Latest).
    """
    logger.info(f"[DIAG] get_overview_stats called with line_id={line_id}")

    from app.repositories.production_repo import ProductionRepository

    prod_repo = ProductionRepository(db)

    # Resolve Date Logic
    if date_from and date_to:
        current_start = date_from
        current_end = date_to

        # Previous Period Logic (Same Duration)
        duration = (current_end - current_start).days + 1
        prev_end = current_start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=duration - 1)

        effective_date = current_end # For "Last Updated" text
    else:
        # Fallback to "Effective Date" (Today or latest data)
        # Verify timezone logic needed?
        effective_date = await prod_repo.get_effective_date(line_id)
        current_start = effective_date
        current_end = effective_date

        prev_end = effective_date - timedelta(days=1)
        prev_start = prev_end

    # Use AnalyticsService for consistent aggregation
    analytics_service = AnalyticsService(db)
    current_stats = await analytics_service.get_aggregated_stats(
        line_id=line_id, start_date=current_start, end_date=current_end
    )
    prev_stats = await analytics_service.get_aggregated_stats(
        line_id=line_id, start_date=prev_start, end_date=prev_end
    )

    total_output = current_stats["total_produced"]
    yesterday_output = prev_stats["total_produced"]
    avg_efficiency = current_stats["weighted_efficiency"]
    yesterday_eff = prev_stats["weighted_efficiency"]

    # Calculate Changes
    output_change = 0
    if yesterday_output > 0:
        # Should be scaled if durations differ? No, just raw output change.
        output_change = ((total_output - yesterday_output) / yesterday_output) * 100

    eff_change = avg_efficiency - yesterday_eff  # Absolute delta

    # 2. Consolidated Lines and Discrepancies
    lines_query = select(
        func.count(ProductionLine.id).label("total"),
        func.sum(case((ProductionLine.is_active, 1), else_=0)).label("active"),
    )
    lines_result = await db.execute(lines_query)
    lines_stats = lines_result.one()

    active_lines = lines_stats.active or 0
    total_lines = lines_stats.total or 0

    # 3. Discrepancies (Separate as it's a different table hierarchy)
    # disc_query = select(func.count(TraceabilityRecord.id)).where(
    #     TraceabilityRecord.verification_status != VerificationStatus.VERIFIED
    # )
    disc_query = select(literal(0)) # Return 0 for now
    disc_result = await db.execute(disc_query)
    discrepancies_count = disc_result.scalar() or 0

    last_updated = "Just now"
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        pass

    today = datetime.now(timezone.utc).date()
    if effective_date != today:
        last_updated = f"Data from {effective_date.strftime('%Y-%m-%d')}"

    return OverviewStats(
        total_output=total_output,
        output_change_pct=Decimal(f"{output_change:.1f}"),
        avg_efficiency=Decimal(f"{avg_efficiency:.1f}"),
        efficiency_change_pct=Decimal(f"{eff_change:.1f}"),
        discrepancies_count=discrepancies_count,
        active_lines=active_lines,
        total_lines=total_lines,
        last_updated=last_updated,
    )


@router.get("/production-chart", response_model=ProductionChartData)
async def get_production_chart(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """
    Get production vs target chart data for the last 7 days.

    Optionally filter by production line ID.
    """
    from app.repositories.production_repo import ProductionRepository

    # Use repository for aggregated data
    prod_repo = ProductionRepository(db)

    # Determine effective date (mostly for correct anchor, though this chart is historical)
    if date_from and date_to:
        start_date = date_from
        effective_date = date_to
    else:
        effective_date = await prod_repo.get_effective_date(line_id)
        start_date = effective_date - timedelta(days=6)

    rows_data = await prod_repo.get_production_chart_data(
        start_date, effective_date, line_id
    )

    # Map to dictionary for easy lookup
    data_map = {row["production_date"]: row for row in rows_data}

    data_points = []
    current = start_date
    while current <= effective_date:
        row = data_map.get(current)
        actual = row["actual"] if row else 0
        target = row["target"] if row else 0  # Default target 0 if no run

        # Use day name (Mon, Tue) as label for frontend consistency
        # Determine date format
        date_fmt = "%m/%d/%Y"
        if current_user.preferences:
            try:
                import json

                prefs = (
                    json.loads(current_user.preferences)
                    if isinstance(current_user.preferences, str)
                    else current_user.preferences
                )
                if isinstance(prefs, dict):
                    user_fmt = prefs.get("date_format")
                    if user_fmt == "DD/MM/YYYY":
                        date_fmt = "%d/%m/%Y"
                    elif user_fmt == "YYYY-MM-DD":
                        date_fmt = "%Y-%m-%d"
            except Exception:
                pass  # Fallback to default

        day_label = current.strftime(date_fmt)

        data_points.append(
            ProductionDataPoint(day=day_label, actual=actual, target=target)
        )
        current += timedelta(days=1)

    return ProductionChartData(
        data_points=data_points,
        line_filter=line_id,
    )


@router.get("/workers/lowest-performers", response_model=LowestPerformersResponse)
async def get_lowest_performers(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 5,
):
    """
    Get workers with lowest efficiency for the current week.

    Used for the "Lowest Performers" dashboard widget.
    This is intended for coaching/improvement, not punitive purposes.
    """
    # Query WorkerSkills explicitly to find low performers
    # We prioritize 'Efficiency' metrics if available
    query = (
        select(Worker, WorkerSkill, ProductionLine.name.label("line_name"))
        .join(WorkerSkill, Worker.id == WorkerSkill.worker_id)
        .outerjoin(ProductionLine, Worker.line_id == ProductionLine.id)
        .where(Worker.is_active)
        .order_by(WorkerSkill.efficiency_pct.asc())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    workers = []
    for worker, skill, line_name in rows:
        # Use first letters of name for initials
        parts = worker.full_name.split()
        initials = "".join(p[0] for p in parts[:2]).upper() if parts else "XX"

        workers.append(
            WorkerPerformance(
                id=worker.id,
                initials=initials,
                name=worker.full_name,
                line_name=line_name or "N/A",
                operation=skill.operation,
                efficiency_pct=skill.efficiency_pct or Decimal("0"),
            )
        )

    return LowestPerformersResponse(workers=workers)


@router.get("/discrepancies", response_model=DiscrepanciesResponse)
async def get_discrepancies(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get detected data discrepancies based on TraceabilityRecords.
    """
    query = (
        select(TraceabilityRecord)
        .where(
            TraceabilityRecord.verification_status.in_(
                [
                    VerificationStatus.FLAGGED,
                    VerificationStatus.REJECTED,
                    VerificationStatus.PENDING,
                ]
            )
        )
        .order_by(desc(TraceabilityRecord.created_at))
        .limit(20)
    )

    result = await db.execute(query)
    records = result.scalars().all()

    discrepancies = []
    for rec in records:
        severity = "Medium"
        if (
            rec.verification_status == VerificationStatus.REJECTED
            or rec.verification_status == VerificationStatus.FLAGGED
        ):
            severity = "High"

        discrepancies.append(
            DiscrepancyItem(
                id=rec.id,
                severity=severity,
                issue_title=f"Compliance {rec.verification_status.value.title()}",
                issue_description=rec.risk_notes
                or "Verification incomplete or failed.",
                source_file="Traceability Record",  # Placeholder
            )
        )

    return DiscrepanciesResponse(
        discrepancies=discrepancies,
        total_count=len(discrepancies),
    )


@router.get("/production/styles", response_model=StyleProgressResponse)
async def get_style_progress(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """
    Get progress of currently active production styles (Orders).
    If date range provided, shows orders that were ACTIVE (had production) during that range.
    Optionally filter by production line ID.
    """
    # Logic:
    # If date range: Find all Orders that have ProductionRuns in that range.
    # If no date range: Find all Orders with active status.

    if date_from and date_to:
        query = (
            select(Order)
            .join(ProductionRun, Order.production_runs)
            .where(
                func.date(ProductionRun.production_date) >= date_from,
                func.date(ProductionRun.production_date) <= date_to
            )
        )
        if line_id:
            query = query.where(ProductionRun.line_id == line_id)

        query = query.options(selectinload(Order.style)).distinct()

    else:
        # Defaults to "Current Active Orders"
        if line_id:
            query = (
                select(Order)
                .join(ProductionRun, Order.production_runs)
                .where(ProductionRun.line_id == line_id)
                .options(selectinload(Order.style))
                .distinct()
            )
        else:
            # Global view: Active statuses including PENDING
            active_statuses = [
                OrderStatus.CUTTING,
                OrderStatus.SEWING,
                OrderStatus.FINISHING,
                OrderStatus.PENDING,
            ]
            query = (
                select(Order)
                .options(selectinload(Order.style))
                .where(Order.status.in_(active_statuses))
                .order_by(desc(Order.order_date))
            )

    result = await db.execute(query)
    orders = result.scalars().all()

    styles = []
    for order in orders:
        run_query = select(func.sum(ProductionRun.actual_qty)).where(
            ProductionRun.order_id == order.id
        )

        # Filter runs?
        # If we are in date range mode, should we show TOTAL progress of the order,
        # or just what was made in that window?
        # Usually "Style Progress" implies "How much is done for the Order Total".
        # So we keep looking at ALL runs for that order to show true % completion.

        # However, verifying if we should respect line_id for the count.
        # Yes, if we are filtering by line, we might only care about that line's contribution?
        # Standard logic: Progress of the order is global. But if line filter active...
        # Let's keep it simple: Show Global Progress for that Order, even if filtered by Line.
        # Or... if line_id, we only count runs from that line.

        if line_id:
            run_query = run_query.where(ProductionRun.line_id == line_id)

        run_res = await db.execute(run_query)
        total_produced = run_res.scalar() or 0

        target = order.quantity or 0
        try:
            progress = (
                (Decimal(total_produced) / Decimal(target)) * 100
                if target > 0
                else Decimal(0)
            )
        except (ZeroDivisionError, TypeError, Exception):
            progress = Decimal(0)

        # Determine Status Logic
        status = "On Track"
        progress_val = progress if progress else Decimal(0)

        if progress_val >= 90:
            status = "Completed"
        elif progress_val > 0:
            status = "In Progress"
        else:
            status = "Pending"

        # Safe Style Code
        style_code = "Unknown"
        if order.style and order.style.style_number:
            style_code = order.style.style_number

        styles.append(
            StyleProgressItem(
                style_code=style_code,
                target=target,
                actual=total_produced,
                progress_pct=round(progress, 1),
                status=status,
            )
        )

    return StyleProgressResponse(active_styles=styles)


@router.get("/quality/dhu", response_model=list[DhuPoint])
async def get_dhu_history(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 7,
    date_from: date | None = None,
    date_to: date | None = None,
    line_id: str | None = None,
):
    """
    Get daily DHU trend for the last N days (or specific range).
    Optionally filter by production line ID.
    """
    # Determine effective date via repo
    from app.repositories.production_repo import ProductionRepository

    prod_repo = ProductionRepository(db)

    # Logic: If specific range provided, use it. Else default to N days window from effective date.
    if date_from and date_to:
        effective_date = date_to
        query_start = date_from
    else:
        effective_date = await prod_repo.get_effective_date(line_id)
        query_start = effective_date - timedelta(days=days - 1)

    # Aggregate QualityInspection by Date
    from app.models.quality import QualityInspection

    query = (
        select(
            func.date(ProductionRun.production_date).label("report_date"),
            func.sum(QualityInspection.defects_found).label("total_defects"),
            func.sum(QualityInspection.units_checked).label("total_checked"),
        )
        .join(
            QualityInspection, ProductionRun.id == QualityInspection.production_run_id
        )
        .where(
            func.date(ProductionRun.production_date) >= query_start,
            func.date(ProductionRun.production_date) <= effective_date,
        )
        .group_by(func.date(ProductionRun.production_date))
        .order_by(func.date(ProductionRun.production_date).asc())
    )

    if line_id:
        query = query.where(ProductionRun.line_id == line_id)

    result = await db.execute(query)
    rows = result.all()

    print(f"DEBUG: DHU Effective Date: {effective_date}")
    print(f"DEBUG: DHU Start Date: {query_start}")
    print(f"DEBUG: DHU Found Rows: {len(rows)}")

    data = []
    for row in rows:
        print(
            f"DEBUG: Row: Date={row.report_date}, Defects={row.total_defects}, Checked={row.total_checked}"
        )
        dhu = Decimal(0)
        if row.total_checked > 0:
            dhu = (Decimal(row.total_defects) / Decimal(row.total_checked)) * 100

        data.append(
            DhuPoint(
                date=row.report_date
                if isinstance(row.report_date, str)
                else row.report_date.strftime("%Y-%m-%d"),
                dhu=round(dhu, 1),
            )
        )

    return data


@router.get("/speed-vs-quality", response_model=SpeedQualityResponse)
async def get_speed_quality_stats(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 14,
    date_from: date | None = None,
    date_to: date | None = None,
    line_id: str | None = None,
):
    """
    Get daily trend of Efficiency vs Defects (DHU).
    Returns last N days (default 14).
    Optionally filter by production line ID.
    """
    # Determine effective date
    from app.repositories.production_repo import ProductionRepository

    prod_repo = ProductionRepository(db)

    if date_from and date_to:
        effective_date = date_to
        start_date = date_from
    else:
        effective_date = await prod_repo.get_effective_date(line_id)
        start_date = effective_date - timedelta(days=days)

    # 1. Get Daily Efficiency (Avg of EfficiencyMetric per day)
    eff_query = (
        select(
            func.date(ProductionRun.production_date).label("production_date"),
            func.avg(EfficiencyMetric.efficiency_pct).label("avg_eff"),
        )
        .join(EfficiencyMetric, ProductionRun.efficiency_metric)
        .where(func.date(ProductionRun.production_date) >= start_date)
        .where(func.date(ProductionRun.production_date) <= effective_date)
    )

    if line_id:
        eff_query = eff_query.where(ProductionRun.line_id == line_id)

    eff_query = eff_query.group_by(ProductionRun.production_date)

    eff_result = await db.execute(eff_query)
    eff_data = {row.production_date: row.avg_eff for row in eff_result.all()}

    # 2. Get Daily DHU Quality
    dhu_query = (
        select(DHUReport.report_date, DHUReport.avg_dhu)
        .where(DHUReport.report_date >= start_date)
        .where(DHUReport.report_date <= effective_date)
    )

    dhu_result = await db.execute(dhu_query)
    dhu_data = {row.report_date: row.avg_dhu for row in dhu_result.all()}

    data_points = []
    current = start_date
    while current <= effective_date:
        eff = eff_data.get(current) or Decimal(0)
        dhu = dhu_data.get(current) or Decimal(0)

        data_points.append(
            SpeedQualityPoint(
                date=current.strftime("%Y-%m-%d"),
                efficiency_pct=round(eff, 1),
                defects_per_hundred=round(dhu, 1),
            )
        )
        current += timedelta(days=1)

    return SpeedQualityResponse(data_points=data_points)


@router.get("/complexity-impact", response_model=ComplexityAnalysisResponse)
async def get_complexity_stats(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
):
    """
    Get Scatter Plot data: SAM vs Efficiency for active styles.
    Optionally filter by production line ID.
    """
    # Join ProductionRun -> Order -> Style -> EfficiencyMetric
    query = (
        select(
            Style.id,
            Style.style_number,
            Style.base_sam,
            func.avg(EfficiencyMetric.efficiency_pct).label("avg_eff"),
        )
        .join(Order, Style.orders)
        .join(ProductionRun, Order.production_runs)
        .join(EfficiencyMetric, ProductionRun.efficiency_metric)
        .where(
            Style.base_sam.is_not(None), EfficiencyMetric.efficiency_pct.is_not(None)
        )
    )

    if line_id:
        query = query.where(ProductionRun.line_id == line_id)

    query = query.group_by(Style.id, Style.style_number, Style.base_sam).limit(50)

    result = await db.execute(query)
    rows = result.all()

    points = []
    for row in rows:
        points.append(
            ComplexityPoint(
                style_id=row.id,
                style_code=row.style_number,
                sam=row.base_sam,
                efficiency_pct=round(row.avg_eff, 1),
            )
        )

    return ComplexityAnalysisResponse(data_points=points)


@router.get("/earned-minutes", response_model=EarnedMinutesStats)
async def get_earned_minutes_stats(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """
    Get Earned Minutes vs Available Minutes stats.
    Defaults to today if no dates provided.
    Optionally filter by production line ID.
    """
    from app.repositories.production_repo import ProductionRepository

    if date_from and date_to:
        start_date = date_from
        end_date = date_to
    else:
        prod_repo = ProductionRepository(db)
        effective_date = await prod_repo.get_effective_date(line_id)
        start_date = effective_date
        end_date = effective_date

    analytics_service = AnalyticsService(db)
    stats = await analytics_service.get_aggregated_stats(
        line_id=line_id, start_date=start_date, end_date=end_date
    )

    return EarnedMinutesStats(
        earned_minutes=stats["total_earned_minutes"],
        total_available_minutes=stats["total_available_minutes"],
        efficiency_pct_aggregate=stats["weighted_efficiency"],
    )


@router.get("/downtime-reasons", response_model=DowntimeAnalysisResponse)
async def get_downtime_reasons(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """
    Get top recurring downtime reasons.
    Aggregates data from the 'downtime_reason' column.
    Optionally filter by production line ID.
    """
    # Aggregate by downtime_reason
    base_filter = [
        ProductionRun.downtime_reason.is_not(None),
        ProductionRun.downtime_reason != "",
    ]

    if line_id:
        base_filter.append(ProductionRun.line_id == line_id)

    if date_from and date_to:
        base_filter.append(func.date(ProductionRun.production_date) >= date_from)
        base_filter.append(func.date(ProductionRun.production_date) <= date_to)

    query = (
        select(
            ProductionRun.downtime_reason, func.count(ProductionRun.id).label("count")
        )
        .where(*base_filter)
        .group_by(ProductionRun.downtime_reason)
        .order_by(desc("count"))
        .limit(10)
    )

    result = await db.execute(query)
    rows = result.all()

    # If structured data exists, use it
    if rows:
        reasons = [DowntimeReason(reason=row[0], count=row[1]) for row in rows]
        return DowntimeAnalysisResponse(reasons=reasons)

    # Fallback: Simple Keyword Frequency Analysis on Notes if no explicit reasons
    # This maintains backward compatibility for legacy data
    query_notes = (
        select(ProductionRun.notes).where(ProductionRun.notes.is_not(None))
    )
    # Apply filters to fallback query too
    if date_from and date_to:
        query_notes = query_notes.where(
            func.date(ProductionRun.production_date) >= date_from,
            func.date(ProductionRun.production_date) <= date_to
        )
    if line_id:
        query_notes = query_notes.where(ProductionRun.line_id == line_id)

    query_notes = query_notes.limit(100)

    result_notes = await db.execute(query_notes)
    notes_list = result_notes.scalars().all()

    keywords = [
        "Machine",
        "Thread",
        "Needle",
        "Material",
        "Absent",
        "Quality",
        "Power",
        "Trim",
    ]
    counts = dict.fromkeys(keywords, 0)

    for note in notes_list:
        if not note:
            continue
        lower_note = note.lower()
        for k in keywords:
            if k.lower() in lower_note:
                counts[k] += 1

    sorted_reasons = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return DowntimeAnalysisResponse(
        reasons=[DowntimeReason(reason=k, count=v) for k, v in sorted_reasons if v > 0]
    )


@router.get("/production/hourly", response_model=list[int])
async def get_hourly_production(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
):
    """
    Get hourly production output for today (08:00 - 19:00).
    Returns a list of integer quantities per hour.
    """
    print(f"DEBUG: Entering get_hourly_production line_id={line_id}")
    # Determine effective date
    from app.repositories.production_repo import ProductionRepository

    prod_repo = ProductionRepository(db)
    print("DEBUG: Calling prod_repo.get_effective_date")
    effective_date = await prod_repo.get_effective_date(line_id)
    print(f"DEBUG: effective_date={effective_date}")

    # 1. Try to get granular data from ProductionEvent (New standard)
    query = select(
        func.extract("hour", ProductionEvent.timestamp).label("hour"),
        func.sum(ProductionEvent.quantity).label("qty"),
    ).where(func.date(ProductionEvent.timestamp) == effective_date)

    if line_id:
        query = query.where(ProductionEvent.line_id == line_id)

    query = query.group_by("hour").order_by("hour")

    print("DEBUG: Executing query")
    result = await db.execute(query)
    print("DEBUG: Query executed")
    rows = result.all()
    print(f"DEBUG: Found {len(rows)} rows")

    # Initialize hours map (8am to 7pm)
    hours_map = dict.fromkeys(range(8, 20), 0)

    if rows:
        for hour, qty in rows:
            h = int(hour)
            if 8 <= h <= 19:
                hours_map[h] = int(qty or 0)
        return list(hours_map.values())

    # 2. Honest Fallback: If no granular events, return 0s.
    # The UI should detect this as "No Data" or show a flat line.
    # We explicitly DO NOT simulate a curve anymore.

    return [0] * 12


@router.get("/sam-performance", response_model=SamPerformanceResponse)
async def get_sam_performance(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """
    Get SAM performance metrics for today or a specific range.
    """

    # If no dates, defaults inside get_sam_performance_metrics are used (Today)
    analytics_service = AnalyticsService(db)
    return await analytics_service.get_sam_performance_metrics(
        line_id=line_id, start_date=date_from, end_date=date_to
    )


@router.get("/target-realization", response_model=TargetRealizationResponse)
async def get_target_realization(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
):
    """
    Get target realization metrics (Actual vs Planned) for today.
    """
    from app.repositories.production_repo import ProductionRepository

    prod_repo = ProductionRepository(db)
    effective_date = await prod_repo.get_effective_date(line_id)

    analytics_service = AnalyticsService(db)
    return await analytics_service.get_target_realization(
        line_id=line_id, reference_date=effective_date
    )


@router.get("/complexity", response_model=ComplexityAnalysisResponse)
async def get_complexity_analysis(
    db: Annotated[AsyncSession, Depends(get_db)],
    start_date: datetime | None = None,
    end_date: datetime | None = None,
):
    """
    Analyze correlation between Style Complexity (SAM) and Efficiency.
    """
    # Fallback to last 30 days if no dates provided
    end = end_date or datetime.now()
    start = start_date or (end - timedelta(days=30))

    service = AnalyticsService(db)
    return await service.get_complexity_analysis(start, end, line_id=line_id)


@router.get("/events", response_model=list[ProductionEventItem])
async def get_production_events(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
    minutes: int = 60,
):
    """
    Get raw production events for the last N minutes.
    Used for real-time charting or feeds.
    """

    start_time = datetime.utcnow() - timedelta(minutes=minutes)

    query = (
        select(ProductionEvent)
        .where(ProductionEvent.timestamp >= start_time)
        .order_by(ProductionEvent.timestamp.asc())
    )

    if line_id:
        query = query.where(ProductionEvent.line_id == line_id)

    result = await db.execute(query)
    events = result.scalars().all()

    return [ProductionEventItem.model_validate(e) for e in events]


@router.get("/workforce", response_model=WorkforceStats)
async def get_workforce_stats(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    line_id: str | None = None,
):
    """
    Get workforce attendance statistics for today.
    """
    from app.repositories.production_repo import ProductionRepository

    prod_repo = ProductionRepository(db)
    effective_date = await prod_repo.get_effective_date(line_id)

    # 1. Get Present Metric (from ProductionRun)
    query = select(
        func.sum(ProductionRun.operators_present).label("ops"),
        func.sum(ProductionRun.helpers_present).label("helpers"),
    ).where(func.date(ProductionRun.production_date) == effective_date)

    if line_id:
        query = query.where(ProductionRun.line_id == line_id)

    result = await db.execute(query)
    stats = result.one()

    present_total = (stats.ops or 0) + (stats.helpers or 0)

    # 2. Get Target Metric (from ProductionLine)
    target_total = 0

    if line_id:
        line_query = select(ProductionLine.target_operators).where(
            ProductionLine.id == line_id
        )
        line_res = await db.execute(line_query)
        target = line_res.scalar()
        if target:
            target_total = target
    else:
        # Sum of all active lines targets for this Organization/Factory
        # Ghost Filter Fix: Must filter by organization or factory context.
        # Since we don't have factory_id in args explicitly, we leverage current_user org/factory
        # (Assuming Multi-tenant) OR if monolithic, we ensure we filter by what we can.
        # For now, let's assume filtering by active lines is "Global" which is bad.
        # We need to filter by the user's factory if possible.
        # The Line model has factory_id.
        # We should filter lines by the current user's organization factories?
        # IMPORTANT: 'CurrentUser' object is available.
        # This user has organization_id.

        # Proper Ghost Filter Fix: Join Factory -> Organization
        lines_query = (
            select(func.sum(ProductionLine.target_operators))
            .join(Factory, ProductionLine.factory_id == Factory.id)
            .where(ProductionLine.is_active)
            .where(Factory.organization_id == current_user.organization_id)
        )

        lines_res = await db.execute(lines_query)
        sum_target = lines_res.scalar()
        if sum_target:
            target_total = sum_target

    # Zero Tolerance: Honest Data.
    # If absent is not tracked, returning 0 is honest. Creating fake "10%" is not.
    absent = 0
    late = 0

    # If we had Real data:
    # absent = count(workers where status='absent')
    # For now, if explicit data is missing, we claim 0 known absences.

    return WorkforceStats(
        present=int(present_total),
        target=int(target_total),
        absent=int(absent),
        late=int(late),
    )


@router.post("/recalculate")
async def recalculate_metrics(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    days_back: int = 30,
):
    """
    Trigger recalculation of missing metrics for existing production data.
    Useful for fixing 'No Data' issues on dashboards created before metric logic was added.
    """
    from app.services.backfill import BackfillService

    service = BackfillService(db)
    result = await service.recalculate_metrics(days_back=days_back)
    return result
