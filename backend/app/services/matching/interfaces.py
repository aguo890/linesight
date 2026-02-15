# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

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
