"""
Production domain models.
Style, Order, and ProductionRun entities.
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    case,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import OrderStatus
from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.analytics import EfficiencyMetric
    from app.models.datasource import DataSource
    from app.models.events import ProductionEvent
    from app.models.factory import Factory
    from app.models.quality import QualityInspection
    from app.models.workforce import ProductionOutput


class Style(Base, UUIDMixin, TimestampMixin):
    """
    Garment style master data.
    """

    __tablename__ = "styles"
    __table_args__ = (
        UniqueConstraint("factory_id", "style_number", name="uq_factory_style"),
    )

    # Factory FK
    factory_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("factories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Style Identification
    style_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    style_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Buyer/Season
    buyer: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    season: Mapped[str | None] = mapped_column(String(50), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Technical Data
    base_sam: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 4),  # High Precision for SAM
        nullable=True,
    )
    complexity_rating: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    # Bill of Materials (JSON)
    bom_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Tech Pack Reference
    tech_pack_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    factory: Mapped["Factory"] = relationship("Factory", back_populates="styles")
    orders: Mapped[list["Order"]] = relationship(
        "Order", back_populates="style", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Style(id={self.id}, number={self.style_number})>"


class Order(Base, UUIDMixin, TimestampMixin):
    """
    Purchase order from a buyer.
    """

    __tablename__ = "orders"
    __table_args__ = (UniqueConstraint("style_id", "po_number", name="uq_style_po"),)

    # Style FK
    style_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("styles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Order Identification
    po_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Quantity
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    size_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    uom: Mapped[str] = mapped_column(String(20), default="pcs", nullable=False)
    color: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Dates
    order_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    planned_cut_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    planned_sew_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ex_factory_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actual_ship_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Status & Priority
    status: Mapped[str] = mapped_column(
        String(20),
        default=OrderStatus.PENDING,
        nullable=False,
        index=True,
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        default="normal",
        nullable=False,
    )

    # Progress Tracking
    qty_cut: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    qty_sewn: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    qty_packed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    qty_shipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    style: Mapped["Style"] = relationship("Style", back_populates="orders")
    production_runs: Mapped[list["ProductionRun"]] = relationship(
        "ProductionRun", back_populates="order", lazy="selectin"
    )
    # ARCHIVED: cut_tickets moved to models/drafts/cutting.py
    # ARCHIVED: packing_lists moved to models/drafts/shipping.py

    @hybrid_property
    def percentage_complete(self) -> float:
        """Calculate order completion percentage."""
        if self.quantity == 0:
            return 0.0
        return round((self.qty_sewn / self.quantity) * 100, 2)

    @percentage_complete.expression
    def percentage_complete_expression(cls):  # noqa: N805
        """SQL expression for percentage_complete."""
        return case((cls.quantity > 0, (cls.qty_sewn / cls.quantity) * 100), else_=0)

    def __repr__(self) -> str:
        return f"<Order(id={self.id}, po={self.po_number}, qty={self.quantity})>"


class ProductionRun(Base, UUIDMixin, TimestampMixin):
    """
    Daily production execution record.
    Includes database-level computed columns for integrity.
    """

    __tablename__ = "production_runs"
    __table_args__ = (
        CheckConstraint("actual_qty >= 0", name="check_positive_qty"),
        CheckConstraint("operators_present >= 0", name="check_positive_operators"),
        CheckConstraint("helpers_present >= 0", name="check_positive_helpers"),
        CheckConstraint("worked_minutes >= 0", name="check_positive_worked_minutes"),
        CheckConstraint(
            "wip_start >= 0 OR wip_start IS NULL", name="check_positive_wip_start"
        ),
        CheckConstraint(
            "wip_end >= 0 OR wip_end IS NULL", name="check_positive_wip_end"
        ),
        # Unique Index for Idempotency
        # Ensures (Line, Order, Date, Shift) is unique
        UniqueConstraint(
            "data_source_id", "order_id", "production_date", "shift", name="uq_production_run"
        ),
    )

    # Factory FK (Denormalized for performance)
    factory_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("factories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Order & Line FKs
    order_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Data Source FK (renamed from line_id after migration)
    data_source_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("data_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # ARCHIVED: cut_ticket_id moved to models/drafts/cutting.py

    # Traceability - Link back to the file upload that created this record
    source_import_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("raw_imports.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Links to the RawImport that created this record for debugging",
    )

    # Production Date & Shift
    production_date: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, index=True
    )
    inspection_date: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, index=True
    )
    shift: Mapped[str] = mapped_column(String(20), default="day", nullable=False)

    # Quantity
    planned_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # WIP
    wip_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wip_end: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Batch & Fabric Identification
    lot_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )
    shade_band: Mapped[str | None] = mapped_column(String(10), nullable=True)
    batch_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    # Downtime
    downtime_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    downtime_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Metrics
    # We store SAM snapshot here to allow computed columns to work at row level
    sam: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)

    # Headcount
    operators_present: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    helpers_present: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Time
    worked_minutes: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), default=0, nullable=False
    )

    # --- COMPUTED COLUMNS (Database Level) ---
    # Earned Minutes = Actual Qty * SAM
    earned_minutes: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 4),
        Computed("actual_qty * sam"),
        nullable=True,
    )

    # Efficiency = (Earned Mins) / (Available Mins) * 100
    # Note: Requires logic to handle division by zero and NULL SAM.
    efficiency: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        Computed(
            """
            CASE
                WHEN (worked_minutes * (operators_present + helpers_present)) > 0 AND sam IS NOT NULL
                THEN ((actual_qty * sam) / (worked_minutes * (operators_present + helpers_present))) * 100
                ELSE 0
            END
            """
        ),
        nullable=True,
    )

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- DENORMALIZED COLUMNS (for widget sync) ---
    # Timestamps
    start_time: Mapped[datetime | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(Time, nullable=True)

    # Order Details (denormalized for direct widget access)
    style_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    buyer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    season: Mapped[str | None] = mapped_column(String(50), nullable=True)
    po_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Quality Metrics (denormalized)
    defects: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dhu: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)

    # Efficiency Override (for explicit storage vs computed)
    line_efficiency: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="production_runs")
    data_source: Mapped["DataSource"] = relationship(
        "DataSource", back_populates="production_runs"
    )
    # ARCHIVED: cut_ticket relationship moved to models/drafts/cutting.py
    quality_inspections: Mapped[list["QualityInspection"]] = relationship(
        "QualityInspection", back_populates="production_run", lazy="selectin"
    )
    production_outputs: Mapped[list["ProductionOutput"]] = relationship(
        "ProductionOutput", back_populates="production_run", lazy="selectin"
    )
    efficiency_metric: Mapped[Optional["EfficiencyMetric"]] = relationship(
        "EfficiencyMetric", back_populates="production_run", uselist=False
    )
    events: Mapped[list["ProductionEvent"]] = relationship(
        "ProductionEvent", back_populates="production_run", lazy="selectin"
    )

    @hybrid_property
    def total_manpower(self) -> int:
        """Total personnel present."""
        return self.operators_present + self.helpers_present

    @total_manpower.expression
    def total_manpower_expression(cls):  # noqa: N805
        """SQL expression for total_manpower."""
        return cls.operators_present + cls.helpers_present

    def __repr__(self) -> str:
        return f"<ProductionRun(id={self.id}, date={self.production_date}, qty={self.actual_qty})>"
