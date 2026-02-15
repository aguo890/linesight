# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from typing import Any
from app.core.interfaces import WidgetSuggestionInterface

class PublicWidgetSuggestionService(WidgetSuggestionInterface):
    """
    Mock implementation of Widget Suggestion Service for public repository.
    """
    
    async def analyze_and_suggest(
        self,
        raw_import: Any,
        db: Any,
    ) -> list[Any]:
        # Return empty list or a placeholder suggestion
        return []

# Singleton instance for consistency
widget_suggestion_service = PublicWidgetSuggestionService()
