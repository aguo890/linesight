# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from dataclasses import dataclass
from typing import Any

from app.core.interfaces import ETLAgentInterface, SchemaInferenceProtocol, GeneratedCodeProtocol

@dataclass
class MockSchemaInference:
    detected_headers: list[str]
    header_row: int
    column_mappings: dict[str, str]
    data_types: dict[str, str]
    confidence_scores: dict[str, float]
    recommendations: list[str]
    suggested_widgets: list[str] | None
    raw_response: str

@dataclass
class MockGeneratedCode:
    code: str
    description: str
    expected_output_columns: list[str]
    version: int

class PublicETLAgent(ETLAgentInterface):
    """
    Mock implementation of the Semantic ETL Agent for the public repository.
    Does not contain any proprietary LLM logic.
    """
    
    async def infer_schema(
        self,
        sample_rows: list[list[Any]],
        filename: str,
        file_type_hint: str | None = None,
        data_source_id: str | None = None,
    ) -> SchemaInferenceProtocol:
        return MockSchemaInference(
            detected_headers=[],
            header_row=0,
            column_mappings={},
            data_types={},
            confidence_scores={},
            recommendations=["Proprietary schema inference is disabled in public build."],
            suggested_widgets=[],
            raw_response="MOCK_RESPONSE"
        )

    async def generate_cleaning_code(
        self,
        schema: Any, 
        target_table: str,
        sample_data: list[list[Any]],
        data_source_id: str | None = None,
    ) -> GeneratedCodeProtocol:
        return MockGeneratedCode(
            code="# Proprietary cleaning code generation is disabled.\n# Please upgrade to the full version.",
            description="Mock Cleaning Code",
            expected_output_columns=[],
            version=1
        )
