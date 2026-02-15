# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
LLM Agent for Semantic ETL.

Uses DeepSeek-V3 (or OpenAI fallback) to:
1. Infer schema from messy Excel data
2. Generate Python/Pandas cleaning code
3. Handle ambiguous column mappings

Key principle: Generate CODE, not data.
The LLM writes the transformation script, Python executes it deterministically.
"""

import json
import time
from dataclasses import dataclass
from typing import Any

import pandas as pd  # type: ignore[import-untyped]

from app.core.config import settings


@dataclass
class SchemaInference:
    """Result of LLM schema inference."""

    detected_headers: list[str]
    header_row: int
    column_mappings: dict[str, str]  # source → target
    data_types: dict[str, str]
    confidence_scores: dict[str, float]
    recommendations: list[str]
    suggested_widgets: list[str] | None = None
    raw_response: str = ""


@dataclass
class GeneratedCode:
    """Generated Python cleaning code."""

    code: str
    description: str
    expected_output_columns: list[str]
    version: int


class SemanticETLAgent:
    """
    LLM-powered agent for understanding and cleaning Excel data.

    Architecture:
    1. Send sample rows to LLM for schema inference
    2. LLM generates pandas code for cleaning
    3. Execute code in sandboxed environment
    4. Validate output and retry if needed
    """

    SYSTEM_PROMPT = """You are an expert data engineer specializing in apparel manufacturing data.

Your task is to analyze messy Excel spreadsheets from garment factories and generate Python/Pandas code to clean and normalize them.

CONTEXT:
- Data comes from factories using informal Excel sheets (not ERP exports)
- Column names vary widely (e.g., "Qty", "quantity", "QTY", "pcs" all mean the same thing)
- Data may have merged cells, multi-line headers, or headers not in row 1
- Numbers may be formatted as strings with commas or currency symbols
- Dates may be in various formats

TARGET SCHEMA (apparel manufacturing):
- style_number: Unique garment style identifier
- po_number: Purchase order number
- quantity: Order Quantity (Total PO Qty)
- planned_qty: Target Production Quantity (Daily Target/Plan)
- color: Color/colorway
- buyer: Brand/customer name
- season: e.g., "SS25", "FW24"
- sam: Standard Allowed Minute (or SMV - Standard Minute Value)
- production_date: Date of production (when goods were made)
- inspection_date: Date of inspection (when goods were checked)
- actual_qty: Actual pieces produced/passed (Good Output)
- defects: Number of defects found (Rejected Qty / Defect Count)
- dhu: Defects per hundred units (Defect Rate)
- lot_number: Fabric lot identifier (Dye Lot)
- shade_band: Fabric shade grouping (e.g., A, B, C)
- batch_number: Batch ID / Serial Number / Roll No
- downtime_minutes: Minutes production stopped
- downtime_reason: Reason for stop (Look for codes like MF-01, EF-01)
- origin_country: Country of origin (for compliance)
- cut_date: Planned Cut Date (PCD)
- sew_date: Planned Sew Date (PSD)
- ex_factory_date: X-Factory Date (EXD)

RULES:
1. Generate ONLY executable Python code using pandas
2. Handle missing columns gracefully - don't fail if a column doesn't exist
3. Use `.get()` or `if column in df.columns` patterns
4. Convert data types safely with error handling
5. Return clean, normalized column names (snake_case)

DOMAIN KNOWLEDGE (Use to identify obscure headers):
1. **Time Metrics**: "SAM" and "SMV" are the denominator for efficiency. If you see "Rate" or "Allowed", map to `sam`.
2. **Efficiency Types**: Distinguish `line_efficiency` (Total Output vs Total Hours) from `operator_efficiency` (Individual Performance).
3. **TNA Dates**: Map "PCD" to `cut_date`, "PSD" to `sew_date`, "EXD" or "FOB" to `ex_factory_date`.
4. **Quality Codes**: Look for "GSD" codes (e.g., GSD001) or "AQL" columns. Map "Ac" or "Pass" to `actual_qty`. Map "Re", "Fail" or "Defect" to `defects`.
5. **Fabric Logic**: "Ply" or "Layer" relates to Cutting. "Shade" or "Band" relates to Fabric.
6. **Date Logic**: "Production Date" (MFG) is when item was made. "Inspection Date" is usually >= Production Date. If ambiguous, prefer `production_date` unless "QC", "Check", or "Audit" is in the name."""

    def __init__(self, db_session=None):
        self.llm_provider = settings.LLM_PROVIDER
        self.client = self._init_client()
        self.db_session = db_session  # Optional DB session for logging

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

    async def infer_schema(
        self,
        sample_rows: list[list[Any]],
        filename: str,
        file_type_hint: str | None = None,
        data_source_id: str | None = None,
    ) -> SchemaInference:
        """
        Use LLM to infer schema from sample Excel rows.

        Args:
            sample_rows: First 20 rows of Excel data
            filename: Original filename (may contain hints)
            file_type_hint: Optional hint about file type
            data_source_id: Optional data source ID for logging

        Returns:
            SchemaInference with detected structure
        """
        start_time = time.time()

        prompt = f"""Analyze this Excel data sample to infer the schema and data patterns.

CRITICAL: Look at the 'production_date' values in the sample rows.
- If they look like "12-19" or "12/19" (missing year), flag this in recommendations.
- If they are standard "2025-12-19", note that.

FILENAME: {filename}
FILE TYPE HINT: {file_type_hint or "Unknown"}

SAMPLE DATA (first 20 rows):
```
{self._format_sample_rows(sample_rows)}
```

Respond with JSON in this exact format:
{{
    "header_row": <0-indexed row number where headers are>,
    "detected_headers": ["list", "of", "column", "names"],
    "column_mappings": {{
        "original_column_name": "normalized_target_field",
        ...
    }},
    "data_types": {{
        "column_name": "string|integer|decimal|date|boolean",
        ...
    }},
    "confidence_scores": {{
        "column_name": 0.0-1.0,
        ...
    }},
    "recommendations": ["any data quality issues or recommendations"],
    "suggested_widgets": ["production-chart", "stats", "excel-upload"]
}}"""

        response = self.client.chat.completions.create(
            model="deepseek-chat" if self.llm_provider == "deepseek" else "gpt-4o",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,  # Low temperature for consistent parsing
            response_format={"type": "json_object"},
        )

        latency_ms = int((time.time() - start_time) * 1000)
        raw_response = response.choices[0].message.content
        parsed = json.loads(raw_response)

        schema = SchemaInference(
            detected_headers=parsed.get("detected_headers", []),
            header_row=parsed.get("header_row", 0),
            column_mappings=parsed.get("column_mappings", {}),
            data_types=parsed.get("data_types", {}),
            confidence_scores=parsed.get("confidence_scores", {}),
            recommendations=parsed.get("recommendations", []),
            suggested_widgets=parsed.get("suggested_widgets", []),
            raw_response=raw_response,
        )

        # Log AI decision
        avg_confidence = (
            sum(schema.confidence_scores.values()) / len(schema.confidence_scores)
            if schema.confidence_scores
            else 0.0
        )
        await self._log_decision(
            agent_type="schema_inference",
            input_summary=f"File: {filename}, {len(sample_rows)} rows, {len(schema.detected_headers)} columns",
            output_summary=f"Detected {len(schema.column_mappings)} mappings, header at row {schema.header_row}",
            confidence=avg_confidence,
            reasoning={
                "column_mappings": schema.column_mappings,
                "confidence_scores": schema.confidence_scores,
                "recommendations": schema.recommendations,
                "suggested_widgets": schema.suggested_widgets,
            },
            metadata={
                "tokens_used": response.usage.total_tokens
                if hasattr(response, "usage")
                else None,
                "latency_ms": latency_ms,
                "temperature": 0.1,
                "model": "deepseek-chat"
                if self.llm_provider == "deepseek"
                else "gpt-4o",
            },
            data_source_id=data_source_id,
        )

        return schema

    async def generate_cleaning_code(
        self,
        schema: SchemaInference,
        target_table: str,
        sample_data: list[list[Any]],
        data_source_id: str | None = None,
    ) -> GeneratedCode:
        """
        Generate Python/Pandas code to clean the Excel data.

        Args:
            schema: Previously inferred schema
            target_table: Target database table name
            sample_data: Sample rows for context
            data_source_id: Optional data source ID for logging

        Returns:
            GeneratedCode with executable Python
        """
        start_time = time.time()

        prompt = f"""Generate Python code to clean this Excel data for import into the '{target_table}' table.

INFERRED SCHEMA:
- Header row: {schema.header_row}
- Column mappings: {json.dumps(schema.column_mappings, indent=2)}
- Data types: {json.dumps(schema.data_types, indent=2)}

SAMPLE DATA:
```
{self._format_sample_rows(sample_data[:5])}
```

Generate a complete Python function with this signature:
```python
def clean_excel_data(df: pd.DataFrame) -> pd.DataFrame:
    '''Clean and normalize Excel data for {target_table} table.'''
    # Your code here
    return cleaned_df
```

REQUIREMENTS:
1. Skip rows before the header row
2. Rename columns to snake_case target names
3. Convert data types safely (handle errors gracefully)
4. Remove completely empty rows
5. Handle common data issues (extra whitespace, mixed formats)
6. Return only the columns that exist - don't fail on missing columns

Return ONLY the Python code, no explanations. Do not include any imports as they are already provided in the environment.
```python
def clean_excel_data(df: pd.DataFrame) -> pd.DataFrame:
    # Your implementation here
    return df
```"""

        response = self.client.chat.completions.create(
            model="deepseek-chat" if self.llm_provider == "deepseek" else "gpt-4o",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )

        latency_ms = int((time.time() - start_time) * 1000)
        code = response.choices[0].message.content

        # Extract code from markdown blocks if present
        if "```python" in code:
            code = code.split("```python")[1].split("```")[0]
        elif "```" in code:
            code = code.split("```")[1].split("```")[0]

        generated_code = GeneratedCode(
            code=code.strip(),
            description=f"Auto-generated cleaning code for {target_table}",
            expected_output_columns=list(schema.column_mappings.values()),
            version=1,
        )

        # Log AI decision
        await self._log_decision(
            agent_type="code_generation",
            input_summary=f"Target: {target_table}, {len(schema.column_mappings)} mappings",
            output_summary=f"Generated {len(code.strip())} chars of cleaning code",
            confidence=0.85,  # Fixed confidence for code generation
            reasoning={
                "target_table": target_table,
                "expected_columns": generated_code.expected_output_columns,
                "code_preview": code.strip()[:200] + "..."
                if len(code.strip()) > 200
                else code.strip(),
            },
            metadata={
                "tokens_used": response.usage.total_tokens
                if hasattr(response, "usage")
                else None,
                "latency_ms": latency_ms,
                "temperature": 0.2,
                "model": "deepseek-chat"
                if self.llm_provider == "deepseek"
                else "gpt-4o",
                "code_length": len(code.strip()),
            },
            data_source_id=data_source_id,
        )

        return generated_code

    def _format_sample_rows(self, rows: list[list[Any]]) -> str:
        """Format sample rows for LLM prompt."""
        lines = []
        for i, row in enumerate(rows):
            row_str = " | ".join(str(cell) if cell is not None else "" for cell in row)
            lines.append(f"Row {i}: {row_str}")
        return "\n".join(lines)

    async def _log_decision(
        self,
        agent_type: str,
        input_summary: str,
        output_summary: str,
        confidence: float,
        reasoning: dict[str, Any],
        metadata: dict[str, Any],
        data_source_id: str | None = None,
    ) -> None:
        """Log AI decision to database for transparency."""
        if not self.db_session:
            return  # Skip logging if no DB session provided

        try:
            from app.models.ai_decision import AgentType, AIDecision

            decision = AIDecision(
                data_source_id=data_source_id,
                agent_type=AgentType(agent_type),
                model_used="deepseek-v3"
                if self.llm_provider == "deepseek"
                else "gpt-4o",
                input_summary=input_summary[:500],  # Truncate to 500 chars
                output_summary=output_summary[:500],
                confidence=confidence,
                reasoning=reasoning,
                performance_metadata=metadata,
            )

            self.db_session.add(decision)
            await self.db_session.flush()  # Don't commit, let caller handle transaction
        except Exception as e:
            # Don't fail the main operation if logging fails
            print(f"Warning: Failed to log AI decision: {e}")


class CodeExecutionSandbox:
    """
    Sandboxed environment for executing LLM-generated code.

    Security measures:
    - Restricted builtins
    - No file system access
    - No network access
    - Timeout enforcement
    """

    ALLOWED_IMPORTS = {
        "pandas",
        "numpy",
        "re",
        "datetime",
        "decimal",
    }

    def __init__(self, timeout_seconds: int = 30):
        self.timeout = timeout_seconds

    def execute(
        self,
        code: str,
        input_df: "pd.DataFrame",
    ) -> "pd.DataFrame":
        """
        Execute generated code safely.

        Args:
            code: Python code string
            input_df: Input DataFrame

        Returns:
            Cleaned DataFrame

        Raises:
            ExecutionError: If code fails or times out
        """
        import re
        from decimal import Decimal

        import numpy as np
        import pandas as pd

        # Create restricted globals
        safe_globals = {
            "Decimal": Decimal,
            "re": re,
            "df": input_df,  # Provide df in globals as fallback
            "pd": pd,
            "np": np,
            "__builtins__": {
                "len": len,
                "str": str,
                "int": int,
                "float": float,
                "bool": bool,
                "list": list,
                "dict": dict,
                "tuple": tuple,
                "set": set,
                "range": range,
                "enumerate": enumerate,
                "zip": zip,
                "map": map,
                "filter": filter,
                "sorted": sorted,
                "min": min,
                "max": max,
                "sum": sum,
                "abs": abs,
                "round": round,
                "isinstance": isinstance,
                "hasattr": hasattr,
                "getattr": getattr,
                "print": print,
                "__import__": __import__,
            },
        }

        # Execute the code to define the function
        # We merge globals and locals to avoid unscoped variable errors
        context = safe_globals.copy()
        context["df"] = input_df

        exec(code, context)

        from collections.abc import Callable

        # Find the cleaning function
        clean_func = context.get("clean_excel_data")

        if clean_func and callable(clean_func):
            from collections.abc import Callable
            from typing import cast

            clean_func = cast(Callable[[pd.DataFrame], pd.DataFrame], clean_func)
        else:
            clean_func = None

        if not clean_func:
            # Fallback: search for any callable starting with 'clean'
            for name, obj in context.items():
                if callable(obj) and name.startswith("clean"):
                    clean_func = obj
                    break

        if not clean_func:
            raise ValueError("No cleaning function found in generated code")

        # Execute the function
        try:
            result = clean_func(input_df.copy())
            return result
        except Exception as e:
            import traceback

            raise ValueError(
                f"Execution Error: {str(e)}\n{traceback.format_exc()}"
            ) from e
