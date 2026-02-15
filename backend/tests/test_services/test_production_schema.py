# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Tests for Production schema validators - specifically testing messy date parsing.
"""

import uuid
from datetime import date, datetime

import pytest
from pydantic import ValidationError

from app.schemas.production import ProductionRunCreate

# Base required fields for ProductionRunCreate
# All tests should include these to satisfy schema requirements
REQUIRED_FIELDS = {
    "factory_id": str(uuid.uuid4()),
    "sam": "2.5",
    "operators_present": 25,
    "worked_minutes": "12000",
}


class TestProductionDateValidator:
    """Test the flexible date validator in ProductionRunBase."""

    def test_parse_mm_dd_format(self):
        """Test parsing MM-DD format (missing year)."""
        data = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": "12-19",
            "actual_qty": 100,
        }

        run = ProductionRunCreate(**data)

        assert isinstance(run.production_date, date)
        assert run.production_date.month == 12
        assert run.production_date.day == 19
        assert run.production_date.year == datetime.now().year

    def test_parse_mm_slash_dd_format(self):
        """Test parsing MM/DD format with forward slashes."""
        data = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": "12/19",
            "actual_qty": 100,
        }

        run = ProductionRunCreate(**data)

        assert isinstance(run.production_date, date)
        assert run.production_date.month == 12
        assert run.production_date.day == 19
        assert run.production_date.year == datetime.now().year

    def test_parse_full_date_format(self):
        """Test parsing full YYYY-MM-DD format."""
        data = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": "2025-12-19",
            "actual_qty": 100,
        }

        run = ProductionRunCreate(**data)

        assert run.production_date == date(2025, 12, 19)

    def test_parse_date_object(self):
        """Test that date objects pass through unchanged."""
        data = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": date(2025, 12, 19),
            "actual_qty": 100,
        }

        run = ProductionRunCreate(**data)

        assert run.production_date == date(2025, 12, 19)

    def test_target_qty_alias(self):
        """Test that Target_Qty from Excel maps to planned_qty."""
        data = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": "2025-12-19",
            "Target_Qty": 1000,  # Excel column name
            "actual_qty": 950,
        }

        run = ProductionRunCreate(**data)

        assert run.planned_qty == 1000

    def test_planned_qty_direct(self):
        """Test that planned_qty also works directly."""
        data = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": "2025-12-19",
            "planned_qty": 1000,
            "actual_qty": 950,
        }

        run = ProductionRunCreate(**data)

        assert run.planned_qty == 1000

    def test_invalid_date_format(self):
        """Test that invalid date formats raise validation errors."""
        data = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": "invalid-date",
            "actual_qty": 100,
        }

        with pytest.raises(ValidationError):
            ProductionRunCreate(**data)

    def test_optional_fields(self):
        """Test that optional fields work correctly."""
        data = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": "2025-12-19",
            "actual_qty": 100,
            "operators_present": 25,
            "helpers_present": 5,
            "notes": "Good production day",
        }

        run = ProductionRunCreate(**data)

        assert run.operators_present == 25
        assert run.helpers_present == 5
        assert run.notes == "Good production day"

    def test_default_values(self):
        """Test default values for fields."""
        data = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": "2025-12-19",
            # actual_qty should default to 0
            # shift should default to "day"
        }

        run = ProductionRunCreate(**data)

        assert run.actual_qty == 0
        assert run.shift == "day"

    def test_edge_case_dates(self):
        """Test edge cases for date parsing."""
        # End of month
        data1 = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": "12-31",
            "actual_qty": 100,
        }
        run1 = ProductionRunCreate(**data1)
        assert run1.production_date.day == 31

        # Beginning of month
        data2 = {
            **REQUIRED_FIELDS,
            "order_id": "order-1",
            "line_id": "line-1",
            "production_date": "01-01",
            "actual_qty": 100,
        }
        run2 = ProductionRunCreate(**data2)
        assert run2.production_date.month == 1
        assert run2.production_date.day == 1
