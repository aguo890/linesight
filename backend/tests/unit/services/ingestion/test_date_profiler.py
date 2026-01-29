"""
Unit tests for Date Format Profiler - Constraint Elimination Algorithm.

Tests edge cases including:
- Clear ISO format (middle > 12)
- Clear SWAP format (last > 12) 
- Ambiguous data (all values ≤ 12)
- Invalid dates (e.g., 2025-13-13, 2025-02-30)
- Empty lists
- Mixed separators
- Non-date strings
"""

from app.services.ingestion.date_profiler import (
    detect_column_format,
    profile_date_column,
)


class TestDetectColumnFormat:
    """Test constraint elimination algorithm."""

    # =========================================================================
    # Clear Format Detection
    # =========================================================================

    def test_detects_iso_when_last_exceeds_12(self):
        """
        When last value > 12, it cannot be month, proving YYYY-MM-DD.
        Data: 2025-01-15 (Middle=1, Last=15)
        """
        dates = [
            "2025-01-15",  # Middle=1, Last=15 -> Last > 12, proves ISO
            "2025-03-22",
            "2025-06-28",
        ]
        result = detect_column_format(dates)

        assert result.format == "%Y-%m-%d"
        assert result.format_label == "YYYY-MM-DD"
        assert result.confidence == 1.0
        assert result.ambiguous is False
        assert result.eliminating_value == "2025-01-15"

    def test_detects_swap_when_middle_exceeds_12(self):
        """
        When middle value > 12, it cannot be month, proving YYYY-DD-MM.
        Data: 2025-15-01 (Middle=15, Last=1)
        """
        dates = [
            "2025-15-01",  # Middle=15, Last=1 -> Middle > 12, proves SWAP
            "2025-22-03",
            "2025-28-06",
        ]
        result = detect_column_format(dates)

        assert result.format == "%Y-%d-%m"
        assert result.format_label == "YYYY-DD-MM"
        assert result.confidence == 1.0
        assert result.ambiguous is False

    def test_early_exit_on_first_proof(self):
        """Should stop scanning once format is confirmed."""
        dates = [
            "2025-01-15",  # Proves ISO immediately
            "2025-13-01",  # Would prove SWAP if reached (but shouldn't be)
        ]
        result = detect_column_format(dates)

        # ISO should win because it's found first
        assert result.format == "%Y-%m-%d"
        assert result.sample_size == 1  # Stopped after first proof

    # =========================================================================
    # Ambiguous Data
    # =========================================================================

    def test_ambiguous_when_all_values_under_12(self):
        """When all middle AND last values ≤ 12, format is ambiguous."""
        dates = [
            "2025-01-02",  # Could be Jan 2 or Feb 1
            "2025-03-04",  # Could be Mar 4 or Apr 3
            "2025-06-07",  # Could be Jun 7 or Jul 6
            "2025-10-11",  # Could be Oct 11 or Nov 10
        ]
        result = detect_column_format(dates)

        assert result.format == "%Y-%m-%d"  # Default to ISO
        assert result.confidence == 0.5
        assert result.ambiguous is True
        assert result.eliminating_value is None

    def test_single_ambiguous_value(self):
        """Single ambiguous value should still default to ISO."""
        dates = ["2025-06-06"]
        result = detect_column_format(dates)

        assert result.ambiguous is True
        assert result.format == "%Y-%m-%d"

    # =========================================================================
    # Edge Cases: Invalid Dates
    # =========================================================================

    def test_impossible_date_both_exceed_12(self):
        """When both middle AND last > 12, neither format works."""
        dates = [
            "2025-13-14",  # Middle=13, Last=14 -> both > 12, impossible!
        ]
        result = detect_column_format(dates)

        # Should return UNKNOWN with 0 confidence
        assert result.confidence == 0.0
        assert result.format_label == "UNKNOWN"
        assert result.ambiguous is True

    def test_mixed_constraint_violations(self):
        """Mixed data with conflicting constraints."""
        dates = [
            "2025-01-15",  # Proves ISO (last > 12)
            "2025-15-01",  # Proves SWAP (middle > 12) - conflict!
        ]
        result = detect_column_format(dates)

        # First proof wins (ISO), but this is technically bad data
        assert result.format == "%Y-%m-%d"

    def test_february_30_invalid(self):
        """Feb 30 is invalid but profiler only checks numeric ranges, not calendar validity."""
        dates = ["2025-02-30"]  # Invalid date, but profiler should still work
        result = detect_column_format(dates)

        # Last > 12, so this proves ISO
        assert result.format == "%Y-%m-%d"
        assert result.confidence == 1.0

    # =========================================================================
    # Edge Cases: Empty and Invalid Input
    # =========================================================================

    def test_empty_list(self):
        """Empty list should return ambiguous default."""
        result = detect_column_format([])

        assert result.format == "%Y-%m-%d"
        assert result.ambiguous is True
        assert result.sample_size == 0

    def test_none_values_skipped(self):
        """None values should be skipped gracefully."""
        dates = [None, "", "2025-01-15", None]
        result = detect_column_format(dates)

        assert result.format == "%Y-%m-%d"
        assert result.sample_size == 1

    def test_non_date_strings_skipped(self):
        """Non-date strings should be skipped."""
        dates = [
            "hello world",
            "not a date",
            "2025-01-15",  # Only valid date
            "abc123",
        ]
        result = detect_column_format(dates)

        assert result.sample_size == 1
        assert result.format == "%Y-%m-%d"

    # =========================================================================
    # Separator Handling
    # =========================================================================

    def test_slash_separator(self):
        """Should work with slash separators."""
        dates = ["2025/01/15", "2025/03/22"]
        result = detect_column_format(dates)

        assert result.format == "%Y-%m-%d"  # Returns standard format
        assert result.confidence == 1.0

    def test_dot_separator(self):
        """Should work with dot separators."""
        dates = ["2025.01.15", "2025.03.22"]
        result = detect_column_format(dates)

        assert result.format == "%Y-%m-%d"
        assert result.confidence == 1.0

    def test_mixed_separators(self):
        """Mixed separators in same column (unusual but handled)."""
        dates = ["2025-01-15", "2025/03/22", "2025.06.28"]
        result = detect_column_format(dates)

        assert result.confidence == 1.0
        assert result.format == "%Y-%m-%d"

    # =========================================================================
    # Sample Size Limiting
    # =========================================================================

    def test_respects_max_sample(self):
        """Should limit analysis to max_sample values."""
        # Create 200 ambiguous dates
        dates = [f"2025-0{i % 9 + 1}-0{(i + 1) % 9 + 1}" for i in range(200)]

        result = detect_column_format(dates, max_sample=50)

        # Should only have analyzed up to 50
        assert result.sample_size <= 50


class TestProfileDateColumn:
    """Test the dict-returning wrapper function."""

    def test_returns_dict_with_expected_keys(self):
        """Should return dict with all expected keys."""
        dates = ["2025-01-15", "2025-03-22"]
        profile = profile_date_column(dates, column_name="test_date")

        expected_keys = {
            "column",
            "detected_format",
            "strptime_format",
            "confidence",
            "ambiguous",
            "sample_size",
            "proof_value",
        }
        assert set(profile.keys()) == expected_keys
        assert profile["column"] == "test_date"

    def test_profile_matches_detect_result(self):
        """Profile dict should match detect_column_format result."""
        dates = ["2025-01-15"]

        detect_result = detect_column_format(dates)
        profile = profile_date_column(dates)

        assert profile["strptime_format"] == detect_result.format
        assert profile["detected_format"] == detect_result.format_label
        assert profile["confidence"] == detect_result.confidence
        assert profile["ambiguous"] == detect_result.ambiguous
