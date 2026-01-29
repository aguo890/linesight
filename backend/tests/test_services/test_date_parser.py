from datetime import date, datetime

import pandas as pd

from app.services.ingestion.date_parser import parse_date


class TestDateParser:
    def test_native_types(self):
        """Tier 1: Native datetime/date objects should be returned directly."""
        dt = datetime(2025, 1, 6, 12, 0, 0)
        assert parse_date(dt) == dt

        d = date(2025, 1, 6)
        # Dates should convert to datetime at midnight
        assert parse_date(d) == datetime(2025, 1, 6, 0, 0, 0)

        # Pandas Timestamp
        ts = pd.Timestamp("2025-01-06 12:00:00")
        assert parse_date(ts) == dt

    def test_format_spec(self):
        """Tier 2: User specified format."""
        # YYYY-MM-DD
        assert parse_date("2025-01-06", format_spec="YYYY-MM-DD") == datetime(2025, 1, 6)

        # DD/MM/YYYY
        assert parse_date("06/01/2025", format_spec="DD/MM/YYYY") == datetime(2025, 1, 6)

        # MM/DD/YYYY
        assert parse_date("01/06/2025", format_spec="MM/DD/YYYY") == datetime(2025, 1, 6)

        # Short format MM-DD (assume current year)
        current_year = datetime.now().year
        assert parse_date("01-06", format_spec="MM-DD", assume_year=2025) == datetime(2025, 1, 6)

    def test_excel_serials(self):
        """Tier 3: Excel serial numbers (days since 1899-12-30)."""
        # 45663 = 2025-01-06 (approx check: 45663 days after 1899-12-30)
        # Base: 1899-12-30
        # 45663 days = 125 years + days

        base = date(1899, 12, 30)
        target = date(2025, 1, 6)
        delta = (target - base).days

        # Integer serial
        assert parse_date(delta) == datetime(2025, 1, 6)
        assert parse_date(str(delta)) == datetime(2025, 1, 6)

        # Float serial (noon)
        # .5 = 12:00 PM
        assert parse_date(float(delta) + 0.5) == datetime(2025, 1, 6, 12, 0, 0)

        # Small serial (early 1900s)
        # 1 = 1899-12-31, 2 = 1900-01-01
        assert parse_date(2) == datetime(1900, 1, 1)

    def test_heuristics_dayfirst(self):
        """Tier 4: Heuristics and dayfirst/yearfirst verification."""
        ambiguous = "01/02/2024"  # Jan 2nd vs Feb 1st

        # dayfirst=True (British/Intl) -> Feb 1st
        assert parse_date(ambiguous, dayfirst=True) == datetime(2024, 2, 1)

        # dayfirst=False (US) -> Jan 2nd
        assert parse_date(ambiguous, dayfirst=False) == datetime(2024, 1, 2)

        # Default behavior (heuristic, likely defaults to dayfirst=True in our logic)
        # We explicitly set default=True in the code
        assert parse_date(ambiguous) == datetime(2024, 2, 1)

    def test_diagnostics_return(self):
        """Check robust return type."""
        # Native
        res = parse_date(datetime(2025, 1, 1), return_diagnostics=True)
        assert res.tier_used == "native"
        assert res.value == datetime(2025, 1, 1)

        # Format
        res = parse_date("2025-01-01", format_spec="YYYY-MM-DD", return_diagnostics=True)
        assert res.tier_used == "format"

        # Excel
        res = parse_date("45000", return_diagnostics=True)
        assert res.tier_used == "excel_serial"

        # Heuristic
        res = parse_date("Jan 1st, 2025", return_diagnostics=True)
        assert res.tier_used == "heuristic"
        assert res.value == datetime(2025, 1, 1)

        # Failure
        res = parse_date("Not a date", return_diagnostics=True)
        assert res.tier_used == "failed"
        assert res.value is None

    def test_invalid_inputs(self):
        """Degenerate cases."""
        assert parse_date(None) is None
        assert parse_date("") is None
        assert parse_date("   ") is None
        assert parse_date("Not a date") is None
