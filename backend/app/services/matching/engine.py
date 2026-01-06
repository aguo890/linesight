"""
Matching Engine Implementation.
Contains the logic for Hash-based, Fuzzy, and Semantic matching.
"""

import logging
from typing import Any

from app.services.matching.fuzzy_matcher import RapidFuzzMatcher
from app.services.matching.hash_matcher import HashAliasMatcher
from app.services.matching.semantic_matcher import LLMSemanticMatcher
from app.services.matching.types import (
    ColumnMatchResult,
    MatchResult,
    MatchTier,
)

logger = logging.getLogger(__name__)


class MatchingEngine:
    """Orchestrator for matching strategies."""

    def __init__(
        self,
        hash_matcher: HashAliasMatcher | None = None,
        fuzzy_matcher: RapidFuzzMatcher | None = None,
    ):
        self.hash_matcher = hash_matcher or HashAliasMatcher()
        self.fuzzy_matcher = fuzzy_matcher or RapidFuzzMatcher()

    def match_column(self, column_name: str) -> MatchResult:
        """
        Match a single column using available strategies in order (Hash -> Fuzzy).
        """
        # 1. Try Hash
        hash_res = self.hash_matcher.match(column_name)
        if hash_res:
            return hash_res

        # 2. Try Fuzzy
        fuzzy_res = self.fuzzy_matcher.match(column_name)
        if fuzzy_res:
            return fuzzy_res

        # 3. No Match
        return MatchResult(
            canonical=None,
            confidence=0.0,
            tier=MatchTier.UNMATCHED,
            reasoning="No match found in Tier 1 (Hash) or Tier 2 (Fuzzy)",
            fuzzy_score=None,
        )


class HybridMatchingEngine(MatchingEngine):
    """
    Advanced matching engine supporting Factory/Org scopes and LLM fallback.
    """

    def __init__(self, factory_id: str, db_session=None, llm_enabled: bool = False):
        # Initialize robust matchers with DB session for learned aliases
        hash_matcher = HashAliasMatcher(db_session=db_session)
        # Initialize optimized fuzzy matcher
        fuzzy_matcher = RapidFuzzMatcher()

        super().__init__(hash_matcher=hash_matcher, fuzzy_matcher=fuzzy_matcher)

        self.factory_id = factory_id
        self.db_session = db_session
        self.llm_enabled = llm_enabled
        self.llm_matcher = (
            LLMSemanticMatcher(db_session=db_session) if llm_enabled else None
        )

        self.stats = {
            "total_columns": 0,
            "auto_mapped": 0,
            "needs_review": 0,
            "unmatched": 0,
            "tier_hash": 0,
            "tier_fuzzy": 0,
            "tier_llm": 0,
        }

    async def initialize(self):
        """Async initialization to load learned aliases."""
        if self.hash_matcher:
            await self.hash_matcher.load_aliases()

    def match_columns(
        self, headers: list[str], sample_data: dict[str, list[Any]]
    ) -> list[ColumnMatchResult]:
        """
        Match multiple columns using the Waterfall strategy:
        1. Hash (Exact/Alias)
        2. Fuzzy (Similarity)
        3. LLM (Semantic) - Batch processed for unmatched columns
        """
        self.stats["total_columns"] = len(headers)
        results: list[ColumnMatchResult] = []
        unmatched_indices: list[int] = []

        # Pass 1: Hash and Fuzzy (Fast)
        for idx, header in enumerate(headers):
            # Use factory_id for scoped alias lookup
            match = self.match_column_scoped(header)

            # If matched or no LLM enabled, create result
            if match.tier != MatchTier.UNMATCHED or not self.llm_enabled:
                self._record_stat(match.tier)
                results.append(
                    self._create_column_result(
                        header, match, sample_data.get(header, [])
                    )
                )
            else:
                # Placeholder for LLM pass
                results.append(None)  # type: ignore
                unmatched_indices.append(idx)

        # Pass 2: LLM (Slow, Semantic)
        if unmatched_indices and self.llm_enabled and self.llm_matcher:
            # Prepare batch for LLM
            columns_to_match = []
            for idx in unmatched_indices:
                columns_to_match.append(
                    {"name": headers[idx], "samples": sample_data.get(headers[idx], [])}
                )

            # Call LLM
            llm_results = self.llm_matcher.match_batch(columns_to_match)

            # Merge results
            for i, idx in enumerate(unmatched_indices):
                match = llm_results[i]
                self._record_stat(match.tier)
                results[idx] = self._create_column_result(
                    headers[idx], match, sample_data.get(headers[idx], [])
                )

        # Fill in any remaining None results (e.g. if LLM failed or disabled)
        for i in range(len(results)):
            if results[i] is None:
                match = MatchResult(
                    canonical=None,
                    confidence=0.0,
                    tier=MatchTier.UNMATCHED,
                    fuzzy_score=None,
                )
                self._record_stat(MatchTier.UNMATCHED)
                results[i] = self._create_column_result(
                    headers[i], match, sample_data.get(headers[i], [])
                )

        return results

    def match_column_scoped(self, column_name: str) -> MatchResult:
        """Helper to match with factory scope."""
        # 1. Try Hash with factory_id
        hash_res = self.hash_matcher.match(column_name, factory_id=self.factory_id)
        if hash_res:
            logger.info(
                f"MATCH [Hash]: '{column_name}' -> '{hash_res.canonical}' (Conf: {hash_res.confidence})"
            )
            return hash_res

        # 2. Try Fuzzy
        fuzzy_res = self.fuzzy_matcher.match(column_name)
        if fuzzy_res:
            logger.info(
                f"MATCH [Fuzzy]: '{column_name}' -> '{fuzzy_res.canonical}' (Score: {fuzzy_res.fuzzy_score})"
            )
            return fuzzy_res

        logger.debug(f"NO MATCH: '{column_name}'")
        return MatchResult(
            canonical=None, confidence=0.0, tier=MatchTier.UNMATCHED, fuzzy_score=None
        )

    def _create_column_result(
        self, header: str, match: MatchResult, samples: list[Any]
    ) -> ColumnMatchResult:
        """Helper to create formatted result."""
        col_result = ColumnMatchResult(
            source_column=header,
            target_field=match.canonical,
            confidence=match.confidence,
            tier=match.tier,
            fuzzy_score=match.fuzzy_score,
            reasoning=match.reasoning,
            sample_data=samples,
            needs_review=match.confidence < 0.9,
            ignored=match.tier == MatchTier.UNMATCHED,
        )

        # Update summary stats
        if col_result.status == "auto_mapped":
            self.stats["auto_mapped"] += 1
        elif col_result.status == "needs_review":
            self.stats["needs_review"] += 1
        else:
            self.stats["unmatched"] += 1

        return col_result

    def _record_stat(self, tier: MatchTier):
        if tier == MatchTier.HASH:
            self.stats["tier_hash"] += 1
        elif tier == MatchTier.FUZZY:
            self.stats["tier_fuzzy"] += 1
        elif tier == MatchTier.LLM:
            self.stats["tier_llm"] += 1

    def get_stats(self) -> dict[str, Any]:
        """Return match statistics."""
        return self.stats

    @staticmethod
    def get_available_fields() -> list[dict[str, str]]:
        """Return list of available canonical fields with descriptions."""
        from app.services.matching.types import CANONICAL_DEFINITIONS

        return [
            {"field": d.key, "description": d.label, "category": d.category}
            for d in CANONICAL_DEFINITIONS
        ]
