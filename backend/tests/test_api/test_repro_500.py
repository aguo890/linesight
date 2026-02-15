# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Reproduction test for the 500 error on GET /dashboards/?factory_id=...
This test specifically targets the "ambiguous join" crash scenario.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dashboard import Dashboard
from app.models.datasource import DataSource
from app.models.user import Organization, User


@pytest.mark.asyncio
async def test_list_dashboards_by_factory_id_crash(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_organization: Organization,
    auth_headers: dict,
):
    """
    REPRO: This test attempts to fetch dashboards filtered by factory_id.
    If the 'Ambiguous Join' bug exists, this will fail with status 500.

    The join path is: Dashboard -> DataSource (via data_source_id) -> Factory
    """

    # 1. SETUP: Create a factory
    factory_res = await async_client.post(
        "/api/v1/factories",
        json={"name": "Test Factory 500", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert factory_res.status_code == 201
    factory_id = factory_res.json()["id"]

    # 2. Create a DataSource linked to that factory (direct DB)
    data_source = DataSource(
        factory_id=factory_id,
        name="Test DataSource 500",
        is_active=True,
        time_column="Date",
    )
    db_session.add(data_source)
    await db_session.commit()
    await db_session.refresh(data_source)

    # 3. Create a Dashboard linked to that DataSource
    dashboard = Dashboard(
        user_id=test_user.id,
        name="Crash Test Dummy",
        description="Testing for 500 error",
        data_source_id=data_source.id,
    )
    db_session.add(dashboard)
    await db_session.commit()
    await db_session.refresh(dashboard)

    # 4. ACT: Hit the exact endpoint causing the browser error
    # URL: /api/v1/dashboards/?factory_id=...
    response = await async_client.get(
        f"/api/v1/dashboards/?factory_id={factory_id}",
        headers=auth_headers,
    )

    # 5. ASSERT: If this is 500, we confirmed the bug.
    if response.status_code == 500:
        pytest.fail(f"Server Crashed! API returned 500. Response: {response.text}")

    assert response.status_code == 200
    data = response.json()

    # Verify we actually got the list back
    assert "dashboards" in data
    assert data["count"] >= 1
    assert any(d["id"] == str(dashboard.id) for d in data["dashboards"])
