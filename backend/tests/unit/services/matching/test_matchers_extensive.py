# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Matching Engine Extensive Tests
Sweeps hash_matcher using pure algorithmic tests.
"""

import pytest

from app.services.matching.hash_matcher import HashAliasMatcher
from app.services.matching.types import MatchTier


class TestHashMatcherNormalization:
    """Test hash matcher normalization logic."""

    @pytest.mark.parametrize(
        "input_val,expected",
        [
            ("SAM", "sam"),
            ("Standard Allowed Minute", "standard_allowed_minute"),
            ("standard-minute-value", "standard_minute_value"),
            ("dhu", "dhu"),
            ("Defects Per Hundred", "defects_per_hundred"),
            ("Efficiency %", "efficiency_pct"),
            ("actual_qty", "actual_qty"),
            ("Production Count", "production_count"),
            ("    spaces   ", "spaces"),
            ("UPPER", "upper"),
            ("MiXeD", "mixed"),
            ("efficiency%", "efficiency_pct"),
            ("__multiple__underscores__", "multiple_underscores"),
        ],
    )
    def test_normalize_variations(self, input_val, expected):
        """Test various normalization scenarios."""
        result = HashAliasMatcher.normalize(input_val)
        assert result == expected

    def test_normalize_empty_string(self):
        """Test normalization of empty string."""
        result = HashAliasMatcher.normalize("")
        assert result == ""

    def test_normalize_none(self):
        """Test normalization of None."""
        result = HashAliasMatcher.normalize(None)
        assert result == ""


class TestHashMatcherCanonicalAliases:
    """Test built-in canonical alias matching."""

    def test_match_sam_variations(self):
        """Test SAM variations resolve to sam."""
        matcher = HashAliasMatcher()

        for alias in [
            "sam",
            "smv",
            "standard_allowed_minute",
            "standard minute",
            "sewing time",
        ]:
            result = matcher.match(alias)
            assert result is not None
            assert result.canonical == "sam"
            assert result.tier == MatchTier.HASH

    def test_match_dhu_variations(self):
        """Test DHU variations resolve to dhu."""
        matcher = HashAliasMatcher()

        for alias in [
            "dhu",
            "defects_per_hundred",
            "defect rate",
            "fail_rate",
            "rejection_rate",
        ]:
            result = matcher.match(alias)
            assert result is not None
            assert result.canonical == "dhu"

    def test_match_efficiency_variations(self):
        """Test efficiency variations resolve to line_efficiency."""
        matcher = HashAliasMatcher()

        for alias in [
            "efficiency",
            "line_efficiency",
            "eff",
            "eff_pct",
            "efficiency_pct",
            "performance",
        ]:
            result = matcher.match(alias)
            assert result is not None
            assert result.canonical == "line_efficiency"

    def test_match_production_qty_variations(self):
        """Test production quantity variations resolve to actual_qty."""
        matcher = HashAliasMatcher()

        for alias in [
            "actual_qty",
            "production_count",
            "output",
            "pieces",
            "pcs",
            "units",
            "qty",
            "quantity",
            "produced",
            "produced_qty",
        ]:
            result = matcher.match(alias)
            assert result is not None
            assert result.canonical == "actual_qty"

    def test_match_target_variations(self):
        """Test target variations resolve to planned_qty."""
        matcher = HashAliasMatcher()

        for alias in [
            "planned_qty",
            "target",
            "target_qty",
            "target_output",
            "daily_target",
            "target_quantity",
        ]:
            result = matcher.match(alias)
            assert result is not None
            assert result.canonical == "planned_qty"

    def test_match_defects_variations(self):
        """Test defects variations resolve to defects."""
        matcher = HashAliasMatcher()

        for alias in [
            "defects",
            "defect_count",
            "total_defects",
            "no_of_defects",
            "rejects",
            "rejected",
        ]:
            result = matcher.match(alias)
            assert result is not None
            assert result.canonical == "defects"

    def test_match_workforce_variations(self):
        """Test workforce variations resolve correctly."""
        matcher = HashAliasMatcher()

        # Operators
        result = matcher.match("operators")
        assert result is not None
        assert result.canonical == "operators_present"

        result = matcher.match("helpers")
        assert result is not None
        assert result.canonical == "helpers_present"

        result = matcher.match("manpower")
        assert result is not None
        assert result.canonical == "total_manpower"

    def test_match_date_variations(self):
        """Test date variations resolve to production_date."""
        matcher = HashAliasMatcher()

        for alias in [
            "production_date",
            "date",
            "prod_date",
            "work_date",
            "shift_date",
        ]:
            result = matcher.match(alias)
            assert result is not None
            assert result.canonical == "production_date"

    def test_match_identifier_variations(self):
        """Test identifier variations resolve correctly."""
        matcher = HashAliasMatcher()

        # Style
        result = matcher.match("style_number")
        assert result is not None
        assert result.canonical == "style_number"

        result = matcher.match("style")
        assert result is not None
        assert result.canonical == "style_number"

        result = matcher.match("sku")
        assert result is not None
        assert result.canonical == "style_number"

        # PO
        result = matcher.match("po_number")
        assert result is not None
        assert result.canonical == "po_number"

        result = matcher.match("po")
        assert result is not None
        assert result.canonical == "po_number"

    def test_match_no_match(self):
        """Test unmatched columns return None."""
        matcher = HashAliasMatcher()

        result = matcher.match("xyz_unknown_column_123")
        assert result is None

        result = matcher.match("foo_bar_baz")
        assert result is None

        result = matcher.match("")
        assert result is None

    def test_match_case_insensitive(self):
        """Test case insensitivity."""
        matcher = HashAliasMatcher()

        result_lower = matcher.match("sam")
        result_upper = matcher.match("SAM")
        result_mixed = matcher.match("Sam")

        assert result_lower is not None
        assert result_upper is not None
        assert result_mixed is not None

        assert (
            result_lower.canonical
            == result_upper.canonical
            == result_mixed.canonical
            == "sam"
        )

    def test_match_confidence_scores(self):
        """Test confidence scores for different alias types."""
        matcher = HashAliasMatcher()

        # Built-in canonical alias
        result = matcher.match("sam")
        assert result is not None
        assert result.confidence == 1.0

        # Empty string
        result = matcher.match("")
        assert result is None

    def test_match_factory_scoped(self):
        """Test factory-scoped alias priority."""
        matcher = HashAliasMatcher()

        # Manually add a factory alias
        matcher._factory_aliases["factory-123"] = {"custom_col": "sam"}

        result = matcher.match("custom_col", factory_id="factory-123")
        assert result is not None
        assert result.canonical == "sam"
        assert result.confidence == 1.0

    def test_match_org_scoped(self):
        """Test organization-scoped alias priority."""
        matcher = HashAliasMatcher()

        # Manually add an org alias
        matcher._org_aliases["org-456"] = {"org_col": "dhu"}

        result = matcher.match("org_col", org_id="org-456")
        assert result is not None
        assert result.canonical == "dhu"
        assert result.confidence == 0.99

    def test_match_global_learned(self):
        """Test global learned alias priority."""
        matcher = HashAliasMatcher()

        # Manually add a global alias
        matcher._global_aliases["learned_col"] = "line_efficiency"

        result = matcher.match("learned_col")
        assert result is not None
        assert result.canonical == "line_efficiency"
        assert result.confidence == 0.98

    def test_priority_order_factory_first(self):
        """Test that factory-scoped aliases have highest priority."""
        matcher = HashAliasMatcher()

        # Both resolve to different things
        matcher._factory_aliases["factory-123"] = {"sam": "custom_target_1"}
        matcher._global_aliases["sam"] = "global_target_2"

        result = matcher.match("sam", factory_id="factory-123")
        assert result is not None
        assert result.canonical == "custom_target_1"
        assert result.reasoning == "Matched via factory-specific alias"

    def test_priority_order_org_second(self):
        """Test that org-scoped aliases come after factory."""
        matcher = HashAliasMatcher()

        # Both resolve to different things
        matcher._org_aliases["org-456"] = {"sam": "org_target"}
        matcher._global_aliases["sam"] = "global_target"

        result = matcher.match("sam", org_id="org-456")  # No factory
        assert result is not None
        assert result.canonical == "org_target"
        assert result.reasoning == "Matched via organization alias"


class TestHashMatcherEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_whitespace_only(self):
        """Test whitespace-only input."""
        matcher = HashAliasMatcher()
        result = matcher.match("   ")
        assert result is None

    def test_special_characters(self):
        """Test special characters are handled."""
        matcher = HashAliasMatcher()

        # These should normalize and potentially match
        result = matcher.match("sam@#$")
        # May or may not match depending on what remains after normalization

    def test_unicode_characters(self):
        """Test unicode handling."""
        matcher = HashAliasMatcher()
        result = matcher.match("säm")
        # Normalization should handle unicode

    def test_very_long_string(self):
        """Test very long string handling."""
        matcher = HashAliasMatcher()
        long_str = "a" * 1000
        result = matcher.match(long_str)
        # Should not crash

    def test_numbers_in_string(self):
        """Test strings with numbers."""
        matcher = HashAliasMatcher()

        result = matcher.match("style_123")
        # Should normalize but probably not match

    def test_leading_trailing_underscores(self):
        """Test leading/trailing underscores are stripped."""
        result = HashAliasMatcher.normalize("__sam__")
        assert result == "sam"

    def test_multiple_separators(self):
        """Test multiple types of separators."""
        result = HashAliasMatcher.normalize("hello-world_test_value")
        assert result == "hello_world_test_value"
