# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from app.services.matching.engine import MatchingEngine
from app.services.matching.types import MatchTier


def test_hash_matcher_exact():
    engine = MatchingEngine()
    result = engine.match_column("Efficiency %")
    assert result.canonical == "line_efficiency"
    assert result.tier == MatchTier.HASH
    assert result.confidence == 1.0


def test_hash_matcher_alias():
    engine = MatchingEngine()
    result = engine.match_column("pcs")
    assert result.canonical == "actual_qty"
    assert result.tier == MatchTier.HASH
    assert result.confidence == 1.0


def test_fuzzy_matcher():
    engine = MatchingEngine()
    # "Style No" should fuzzy match to "style_number" if exactly not in aliases
    # Wait, "style_no" IS in aliases. Let's try something slightly typoed.
    result = engine.match_column("Styll Number")
    assert result.canonical == "style_number"
    assert result.tier == MatchTier.FUZZY
    assert result.confidence >= 0.8


def test_unmatched_column():
    engine = MatchingEngine()
    result = engine.match_column("Xy7z9 UnlikelyString For Unchanged")
    assert result.canonical is None
    assert result.tier == MatchTier.UNMATCHED
    assert result.confidence == 0.0


def test_case_insensitivity():
    engine = MatchingEngine()
    result = engine.match_column("ACTUAL QTY")
    assert result.canonical == "actual_qty"
    assert result.tier == MatchTier.HASH


def test_operator_plurality_mismatch():
    """Verify that singular 'operator_present' maps to 'operators_present'."""
    engine = MatchingEngine()

    # Test singular variations
    res1 = engine.match_column("Operator Present")
    assert res1.canonical == "operators_present"

    res2 = engine.match_column("operator")
    assert res2.canonical == "operators_present"

    # Test with space (fuzzy/alias)
    res3 = engine.match_column("operator present")
    assert res3.canonical == "operators_present"
