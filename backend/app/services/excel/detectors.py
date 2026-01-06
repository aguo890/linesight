"""
Header detection logic for Excel files.
Handles finding headers anywhere in the first few rows of a worksheet.
"""

from .mappers import COLUMN_PATTERNS


class HeaderDetector:
    """Detects header rows in Excel worksheets."""

    def __init__(self, max_scan_rows: int = 20):
        self.max_scan_rows = max_scan_rows

    def detect_headers(self, worksheet) -> tuple[int, list[str]]:
        """
        Detect the header row in a worksheet.
        Handles headers that may not be in row 1.
        """
        best_row = 0
        best_headers = []
        best_score = 0

        # Determine how many rows to scan
        scan_limit = min(self.max_scan_rows, worksheet.max_row)

        for row_idx in range(scan_limit):
            row_values = []
            for cell in worksheet[row_idx + 1]:
                val = cell.value
                if val is not None:
                    row_values.append(str(val).strip())

            # Score this row as potential header
            score = self.score_header_row(row_values)

            if score > best_score:
                best_score = score
                best_row = row_idx
                best_headers = row_values

        return best_row, best_headers

    def score_header_row(self, values: list[str]) -> int:
        """Score a row's likelihood of being the header row."""
        if not values:
            return 0

        score = 0

        # More non-empty cells is better
        non_empty = [v for v in values if v]
        if not non_empty:
            return 0

        score += len(non_empty) * 2

        # Matching known column patterns is great
        for val in values:
            val_lower = val.lower().strip()
            if not val_lower:
                continue

            for _target_field, patterns in COLUMN_PATTERNS.items():
                # Check for exact match (high weight)
                if val_lower in patterns:
                    score += 10
                    continue

                # Check for fuzzy match only if string is long enough
                if len(val_lower) > 2 and any(
                    p in val_lower or val_lower in p for p in patterns
                ):
                    score += 5

        # Penalty for numeric values (likely data, not headers)
        for val in values:
            if val and val.replace(".", "").replace(",", "").replace("-", "").isdigit():
                score -= 10  # Stronger penalty

        return score
