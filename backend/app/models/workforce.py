# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Workforce models.
Worker, WorkerSkill, WorkerAttendance, and ProductionOutput.
Implements Skill Matrix instead of punitive leaderboards.
"""

from datetime import date, datetime, time
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.datasource import DataSource
    from app.models.factory import Factory
    from app.models.production import ProductionRun


class Worker(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Factory worker / employee.
    PII-sensitive entity - data should be redacted before LLM processing.
    """

    __tablename__ = "workers"
    __table_args__ = (
        UniqueConstraint("factory_id", "employee_id", name="uq_factory_employee"),
    )

    # Factory FK
    factory_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("factories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Employee Identification
    employee_id: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # Badge/ID number

    # PII Fields (Handle with Presidio)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Position
    department: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g., 'Sewing', 'Cutting'
    job_title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    primary_skill: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # Main operation

    # Assignment (renamed from line_id after migration)
    data_source_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("data_sources.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Employment
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    termination_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Compensation (Sensitive - Consider Encryption)
    hourly_rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(
        String(3), default="USD", nullable=True
    )

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    factory: Mapped["Factory"] = relationship(
        "Factory",
        back_populates="workers",
    )
    assigned_data_source: Mapped[Optional["DataSource"]] = relationship(
        "DataSource",
        foreign_keys=[data_source_id],
    )
    skills: Mapped[list["WorkerSkill"]] = relationship(
        "WorkerSkill",
        back_populates="worker",
        lazy="selectin",
    )
    attendance_records: Mapped[list["WorkerAttendance"]] = relationship(
        "WorkerAttendance",
        back_populates="worker",
        lazy="selectin",
    )
    production_outputs: Mapped[list["ProductionOutput"]] = relationship(
        "ProductionOutput",
        back_populates="worker",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Worker(id={self.id}, employee_id={self.employee_id})>"


class WorkerSkill(Base, UUIDMixin, TimestampMixin):
    """
    Skill matrix entry for a worker.
    Tracks proficiency per operation rather than simple ranking.
    Used for workforce optimization and line balancing.
    """

    __tablename__ = "worker_skills"
    __table_args__ = (
        UniqueConstraint("worker_id", "operation", name="uq_worker_operation"),
    )

    # Worker FK
    worker_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Operation
    operation: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # e.g., 'Collar Attach'
    operation_category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Proficiency Metrics
    proficiency_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )  # 0-100 performance %
    sam_achieved: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 2),
        nullable=True,
    )  # Average SAM for this operation
    efficiency_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )  # Efficiency on this operation

    # Quality Metrics
    defect_rate_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )  # DHU for this worker/operation

    # Volume
    pieces_lifetime: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # Total pieces done
    pieces_30d: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # Last 30 days

    # Training Status
    is_certified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    certification_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Last Assessment
    last_assessed: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    worker: Mapped["Worker"] = relationship(
        "Worker",
        back_populates="skills",
    )

    def __repr__(self) -> str:
        return f"<WorkerSkill(worker={self.worker_id}, op={self.operation}, pct={self.proficiency_pct})>"


class WorkerAttendance(Base, UUIDMixin, TimestampMixin):
    """
    Daily time and attendance record.
    Tracks clock-in/out and hours worked.
    """

    __tablename__ = "worker_attendances"
    __table_args__ = (
        UniqueConstraint("worker_id", "work_date", name="uq_worker_date"),
    )

    # Worker FK
    worker_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Date
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Time (nullable for absences)
    clock_in: Mapped[time | None] = mapped_column(Time, nullable=True)
    clock_out: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Hours
    hours_regular: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    hours_overtime: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    hours_total: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)

    # Status
    is_present: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    absence_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    worker: Mapped["Worker"] = relationship(
        "Worker",
        back_populates="attendance_records",
    )

    def __repr__(self) -> str:
        return f"<WorkerAttendance(worker={self.worker_id}, date={self.work_date})>"


class ProductionOutput(Base, UUIDMixin, TimestampMixin):
    """
    Individual worker production output.
    Used to calculate skill matrix metrics.
    """

    __tablename__ = "production_outputs"

    # FKs
    worker_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    production_run_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("production_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Operation
    operation: Mapped[str] = mapped_column(String(100), nullable=False)

    # Output
    pieces_completed: Mapped[int] = mapped_column(Integer, nullable=False)
    sam_earned: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )  # pieces × operation SAM

    # Time Spent
    minutes_worked: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)

    # Calculated Efficiency
    efficiency_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    # Recording Time
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Relationships
    worker: Mapped["Worker"] = relationship(
        "Worker",
        back_populates="production_outputs",
    )
    production_run: Mapped["ProductionRun"] = relationship(
        "ProductionRun",
        back_populates="production_outputs",
    )

    def __repr__(self) -> str:
        return f"<ProductionOutput(worker={self.worker_id}, op={self.operation}, pcs={self.pieces_completed})>"
