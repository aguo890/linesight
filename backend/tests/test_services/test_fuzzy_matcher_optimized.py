# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from app.services.matching.fuzzy_matcher import RapidFuzzMatcher


def test_fuzzy_matcher_wratio_handling():
    """Test that WRatio handles reordering and substrings better than token_sort_ratio."""
    matcher = RapidFuzzMatcher()

    # Reordering
    result = matcher.match("Line 5 Efficiency")
    assert result is not None
    assert result.canonical == "line_efficiency"
    assert result.confidence > 0.8

    # Substring
    result = matcher.match("Target Production (Daily)")
    assert result is not None
    assert result.canonical == "planned_qty"

    # Noise handling
    result = matcher.match("Total Actual Qty *")
    assert result is not None
    assert result.canonical == "actual_qty"


def test_short_word_protection():
    """Test that short words like 'SAM' require exact or very high confidence matches."""
    matcher = RapidFuzzMatcher()

    # Exact match for SAM
    result = matcher.match("SAM")
    assert result is not None
    assert result.canonical == "sam"
    assert result.confidence == 1.0

    # SAM in a different context (should not match too aggressively)
    # "Sample Count" contains "Sam" but isn't SAM.
    # RapidFuzz might give a high score, but our length check should stop it.
    result = matcher.match("Sample Count")
    if result:
        # If it matches, it shouldn't be 'sam' unless it's very confident
        assert result.canonical != "sam" or result.confidence == 1.0


def test_industry_variations():
    """Test new industry-specific variations."""
    matcher = RapidFuzzMatcher()

    variations = [
        ("Style Name", "style_number"),
        ("Article", "style_number"),
        ("SMV", "sam"),
        ("Daily Target", "planned_qty"),
        ("Quota", "planned_qty"),
        ("Produced Pieces", "actual_qty"),
    ]

    for input_name, expected_canonical in variations:
        result = matcher.match(input_name)
        assert result is not None, f"Failed to match {input_name}"
        assert result.canonical == expected_canonical, (
            f"Matched {input_name} to {result.canonical}, expected {expected_canonical}"
        )


def test_match_with_alternatives_deduplication():
    """Test that alternatives are unique by canonical field."""
    matcher = RapidFuzzMatcher()

    # "Production" might match "production_date", "actual_qty" (variation "production count"), etc.
    results = matcher.match_with_alternatives("Production", top_n=5)

    canonicals = [r.canonical for r in results]
    assert len(canonicals) == len(set(canonicals)), "Duplicates found in alternatives"


def test_performance_cached_keys():
    """Basic check that it initializes correctly and has search keys."""
    matcher = RapidFuzzMatcher()
    assert len(matcher._search_keys) > 0
    assert "sam" in matcher._search_keys
    assert matcher._variation_map["sam"] == "sam"
