# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Core Interface Definitions.

These interfaces define the contract that both the public (mock) and 
private (proprietary) implementations must adhere to.
"""

from abc import ABC, abstractmethod
from typing import Any, Protocol

class SchemaInferenceProtocol(Protocol):
    """Protocol for schema inference result."""
    detected_headers: list[str]
    header_row: int
    column_mappings: dict[str, str]
    data_types: dict[str, str]
    confidence_scores: dict[str, float]
    recommendations: list[str]
    suggested_widgets: list[str] | None
    raw_response: str

class GeneratedCodeProtocol(Protocol):
    """Protocol for generated cleaning code."""
    code: str
    description: str
    expected_output_columns: list[str]
    version: int

class ETLAgentInterface(ABC):
    """Interface for the Semantic ETL Agent."""
    
    @abstractmethod
    async def infer_schema(
        self,
        sample_rows: list[list[Any]],
        filename: str,
        file_type_hint: str | None = None,
        data_source_id: str | None = None,
    ) -> SchemaInferenceProtocol:
        """Infer schema from sample rows."""
        pass

    @abstractmethod
    async def generate_cleaning_code(
        self,
        schema: Any, # Typed as Any to avoid circular imports with implementation classes
        target_table: str,
        sample_data: list[list[Any]],
        data_source_id: str | None = None,
    ) -> GeneratedCodeProtocol:
        """Generate cleaning code."""
        pass

class WidgetSuggestionInterface(ABC):
    """Interface for Widget Suggestion Service."""
    
    @abstractmethod
    async def analyze_and_suggest(
        self,
        raw_import: Any, # Typed as Any to avoid circular imports
        db: Any,         # Typed as Any to avoid circular imports
    ) -> list[Any]:
        """Analyze import and suggest widgets."""
        pass
