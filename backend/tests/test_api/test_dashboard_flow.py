# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Dashboard Flow Integration Tests.

Tests the complete dashboard lifecycle including:
- Editing DataSource configurations
- Viewing upload history
- Filtering by production line
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.raw_import import RawImport


@pytest.fixture
async def setup_dashboard_data(db_session: AsyncSession, test_organization):
    """Create comprehensive dashboard test data."""
    # 1. Setup Factory & Line
    factory = Factory(
        name="Dash Factory",
        organization_id=test_organization.id,
        code="DF1",
        country="US",
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)

    line = DataSource(name="Line 1", factory_id=factory.id)
    db_session.add(line)
    await db_session.commit()
    await db_session.refresh(line)

    # 2. Setup Existing DataSource
    ds = DataSource(
        production_line_id=line.id,
        source_name="Production Data",
        time_column="Date",
        description="Main production data source",
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    # 3. Setup Upload History (Raw Imports)
    upload = RawImport(
        original_filename="prod_jan.xlsx",
        file_path="/tmp/prod_jan.xlsx",
        status="processed",
        factory_id=factory.id,
        production_line_id=line.id,
        file_hash="abc123",
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        file_size_bytes=1024,
        row_count=100,
        column_count=10,
        raw_headers='["Date", "Product", "Quantity"]',
        sample_data='[["2024-01-01", "Widget", 100]]',
    )
    db_session.add(upload)

    await db_session.commit()
    await db_session.refresh(upload)

    return factory, line, ds, upload


@pytest.mark.asyncio
async def test_edit_configuration(
    async_client: AsyncClient,
    db_session: AsyncSession,
    setup_dashboard_data,
    auth_headers,
):
    """Verify user can edit the DataSource configuration (e.g., change time column)."""
    _, _, ds, _ = setup_dashboard_data

    # Payload to change time column from "Date" to "Production_Date"
    update_payload = {"time_column": "Production_Date"}

    response = await async_client.put(
        f"/api/v1/datasources/{ds.id}", json=update_payload, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["time_column"] == "Production_Date"
    assert data["id"] == ds.id

    # Verify the update persisted
    await db_session.refresh(ds)
    assert ds.time_column == "Production_Date"


@pytest.mark.asyncio
async def test_view_uploaded_files(
    async_client: AsyncClient,
    db_session: AsyncSession,
    setup_dashboard_data,
    auth_headers,
):
    """Verify the dashboard can fetch the list of uploaded files."""
    factory, line, _, upload = setup_dashboard_data

    # Fetch upload history filtered by production line
    response = await async_client.get(
        f"/api/v1/ingestion/uploads?production_line_id={line.id}", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()

    # Verify we got the files list
    assert "files" in data
    assert len(data["files"]) >= 1

    # Verify the upload we created is in the list
    file_entry = data["files"][0]
    assert file_entry["original_filename"] == "prod_jan.xlsx"
    assert file_entry["status"] == "processed"
    assert file_entry["production_line_id"] == line.id


@pytest.mark.asyncio
async def test_upload_history_isolation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    setup_dashboard_data,
    test_organization,
    auth_headers,
):
    """Verify upload history is properly isolated between production lines."""
    factory, line_1, _, _ = setup_dashboard_data

    # Create a second line
    line_2 = DataSource(name="Line 2", factory_id=factory.id)
    db_session.add(line_2)
    await db_session.commit()
    await db_session.refresh(line_2)

    # Create upload for line 2
    upload_2 = RawImport(
        original_filename="prod_feb.xlsx",
        file_path="/tmp/prod_feb.xlsx",
        status="processed",
        factory_id=factory.id,
        production_line_id=line_2.id,
        file_hash="def456",
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        file_size_bytes=2048,
        row_count=200,
        column_count=10,
        raw_headers='["Date", "Product", "Quantity"]',
        sample_data='[["2024-02-01", "Widget", 200]]',
    )
    db_session.add(upload_2)
    await db_session.commit()

    # Query line 1 history
    response_1 = await async_client.get(
        f"/api/v1/ingestion/uploads?production_line_id={line_1.id}",
        headers=auth_headers,
    )
    assert response_1.status_code == 200
    data_1 = response_1.json()

    # Should only see line 1's uploads
    assert len(data_1["files"]) == 1
    assert data_1["files"][0]["original_filename"] == "prod_jan.xlsx"

    # Query line 2 history
    response_2 = await async_client.get(
        f"/api/v1/ingestion/uploads?production_line_id={line_2.id}",
        headers=auth_headers,
    )
    assert response_2.status_code == 200
    data_2 = response_2.json()

    # Should only see line 2's uploads
    assert len(data_2["files"]) == 1
    assert data_2["files"][0]["original_filename"] == "prod_feb.xlsx"


@pytest.mark.asyncio
async def test_upload_history_simple_endpoint(
    async_client: AsyncClient,
    db_session: AsyncSession,
    setup_dashboard_data,
    auth_headers,
):
    """Verify the NEW simple /history endpoint works correctly."""
    factory, line, _, upload = setup_dashboard_data

    # Fetch recent history
    response = await async_client.get(
        f"/api/v1/ingestion/history?production_line_id={line.id}", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()

    # This endpoint returns a flat list, not wrapped in mapping
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["original_filename"] == "prod_jan.xlsx"
    assert data[0]["production_line_id"] == line.id
