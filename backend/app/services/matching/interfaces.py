from typing import Protocol

from .types import ColumnMatchResult


class ColumnMatchingStrategy(Protocol):
    """
    Contract for different matching algorithms.
    This allows you to swap 'Fuzzy' for 'LLM' or 'Exact' easily.
    """

    def match_column(
        self, source_column: str, canonical_options: list[str]
    ) -> ColumnMatchResult: ...
