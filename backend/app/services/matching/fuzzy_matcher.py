"""
Tier 2: RapidFuzz Matcher.

Provides high-performance fuzzy matching for typos and variations.
Uses the RapidFuzz library (C++ implementation, 10-100x faster than FuzzyWuzzy).

Algorithms used:
- token_sort_ratio: Handles word reordering (e.g., "Line Efficiency" = "Efficiency Line")
- partial_ratio: Detects substrings (e.g., "Total SAM" matches "SAM")

Performance: <5ms per column
"""

from rapidfuzz import fuzz, process, utils

from app.services.matching.types import (
    CANONICAL_FIELDS,
    ColumnMatchResult,
    MatchResult,
    MatchTier,
)


class RapidFuzzMatcher:
    """
    Tier 2: Optimized fuzzy matching.
    """

    HIGH_CONFIDENCE_THRESHOLD = 90
    MEDIUM_CONFIDENCE_THRESHOLD = 75
    LOW_CONFIDENCE_THRESHOLD = 60

    FIELD_VARIATIONS = {
        "sam": [
            "standard allowed minute",
            "smv",
            "sewing time",
            "operation time",
            "allowed minutes",
            "standard minute",
        ],
        "dhu": [
            "defects per hundred",
            "defect rate",
            "fail rate",
            "quality rate",
            "dhu percentage",
        ],
        "line_efficiency": [
            "efficiency",
            "line efficiency",
            "eff pct",
            "performance",
            "output pct",
            "manpower efficiency",
        ],
        "actual_qty": [
            "production count",
            "output",
            "pieces",
            "actual qty",
            "total actual qty",
            "qty",
            "produced",
            "sewn qty",
            "total pieces",
            "pcs",
        ],
        "planned_qty": [
            "target",
            "daily target",
            "plan",
            "quota",
            "scheduled qty",
            "required output",
            "target qty",
        ],
        "operators_present": [
            "operators",
            "operator",
            "sewers",
            "active operators",
            "operators present",
            "operator present",
            "operator count",
        ],
        "helpers_present": [
            "helpers",
            "helper",
            "helpers count",
            "helpers present",
            "checkers",
        ],
        "total_manpower": [
            "manpower",
            "headcount",
            "total manpower",
            "total headcount",
            "on roll",
        ],
        "style_number": [
            "style code",
            "style name",
            "article",
            "sku",
            "item code",
            "style number",
            "style",
        ],
        "po_number": ["po number", "purchase order", "order number", "po", "po#"],
        "line_name": ["line name", "line", "production line", "sewing line", "line #"],
        "defects": [
            "defect count",
            "defects found",
            "rejected",
            "rejects",
            "fail count",
            "defects",
            "bad quality",
        ],
        "production_date": ["production date", "date", "work date", "shift date"],
    }

    def __init__(self, custom_targets: list[str] | None = None):
        self.targets = custom_targets or CANONICAL_FIELDS

        # Pre-compute dictionary for O(1) lookup: Variation -> Canonical
        self._variation_map: dict[str, str] = {}
        self._build_map()

        # Pre-cache the keys for RapidFuzz performance
        self._search_keys = list(self._variation_map.keys())

    def _build_map(self) -> None:
        """Builds a flat lookup map once."""
        # 1. Add industry variations first
        for canonical, variations in self.FIELD_VARIATIONS.items():
            if canonical not in self.targets:
                continue
            for v in variations:
                self._variation_map[v] = canonical

        # 2. Add canonicals themselves (Highest Priority)
        for field in self.targets:
            self._variation_map[field] = field
            # Add space version (actual_qty -> actual qty)
            self._variation_map[field.replace("_", " ")] = field

    def match(
        self,
        column_name: str,
        threshold: int = LOW_CONFIDENCE_THRESHOLD,
    ) -> MatchResult | None:
        if not column_name:
            return None

        # RapidFuzz can take a 'processor' to handle lowercase/strip/clean automatically
        # fuzz.WRatio is much better for headers (handles substrings + reordering)
        result = process.extractOne(
            column_name,
            self._search_keys,
            scorer=fuzz.WRatio,
            processor=utils.default_process,
            score_cutoff=threshold,
        )

        if not result:
            return None

        matched_key, score, _ = result
        canonical = self._variation_map.get(matched_key)

        if not canonical or canonical not in self.targets:
            return None

        # Logic: If it's a very short word (like 'SAM') and score isn't 100,
        # fuzzy matching can be dangerous.
        if len(matched_key) <= 3 and score < 100:
            return None

        return MatchResult(
            canonical=canonical,
            confidence=score / 100.0,
            tier=MatchTier.FUZZY,
            fuzzy_score=int(score),
            reasoning=self._get_reasoning(score),
        )

    def match_column(
        self, source_column: str, canonical_options: list[str]
    ) -> ColumnMatchResult:
        """
        Implementation of ColumnMatchingStrategy protocol.
        """
        # Note: canonical_options is passed by the protocol but this matcher
        # largely relies on its pre-computed FIELD_VARIATIONS and CANONICAL_FIELDS.
        # We use CANONICAL_FIELDS if canonical_options is not provided or different.
        match_res = self.match(source_column)

        if not match_res:
            return ColumnMatchResult(
                source_column=source_column,
                target_field=None,
                confidence=0.0,
                tier=MatchTier.UNMATCHED,
                reasoning="No fuzzy match found",
                fuzzy_score=None,
            )

        return ColumnMatchResult(
            source_column=source_column,
            target_field=match_res.canonical,
            confidence=match_res.confidence,
            tier=match_res.tier,
            fuzzy_score=match_res.fuzzy_score,
            reasoning=match_res.reasoning,
        )

    def _get_reasoning(self, score: float) -> str:
        if score >= self.HIGH_CONFIDENCE_THRESHOLD:
            return f"Strong fuzzy match ({score:.0f}%)"
        if score >= self.MEDIUM_CONFIDENCE_THRESHOLD:
            return f"Likely match ({score:.0f}%), suggest review"
        return f"Tentative match ({score:.0f}%), needs verification"

    def match_with_alternatives(
        self, column_name: str, top_n: int = 3
    ) -> list[MatchResult]:
        """Optimized version of alternative finder."""
        if not column_name:
            return []

        results = process.extract(
            column_name,
            self._search_keys,
            scorer=fuzz.WRatio,
            processor=utils.default_process,
            limit=top_n * 2,
        )

        seen = set()
        final_matches = []
        for matched_key, score, _ in results:
            canonical = self._variation_map[matched_key]
            if canonical not in seen:
                seen.add(canonical)
                final_matches.append(
                    MatchResult(
                        canonical=canonical,
                        confidence=score / 100.0,
                        tier=MatchTier.FUZZY,
                        fuzzy_score=int(score),
                    )
                )
            if len(final_matches) >= top_n:
                break
        return final_matches
