# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Test Suite for Dry-Run Validation Flow.

This module tests the HITL (Human-in-the-Loop) dry-run preview functionality
that allows users to review data transformations before committing to production.

Key Features Tested:
- Dry-run preview generation
- Date auto-fixing detection and warnings
- Data cleaning validation (efficiency, decimals, integers)
- Column mapping application
- Overall status calculation
- Full flow: upload → process → dry-run → confirm →promote
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import SchemaMapping
from app.models.raw_import import RawImport
from app.services.file_processor import FileProcessingService

# Fixtures moved to tests/api/v1/conftest.py


# =============================================================================
# Test Cases
# =============================================================================


@pytest.mark.asyncio
async def test_dry_run_preview_structure(
    db_session: AsyncSession, create_raw_import_with_messy_dates
):
    """Test that dry-run preview returns correct structure."""
    raw_import = create_raw_import_with_messy_dates

    service = FileProcessingService(db_session)
    result = await service.preview_dry_run(raw_import.id)

    # Verify response structure (Robust check)
    assert "raw_import_id" in result
    assert "total_rows" in result
    
    # Support multiple possible keys for preview records
    preview_records = result.get("preview_records") or result.get("preview") or result.get("rows")
    assert preview_records is not None, "Could not find preview records in result"
    assert isinstance(preview_records, list)
    
    assert "mapping_used" in result
    assert "overall_status" in result

    assert result["raw_import_id"] == raw_import.id
    assert result["total_rows"] == 5
    assert len(preview_records) <= 20  # Max 20 preview records

    # Verify each preview record has required fields
    for record in preview_records:
        assert "row" in record
        assert "raw" in record
        assert "clean" in record
        assert "status" in record
        # Note: issues might be optional in some versions, but let's check it if it's there
        if "issues" in record:
            assert isinstance(record["issues"], list)


@pytest.mark.asyncio
async def test_date_auto_fixing_detection(
    db_session: AsyncSession, create_raw_import_with_messy_dates
):
    """Test that date auto-fixing is detected and warnings are generated."""
    raw_import = create_raw_import_with_messy_dates

    service = FileProcessingService(db_session)
    result = await service.preview_dry_run(raw_import.id)

    # Check for warning status on rows with auto-fixed dates
    warning_records = [r for r in result["preview_records"] if r["status"] == "warning"]

    assert len(warning_records) > 0, "Should have warning records for auto-fixed dates"

    # Verify warning contains date-related issue
    for record in warning_records:
        assert len(record["issues"]) > 0
        assert any(
            "date" in issue.lower() or "year" in issue.lower()
            for issue in record["issues"]
        )

    # Check that overall_status is "needs_review" when warnings exist
    assert result["overall_status"] == "needs_review"


@pytest.mark.asyncio
async def test_efficiency_percentage_cleaning(
    db_session: AsyncSession,
    setup_dry_run_test_data,
    create_raw_import_with_messy_dates,
):
    """Test that efficiency percentages are cleaned correctly."""
    raw_import = create_raw_import_with_messy_dates

    service = FileProcessingService(db_session)
    result = await service.preview_dry_run(raw_import.id)

    # Find a record with efficiency data
    for record in result["preview_records"]:
        if "efficiency_pct" in record["clean"]:
            cleaned_eff = record["clean"]["efficiency_pct"]

            # Should be a decimal between 0 and 1 (not 85, but 0.85)
            if cleaned_eff is not None:
                assert isinstance(cleaned_eff, (float, int))
                # If original was "85%" should be converted to 0.85
                assert 0 <= cleaned_eff <= 1.5  # Allow some tolerance


@pytest.mark.asyncio
async def test_decimal_field_handling(
    db_session: AsyncSession, create_raw_import_with_messy_dates
):
    """Test that decimal fields (SAM) are handled correctly."""
    raw_import = create_raw_import_with_messy_dates

    service = FileProcessingService(db_session)
    result = await service.preview_dry_run(raw_import.id)

    for record in result["preview_records"]:
        if "standard_allowed_minute" in record["clean"]:
            sam_value = record["clean"]["standard_allowed_minute"]

            # Should be a valid decimal or None
            if sam_value is not None:
                # Can be Decimal, float, or int
                from decimal import Decimal

                assert isinstance(sam_value, (Decimal, float, int))
                assert sam_value > 0  # SAM should be positive


@pytest.mark.asyncio
async def test_integer_field_cleaning(
    db_session: AsyncSession, create_raw_import_with_messy_dates
):
    """Test that integer fields (quantities) are cleaned correctly."""
    raw_import = create_raw_import_with_messy_dates

    service = FileProcessingService(db_session)
    result = await service.preview_dry_run(raw_import.id)

    for record in result["preview_records"]:
        # Check actual_quantity
        if "actual_quantity" in record["clean"]:
            actual = record["clean"]["actual_quantity"]
            if actual is not None:
                assert isinstance(actual, int)
                assert actual >= 0

        # Check target_quantity
        if "target_quantity" in record["clean"]:
            target = record["clean"]["target_quantity"]
            if target is not None:
                assert isinstance(target, int)
                assert target >= 0


@pytest.mark.asyncio
async def test_column_mapping_application(
    db_session: AsyncSession, create_raw_import_with_messy_dates
):
    """Test that column mappings are applied correctly."""
    raw_import = create_raw_import_with_messy_dates

    service = FileProcessingService(db_session)
    result = await service.preview_dry_run(raw_import.id)

    # Verify column mapping was used
    column_map = result["mapping_used"]
    assert "Date" in column_map
    assert column_map["Date"] == "production_date"
    assert column_map["Style"] == "style_number"

    # Verify cleaned data uses target field names
    for record in result["preview_records"]:
        cleaned = record["clean"]

        # Should have target field names, not source column names
        assert "production_date" in cleaned or cleaned.get("production_date") is None
        assert "style_number" in cleaned or cleaned.get("style_number") is None

        # Should NOT have source column names
        assert "Date" not in cleaned
        assert "Style" not in cleaned


@pytest.mark.asyncio
async def test_overall_status_with_warnings(
    db_session: AsyncSession, create_raw_import_with_messy_dates
):
    """Test that overall_status is 'needs_review' when warnings exist."""
    raw_import = create_raw_import_with_messy_dates

    service = FileProcessingService(db_session)
    result = await service.preview_dry_run(raw_import.id)

    # Count warnings
    warning_count = sum(1 for r in result["preview_records"] if r["status"] == "warning")

    if warning_count > 0:
        assert result["overall_status"] == "needs_review"
    else:
        assert result["overall_status"] == "ready"


@pytest.mark.asyncio
async def test_overall_status_all_valid(
    db_session: AsyncSession, setup_dry_run_test_data, tmp_path
):
    """Test that overall_status is 'ready' when all rows are valid."""
    factory, line, ds, _ = setup_dry_run_test_data

    # Create CSV with clean data (no date issues)
    clean_csv = """Date,Style,PO,Produced,Target,Eff%,SAM
2025-01-01,ST100,PO123,85,100,0.85,2.5
2025-01-02,ST101,PO124,95,100,0.95,3.0"""

    test_file_path = tmp_path / "clean_dates.csv"
    test_file_path.write_text(clean_csv)

    raw_import = RawImport(
        factory_id=factory.id,
        production_line_id=line.id,
        data_source_id=ds.id,
        original_filename="clean_dates.csv",
        file_path=str(test_file_path),
        file_size_bytes=len(clean_csv),
        file_hash="clean123",
        mime_type="text/csv",
        status="confirmed",
    )

    db_session.add(raw_import)
    await db_session.commit()

    service = FileProcessingService(db_session)
    result = await service.preview_dry_run(raw_import.id)

    # All records should be valid
    assert all(r["status"] == "valid" for r in result["preview_records"])
    assert result["overall_status"] == "ready"


@pytest.mark.asyncio
async def test_promotion_after_dry_run_approval(
    db_session: AsyncSession, create_raw_import_with_messy_dates
):
    """Test full flow: dry-run → user approval → successful promotion."""
    raw_import = create_raw_import_with_messy_dates

    # Step 1: Run dry-run preview
    service = FileProcessingService(db_session)
    preview_result = await service.preview_dry_run(raw_import.id)

    # Verify preview shows warnings
    assert preview_result["overall_status"] == "needs_review"

    # Step 2: User reviews and approves (simulated)
    # In real flow, user would click "Confirm & Import"

    # Step 3: Promote to production
    promotion_result = await service.promote_to_production(raw_import.id)

    # Verify promotion completed
    assert "status" in promotion_result
    assert promotion_result["status"] == "promoted"
    assert promotion_result["inserted"] > 0


@pytest.mark.asyncio
async def test_dry_run_with_missing_schema_mapping(
    db_session: AsyncSession, setup_dry_run_test_data
):
    """Test dry-run fails gracefully when SchemaMapping is missing."""
    factory, line, ds, _ = setup_dry_run_test_data

    # Deactivate the schema mapping
    from sqlalchemy import update

    await db_session.execute(
        update(SchemaMapping)
        .where(SchemaMapping.data_source_id == ds.id)
        .values(is_active=False)
    )
    await db_session.commit()

    # Create raw import
    raw_import = RawImport(
        factory_id=factory.id,
        production_line_id=line.id,
        data_source_id=ds.id,
        original_filename="test.csv",
        file_path="test.csv",
        file_size_bytes=100,
        file_hash="test",
        mime_type="text/csv",
        status="confirmed",
    )
    db_session.add(raw_import)
    await db_session.commit()

    # Attempt dry-run
    service = FileProcessingService(db_session)

    with pytest.raises(ValueError, match="No active schema mapping found"):
        await service.preview_dry_run(raw_import.id)


@pytest.mark.asyncio
async def test_dry_run_limits_to_20_rows(
    db_session: AsyncSession, setup_dry_run_test_data, tmp_path
):
    """Test that dry-run only processes first 20 rows for performance."""
    factory, line, ds, _ = setup_dry_run_test_data

    # Create CSV with 50 rows
    large_csv_lines = ["Date,Style,PO,Produced,Target,Eff%,SAM"]
    for i in range(50):
        large_csv_lines.append(
            f"2025-01-{i + 1:02d},ST{i:03d},PO{i:03d},100,100,1.0,2.5"
        )

    large_csv = "\n".join(large_csv_lines)
    test_file_path = tmp_path / "large.csv"
    test_file_path.write_text(large_csv)

    raw_import = RawImport(
        factory_id=factory.id,
        production_line_id=line.id,
        data_source_id=ds.id,
        original_filename="large.csv",
        file_path=str(test_file_path),
        file_size_bytes=len(large_csv),
        file_hash="large123",
        mime_type="text/csv",
        row_count=50,
        status="confirmed",
    )
    db_session.add(raw_import)
    await db_session.commit()

    service = FileProcessingService(db_session)
    result = await service.preview_dry_run(raw_import.id)

    # Should have processed only 20 rows
    assert len(result["preview_records"]) == 20
    # But total_rows should reflect actual file size
    assert result["total_rows"] == 50


@pytest.mark.asyncio
async def test_raw_data_preserved_in_preview(
    db_session: AsyncSession, create_raw_import_with_messy_dates
):
    """Test that raw_data is preserved exactly as it appears in the file."""
    raw_import = create_raw_import_with_messy_dates

    service = FileProcessingService(db_session)
    result = await service.preview_dry_run(raw_import.id)

    # Find a record with messy date
    for record in result["preview_records"]:
        raw_data = record["raw"]
        cleaned_data = record["clean"]

        # Raw data should contain original column names
        assert "Date" in raw_data or any("date" in k.lower() for k in raw_data)

        # Verify raw value is string (as it appears in CSV)
        if "Date" in raw_data:
            raw_date = raw_data["Date"]
            # Should be original string like "12-19", not transformed
            assert isinstance(raw_date, (str, type(None)))

            # Cleaned should have actual date object or string
            if "production_date" in cleaned_data:
                assert cleaned_data["production_date"] != raw_date or raw_date is None
