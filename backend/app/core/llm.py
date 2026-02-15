# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
LLM Provider Strategy Pattern.

Defines an abstract base class for LLM providers and concrete implementations
for DeepSeek and OpenAI. This allows easy switching between providers via configuration.
"""

from abc import ABC, abstractmethod
from typing import Any

from app.core.config import settings


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def infer_schema(
        self,
        headers: list[str],
        sample_data: list[list[Any]],
        filename: str,
        file_type_hint: str,
    ) -> dict[str, Any]:
        """
        Infer schema from sample rows.

        Args:
            headers: List of column headers
            sample_data: Sample rows from the file
            filename: Original filename
            file_type_hint: Hint about file type

        Returns:
            Dictionary containing schema inference results
        """
        pass

    @abstractmethod
    async def generate_cleaning_code(
        self,
        schema: dict[str, Any],
        target_table: str,
        sample_data: list[list[Any]],
    ) -> str:
        """
        Generate Python/Pandas code to clean the Excel data.

        Args:
            schema: Previously inferred schema
            target_table: Target database table name
            sample_data: Sample rows for context

        Returns:
            Generated Python code as a string
        """
        pass


class DeepSeekStrategy(LLMProvider):
    """DeepSeek-specific LLM implementation."""

    def __init__(self):
        """Initialize DeepSeek client."""
        from openai import OpenAI

        self.client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
        )
        self.model = "deepseek-chat"

    async def infer_schema(
        self,
        headers: list[str],
        sample_data: list[list[Any]],
        filename: str,
        file_type_hint: str,
    ) -> dict[str, Any]:
        """Infer schema using DeepSeek API."""
        # Implementation would use self.client and self.model
        # This is a simplified version - the full implementation
        # should be migrated from llm_agent.py
        return {}

    async def generate_cleaning_code(
        self,
        schema: dict[str, Any],
        target_table: str,
        sample_data: list[list[Any]],
    ) -> str:
        """Generate cleaning code using DeepSeek API."""
        # Implementation would use self.client and self.model
        return ""


class OpenAIStrategy(LLMProvider):
    """OpenAI-specific LLM implementation."""

    def __init__(self):
        """Initialize OpenAI client."""
        from openai import OpenAI

        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "gpt-4o"

    async def infer_schema(
        self,
        headers: list[str],
        sample_data: list[list[Any]],
        filename: str,
        file_type_hint: str,
    ) -> dict[str, Any]:
        """Infer schema using OpenAI API."""
        # Implementation would use self.client and self.model
        return {}

    async def generate_cleaning_code(
        self,
        schema: dict[str, Any],
        target_table: str,
        sample_data: list[list[Any]],
    ) -> str:
        """Generate cleaning code using OpenAI API."""
        # Implementation would use self.client and self.model
        return ""


def get_llm_service() -> LLMProvider:
    """
    Factory function to get the configured LLM provider.

    Returns:
        LLMProvider instance based on settings.LLM_PROVIDER
    """
    if settings.LLM_PROVIDER == "openai":
        return OpenAIStrategy()
    return DeepSeekStrategy()
