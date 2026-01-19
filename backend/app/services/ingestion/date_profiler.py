"""
Date Format Profiler - Column-Level Constraint Elimination.

Industry-standard algorithm for detecting date formats from a column of data.
Instead of guessing row-by-row, we scan a sample and eliminate impossible formats.

Usage:
    from app.services.ingestion.date_profiler import detect_column_format
    
    result = detect_column_format(date_strings)
    print(result.format)  # "YYYY-MM-DD" or "YYYY-DD-MM"
    print(result.confidence)  # 1.0 = certain, 0.5 = ambiguous
"""
import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Sequence

logger = logging.getLogger(__name__)


class DateFormatHypothesis(Enum):
    """Possible YYYY-first date formats."""
    ISO = "YYYY-MM-DD"   # Standard: Year-Month-Day
    SWAP = "YYYY-DD-MM"  # Non-standard: Year-Day-Month


@dataclass
class FormatDetectionResult:
    """Result of column-level date format detection."""
    format: str  # The detected strptime format string
    format_label: str  # Human-readable format name
    confidence: float  # 1.0 = certain, 0.5 = ambiguous (both valid)
    sample_size: int  # Number of dates analyzed
    eliminating_value: str | None  # The value that proved the format (if any)
    ambiguous: bool  # True if format couldn't be determined with certainty


# Regex for YYYY-XX-XX style dates
ISO_STYLE_PATTERN = re.compile(r'^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s|T|$)')


def detect_column_format(
    date_values: Sequence[str],
    max_sample: int = 100,
) -> FormatDetectionResult:
    """
    Detect date format from a column of values using constraint elimination.
    
    Algorithm:
    1. Start with two hypotheses: ISO (YYYY-MM-DD) and SWAP (YYYY-DD-MM)
    2. Scan values looking for "constraint violations":
       - If middle value > 12: ISO impossible (month cannot be > 12)
       - If last value > 12: SWAP impossible (month cannot be > 12)
    3. Return the surviving hypothesis
    
    Args:
        date_values: List of date strings to analyze
        max_sample: Maximum number of values to check (for performance)
        
    Returns:
        FormatDetectionResult with detected format and confidence
    """
    # Track which hypotheses are still valid
    iso_valid = True   # YYYY-MM-DD
    swap_valid = True  # YYYY-DD-MM
    
    eliminating_value: str | None = None
    analyzed_count = 0
    
    for value in date_values[:max_sample]:
        if not value or not isinstance(value, str):
            continue
            
        str_val = str(value).strip()
        match = ISO_STYLE_PATTERN.match(str_val)
        
        if not match:
            continue  # Not a YYYY-XX-XX format, skip
            
        analyzed_count += 1
        
        try:
            middle_val = int(match.group(2))
            last_val = int(match.group(3))
        except ValueError:
            continue
        
        # Constraint check for ISO (YYYY-MM-DD): middle is month, must be ≤ 12
        if middle_val > 12:
            iso_valid = False
            if eliminating_value is None:
                eliminating_value = str_val
                logger.info(
                    f"Format detection: '{str_val}' has middle={middle_val} > 12, "
                    f"eliminating YYYY-MM-DD hypothesis"
                )
        
        # Constraint check for SWAP (YYYY-DD-MM): last is month, must be ≤ 12
        if last_val > 12:
            swap_valid = False
            if eliminating_value is None:
                eliminating_value = str_val
                logger.info(
                    f"Format detection: '{str_val}' has last={last_val} > 12, "
                    f"eliminating YYYY-DD-MM hypothesis"
                )
        
        # Early exit if we've eliminated one option
        if iso_valid != swap_valid:
            break
    
    # Determine result based on surviving hypotheses
    if iso_valid and not swap_valid:
        # YYYY-MM-DD confirmed
        return FormatDetectionResult(
            format="%Y-%m-%d",
            format_label="YYYY-MM-DD",
            confidence=1.0,
            sample_size=analyzed_count,
            eliminating_value=eliminating_value,
            ambiguous=False,
        )
    
    elif swap_valid and not iso_valid:
        # YYYY-DD-MM confirmed (rare but possible)
        logger.warning(
            f"Detected non-standard YYYY-DD-MM format based on value: {eliminating_value}"
        )
        return FormatDetectionResult(
            format="%Y-%d-%m",
            format_label="YYYY-DD-MM",
            confidence=1.0,
            sample_size=analyzed_count,
            eliminating_value=eliminating_value,
            ambiguous=False,
        )
    
    elif iso_valid and swap_valid:
        # Both still valid - genuinely ambiguous data
        # Default to ISO 8601 (industry standard) with warning
        logger.warning(
            f"AMBIGUOUS DATE COLUMN: All {analyzed_count} sampled values could be "
            f"YYYY-MM-DD or YYYY-DD-MM. Defaulting to ISO 8601 (YYYY-MM-DD). "
            f"Consider configuring explicit format in data source settings."
        )
        return FormatDetectionResult(
            format="%Y-%m-%d",
            format_label="YYYY-MM-DD",
            confidence=0.5,  # Ambiguous
            sample_size=analyzed_count,
            eliminating_value=None,
            ambiguous=True,
        )
    
    else:
        # Neither valid - malformed data
        logger.error(
            f"INVALID DATE COLUMN: Data has values with both middle > 12 AND last > 12. "
            f"Cannot determine format. Sample: {eliminating_value}"
        )
        return FormatDetectionResult(
            format="%Y-%m-%d",  # Default fallback
            format_label="UNKNOWN",
            confidence=0.0,
            sample_size=analyzed_count,
            eliminating_value=eliminating_value,
            ambiguous=True,
        )


def profile_date_column(
    date_values: Sequence[str],
    column_name: str = "date",
) -> dict:
    """
    Profile a date column and return detection results as a dict.
    
    Convenience wrapper for detect_column_format that returns a dict
    suitable for logging or API responses.
    
    Args:
        date_values: List of date strings
        column_name: Name of column for logging
        
    Returns:
        Dict with format info and profiling metadata
    """
    result = detect_column_format(date_values)
    
    profile = {
        "column": column_name,
        "detected_format": result.format_label,
        "strptime_format": result.format,
        "confidence": result.confidence,
        "ambiguous": result.ambiguous,
        "sample_size": result.sample_size,
        "proof_value": result.eliminating_value,
    }
    
    logger.info(f"Date column '{column_name}' profiled: {profile}")
    return profile
