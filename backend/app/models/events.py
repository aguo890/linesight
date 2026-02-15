# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Event-driven production models.
Supports granular tracking of scanning events, IoT inputs, and micro-batches.
"""

from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.datasource import DataSource
    from app.models.production import Order, ProductionRun, Style
    from app.models.raw_import import RawImport


class EventType(str, PyEnum):
    SCAN = "scan"
    BATCH_UPLOAD = "batch_upload"
    MANUAL_ADJUSTMENT = "manual_adjustment"
    IOT_SIGNAL = "iot_signal"


class ProductionEvent(Base, UUIDMixin, TimestampMixin):
    """
    Granular production event (e.g., a single shirt scanned, or a batch of 10 uploaded).
    Source of truth for 'Real-Time' dashboards.
    """

    __tablename__ = "production_events"

    # Event Details
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    event_type: Mapped[EventType] = mapped_column(
        SQLEnum(EventType, native_enum=False), default=EventType.SCAN
    )

    # Quantity Change (Positive for production, negative for corrections)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Data Source FK (renamed from line_id after migration)
    data_source_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("data_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    style_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("styles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Link to parent Production Run (Day/Shift Summary)
    production_run_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("production_runs.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Traceability
    source_import_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("raw_imports.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Payload (Sensor data, or original Excel row data)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    data_source: Mapped["DataSource"] = relationship("DataSource")
    order: Mapped["Order"] = relationship("Order")
    style: Mapped["Style"] = relationship("Style")
    production_run: Mapped["ProductionRun"] = relationship(
        "ProductionRun", back_populates="events"
    )
    raw_import: Mapped["RawImport"] = relationship("RawImport")

    def __repr__(self) -> str:
        return f"<ProductionEvent(id={self.id}, type={self.event_type}, quantity={self.quantity})>"
