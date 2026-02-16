# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.user import User

@pytest.mark.asyncio
async def test_assign_user_to_line(
    async_client: AsyncClient, db_session, test_organization, auth_headers
):
    """Test assigning a user to a specific line (datasource)."""
    # 1. Setup
    factory = Factory(organization_id=test_organization.id, name="Team Factory", code="TF-99", country="US", timezone="UTC")
    db_session.add(factory)
    await db_session.flush()
    
    ds = DataSource(factory_id=factory.id, name="Team Line")
    db_session.add(ds)
    
    target_user = User(
        organization_id=test_organization.id,
        email="operator@example.com",
        hashed_password="pw",
        role="viewer", # FIX: 'operator' is not a valid enum value
        is_active=True
    )
    db_session.add(target_user)
    await db_session.commit()

    # 2. Assign Scope
    payload = {
        "data_source_id": str(ds.id),
        "role": "viewer" 
    }
    
    res = await async_client.post(
        f"/api/v1/organizations/members/{target_user.id}/scopes",
        json=payload,
        headers=auth_headers
    )
    assert res.status_code == 201
    data = res.json()
    
    # FIX: Assert 'data_source' instead of 'line'
    assert data["scope_type"] == "data_source" 
    assert data["data_source_id"] == str(ds.id)
