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
from app.models.factory import Factory
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
    """

    # 1. SETUP: Create a factory manually to ensure ID control
    # RLS: Must belong to test_org
    factory = Factory(
        organization_id=test_organization.id,
        name="Test Factory 500", 
        country="US", 
        timezone="UTC"
    )
    db_session.add(factory)
    await db_session.commit()
    factory_id = factory.id

    # 2. Create a DataSource linked to that factory
    data_source = DataSource(
        factory_id=factory_id,
        name="Test DataSource 500",
        is_active=True,
        time_column="Date",
    )
    db_session.add(data_source)
    await db_session.commit()

    # 3. Create a Dashboard via API to ensure complete setup
    payload = {
        "name": "Crash Test Dummy",
        "description": "Testing for 500 error",
        "data_source_id": str(data_source.id),
        "factory_id": str(factory_id),
        "widget_config": {"layout": []},
        "layout_config": {}
    }
    
    create_res = await async_client.post(
        "/api/v1/dashboards/", 
        json=payload,
        headers=auth_headers
    )
    assert create_res.status_code == 201, f"Setup Failed: {create_res.text}"

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
