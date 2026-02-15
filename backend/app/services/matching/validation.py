# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Validation utilities for matching engine and domain models.
"""

import logging
from typing import Any

from app.models.production import Order, ProductionRun, Style
from app.models.quality import QualityInspection
from app.services.matching.types import CANONICAL_FIELDS

logger = logging.getLogger(__name__)

# Registry mapping canonical keys to their primary target models/attributes
# Format: "canonical_key": (ModelClass, "model_attribute")
CANONICAL_MODEL_MAPPING: dict[str, Any] = {
    # Metrics (ProductionRun)
    "actual_qty": (ProductionRun, "actual_qty"),
    "planned_qty": (ProductionRun, "planned_qty"),
    "defects": (QualityInspection, "defects_found"),
    "dhu": (QualityInspection, "dhu"),
    "line_efficiency": (ProductionRun, "efficiency"),
    "sam": (ProductionRun, "sam"),
    "earned_minutes": (ProductionRun, "earned_minutes"),
    "worked_minutes": (ProductionRun, "worked_minutes"),
    "downtime_minutes": (ProductionRun, "downtime_minutes"),
    # Workforce (ProductionRun)
    "operators_present": (ProductionRun, "operators_present"),
    "helpers_present": (ProductionRun, "helpers_present"),
    "total_manpower": (ProductionRun, "total_manpower"),
    # Time (ProductionRun)
    "production_date": (ProductionRun, "production_date"),
    "inspection_date": (ProductionRun, "inspection_date"),
    "shift": (ProductionRun, "shift"),
    # Identifiers
    "style_number": (Style, "style_number"),
    "po_number": (Order, "po_number"),
    "line_id": (ProductionRun, "line_id"),
    "order_id": (ProductionRun, "order_id"),
    "lot_number": (ProductionRun, "lot_number"),
    "batch_number": (ProductionRun, "batch_number"),
    "color": (Order, "color"),
    "size": (Order, "size_breakdown"),  # Maps to the JSON field
    "buyer": (Style, "buyer"),
    "season": (Style, "season"),
    "notes": (ProductionRun, "notes"),
}


def validate_canonical_mapping():
    """
    Validates that every defined canonical field in CANONICAL_FIELDS
    exists on its assigned ORM model attribute.
    """
    errors = []

    for field_name in CANONICAL_FIELDS:
        if field_name not in CANONICAL_MODEL_MAPPING:
            logger.warning(
                f"Canonical field '{field_name}' is not registered in CANONICAL_MODEL_MAPPING for validation."
            )
            continue

        model, attr_name = CANONICAL_MODEL_MAPPING[field_name]

        # Check if attribute exists on the model
        if not hasattr(model, attr_name):
            error_msg = f"Canonical field '{field_name}' maps to missing attribute '{attr_name}' in model {model.__name__}"
            logger.error(error_msg)
            errors.append(error_msg)

    if errors:
        raise ValueError("Canonical mapping validation failed:\n" + "\n".join(errors))

    logger.info("Canonical mapping validation passed.")
    return True
