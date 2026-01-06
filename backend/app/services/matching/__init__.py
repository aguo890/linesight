"""
Hybrid Waterfall Matching Engine.

Provides a 3-tier matching strategy for column mapping:
1. Hash/Alias: Instant exact match (known aliases)
2. Fuzzy: RapidFuzz for typos and variations
3. Semantic: LLM for conceptual understanding
"""

from .engine import (
    HashAliasMatcher,
    HybridMatchingEngine,
    MatchingEngine,
    RapidFuzzMatcher,
)
from .semantic_matcher import LLMSemanticMatcher
from .types import ColumnMatchResult, MatchResult, MatchTier

__all__ = [
    "MatchResult",
    "MatchTier",
    "ColumnMatchResult",
    "MatchingEngine",
    "HybridMatchingEngine",
    "HashAliasMatcher",
    "RapidFuzzMatcher",
    "LLMSemanticMatcher",
]
