# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import logging
from typing import Any

from app.core.interfaces import ETLAgentInterface, WidgetSuggestionInterface

logger = logging.getLogger(__name__)

def get_etl_agent() -> ETLAgentInterface:
    """
    Factory method to get the Semantic ETL Agent.
    Tries to load the private (proprietary) implementation first.
    Falls back to the public (mock) implementation if not found.
    """
    try:
        from app.private_core.etl_agent import SemanticETLAgent
        return SemanticETLAgent()
    except ImportError:
        logger.info("Private Core not found. Loading Public ETL Agent (Mock).")
        from app.public_core.etl_mock import PublicETLAgent
        return PublicETLAgent()

def get_widget_suggestion_service() -> WidgetSuggestionInterface:
    """
    Factory method to get the Widget Suggestion Service.
    Tries to load the private (proprietary) implementation first.
    Falls back to the public (mock) implementation if not found.
    """
    try:
        from app.private_core.widget_suggestion import widget_suggestion_service
        return widget_suggestion_service
    except ImportError:
        logger.info("Private Core not found. Loading Public Widget Suggestion Service (Mock).")
        from app.public_core.widget_mock import widget_suggestion_service
        return widget_suggestion_service
