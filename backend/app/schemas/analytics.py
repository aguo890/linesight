"""
Analytics Pydantic schemas.
Response models for dashboard analytics endpoints.
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class OverviewStats(BaseModel):
    """Dashboard overview statistics."""

    total_output: int = Field(
        ..., description="Total units produced across all lines today"
    )
    output_change_pct: Decimal = Field(
        ..., description="Percentage change in output compared to yesterday"
    )
    avg_efficiency: Decimal = Field(
        ..., description="Average line efficiency percentage across the factory today"
    )
    efficiency_change_pct: Decimal = Field(
        ..., description="Percentage change in efficiency compared to yesterday"
    )
    discrepancies_count: int = Field(
        ..., description="Number of active data discrepancies or compliance flags"
    )
    active_lines: int = Field(
        ..., description="Number of production lines currently running"
    )
    total_lines: int = Field(
        ..., description="Total number of production lines in the factory"
    )
    last_updated: str = Field(
        ..., description="Timestamp or relative time of last data refresh"
    )


class ProductionDataPoint(BaseModel):
    """Single point in production chart."""

    day: str = Field(..., description="Day label (e.g., 'Mon', '2025-12-25')")
    actual: int = Field(..., description="Actual units produced on this day")
    target: int = Field(..., description="Planned/target units for this day")


class ProductionChartData(BaseModel):
    """Production vs target chart data."""

    data_points: list[ProductionDataPoint] = Field(
        ..., description="List of daily production metrics for the chart"
    )
    line_filter: str | None = Field(None, description="Active line filter ID, if any")


class WorkerPerformance(BaseModel):
    """Worker efficiency ranking item."""

    id: str = Field(..., description="Unique worker UUID")
    initials: str = Field(..., description="Worker initials for display (e.g., 'JS')")
    name: str = Field(..., description="Full display name of the worker")
    line_name: str = Field(
        ..., description="Name of the line the worker is assigned to"
    )
    operation: str = Field(
        ..., description="Primary operation performed by the worker (e.g., 'Hemming')"
    )
    efficiency_pct: Decimal = Field(
        ..., description="Current efficiency percentage for this week"
    )


class LowestPerformersResponse(BaseModel):
    """List of lowest performing workers."""

    workers: list[WorkerPerformance] = Field(
        ..., description="List of workers identified as requiring coaching/support"
    )


class DiscrepancyItem(BaseModel):
    """Single discrepancy alert."""

    id: str = Field(..., description="Unique discrepancy UUID")
    severity: str = Field(..., description="Severity level: 'High', 'Medium', 'Low'")
    issue_title: str = Field(..., description="Short title describing the data issue")
    issue_description: str = Field(
        ..., description="Detailed explanation of what triggered the discrepancy"
    )
    source_file: str = Field(
        ..., description="Name of the source file or record where the issue originated"
    )


class DiscrepanciesResponse(BaseModel):
    """Discrepancies from AI analysis."""

    discrepancies: list[DiscrepancyItem] = Field(
        ..., description="List of currently active discrepancies"
    )
    total_count: int = Field(..., description="Total count of active discrepancies")


class StyleProgressItem(BaseModel):
    """Progress of a single style in production."""

    style_code: str = Field(..., description="Style code (e.g., 'ST-2025-A')")
    target: int = Field(..., description="Target production quantity")
    actual: int = Field(..., description="Actual production quantity so far")
    progress_pct: Decimal = Field(..., description="Percentage of target completed")
    status: str = Field(
        ..., description="Status string: 'On Track', 'Behind', 'Completed'"
    )


class StyleProgressResponse(BaseModel):
    """List of style progress items."""

    active_styles: list[StyleProgressItem] = Field(
        ..., description="List of active styles and their progress"
    )


class SpeedQualityPoint(BaseModel):
    """Single point for Speed vs Quality chart."""

    date: str = Field(..., description="Date label (e.g., '2025-01-01')")
    efficiency_pct: Decimal = Field(
        ..., description="Average efficiency percentage for this day"
    )
    defects_per_hundred: Decimal = Field(
        ..., description="Defects per hundred units (DHU)"
    )


class SpeedQualityResponse(BaseModel):
    """Speed vs Quality trade-off analysis."""

    data_points: list[SpeedQualityPoint] = Field(
        ..., description="Daily trend of efficiency vs defects"
    )


class ComplexityPoint(BaseModel):
    """Single point for Complexity Impact scatter plot."""

    style_id: str = Field(..., description="Style UUID")
    sam: Decimal = Field(..., description="Standard Allowed Minute (Difficulty)")
    efficiency_pct: Decimal = Field(
        ..., description="Performance efficiency on this style"
    )
    style_code: str = Field(..., description="Style code text for tooltip")


class ComplexityAnalysisResponse(BaseModel):
    """Complexity vs Performance analysis."""

    data_points: list[ComplexityPoint] = Field(
        ..., description="Scatter plot data points"
    )


class EarnedMinutesStats(BaseModel):
    """Earned Minutes KPI stats."""

    earned_minutes: Decimal = Field(
        ..., description="Total Earned Minutes (Output * SAM)"
    )
    total_available_minutes: Decimal = Field(
        ..., description="Total Available Minutes (Workers * Shift Hours)"
    )
    efficiency_pct_aggregate: Decimal = Field(
        ..., description="Aggregate Efficiency (Earned / Available)"
    )


class DowntimeReason(BaseModel):
    """Recurring downtime reason/keyword."""

    reason: str = Field(..., description="Keyword or reason extracted from notes")
    count: int = Field(..., description="Frequency count of this reason")


class DowntimeAnalysisResponse(BaseModel):
    """Downtime/Blocker keyword analysis."""

    reasons: list[DowntimeReason] = Field(
        ..., description="Top recurring downtime reasons"
    )


class DhuPoint(BaseModel):
    """Single point for DHU (Quality) Trend."""

    date: str = Field(..., description="Report Date (YYYY-MM-DD)")
    dhu: Decimal = Field(..., description="Defects per Hundred Units (%)")


class WorkforceStats(BaseModel):
    """Workforce attendance statistics."""

    present: int = Field(..., description="Number of workers currently present")
    target: int = Field(
        ..., description="Target number of workers for the line/factory"
    )
    absent: int = Field(..., description="Number of workers absent")
    late: int = Field(..., description="Number of workers late")


class DhuTrendResponse(BaseModel):
    """List of DHU points."""

    data: list[DhuPoint]


class ProductionEventItem(BaseModel):
    """Single production event."""

    id: str = Field(..., description="Event UUID")
    timestamp: datetime = Field(..., description="When the event occurred")
    event_type: str = Field(..., description="Type of event (e.g., SCAN, BATCH_UPLOAD)")
    quantity: int = Field(..., description="Quantity change")
    line_id: str = Field(..., description="Production Line ID")
    style_id: str = Field(..., description="Style ID")

    class Config:
        from_attributes = True


class ProductionEventResponse(BaseModel):
    """List of production events."""

    events: list[ProductionEventItem]


class SamBreakdownItem(BaseModel):
    """Breakdown of SAM performance by style."""

    name: str = Field(..., description="Style name or number")
    actual: int = Field(..., description="Actual earned minutes")
    standard: int = Field(..., description="Standard/Target minutes")
    efficiency: float = Field(..., description="Efficiency percentage for this style")


class SamPerformanceResponse(BaseModel):
    """SAM performance metrics."""

    efficiency: Decimal = Field(
        ..., description="Current efficiency percentage based on SAM"
    )
    efficiency_change: Decimal = Field(
        ..., description="Change in efficiency vs equivalent previous period"
    )
    avg_sam_per_hour: Decimal = Field(..., description="Average SAM earned per hour")
    total_sam: Decimal = Field(..., description="Total SAM accumulation")
    breakdown: list[SamBreakdownItem] = Field(
        default=[], description="Breakdown by style for charts"
    )


class TargetRealizationResponse(BaseModel):
    """Target Realization metrics."""

    actual: int = Field(..., description="Actual units produced")
    target: int = Field(..., description="Target units expected")
    percentage: Decimal = Field(
        ..., description="Percentage of target realized (Actual / Target * 100)"
    )
    variance: int = Field(..., description="Variance (Actual - Target)")
