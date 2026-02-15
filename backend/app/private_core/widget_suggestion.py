# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
AI Widget Suggestion Service.
Analyzes uploaded data patterns to suggest relevant dashboard widgets.
"""

import json

from sqlalchemy.orm import Session

from app.models.raw_import import RawImport
from app.schemas.dashboard import SuggestedWidget


from app.core.interfaces import WidgetSuggestionInterface

class WidgetSuggestionService(WidgetSuggestionInterface):
    """
    Analyzes uploaded files and suggests relevant dashboard widgets.
    Uses pattern matching on column names.
    """

    async def analyze_and_suggest(
        self,
        raw_import: RawImport,
        db: Session,
    ) -> list[SuggestedWidget]:
        """
        Main entry point for widget suggestion.
        Analyzes raw headers and returns a list of suggested widgets.
        """
        if not raw_import.raw_headers:
            return []

        try:
            headers = json.loads(raw_import.raw_headers)
        except json.JSONDecodeError:
            return []

        suggestions = []

        # Rule 1: Line Efficiency Gauge
        if self._has_efficiency_column(headers):
            eff_col = self._find_column(
                headers, ["efficiency", "eff%", "line_eff", "efficiency_percentage"]
            )
            suggestions.append(
                SuggestedWidget(
                    widget_type="line_efficiency_gauge",
                    reason="Detected efficiency percentage column",
                    confidence=0.95,
                    data_mapping={"efficiency": eff_col or "efficiency"},
                )
            )

        # Rule 2: Quality/DHU Chart
        if self._has_quality_metrics(headers):
            defect_col = self._find_column(
                headers, ["defect", "dhu", "defects_per_hundred", "defect_count"]
            )
            suggestions.append(
                SuggestedWidget(
                    widget_type="dhu_quality_chart",
                    reason="Detected quality metrics (defects, DHU, pass rate)",
                    confidence=0.90,
                    data_mapping={"defects": defect_col or "dhu"},
                )
            )

        # Rule 3: Production Timeline
        if self._has_date_and_output(headers):
            date_col = self._find_column(
                headers, ["date", "production_date", "day", "timestamp"]
            )
            output_col = self._find_column(
                headers, ["output", "units", "production", "quantity"]
            )
            suggestions.append(
                SuggestedWidget(
                    widget_type="production_timeline",
                    reason="Detected date and production output columns",
                    confidence=0.85,
                    data_mapping={
                        "date": date_col or "date",
                        "output": output_col or "output",
                    },
                )
            )

        # Rule 4: SAM Performance
        if self._has_sam_data(headers):
            sam_col = self._find_column(
                headers, ["sam", "sam_minutes", "standard_minutes", "smv"]
            )
            suggestions.append(
                SuggestedWidget(
                    widget_type="sam_performance",
                    reason="Detected SAM (Standard Allowed Minutes) data",
                    confidence=0.80,
                    data_mapping={"sam": sam_col or "sam"},
                )
            )

        # Rule 5: Workforce Attendance
        if self._has_workforce_data(headers):
            worker_col = self._find_column(
                headers, ["worker", "employee", "worker_id", "operator"]
            )
            attendance_col = self._find_column(
                headers, ["attendance", "present", "absent", "status"]
            )
            suggestions.append(
                SuggestedWidget(
                    widget_type="workforce_attendance",
                    reason="Detected worker/attendance data",
                    confidence=0.75,
                    data_mapping={
                        "workers": worker_col or "worker",
                        "attendance": attendance_col or "attendance",
                    },
                )
            )

        # Sort by confidence (highest first)
        suggestions.sort(key=lambda x: x.confidence, reverse=True)

        return suggestions

    def _has_efficiency_column(self, headers: list[str]) -> bool:
        """Check for efficiency-related columns."""
        patterns = [
            "efficiency",
            "eff%",
            "line_eff",
            "production_efficiency",
            "eff_pct",
        ]
        return any(self._fuzzy_match(h, patterns) for h in headers)

    def _has_quality_metrics(self, headers: list[str]) -> bool:
        """Check for quality/defect-related columns."""
        patterns = ["defect", "dhu", "quality", "pass_rate", "reject", "qc"]
        return any(self._fuzzy_match(h, patterns) for h in headers)

    def _has_date_and_output(self, headers: list[str]) -> bool:
        """Check for date + production output columns."""
        date_patterns = ["date", "day", "timestamp", "time"]
        output_patterns = ["output", "production", "units", "quantity", "pieces"]

        has_date = any(self._fuzzy_match(h, date_patterns) for h in headers)
        has_output = any(self._fuzzy_match(h, output_patterns) for h in headers)

        return has_date and has_output

    def _has_sam_data(self, headers: list[str]) -> bool:
        """Check for SAM (Standard Allowed Minutes) data."""
        patterns = ["sam", "smv", "standard_minutes", "sam_minutes", "allowed_minutes"]
        return any(self._fuzzy_match(h, patterns) for h in headers)

    def _has_workforce_data(self, headers: list[str]) -> bool:
        """Check for workforce/worker-related data."""
        patterns = ["worker", "employee", "operator", "attendance", "staff"]
        return any(self._fuzzy_match(h, patterns) for h in headers)

    def _find_column(self, headers: list[str], patterns: list[str]) -> str | None:
        """Find the first column that matches any of the patterns."""
        for header in headers:
            if self._fuzzy_match(header, patterns):
                return header
        return None

    def _fuzzy_match(self, header: str, patterns: list[str]) -> bool:
        """
        Case-insensitive substring matching.
        Removes underscores and spaces for better matching.
        """
        header_normalized = header.lower().replace("_", "").replace(" ", "")
        for pattern in patterns:
            pattern_normalized = pattern.lower().replace("_", "").replace(" ", "")
            if pattern_normalized in header_normalized:
                return True
        return False


# Singleton instance
widget_suggestion_service = WidgetSuggestionService()
