"""
Test for Import Preview API Endpoint.

Tests the /ingestion/preview-dry-run/{raw_import_id} endpoint.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# Fixtures (setup_dry_run_test_data, create_raw_import_with_messy_dates)
# are now provided automatically by tests/api/v1/conftest.py


@pytest.mark.asyncio
async def test_preview_dry_run_endpoint(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers,
    create_raw_import_with_messy_dates,
):
    """Test the /preview-dry-run/{raw_import_id} API endpoint."""
    raw_import = create_raw_import_with_messy_dates

    # Call the API endpoint
    response = await async_client.get(
        f"/api/v1/ingestion/preview-dry-run/{raw_import.id}", headers=auth_headers
    )

    # Verify response status
    assert response.status_code == 200

    # Verify response structure matches DryRunResponse schema
    data = response.json()
    assert "raw_import_id" in data
    assert "total_rows" in data
    assert "preview" in data
    assert "mapping_used" in data
    assert "overall_status" in data

    # Verify data content
    assert data["raw_import_id"] == raw_import.id
    assert len(data["preview"]) > 0
    assert data["overall_status"] in ["ready", "needs_review"]

    # Verify preview records structure
    for record in data["preview"]:
        assert "row" in record
        assert "raw" in record
        assert "clean" in record
        assert "status" in record
        assert "issues" in record
        assert record["status"] in ["valid", "warning", "error"]
