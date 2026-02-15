# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Cutting and fabric inventory models.
FabricLot and CutTicket for material traceability.
"""

from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.factory import Factory
    from app.models.production import Order, ProductionRun
    from app.models.traceability import TraceabilityRecord
    from app.models.workforce import Worker


class FabricLot(Base, UUIDMixin, TimestampMixin):
    """
    Fabric inventory with origin tracking for UFLPA compliance.
    Links fabric to supplier and country of origin.
    """

    __tablename__ = "fabric_lots"
    __table_args__ = (
        UniqueConstraint("factory_id", "lot_number", name="uq_factory_lot"),
    )

    # Factory FK
    factory_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("factories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Lot Identification
    lot_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Fabric Details
    fabric_type: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g., 'Denim 10oz'
    composition: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # '98% Cotton 2% Elastane'
    width_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gsm: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # Grams per square meter
    color: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Supplier & Origin (Critical for UFLPA)
    supplier: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    origin_country: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    mill_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Dates
    received_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Inventory
    initial_meters: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    available_meters: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    reserved_meters: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), default=0)

    # Cost
    unit_cost: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )  # Per meter
    currency: Mapped[str | None] = mapped_column(
        String(3), default="USD", nullable=True
    )

    # Certifications (JSON array)
    certifications: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # ["OEKO-TEX", "BCI"]

    # Quality
    inspection_status: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    factory: Mapped["Factory"] = relationship(
        "Factory",
        back_populates="fabric_lots",
    )
    cut_tickets: Mapped[list["CutTicket"]] = relationship(
        "CutTicket",
        back_populates="fabric_lot",
        lazy="selectin",
    )
    traceability_records: Mapped[list["TraceabilityRecord"]] = relationship(
        "TraceabilityRecord",
        back_populates="fabric_lot",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<FabricLot(id={self.id}, lot={self.lot_number}, origin={self.origin_country})>"


class CutTicket(Base, UUIDMixin, TimestampMixin):
    """
    Cutting room instruction linking fabric to orders.
    Critical document for material traceability.
    """

    __tablename__ = "cut_tickets"

    # FKs
    fabric_lot_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("fabric_lots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Ticket Identification
    ticket_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Cut Details
    cut_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    plies: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Layer count
    marker_length_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Consumption
    consumption_meters: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    wastage_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    # Size Ratio (JSON)
    size_ratio: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # {"S":1,"M":2,"L":2,"XL":1}

    # Output
    bundle_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_pieces: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Worker
    cutter_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("workers.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    fabric_lot: Mapped["FabricLot"] = relationship(
        "FabricLot",
        back_populates="cut_tickets",
    )
    order: Mapped["Order"] = relationship(
        "Order",
        back_populates="cut_tickets",
    )
    cutter: Mapped[Optional["Worker"]] = relationship(
        "Worker",
        foreign_keys=[cutter_id],
    )
    production_runs: Mapped[list["ProductionRun"]] = relationship(
        "ProductionRun",
        back_populates="cut_ticket",
        lazy="selectin",
    )
    traceability_records: Mapped[list["TraceabilityRecord"]] = relationship(
        "TraceabilityRecord",
        back_populates="cut_ticket",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<CutTicket(id={self.id}, ticket={self.ticket_number})>"
