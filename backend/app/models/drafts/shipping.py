# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Shipping and packing models.
PackingList and Carton for shipment documentation.
"""

from datetime import date
from decimal import Decimal
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.production import Order
    from app.models.traceability import TraceabilityRecord


class ShipmentStatus(str, PyEnum):
    """Packing list / shipment status."""

    DRAFT = "draft"
    PACKING = "packing"
    READY = "ready"
    SHIPPED = "shipped"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"


class PackingList(Base, UUIDMixin, TimestampMixin):
    """
    Shipment packing list.
    Master document for cartons being shipped.
    """

    __tablename__ = "packing_lists"

    # Order FK
    order_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Identification
    packing_list_number: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )

    # Shipping Details
    ship_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    destination: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ship_to_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Carrier
    carrier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    container_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Totals
    total_cartons: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_units: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_net_weight_kg: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    total_gross_weight_kg: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    total_cbm: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 3), nullable=True
    )  # Cubic meters

    # Status
    status: Mapped[ShipmentStatus] = mapped_column(
        Enum(ShipmentStatus),
        default=ShipmentStatus.DRAFT,
        nullable=False,
    )

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    order: Mapped["Order"] = relationship(
        "Order",
    )
    cartons: Mapped[list["Carton"]] = relationship(
        "Carton",
        back_populates="packing_list",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<PackingList(id={self.id}, number={self.packing_list_number})>"


class Carton(Base, UUIDMixin, TimestampMixin):
    """
    Individual carton within a packing list.
    Contains size breakdown for contents.
    """

    __tablename__ = "cartons"

    # Packing List FK
    packing_list_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("packing_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Identification
    carton_number: Mapped[str] = mapped_column(String(50), nullable=False)

    # Contents (JSON)
    size_breakdown: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # {"S":12,"M":24,"L":12}
    color: Mapped[str | None] = mapped_column(String(100), nullable=True)
    total_units: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Weight
    net_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    gross_weight_kg: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 2), nullable=True
    )

    # Dimensions (JSON or individual columns)
    dimensions_cm: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # {"L":60,"W":40,"H":30}
    length_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Barcode
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Relationships
    packing_list: Mapped["PackingList"] = relationship(
        "PackingList",
        back_populates="cartons",
    )
    traceability_records: Mapped[list["TraceabilityRecord"]] = relationship(
        "TraceabilityRecord",
        back_populates="carton",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Carton(id={self.id}, number={self.carton_number})>"
