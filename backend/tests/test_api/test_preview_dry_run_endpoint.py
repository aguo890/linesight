# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

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

    # Verify response structure matches API reality (which differs from new schema slightly)
    data = response.json()
    assert "raw_import_id" in data
    assert "total_rows" in data
    assert "preview_records" in data  # API uses 'preview_records'
    assert "mapping_used" in data # API uses 'mapping_used'
    # overall_status is not in DryRunResponse, it provides error_count/warning_count

    # Verify data content
    assert data["raw_import_id"] == raw_import.id
    assert len(data["preview_records"]) > 0
    
    # Verify preview records structure
    for record in data["preview_records"]:
        assert "row" in record
        assert "raw" in record
        assert "clean" in record
        # issues is a list of strings
        assert "issues" in record
