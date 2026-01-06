"""
Tier 3: LLM Semantic Matcher.

Uses Large Language Models for conceptual understanding of ambiguous columns.
This is the most powerful but slowest tier - only invoked when Tier 1 and 2 fail.

Features:
- KERNEL prompt strategy (Keep simple, Explicit, Reproducible, Narrow scope, Explicit, Logical)
- Data sample injection for context
- Few-shot learning from historical matches
- Self-assessed confidence scoring

Performance: 500ms-2s per column (batched for efficiency)
Cost: ~$0.001-0.005 per column with GPT-4o or DeepSeek
"""

import json
import time
from typing import Any

from app.core.config import settings
from app.services.matching.types import (
    CANONICAL_FIELDS,
    FIELD_DESCRIPTIONS,
    ColumnMatchResult,
    MatchResult,
    MatchTier,
)


class LLMSemanticMatcher:
    """
    Tier 3: LLM semantic reasoning for ambiguous column mapping.

    Uses the KERNEL prompt framework:
    - Keep it simple
    - Easy to verify
    - Reproducible
    - Narrow scope
    - Explicit constraints
    - Logical structure
    """

    SYSTEM_PROMPT = """You are an expert data engineer specializing in apparel manufacturing data standardization.

Your task is to map messy Excel column names to a canonical schema used in production analytics software.

CONTEXT:
- Data comes from garment factories worldwide with inconsistent naming
- Columns may be abbreviated, misspelled, or use industry jargon
- You must analyze both the column NAME and SAMPLE DATA to make accurate mappings

IMPORTANT: Only use the canonical field names provided. Do not invent new fields."""

    # Few-shot examples for better accuracy
    FEW_SHOT_EXAMPLES = """
EXAMPLES OF SUCCESSFUL MAPPINGS:

Example 1:
Column: "Sewing Allowance"
Sample Data: [0.45, 0.55, 1.20, 0.38, 0.72]
Answer: {"canonical": "standard_allowed_minute", "confidence": 0.95, "reasoning": "Small decimal values typical of SAM measurements in minutes. 'Allowance' is industry term for allocated time."}

Example 2:
Column: "Val_1"
Sample Data: [88.5, 92.3, 75.1, 90.0, 85.7]
Answer: {"canonical": "efficiency_pct", "confidence": 0.85, "reasoning": "Values clustered around 75-95 are typical efficiency percentages. Generic column name, but data pattern is clear."}

Example 3:
Column: "Time"
Sample Data: ["08:30", "09:15", "14:00", "16:45"]
Answer: {"canonical": "UNMAPPABLE", "confidence": 0.7, "reasoning": "This appears to be clock time (timestamps), not a production metric. Could be shift start times."}

Example 4:
Column: "Grade"
Sample Data: ["A", "B", "A", "C", "A+"]
Answer: {"canonical": "UNMAPPABLE", "confidence": 0.6, "reasoning": "Letter grades likely represent quality rating, but no canonical field matches. Suggest IGNORE or map to 'notes'."}
"""

    def __init__(self, db_session=None):
        """Initialize the LLM matcher."""
        self.llm_provider = settings.LLM_PROVIDER
        self.client = self._init_client()
        self.db_session = db_session

    def _init_client(self):
        """Initialize the LLM client based on provider."""
        if self.llm_provider == "deepseek":
            from openai import OpenAI

            return OpenAI(
                api_key=settings.DEEPSEEK_API_KEY,
                base_url=settings.DEEPSEEK_BASE_URL,
            )
        else:
            from openai import OpenAI

            return OpenAI(api_key=settings.OPENAI_API_KEY)

    def _build_schema_reference(self) -> str:
        """Build the canonical schema reference for the prompt."""
        lines = ["CANONICAL SCHEMA:"]
        for field in CANONICAL_FIELDS[:20]:  # Limit to most common fields
            desc = FIELD_DESCRIPTIONS.get(field, "")
            if desc:
                lines.append(f"- {field}: {desc}")
            else:
                lines.append(f"- {field}")
        lines.append("- UNMAPPABLE: Use this if column doesn't match any schema field")
        return "\n".join(lines)

    def _format_sample_data(self, samples: list[Any]) -> str:
        """Format sample data for the prompt."""
        if not samples:
            return "[no data available]"

        # Clean and format samples
        formatted = []
        for sample in samples[:5]:
            if sample is None:
                continue
            formatted.append(
                repr(sample) if not isinstance(sample, str) else f'"{sample}"'
            )

        return f"[{', '.join(formatted)}]" if formatted else "[all null values]"

    def match(
        self,
        column_name: str,
        sample_data: list[Any] | None = None,
    ) -> MatchResult | None:
        """
        Use LLM to semantically match a column.

        Args:
            column_name: Column name from file
            sample_data: First 5 non-null values from the column

        Returns:
            MatchResult with LLM reasoning
        """
        if not column_name or not column_name.strip():
            return None

        start_time = time.time()

        prompt = f"""Map this column to the canonical schema.

COLUMN NAME: {column_name}
SAMPLE DATA: {self._format_sample_data(sample_data or [])}

{self._build_schema_reference()}

{self.FEW_SHOT_EXAMPLES}

YOUR TASK:
Analyze the column name AND sample data. Return your mapping decision as JSON:
{{"canonical": "field_name_or_UNMAPPABLE", "confidence": 0.0-1.0, "reasoning": "brief explanation"}}

ONLY output the JSON, nothing else."""

        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat" if self.llm_provider == "deepseek" else "gpt-4o",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,  # Low temperature for consistent mapping
                max_tokens=200,
                response_format={"type": "json_object"},
            )

            latency_ms = int((time.time() - start_time) * 1000)
            raw_response = response.choices[0].message.content

            # Parse response
            parsed = json.loads(raw_response)
            canonical = parsed.get("canonical")
            confidence = float(parsed.get("confidence", 0.5))
            reasoning = parsed.get("reasoning", "")

            # Handle UNMAPPABLE
            if canonical == "UNMAPPABLE" or canonical not in CANONICAL_FIELDS:
                return MatchResult(
                    canonical=None,
                    confidence=confidence,
                    tier=MatchTier.LLM,
                    reasoning=f"LLM: {reasoning} (latency: {latency_ms}ms)",
                    fuzzy_score=None,
                )

            return MatchResult(
                canonical=canonical,
                confidence=confidence,
                tier=MatchTier.LLM,
                reasoning=f"LLM: {reasoning} (latency: {latency_ms}ms)",
                fuzzy_score=None,
            )

        except Exception as e:
            # Don't fail the entire flow on LLM error
            return MatchResult(
                canonical=None,
                confidence=0.0,
                tier=MatchTier.LLM,
                reasoning=f"LLM error: {str(e)}",
                fuzzy_score=None,
            )

    def match_column(
        self, source_column: str, canonical_options: list[str]
    ) -> ColumnMatchResult:
        """
        Implementation of ColumnMatchingStrategy protocol.
        """
        # LLM matcher can use sample data if available, but for now we match just the name
        # to fulfill the protocol. The full 'match' method is still available for deeper logic.
        match_res = self.match(source_column)

        if not match_res:
            return ColumnMatchResult(
                source_column=source_column,
                target_field=None,
                confidence=0.0,
                tier=MatchTier.LLM,
                reasoning="LLM matching failed",
                fuzzy_score=None,
            )

        return ColumnMatchResult(
            source_column=source_column,
            target_field=match_res.canonical,
            confidence=match_res.confidence,
            tier=match_res.tier,
            reasoning=match_res.reasoning,
            fuzzy_score=None,
        )

    def match_batch(
        self,
        columns: list[dict[str, Any]],
    ) -> list[MatchResult]:
        """
        Batch match multiple columns in a single LLM call.

        More efficient than individual calls for large files.

        Args:
            columns: List of {"name": str, "samples": List[Any]}

        Returns:
            List of MatchResults in same order as input
        """
        if not columns:
            return []

        # Build batch prompt
        column_specs = []
        for i, col in enumerate(columns):
            name = col.get("name", "")
            samples = col.get("samples", [])
            column_specs.append(
                f'{i + 1}. Column: "{name}" | Samples: {self._format_sample_data(samples)}'
            )

        start_time = time.time()

        prompt = f"""Map these columns to the canonical schema.

COLUMNS TO MAP:
{chr(10).join(column_specs)}

{self._build_schema_reference()}

{self.FEW_SHOT_EXAMPLES}

YOUR TASK:
For EACH column, provide a mapping. Return as JSON array:
[
  {{"column_index": 1, "canonical": "field_name", "confidence": 0.9, "reasoning": "..."}},
  ...
]

ONLY output the JSON array, nothing else."""

        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat" if self.llm_provider == "deepseek" else "gpt-4o",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=1000,
                response_format={"type": "json_object"},
            )

            int((time.time() - start_time) * 1000)
            raw_response = response.choices[0].message.content

            # Parse response - handle both array and object wrapper
            parsed = json.loads(raw_response)
            if isinstance(parsed, dict):
                # LLM might wrap in {"mappings": [...]}
                parsed = parsed.get("mappings", parsed.get("columns", []))

            # Build results
            results = []
            for i, _ in enumerate(columns):
                # Find matching result by index
                match_data = None
                for item in parsed:
                    if item.get("column_index") == i + 1:
                        match_data = item
                        break

                if match_data:
                    canonical = match_data.get("canonical")
                    if canonical == "UNMAPPABLE" or canonical not in CANONICAL_FIELDS:
                        canonical = None

                    results.append(
                        MatchResult(
                            canonical=canonical,
                            confidence=float(match_data.get("confidence", 0.5)),
                            tier=MatchTier.LLM,
                            reasoning=f"LLM: {match_data.get('reasoning', '')}",
                            fuzzy_score=None,
                        )
                    )
                else:
                    # No match found for this column
                    results.append(
                        MatchResult(
                            canonical=None,
                            confidence=0.0,
                            tier=MatchTier.LLM,
                            reasoning="LLM: No mapping returned",
                            fuzzy_score=None,
                        )
                    )

            return results

        except Exception as e:
            # Return empty results on error
            return [
                MatchResult(
                    canonical=None,
                    confidence=0.0,
                    tier=MatchTier.LLM,
                    reasoning=f"LLM batch error: {str(e)}",
                    fuzzy_score=None,
                )
                for _ in columns
            ]
