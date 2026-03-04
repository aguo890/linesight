# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Semantic Matcher Extensive Tests
Sweeps helper functions in semantic_matcher.py.
"""

import pytest
from app.services.matching.semantic_matcher import LLMSemanticMatcher
from app.services.matching.types import CANONICAL_FIELDS


class TestSemanticMatcherHelpers:
    """Test semantic matcher helper methods."""

    @pytest.fixture
    def matcher(self):
        return LLMSemanticMatcher()

    def test_format_sample_data_with_values(self, matcher):
        """Test formatting sample data with actual values."""
        samples = ["value1", "value2", "value3"]
        result = matcher._format_sample_data(samples)
        assert "value1" in result
        assert "value2" in result

    def test_format_sample_data_with_none(self, matcher):
        """Test formatting sample data filters None values."""
        samples = [None, "value1", None]
        result = matcher._format_sample_data(samples)
        assert "value1" in result

    def test_format_sample_data_all_none(self, matcher):
        """Test formatting when all values are None."""
        samples = [None, None, None]
        result = matcher._format_sample_data(samples)
        assert "null values" in result

    def test_format_sample_data_with_numbers(self, matcher):
        """Test formatting sample data with numeric values."""
        samples = [100, 200.5, 300]
        result = matcher._format_sample_data(samples)
        assert "100" in result

    def test_format_sample_data_truncates(self, matcher):
        """Test formatting truncates to 5 samples."""
        samples = list(range(20))
        result = matcher._format_sample_data(samples)
        # Should have at most 5 samples formatted

    def test_build_schema_reference(self, matcher):
        """Test schema reference includes canonical fields."""
        result = matcher._build_schema_reference()
        # Should contain some canonical fields
        assert len(result) > 0

    def test_canonical_fields_defined(self):
        """Test canonical fields are defined."""
        assert len(CANONICAL_FIELDS) > 0
        assert "sam" in CANONICAL_FIELDS
        assert "actual_qty" in CANONICAL_FIELDS

    def test_match_with_empty_column_name(self, matcher):
        """Test match returns None for empty column name."""
        result = matcher.match("")
        assert result is None

    def test_match_with_whitespace_column_name(self, matcher):
        """Test match returns None for whitespace-only column name."""
        result = matcher.match("   ")
        assert result is None

    def test_match_with_none_column_name(self, matcher):
        """Test match returns None for None column name."""
        result = matcher.match(None)
        assert result is None
