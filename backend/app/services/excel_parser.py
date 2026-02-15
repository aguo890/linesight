# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Refactored Excel Parser Service.

Delegates core logic to specialized modules in .excel/ and adds decision logging.
Philosophy: "Make it work with what you have & explain why you did it"
"""

from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import Any

import pandas as pd
from openpyxl import load_workbook  # type: ignore[import-untyped]

from app.models.base import Base
from app.services.analytics_service import AnalyticsService
from app.services.excel import (
    COLUMN_PATTERNS,
    ColumnMapping,
    ColumnMatchConfidence,
    HeaderDetector,
)
from app.services.ingestion.date_parser import parse_date


@dataclass
class ParseResult:
    """Result of parsing an Excel file."""

    success: bool
    records: list[dict[str, Any]]
    column_mappings: list[ColumnMapping]
    warnings: list[str]
    errors: list[str]
    stats: dict[str, Any]
    decision_logs: list[str] = field(default_factory=list)


class FlexibleExcelParser:
    """
    Flexible Excel parser that works with incomplete data and logs decisions.

    Key Features:
    - Fuzzy column name matching (delegated)
    - Automatic data type detection
    - Graceful handling of missing columns
    - Smart header detection (delegated)
    - Decision logging for AI traceability
    """

    def __init__(self, strict_mode: bool = False):
        self.strict_mode = strict_mode
        self.warnings: list[str] = []
        self.errors: list[str] = []
        self.decision_logs: list[str] = []
        self.detector = HeaderDetector()

    def parse_file(
        self,
        file_path: str | Path,
        target_model: type[Base] | None = None,
        sheet_name: str | None = None,
    ) -> ParseResult:
        """
        Parse an Excel file with flexible column matching.
        """
        self.warnings = []
        self.errors = []
        self.decision_logs = []

        file_path = Path(file_path)

        if not file_path.exists():
            return ParseResult(
                success=False,
                records=[],
                column_mappings=[],
                warnings=[],
                errors=[f"File not found: {file_path}"],
                stats={},
                decision_logs=[],
            )

        try:
            # Load workbook
            self.decision_logs.append(f"Starting parse for {file_path.name}")
            wb = load_workbook(file_path, data_only=True)
            ws = wb[sheet_name] if sheet_name else wb.active

            # Detect header row (delegated)
            header_row, headers = self.detector.detect_headers(ws)

            if not headers:
                self.errors.append("Could not detect any column headers")
                return self._build_result([], [])

            self.decision_logs.append(
                f"Detected headers at row {header_row + 1}: {headers}"
            )

            # Read data
            df = pd.read_excel(
                file_path,
                sheet_name=sheet_name or 0,
                skiprows=header_row,
                engine="openpyxl",
            )

            # Clean column names
            df.columns = [self._clean_column_name(str(c)) for c in df.columns]

            # Map columns (delegated/refactored logic)
            mappings = self._map_columns(df.columns.tolist(), target_model)

            # Parse records
            records = self._parse_records(df, mappings)

            return self._build_result(records, mappings)

        except Exception as e:
            self.errors.append(f"Failed to parse file: {str(e)}")
            return self._build_result([], [])

    def _clean_column_name(self, name: str) -> str:
        """Clean and normalize a column name."""
        name = name.strip()
        if name.startswith("Unnamed:"):
            return ""
        return name

    def _map_columns(
        self, source_columns: list[str], target_model: type[Base] | None = None
    ) -> list[ColumnMapping]:
        """
        Map source Excel columns to target database fields.
        """
        mappings = []

        for source_col in source_columns:
            if not source_col:
                continue

            source_lower = source_col.lower().strip()

            best_match = None
            best_confidence = ColumnMatchConfidence.UNMAPPED

            # Logic stays here for now but uses constants from .excel
            for target_field, patterns in COLUMN_PATTERNS.items():
                if source_lower in patterns:
                    best_match = target_field
                    best_confidence = ColumnMatchConfidence.EXACT
                    self.decision_logs.append(
                        f"Exact match: '{source_col}' -> '{target_field}'"
                    )
                    break

                for pattern in patterns:
                    if (
                        pattern in source_lower or source_lower in pattern
                    ) and best_confidence != ColumnMatchConfidence.EXACT:
                        best_match = target_field
                        best_confidence = ColumnMatchConfidence.FUZZY

            if best_confidence == ColumnMatchConfidence.FUZZY:
                self.decision_logs.append(
                    f"Fuzzy match: '{source_col}' -> '{best_match}'"
                )

            if best_match or not target_model:
                mappings.append(
                    ColumnMapping(
                        source_column=source_col,
                        target_field=best_match or source_col,
                        confidence=best_confidence,
                        data_type="string",
                    )
                )
            else:
                self.decision_logs.append(
                    f"Dropped column: '{source_col}' (no mapping found)"
                )
                self.warnings.append(f"Column '{source_col}' could not be mapped")

        return mappings

    def _parse_records(
        self, df: pd.DataFrame, mappings: list[ColumnMapping]
    ) -> list[dict[str, Any]]:
        """Parse DataFrame rows into records."""
        records = []
        col_map = {m.source_column: m.target_field for m in mappings}

        for idx, row in df.iterrows():
            record = {}
            for source_col, target_field in col_map.items():
                if source_col in df.columns:
                    value = self._clean_value(row[source_col], target_field)
                    if value is not None:
                        record[target_field] = value

            if record:
                # Physics validation
                if "actual_qty" in record and ("sam" in record or "base_sam" in record):
                    physics_warnings = AnalyticsService.validate_production_physics(
                        record
                    )
                    if physics_warnings:
                        self.warnings.extend(
                            [f"Row {idx + 1}: {w}" for w in physics_warnings]
                        )
                        self.decision_logs.extend(
                            [
                                f"Physics Warning Row {idx + 1}: {w}"
                                for w in physics_warnings
                            ]
                        )

                records.append(record)

        return records

    def _clean_value(self, value: Any, field_name: str) -> Any:
        """Clean and convert a value."""
        if pd.isna(value):
            return None
        if isinstance(value, str) and not value.strip():
            return None

        # Specific type conversions
        try:
            if any(
                f in field_name
                for f in ["qty", "quantity", "count", "operators", "pieces"]
            ):
                return int(float(value))
            if any(f in field_name for f in ["sam", "rate", "pct", "percentage", "efficiency"]):
                if isinstance(value, str):
                    value = value.replace("%", "").strip()
                return Decimal(str(value))
            if any(f in field_name for f in ["date"]):
                parsed = parse_date(value, auto_detect=True)
                return parsed.date() if parsed else None
        except (ValueError, TypeError):
            return None

        return value.strip() if isinstance(value, str) else value

    def _build_result(
        self, records: list[dict[str, Any]], mappings: list[ColumnMapping]
    ) -> ParseResult:
        """Build the final ParseResult."""
        stats = {
            "total_records": len(records),
            "mapped_columns": len(
                [m for m in mappings if m.confidence != ColumnMatchConfidence.UNMAPPED]
            ),
            "unmapped_columns": len(
                [m for m in mappings if m.confidence == ColumnMatchConfidence.UNMAPPED]
            ),
            "warnings_count": len(self.warnings),
            "errors_count": len(self.errors),
        }

        return ParseResult(
            success=len(self.errors) == 0,
            records=records,
            column_mappings=mappings,
            warnings=self.warnings,
            errors=self.errors,
            stats=stats,
            decision_logs=self.decision_logs,
        )

    def _score_header_row(self, values: list[str]) -> int:
        """Wrapper for test compatibility."""
        return self.detector.score_header_row(values)
