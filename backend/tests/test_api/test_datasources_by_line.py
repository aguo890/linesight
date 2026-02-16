# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from app.models.factory import Factory
from app.models.datasource import DataSource

@pytest.mark.asyncio
async def test_get_datasource_by_line_exists(
    async_client: AsyncClient, db_session, test_organization, auth_headers
):
    """Test fetching datasource config by ID."""
    # 1. Setup (Correct Org)
    factory = Factory(
        organization_id=test_organization.id,
        name="DS Factory",
        code="DSF-01",
        country="US",
        timezone="UTC"
    )
    db_session.add(factory)
    await db_session.flush()

    ds = DataSource(factory_id=factory.id, name="DS Line", code="DSL-01")
    db_session.add(ds)
    await db_session.commit()

    # 2. Fetch
    res = await async_client.get(
        f"/api/v1/data-sources/by-line/{ds.id}", 
        headers=auth_headers
    )
    assert res.status_code == 200
    data = res.json()
    
    # 3. Verify
    assert data is not None
    assert data["id"] == str(ds.id)
