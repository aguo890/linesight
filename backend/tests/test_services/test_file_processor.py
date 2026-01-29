"""
Tests for FileProcessingService - focusing on HITL dry run preview system.
"""

from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock

import pandas as pd
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import DataSource, SchemaMapping
from app.models.raw_import import RawImport
from app.services.file_processor import FileProcessingService


class TestFileProcessorDryRun:
    """Test the Human-in-the-Loop dry run preview functionality."""

    @pytest.fixture
    def mock_db_session(self):
        """Create a mock database session."""
        session = AsyncMock(spec=AsyncSession)
        return session

    @pytest.fixture
    def service(self, mock_db_session):
        """Create a FileProcessingService instance."""
        return FileProcessingService(mock_db_session)

    @pytest.fixture
    def sample_raw_import(self, tmp_path):
        """Create a sample RawImport with test data."""
        # Create test CSV with messy dates
        test_data = {
            "Date": ["12-19", "12-20", "12-21"],
            "Style": ["ABC-123", "DEF-456", "GHI-789"],
            "Target_Qty": [1000, 1500, 1200],
            "Actual": [950, 1450, 1180],
        }
        df = pd.DataFrame(test_data)

        # Use a temporary file for now as the service expects a file path,
        # but the data generation is dynamic in-memory.
        test_file = tmp_path / "test_production.csv"
        df.to_csv(test_file, index=False)

        # Create mock objects
        schema_mapping = SchemaMapping(
            id="schema-1",
            data_source_id="ds-1",
            column_map={
                "Date": "production_date",
                "Style": "style_number",
                "Target_Qty": "planned_qty",
                "Actual": "actual_qty",
            },
            is_active=True,
        )

        data_source = DataSource(
            id="ds-1", production_line_id="line-1", source_name="Test Data Source"
        )
        data_source.schema_mappings = [schema_mapping]

        raw_import = RawImport(
            id="raw-import-1",
            data_source_id="ds-1",
            factory_id="factory-1",
            production_line_id="line-1",
            file_path=str(test_file),
            encoding_detected="utf-8",
        )
        raw_import.data_source = data_source

        return raw_import

    @pytest.mark.asyncio
    async def test_dry_run_preview_basic(
        self, service, mock_db_session, sample_raw_import
    ):
        """Test basic dry run preview functionality."""
        # Mock the database query
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = sample_raw_import
        mock_db_session.execute.return_value = result_mock

        # Execute dry run
        result = await service.preview_dry_run("raw-import-1")

        # Assertions
        assert result["raw_import_id"] == "raw-import-1"
        assert result["total_rows"] == 3
        assert len(result["preview_records"]) == 3
        assert result["mapping_used"] == {
            "Date": "production_date",
            "Style": "style_number",
            "Target_Qty": "planned_qty",
            "Actual": "actual_qty",
        }

    @pytest.mark.asyncio
    async def test_dry_run_detects_date_warnings(
        self, service, mock_db_session, sample_raw_import
    ):
        """Test that dry run detects and flags messy date formats."""
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = sample_raw_import
        mock_db_session.execute.return_value = result_mock

        result = await service.preview_dry_run("raw-import-1")

        # Check that warnings are generated for date assumptions
        warning_records = [r for r in result["preview_records"] if r["status"] == "warning"]
        assert len(warning_records) > 0

        # Check that issues mention date auto-fixing
        for record in warning_records:
            assert any("Auto-fixed date" in issue for issue in record["issues"])

        assert result["overall_status"] == "needs_review"

    @pytest.mark.asyncio
    async def test_dry_run_shows_before_after(
        self, service, mock_db_session, sample_raw_import
    ):
        """Test that dry run shows raw vs cleaned data comparison."""
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = sample_raw_import
        mock_db_session.execute.return_value = result_mock

        result = await service.preview_dry_run("raw-import-1")

        # Check first record has both raw and cleaned data
        first_record = result["preview_records"][0]

        assert "raw" in first_record
        assert "clean" in first_record

        # Raw data should have original column names
        assert "Date" in first_record["raw"]
        assert "Style" in first_record["raw"]

        # Cleaned data should have normalized column names
        assert "production_date" in first_record["clean"]
        assert "style_number" in first_record["clean"]

        # Date "12-19" is now parsed correctly
        cleaned_date = first_record["clean"]["production_date"]
        assert cleaned_date is not None
        assert cleaned_date.month == 12
        assert cleaned_date.day == 19

    @pytest.mark.asyncio
    async def test_dry_run_no_warnings_for_clean_data(
        self, service, mock_db_session, tmp_path
    ):
        """Test that clean data doesn't generate warnings."""
        # Create test CSV with clean dates
        test_file = tmp_path / "test_clean.csv"
        test_data = {
            "production_date": ["2025-12-19", "2025-12-20", "2025-12-21"],
            "style_number": ["ABC-123", "DEF-456", "GHI-789"],
            "planned_qty": [1000, 1500, 1200],
        }
        df = pd.DataFrame(test_data)
        df.to_csv(test_file, index=False)

        # Create mock objects
        schema_mapping = SchemaMapping(
            id="schema-1",
            data_source_id="ds-1",
            column_map={
                "production_date": "production_date",
                "style_number": "style_number",
                "planned_qty": "planned_qty",
            },
            is_active=True,
        )

        data_source = DataSource(
            id="ds-1", production_line_id="line-1", source_name="Test Data Source"
        )
        data_source.schema_mappings = [schema_mapping]

        raw_import = RawImport(
            id="raw-import-2",
            data_source_id="ds-1",
            factory_id="factory-1",
            file_path=str(test_file),
            encoding_detected="utf-8",
        )
        raw_import.data_source = data_source

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = raw_import
        mock_db_session.execute.return_value = result_mock

        result = await service.preview_dry_run("raw-import-2")

        # All records should be valid (no warnings)
        assert result["overall_status"] == "ready"
        assert all(r["status"] == "valid" for r in result["preview_records"])

    @pytest.mark.asyncio
    async def test_dry_run_limits_to_20_rows(self, service, mock_db_session, tmp_path):
        """Test that dry run only processes first 20 rows for performance."""
        # Create test CSV with 50 rows
        test_file = tmp_path / "test_large.csv"
        test_data = {
            "Date": [f"12-{i:02d}" for i in range(1, 51)],
            "Style": [f"STYLE-{i}" for i in range(1, 51)],
            "Target_Qty": [1000 + i for i in range(1, 51)],
        }
        df = pd.DataFrame(test_data)
        df.to_csv(test_file, index=False)

        schema_mapping = SchemaMapping(
            id="schema-1",
            data_source_id="ds-1",
            column_map={
                "Date": "production_date",
                "Style": "style_number",
                "Target_Qty": "planned_qty",
            },
            is_active=True,
        )

        data_source = DataSource(
            id="ds-1", production_line_id="line-1", source_name="Test Data Source"
        )
        data_source.schema_mappings = [schema_mapping]

        raw_import = RawImport(
            id="raw-import-3",
            data_source_id="ds-1",
            factory_id="factory-1",
            file_path=str(test_file),
            encoding_detected="utf-8",
        )
        raw_import.data_source = data_source

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = raw_import
        mock_db_session.execute.return_value = result_mock

        result = await service.preview_dry_run("raw-import-3")

        # Should have collected the limited rows in total_rows
        assert result["total_rows"] == 20

        # And matched in preview
        assert len(result["preview_records"]) == 20


class TestDataCleaning:
    """Test the _clean_value method for different data types."""

    @pytest.fixture
    def service(self):
        """Create a FileProcessingService instance."""
        session = AsyncMock(spec=AsyncSession)
        return FileProcessingService(session)

    def test_clean_date_messy_format(self, service):
        """Test cleaning messy date formats like '12-19'.
        
        Refactored: The new robust parse_date uses dateutil heuristics which correctly
        identifies '12-19' as December 19th (current year).
        """
        result = service._clean_value("12-19", "production_date")

        # Now returns a date object thanks to Tier 4 (Heuristics)
        assert isinstance(result, (date, datetime))
        assert result.month == 12
        assert result.day == 19

    def test_clean_date_full_format(self, service):
        """Test cleaning full date formats."""
        result = service._clean_value("2025-12-19", "production_date")

        assert isinstance(result, date)
        assert result.year == 2025
        assert result.month == 12
        assert result.day == 19

    def test_clean_integer_fields(self, service):
        """Test cleaning integer fields."""
        # String integer
        assert service._clean_value("1000", "actual_qty") == 1000

        # Float to integer
        assert service._clean_value(1000.5, "planned_qty") == 1000

        # Invalid integer
        assert service._clean_value("invalid", "actual_qty") == 0

    def test_clean_decimal_fields(self, service):
        """Test cleaning decimal fields."""
        result = service._clean_value("12.5", "sam")
        # Refactored: _clean_value now returns float for decimal fields
        assert isinstance(result, float)
        assert result == 12.5

        result = service._clean_value(12.5, "earned_minutes")
        assert isinstance(result, float)

    def test_clean_efficiency_percentage(self, service):
        """Test cleaning efficiency percentage fields."""
        # With percent sign - mapping to line_efficiency which handles %
        assert service._clean_value("95%", "line_efficiency") == 0.95

        # Already decimal - for custom eff if it falls to str_val
        assert service._clean_value("0.95", "eff") == "0.95"

        # Greater than 1 (assume it's a percentage)
        assert service._clean_value("95", "line_efficiency") == 0.95

    def test_clean_none_values(self, service):
        """Test cleaning None and NaN values."""
        import numpy as np

        assert service._clean_value(None, "style_number") is None
        assert service._clean_value(np.nan, "style_number") is None
        assert service._clean_value(pd.NA, "style_number") is None

    def test_clean_string_fields(self, service):
        """Test cleaning string fields."""
        result = service._clean_value("  ABC-123  ", "style_number")
        assert result == "ABC-123"

        result = service._clean_value(123, "style_number")
        assert result == "123"


class TestProductionRunInsertion:
    """Test the production run insertion logic.
    
    NOTE: After refactoring, the _insert_production_runs method was moved to
    app.services.ingestion.writer.ProductionWriter. These tests now validate
    that the orchestrator correctly delegates to the writer.
    """

    @pytest.fixture
    def service(self):
        """Create a FileProcessingService instance."""
        session = AsyncMock(spec=AsyncSession)
        return FileProcessingService(session)

    @pytest.mark.asyncio
    async def test_promote_delegates_to_orchestrator(self, service):
        """Test that promote_to_production delegates to orchestrator."""
        # Mock the orchestrator's promote method
        service._orchestrator.promote_to_production = AsyncMock(
            return_value={
                "status": "promoted",
                "inserted": 2,
                "updated": 0,
                "events": 2,
                "errors": 0,
            }
        )

        result = await service.promote_to_production("raw-import-1")

        # Verify delegation occurred
        service._orchestrator.promote_to_production.assert_called_once_with(
            raw_import_id="raw-import-1",
            on_progress=None,
        )
        assert result["status"] == "promoted"
        assert result["inserted"] == 2

    @pytest.mark.asyncio
    async def test_promote_handles_already_promoted(self, service):
        """Test that already-promoted imports are skipped."""
        service._orchestrator.promote_to_production = AsyncMock(
            return_value={
                "status": "promoted",
                "message": "Already processed",
                "records_processed": 0,
            }
        )

        result = await service.promote_to_production("raw-import-1")

        assert result["status"] == "promoted"
        assert result.get("message") == "Already processed"

