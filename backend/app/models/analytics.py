# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Analytics models.
Pre-computed/materialized metrics for fast dashboard queries.
EfficiencyMetric and DHUReport.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import PerformanceTier, PeriodType, resolve_enum_values
from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.factory import Factory
    from app.models.production import ProductionRun


class EfficiencyMetric(Base, UUIDMixin, TimestampMixin):
    """
    Pre-computed efficiency metrics for a production run.
    Calculated after production data is ingested.
    """

    __tablename__ = "efficiency_metrics"

    # Production Run FK (One-to-One)
    production_run_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("production_runs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Efficiency Calculation
    efficiency_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )  # (earned_minutes / worked_minutes) × 100

    # SAM Analysis
    sam_target: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    sam_actual: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    sam_variance: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 2),
        nullable=True,
    )  # Actual - Target
    sam_variance_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2), nullable=True
    )

    # Utilization
    capacity_utilization_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )

    # Performance Tier
    performance_tier: Mapped[PerformanceTier | None] = mapped_column(
        Enum(PerformanceTier, values_callable=resolve_enum_values),
        nullable=True,
    )

    # Benchmarks
    factory_avg_efficiency: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2), nullable=True
    )
    line_avg_efficiency: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2), nullable=True
    )

    # Calculation Metadata
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Relationships
    production_run: Mapped["ProductionRun"] = relationship(
        "ProductionRun",
        back_populates="efficiency_metric",
    )

    def __repr__(self) -> str:
        return f"<EfficiencyMetric(run={self.production_run_id}, eff={self.efficiency_pct}%)>"


class DHUReport(Base, UUIDMixin, TimestampMixin):
    """
    Pre-aggregated DHU (Defects per Hundred Units) report.
    Factory-level quality summary for dashboard display.
    """

    __tablename__ = "dhu_reports"
    __table_args__ = (
        UniqueConstraint(
            "factory_id", "report_date", "period_type", name="uq_factory_date_period"
        ),
    )

    # Factory FK
    factory_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("factories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Report Period
    report_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    period_type: Mapped[PeriodType] = mapped_column(
        Enum(PeriodType, values_callable=resolve_enum_values),
        default=PeriodType.DAILY,
        nullable=False,
    )

    # Aggregate Metrics
    avg_dhu: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    min_dhu: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    max_dhu: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)

    # Volume
    total_inspected: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_defects: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_rejected: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Analysis (JSON)
    top_defects: Mapped[str | None] = mapped_column(Text, nullable=True)
    """
    JSON example: [
        {"type": "Skip Stitch", "count": 45, "pct": 23.5},
        {"type": "Broken Stitch", "count": 32, "pct": 16.7}
    ]
    """

    top_operations: Mapped[str | None] = mapped_column(Text, nullable=True)
    """
    JSON example: [
        {"operation": "Side Seam", "defects": 28, "pct": 14.6},
        {"operation": "Collar Attach", "defects": 22, "pct": 11.5}
    ]
    """

    top_lines: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # Lines with highest DHU

    # Trend (vs previous period)
    dhu_change_pct: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    trend_direction: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # 'improving', 'worsening', 'stable'

    # LLM-Generated Insights
    recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    factory: Mapped["Factory"] = relationship(
        "Factory",
        back_populates="dhu_reports",
    )

    def __repr__(self) -> str:
        return f"<DHUReport(factory={self.factory_id}, date={self.report_date}, dhu={self.avg_dhu})>"
