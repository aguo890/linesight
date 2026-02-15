# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Column mapping and patterns for Excel parsing.
Contains fuzzy matching patterns and data type inference logic.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ColumnMatchConfidence(str, Enum):
    """Confidence level of column mapping."""

    EXACT = "exact"  # Perfect match
    FUZZY = "fuzzy"  # Close enough (e.g., "Qty" → "quantity")
    INFERRED = "inferred"  # Guessed from data type/patterns
    UNMAPPED = "unmapped"  # Couldn't map to any known field


@dataclass
class ColumnMapping:
    """Mapping between source Excel column and target database field."""

    source_column: str
    target_field: str
    confidence: ColumnMatchConfidence
    data_type: str
    sample_values: list[Any] = field(default_factory=list)
    transform_func: str | None = None  # Name of transform to apply


# Known column name variations for each target field
COLUMN_PATTERNS: dict[str, list[str]] = {
    # Style fields
    "style_number": [
        "style",
        "style#",
        "style no",
        "style number",
        "style code",
        "item",
        "item#",
        "sku",
    ],
    "description": [
        "description",
        "desc",
        "style desc",
        "item desc",
        "garment",
        "product name",
    ],
    "buyer": ["buyer", "customer", "client", "brand", "account"],
    "season": ["season", "szn", "collection", "delivery"],
    "category": ["category", "cat", "type", "product type", "garment type"],
    "sam": [
        "sam",
        "standard minute",
        "allowed minute",
        "base sam",
        "target sam",
        "smv",
    ],
    # Order fields
    "po_number": [
        "po",
        "po#",
        "po number",
        "purchase order",
        "order#",
        "order number",
        "order no",
    ],
    "quantity": ["qty", "quantity", "order qty", "total qty", "pcs", "pieces", "units"],
    "color": ["color", "colour", "col", "colorway", "shade"],
    "size": ["size", "sz", "sizes"],
    "order_date": ["order date", "po date", "received date", "booked date"],
    "ex_factory_date": [
        "ex factory",
        "exf",
        "ship date",
        "delivery date",
        "etd",
        "due date",
    ],
    # Production fields
    "production_date": [
        "date",
        "prod date",
        "production date",
        "work date",
        "shift date",
    ],
    "line_name": ["line", "line#", "line no", "production line", "cell"],
    "planned_qty": ["plan", "planned", "target", "planned qty", "target qty"],
    "actual_qty": ["actual", "output", "produced", "actual qty", "completed"],
    "worked_minutes": [
        "worked minutes",
        "worked mins",
        "total minutes",
        "prod minutes",
        "mins produced",
    ],
    "earned_minutes": [
        "earned minutes",
        "earned mins",
        "sah",
        "standard hours produced",
    ],
    "line_efficiency": [
        "efficiency",
        "eff",
        "eff %",
        "efficiency %",
        "line efficiency",
    ],
    "downtime_reason": [
        "downtime reason",
        "stop reason",
        "loss code",
        "idle reason",
    ],
    # Quality fields
    "defects": ["defects", "def", "defect count", "total defects", "reject"],
    "checked": ["checked", "inspected", "sample", "units checked", "audited"],
    "dhu": ["dhu", "dhu%", "defect rate", "defects per hundred"],
    "defect_type": ["defect type", "defect", "issue", "problem", "defect name"],
    # Fabric fields
    "lot_number": ["lot", "lot#", "lot no", "fabric lot", "roll", "roll#"],
    "fabric_type": ["fabric", "fabric type", "material", "cloth"],
    "composition": ["composition", "content", "fabric content", "fiber"],
    "origin_country": ["origin", "country", "coo", "country of origin", "made in"],
    "supplier": ["supplier", "vendor", "mill", "fabric supplier"],
    "meters": ["meters", "mtrs", "yds", "yards", "length", "consumption"],
    # Worker fields
    "operators_present": ["operators", "workers", "headcount", "manpower", "ops"],
    "helpers_present": ["helpers", "support staff"],
    "employee_id": ["emp id", "employee id", "badge", "id", "worker id", "emp#"],
    "employee_name": ["name", "employee name", "worker name", "operator name"],
    "department": ["department", "dept", "section", "area"],
    "operation": ["operation", "op", "task", "job", "process"],
}

# Data type patterns for inference
TYPE_PATTERNS = {
    "date": [
        r"\d{4}-\d{2}-\d{2}",  # ISO format
        r"\d{1,2}/\d{1,2}/\d{2,4}",  # MM/DD/YYYY
        r"\d{1,2}-\d{1,2}-\d{2,4}",  # DD-MM-YYYY
    ],
    "decimal": [r"^\d+\.\d+$", r"^\d+,\d+$"],
    "integer": [r"^\d+$"],
    "percentage": [r"\d+\.?\d*%$", r"\d+\.?\d*\s*percent"],
}
