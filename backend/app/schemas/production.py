# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Pydantic schemas for Production domain.

This module defines Pydantic models for:
- Style: Garment design/SKU specifications
- Order: Purchase orders from buyers
- ProductionRun: Daily production output records

These schemas handle validation, serialization, and API documentation.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from pydantic import (
    AliasChoices,
    AnyHttpUrl,
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
)

from app.enums import OrderStatus, PriorityLevel

# =============================================================================
# Style Schemas
# =============================================================================


class StyleBase(BaseModel):
    """
    Base schema for garment styles.

    A style represents a unique garment design (e.g., "Men's Polo Shirt Style ABC123").
    Each style has a Standard Allowed Minute (SAM) which determines production targets.
    """

    style_number: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Unique identifier for the style (e.g., 'ABC-123', 'POLO-001')",
    )
    style_name: str | None = Field(
        None,
        max_length=255,
        description="Human-readable name (e.g., 'Classic Polo Shirt')",
    )
    description: str | None = Field(
        None, max_length=500, description="Detailed description of the garment"
    )
    buyer: str | None = Field(
        None, max_length=255, description="Brand/customer name (e.g., 'Nike', 'H&M')"
    )
    season: str | None = Field(
        None, max_length=50, description="Season code (e.g., 'SS24', 'FW25', 'AW2024')"
    )
    category: str | None = Field(
        None,
        max_length=100,
        description="Garment category (e.g., 'Tops', 'Bottoms', 'Outerwear')",
    )
    base_sam: Decimal | None = Field(
        None,
        ge=0,
        decimal_places=4,
        description="Standard Allowed Minute - time to produce one unit (e.g., 12.5 minutes)",
    )
    complexity_rating: PriorityLevel | None = Field(
        None, description="Complexity level affecting SAM adjustments"
    )
    bom_summary: dict | None = Field(
        None, description="Bill of Materials summary (fabric, trims, accessories)"
    )
    tech_pack_url: AnyHttpUrl | None = Field(
        None, description="URL to technical specification document"
    )


class StyleCreate(StyleBase):
    factory_id: str


class StyleUpdate(BaseModel):
    style_number: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    buyer: str | None = None
    season: str | None = None
    base_sam: Decimal | None = Field(None, ge=0)
    bom_summary: dict | None = None
    is_active: bool | None = None


class StyleRead(StyleBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    factory_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Order Schemas
# =============================================================================


class OrderBase(BaseModel):
    """
    Base schema for purchase orders.

    An order represents a buyer's purchase order for a specific style.
    Includes TNA (Time and Action) dates for production planning.
    """

    po_number: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Purchase Order number from buyer (e.g., 'PO-2024-001')",
    )
    quantity: int = Field(..., gt=0, description="Total order quantity in units")
    size_breakdown: dict | None = Field(
        None, description="Quantity per size (e.g., {'S': 100, 'M': 200, 'L': 150})"
    )
    uom: str = Field(
        "pcs", max_length=20, description="Unit of measure (pcs, dozen, etc.)"
    )
    color: str | None = Field(
        None,
        max_length=100,
        description="Color/colorway (e.g., 'Navy Blue', 'Heather Grey')",
    )
    order_date: date | None = Field(None, description="Date order was received")

    # TNA (Time & Action) Dates
    planned_cut_date: date | None = Field(
        None,
        validation_alias=AliasChoices("planned_cut_date", "PCD"),
        description="Planned Cut Date (PCD) - when fabric cutting should start",
    )
    planned_sew_date: date | None = Field(
        None,
        validation_alias=AliasChoices("planned_sew_date", "PSD"),
        description="Planned Sew Date (PSD) - when sewing should start",
    )
    ex_factory_date: date | None = Field(
        None,
        validation_alias=AliasChoices("ex_factory_date", "EXD", "X-Factory"),
        description="Ex-Factory Date (EXD) - deadline for shipment from factory",
    )

    status: OrderStatus = Field(
        OrderStatus.PENDING, description="Current order status in production lifecycle"
    )
    priority: PriorityLevel = Field(
        PriorityLevel.NORMAL, description="Order priority level"
    )
    notes: str | None = Field(
        None, description="Additional notes or special instructions"
    )

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v):
        if v > 1_000_000:
            pass  # Warning logic could go here
        return v


class OrderCreate(OrderBase):
    style_id: str


class OrderUpdate(BaseModel):
    quantity: int | None = Field(None, gt=0)
    status: str | None = None
    priority: str | None = None
    size_breakdown: dict | None = None
    qty_cut: int | None = Field(None, ge=0)
    qty_sewn: int | None = Field(None, ge=0)
    qty_packed: int | None = Field(None, ge=0)
    qty_shipped: int | None = Field(None, ge=0)
    actual_ship_date: date | None = None


class OrderRead(OrderBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    style_id: str
    qty_cut: int
    qty_sewn: int
    qty_packed: int
    qty_shipped: int
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Production Run Schemas
# =============================================================================


class ProductionRunBase(BaseModel):
    """
    Base schema for daily production run records.

    A production run captures a single shift's output from a production line,
    tracking planned vs actual quantities, workforce, and calculating efficiency.

    Key Metrics:
    - earned_minutes: actual_qty × SAM (computed)
    - efficiency: (earned_minutes / available_minutes) × 100 (computed)
    """

    factory_id: str = Field(..., description="UUID of the factory")
    production_date: date = Field(..., description="Date when production occurred")
    shift: str = Field(
        "day",
        pattern="^(day|night|A|B|C)$",
        description="Shift identifier (day/night for 2-shift, A/B/C for 3-shift)",
    )
    inspection_date: date | None = Field(
        None,
        validation_alias=AliasChoices("inspection_date", "Inspection_Date"),
        description="Date when quality inspection was performed",
    )

    # Production Quantities
    planned_qty: int = Field(
        0,
        ge=0,
        validation_alias=AliasChoices("planned_qty", "Target", "Target_Qty"),
        description="Target/planned output quantity for the shift",
    )
    actual_qty: int = Field(
        0,
        ge=0,
        validation_alias=AliasChoices("actual_qty", "Passed_Qty", "Output"),
        description="Actual good pieces produced (passed QC)",
    )

    # Time Standards
    sam: Decimal | None = Field(
        None,
        ge=0,
        validation_alias=AliasChoices("sam", "SAM", "SMV"),
        decimal_places=4,
        description="Standard Allowed Minute - time to produce one unit",
    )

    # Workforce
    operators_present: int = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("operators_present", "Manpower", "Operators"),
        description="Number of sewing operators present",
    )
    helpers_present: int = Field(
        0,
        ge=0,
        validation_alias=AliasChoices("helpers_present", "Helpers"),
        description="Number of helpers/assistants present",
    )
    worked_minutes: Decimal = Field(
        ...,
        ge=0,
        description="Total minutes the line worked (e.g., 480 for 8hr, 600 for 10hr shift)",
    )

    notes: str | None = Field(
        None,
        validation_alias=AliasChoices("notes", "Comments"),
        description="Additional notes or remarks",
    )

    # Fabric Traceability (for compliance)
    lot_number: str | None = Field(
        None,
        validation_alias=AliasChoices("lot_number", "Lot_No"),
        description="Fabric lot number for traceability",
    )
    shade_band: str | None = Field(
        None,
        max_length=10,
        pattern="^[A-Z0-9]+$",
        description="Shade band code (e.g., 'A1', 'B2') for color consistency",
    )
    batch_number: str | None = Field(
        None,
        max_length=50,
        validation_alias=AliasChoices("batch_number", "Batch_ID"),
        description="Production batch identifier",
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def earned_minutes(self) -> Decimal:
        """Computed: Actual Qty * SAM"""
        if self.sam is None:
            return Decimal(0)
        return Decimal(self.actual_qty) * self.sam

    @field_validator("production_date", "inspection_date", mode="before")
    @classmethod
    def parse_flexible_date(cls, v):
        """Handle standard formats and Excel serial dates."""
        if v is None:
            return None
        if isinstance(v, (date, datetime)):
            return v if isinstance(v, date) else v.date()

        # Handle Excel Serial Dates (e.g., 45271 or 45271.0)
        v_str = str(v).strip()
        try:
            # Check if float/int string
            if v_str.replace(".", "", 1).isdigit():
                serial = float(v_str)
                # Excel base date is Dec 30, 1899
                return date(1899, 12, 30) + timedelta(days=int(serial))
        except ValueError:
            pass

        # Handle String Formats
        # 1. MM-DD (Current Year Assumption)
        if "-" in v_str or "/" in v_str:
            clean_v = v_str.replace("/", "-")
            parts = clean_v.split("-")

            # Case: 12-19 (Missing Year)
            if len(parts) == 2:
                # Zero Tolerance: Do not guess current year
                return None

            # Case: 19-12-2024 (DD-MM-YYYY) or 12-19-2024 (MM-DD-YYYY)
            # Pydantic's default parser handles ISO (YYYY-MM-DD) well, so we try to catch the others
            # This is risky without knowing locale, but we assume standard US or ISO.

        return v


class ProductionRunCreate(ProductionRunBase):
    order_id: str
    line_id: str


class ProductionRunUpdate(BaseModel):
    actual_qty: int | None = None
    worked_minutes: Decimal | None = None
    operators_present: int | None = None
    sam: Decimal | None = None
    wip_end: int | None = None


class ProductionRunRead(ProductionRunBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_id: str
    line_id: str
    # earned_minutes is inherited as a computed_field
    efficiency: Decimal | None = Field(
        None, description="Computed: (Earned / Available) * 100"
    )
    created_at: datetime
    updated_at: datetime

    # --- DENORMALIZED FIELDS (Phase 3) ---
    # Timestamps
    start_time: time | None = Field(None, description="Production start time")
    end_time: time | None = Field(None, description="Production end time")

    # Order Details
    style_number: str | None = Field(None, description="Style number (denormalized)")
    buyer: str | None = Field(None, description="Buyer/customer name (denormalized)")
    season: str | None = Field(None, description="Season code (denormalized)")
    po_number: str | None = Field(None, description="PO number (denormalized)")
    color: str | None = Field(None, description="Color/colorway (denormalized)")
    size: str | None = Field(None, description="Size (denormalized)")

    # Quality Metrics
    defects: int = Field(0, description="Number of defects found")
    dhu: Decimal | None = Field(None, description="Defects per Hundred Units")

    # Efficiency Override
    line_efficiency: Decimal | None = Field(None, description="Explicit line efficiency value")
