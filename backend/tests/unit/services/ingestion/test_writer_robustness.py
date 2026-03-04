# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Ingestion Writer Robustness Tests
Sweeps the missing 34% in writer.py.
"""

from datetime import time, datetime
import pytest
from app.services.ingestion.writer import _parse_time


class TestParseTime:
    """Test time parsing utility."""

    @pytest.mark.parametrize(
        "input_val,expected",
        [
            (None, None),
            ("08:00", time(8, 0)),
            ("14:30:00", time(14, 30, 0)),
            ("08:30", time(8, 30)),
            ("", None),
            ("   ", None),
        ],
    )
    def test_parse_time_valid(self, input_val, expected):
        """Test valid time parsing."""
        result = _parse_time(input_val)
        assert result == expected

    def test_parse_time_with_datetime(self):
        """Test parsing datetime object."""
        dt = datetime(2024, 1, 15, 10, 30, 0)
        result = _parse_time(dt)
        assert result == time(10, 30, 0)

    def test_parse_time_already_time(self):
        """Test passing time object returns as-is."""
        t = time(9, 15)
        result = _parse_time(t)
        assert result == t

    def test_parse_time_invalid_format(self):
        """Test invalid time string returns None."""
        result = _parse_time("not-a-time")
        assert result is None

    def test_parse_time_12_hour_format(self):
        """Test 12-hour format parsing."""
        result = _parse_time("02:30 PM")
        assert result == time(14, 30)

    def test_parse_time_12_hour_with_seconds(self):
        """Test 12-hour format with seconds."""
        result = _parse_time("09:15:30 AM")
        assert result == time(9, 15, 30)
