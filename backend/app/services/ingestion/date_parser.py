"""
Date Parsing Utilities.

Handles conversion of various date formats from Excel/CSV to Python datetime.
Supports user-configured formats stored in DataSource.time_format.
Uses a waterfall approach:
1. Native types (datetime, date)
2. User-configured format (strict)
3. Excel Serial (int/float)
4. Intelligent Heuristics (dateutil)
"""
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

import pandas as pd
from dateutil import parser as dateutil_parser
from pandas.errors import ParserError


# Common format specifications to Python strptime format mapping
FORMAT_MAP = {
    # Standard formats
    "YYYY-MM-DD": "%Y-%m-%d",
    "YYYY/MM/DD": "%Y/%m/%d",
    "DD-MM-YYYY": "%d-%m-%Y",
    "DD/MM/YYYY": "%d/%m/%Y",
    "MM-DD-YYYY": "%m-%d-%Y",
    "MM/DD/YYYY": "%m/%d/%Y",
    # With time
    "YYYY-MM-DD HH:mm:ss": "%Y-%m-%d %H:%M:%S",
    "YYYY-MM-DD HH:mm": "%Y-%m-%d %H:%M",
    "DD/MM/YYYY HH:mm:ss": "%d/%m/%Y %H:%M:%S",
    "DD/MM/YYYY HH:mm": "%d/%m/%Y %H:%M",
    "MM/DD/YYYY HH:mm:ss": "%m/%d/%Y %H:%M:%S",
    "MM/DD/YYYY HH:mm": "%m/%d/%Y %H:%M",
    # ISO 8601
    "ISO8601": "%Y-%m-%dT%H:%M:%S",
    # Short formats (assumed current year)
    "MM-DD": "%m-%d",
    "DD-MM": "%d-%m",
    "MM/DD": "%m/%d",
    "DD/MM": "%d/%m",
}


@dataclass
class DateParseResult:
    """Result of date parsing with diagnostics."""

    value: datetime | None
    tier_used: str  # "format", "native", "excel_serial", "heuristic", "failed"
    warning: str | None = None


def normalize_format(format_spec: str | None) -> str | None:
    """
    Convert user-friendly format spec to Python strptime format.

    Args:
        format_spec: Format like "YYYY-MM-DD" or "DD/MM/YYYY"

    Returns:
        Python strptime format string, or None if not recognized
    """
    if not format_spec:
        return None

    # Already a python format (starts with %)
    if format_spec.startswith("%"):
        return format_spec

    # Lookup in map (case-insensitive key matching)
    upper = format_spec.upper()
    return FORMAT_MAP.get(upper)


def parse_date(
    val: Any,
    format_spec: str | None = None,
    auto_detect: bool = True,
    assume_year: int | None = None,
    dayfirst: bool | None = None,
    return_diagnostics: bool = False,
) -> datetime | DateParseResult | None:
    """
    Parse a value into a datetime object with waterfall logic.

    Tier 1: Check if already a native datetime/date type
    Tier 2: Try specified format (from DataSource.time_format)
    Tier 3: Try Excel serial conversion (int OR float)
    Tier 4: Use dateutil.parser with dayfirst hint

    Args:
        val: Value to parse (string, date, datetime, Excel numeric)
        format_spec: User-configured format like "YYYY-MM-DD"
        auto_detect: Enable fallback parsing if format fails
        assume_year: Year for MM-DD only formats
        dayfirst: True for DD/MM (intl), False for MM/DD (US), None for auto
        return_diagnostics: Return DateParseResult instead of datetime

    Returns:
        datetime object, DateParseResult, or None if parsing fails
    """
    result = DateParseResult(value=None, tier_used="failed")

    if pd.isna(val) or val == "":
        return result if return_diagnostics else None

    # Tier 1: Native types (check early - most efficient)
    if isinstance(val, datetime):
        # Handle pandas Timestamp which inherits from datetime but might need conversion
        if hasattr(val, "to_pydatetime"):
            result.value = val.to_pydatetime()
        else:
            result.value = val
        result.tier_used = "native"
        return result if return_diagnostics else result.value

    if isinstance(val, date):
        result.value = datetime.combine(val, datetime.min.time())
        result.tier_used = "native"
        return result if return_diagnostics else result.value

    str_val = str(val).strip()
    if not str_val:
        return result if return_diagnostics else None

    # Tier 2: Try specified format
    py_format = normalize_format(format_spec) if format_spec else None
    if py_format:
        try:
            parsed = datetime.strptime(str_val, py_format)
            # Handle short formats (assume year check)
            if assume_year and parsed.year == 1900:
                parsed = parsed.replace(year=assume_year)
            result.value = parsed
            result.tier_used = "format"
            return result if return_diagnostics else parsed
        except (ValueError, TypeError):
            result.warning = f"Format '{format_spec}' failed, trying heuristics"

    if not auto_detect and not result.value:
        return result if return_diagnostics else None

    # Tier 3: Excel serial (int OR float)
    # Excel serials are typically 25569 (1970-01-01) to ~60000 (2064)
    # But we check a wider range to be safe: 1 (1900-01-01) to 100000 (2173)
    try:
        numeric_val = float(str_val)
        if 1 <= numeric_val <= 100000:
            days = int(numeric_val)
            fractional_day = numeric_val - days

            # Excel base date is 1899-12-30
            base_date = date(1899, 12, 30) + timedelta(days=days)
            parsed_date = datetime.combine(base_date, datetime.min.time())

            # Add time component if fractional
            if fractional_day > 0:
                # 86400 seconds in a day
                parsed_date += timedelta(seconds=round(fractional_day * 86400))

            result.value = parsed_date
            result.tier_used = "excel_serial"
            return result if return_diagnostics else result.value
    except (ValueError, TypeError):
        pass

    # Tier 4: Heuristic detection with dateutil
    # Determine dayfirst from factory locale if not specified
    # Defaulting to True (International/British) as it's more common globally than US
    effective_dayfirst = dayfirst if dayfirst is not None else True

    try:
        parsed = dateutil_parser.parse(str_val, dayfirst=effective_dayfirst)
        result.value = parsed
        result.tier_used = "heuristic"
        return result if return_diagnostics else parsed
    except (ValueError, TypeError, ParserError):
        pass

    # Last resort fallback: pandas (expensive but powerful)
    try:
        ts = pd.to_datetime(str_val, dayfirst=effective_dayfirst)
        if pd.notna(ts):
            result.value = ts.to_pydatetime()
            result.tier_used = "pandas_fallback"
            return result if return_diagnostics else result.value
    except (ValueError, TypeError, ParserError):
        pass

    result.tier_used = "failed"
    result.warning = f"All parsing methods failed for value: {str_val[:50]}"
    return result if return_diagnostics else None


def get_format_options() -> list[dict[str, str]]:
    """
    Get available format options for UI dropdown.

    Returns:
        List of {value, label} dicts for frontend select component
    """
    return [
        {"value": "YYYY-MM-DD", "label": "YYYY-MM-DD (2025-01-06)"},
        {"value": "DD/MM/YYYY", "label": "DD/MM/YYYY (06/01/2025)"},
        {"value": "MM/DD/YYYY", "label": "MM/DD/YYYY (01/06/2025)"},
        {"value": "DD-MM-YYYY", "label": "DD-MM-YYYY (06-01-2025)"},
        {"value": "MM-DD-YYYY", "label": "MM-DD-YYYY (01-06-2025)"},
        {"value": "YYYY-MM-DD HH:mm:ss", "label": "YYYY-MM-DD HH:mm:ss (with time)"},
        # {"value": "auto", "label": "Auto-detect (let system guess)"}, # Removed to encourage explicit selection
        {"value": "auto", "label": "Auto-detect (best effort)"},
    ]

