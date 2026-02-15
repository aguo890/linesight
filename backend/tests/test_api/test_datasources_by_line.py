# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Tests for DataSource API endpoints.
Verifies the by-line lookup endpoint returns correct data or null gracefully.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import DataSource
from app.models.factory import Factory, ProductionLine


@pytest.fixture
async def setup_line(db_session: AsyncSession, test_organization):
    """Create a basic factory hierarchy (Organization -> Factory -> Line)."""
    # 1. Create Factory
    factory = Factory(
        name="Test Factory",
        organization_id=test_organization.id,
        code="TF1",
        country="US",  # Required field
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)

    # 2. Create Production Line
    line = ProductionLine(name="Line A", factory_id=factory.id)
    db_session.add(line)
    await db_session.commit()
    await db_session.refresh(line)

    return line


@pytest.mark.asyncio
async def test_get_datasource_by_line_exists(
    async_client: AsyncClient, db_session: AsyncSession, setup_line, auth_headers
):
    """Test retrieving an existing datasource via line_id."""
    line = setup_line

    # Create DataSource
    ds = DataSource(
        production_line_id=line.id,
        source_name="Test Data Source",
        description="Test description",
        time_column="Date",  # Required field
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    # Call Endpoint
    response = await async_client.get(
        f"/api/v1/datasources/by-line/{line.id}", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data is not None
    assert data["production_line_id"] == line.id
    assert data["source_name"] == "Test Data Source"


@pytest.mark.asyncio
async def test_get_datasource_by_line_none(
    async_client: AsyncClient, db_session: AsyncSession, setup_line, auth_headers
):
    """Test graceful null return when datasource is missing."""
    line = setup_line

    # Call Endpoint without creating a DataSource
    response = await async_client.get(
        f"/api/v1/datasources/by-line/{line.id}", headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json() is None  # Should be null, not 404


@pytest.mark.asyncio
async def test_get_datasource_cross_line_isolation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    setup_line,
    test_organization,
    auth_headers,
):
    """Test that querying Line A does not return Line B's datasource (Scenario C - Isolation)."""
    line_a = setup_line

    # Create Line B in the same factory
    from app.models.factory import Factory

    factory_result = await db_session.execute(
        select(Factory).where(Factory.organization_id == test_organization.id)
    )
    factory = factory_result.scalar_one()

    line_b = ProductionLine(name="Line B", factory_id=factory.id)
    db_session.add(line_b)
    await db_session.commit()
    await db_session.refresh(line_b)

    # Create DataSource for Line A only
    ds_a = DataSource(
        production_line_id=line_a.id,
        source_name="Line A Data Source",
        description="Line A only",
        time_column="Date",
    )
    db_session.add(ds_a)
    await db_session.commit()
    await db_session.refresh(ds_a)

    # Query Line B - should return null
    response_b = await async_client.get(
        f"/api/v1/datasources/by-line/{line_b.id}", headers=auth_headers
    )
    assert response_b.status_code == 200
    assert response_b.json() is None

    # Query Line A - should return the datasource
    response_a = await async_client.get(
        f"/api/v1/datasources/by-line/{line_a.id}", headers=auth_headers
    )
    assert response_a.status_code == 200
    data = response_a.json()
    assert data is not None
    assert data["production_line_id"] == line_a.id
    assert data["source_name"] == "Line A Data Source"


@pytest.mark.asyncio
async def test_update_datasource(
    async_client: AsyncClient, db_session: AsyncSession, setup_line, auth_headers
):
    """Test updating a DataSource configuration (e.g., changing time column)."""
    line = setup_line

    # Create DataSource
    ds = DataSource(
        production_line_id=line.id,
        source_name="Test Data Source",
        description="Original description",
        time_column="Date",
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    # Update the time_column via API
    update_payload = {
        "time_column": "Production_Date",
        "description": "Updated description",
    }

    response = await async_client.put(
        f"/api/v1/datasources/{ds.id}", json=update_payload, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["time_column"] == "Production_Date"
    assert data["description"] == "Updated description"
    assert data["id"] == ds.id

    # Verify persistence by querying again
    verify_response = await async_client.get(
        f"/api/v1/datasources/{ds.id}", headers=auth_headers
    )
    verify_data = verify_response.json()
    assert verify_data["time_column"] == "Production_Date"
    assert verify_data["description"] == "Updated description"
