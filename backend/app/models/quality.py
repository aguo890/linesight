"""
Quality inspection and defect models.
QualityInspection and Defect for DHU tracking.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.production import ProductionRun
    from app.models.workforce import Worker


class InspectionType(str, PyEnum):
    """Quality inspection checkpoint types."""

    INLINE = "inline"  # During production
    ENDLINE = "endline"  # End of line
    FINAL = "final"  # Pre-packing
    AQL = "aql"  # Acceptance Quality Level


class AQLResult(str, PyEnum):
    """AQL inspection outcome."""

    PASS = "pass"
    FAIL = "fail"
    PENDING = "pending"


class DefectSeverity(str, PyEnum):
    """Defect severity levels."""

    MINOR = "minor"  # Cosmetic, customer unlikely to notice
    MAJOR = "major"  # Obvious defect, but functional
    CRITICAL = "critical"  # Safety/function issue, reject


class QualityInspection(Base, UUIDMixin, TimestampMixin):
    """
    Quality inspection record.
    Tracks in-line and end-line checks with DHU calculation.
    """

    __tablename__ = "quality_inspections"

    # Production Run FK
    production_run_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("production_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Inspector
    inspector_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("workers.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Inspection Type
    inspection_type: Mapped[InspectionType] = mapped_column(
        Enum(InspectionType),
        default=InspectionType.INLINE,
        nullable=False,
    )

    # Sample & Results
    units_checked: Mapped[int] = mapped_column(Integer, nullable=False)
    defects_found: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    units_rejected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    units_reworked: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Calculated Metrics
    dhu: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )  # Defects per Hundred Units
    defect_rate_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )

    # AQL (for Final inspection)
    aql_level: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # e.g., '2.5', '4.0'
    aql_result: Mapped[AQLResult | None] = mapped_column(
        Enum(AQLResult),
        nullable=True,
    )

    # Timestamp
    inspected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    production_run: Mapped["ProductionRun"] = relationship(
        "ProductionRun",
        back_populates="quality_inspections",
    )
    inspector: Mapped[Optional["Worker"]] = relationship(
        "Worker",
        foreign_keys=[inspector_id],
    )
    defects: Mapped[list["Defect"]] = relationship(
        "Defect",
        back_populates="inspection",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<QualityInspection(id={self.id}, dhu={self.dhu})>"


class Defect(Base, UUIDMixin, TimestampMixin):
    """
    Individual defect record for root cause analysis.
    Links defects to workers and operations.
    """

    __tablename__ = "defects"

    # Inspection FK
    inspection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("quality_inspections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Worker (Responsible, if known)
    worker_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("workers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Defect Classification
    defect_type: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # e.g., 'Skip Stitch'
    defect_code: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # Standardized code
    defect_category: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g., 'Stitching', 'Fabric'

    # Operation
    operation: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g., 'Side Seam'

    # Severity
    severity: Mapped[DefectSeverity] = mapped_column(
        Enum(DefectSeverity),
        default=DefectSeverity.MINOR,
        nullable=False,
    )

    # Rework Status
    is_reworkable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_reworked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Root Cause Analysis
    root_cause: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # e.g., 'Needle issue'
    machine_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Image Evidence (URL)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Quantity (if multiple of same defect)
    count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Relationships
    inspection: Mapped["QualityInspection"] = relationship(
        "QualityInspection",
        back_populates="defects",
    )
    worker: Mapped[Optional["Worker"]] = relationship(
        "Worker",
        foreign_keys=[worker_id],
    )

    def __repr__(self) -> str:
        return (
            f"<Defect(id={self.id}, type={self.defect_type}, severity={self.severity})>"
        )
