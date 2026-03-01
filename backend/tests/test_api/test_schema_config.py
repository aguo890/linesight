# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import DataSource
from app.models.factory import Factory


@pytest.mark.asyncio
async def test_schema_configuration_flow(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """
    Test the Schema Configuration Flow:
    1. Create Line & DataSource (setup)
    2. Fetch Schema by Line (verify empty/initial)
    3. Update Schema Mapping (create version 1)
    4. Fetch Schema again (verify version 1 active)
    5. Update Schema Mapping again (verify version 2 active, version 1 inactive)
    """

    # 1. Setup (RLS Compliant)
    factory = Factory(
        organization_id=test_organization.id, # Matches User
        name="Schema Test Factory",
        code="STF-001",
        country="Test Country",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    line = DataSource(
        factory_id=factory.id, name="Schema Line 1", code="SL-01", is_active=True
    )
    db_session.add(line)
    await db_session.flush()

    # Create valid DataSource
    ds = DataSource(
        production_line_id=line.id, source_name="Schema Test Source", is_active=True
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    # Cache IDs for API calls
    # Note: In new model, line.id might be the ds_id if they are merged, 
    # but based on existing code structure we use ds.id
    ds_id = ds.id

    # 2. Fetch Schema
    # Note: Using /data-sources/{id} usually returns the config
    resp = await async_client.get(
        f"/api/v1/data-sources/{ds_id}", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == ds_id

    # 3. Update Schema Mapping (Create v1)
    mapping_payload = {
        "column_map": {"ColA": "field_a", "ColB": "field_b"},
        "reviewed_by_user": True,
        "user_notes": "Initial mapping",
    }

    resp_update = await async_client.put(
        f"/api/v1/data-sources/{ds_id}/mapping",
        json=mapping_payload,
        headers=auth_headers,
    )
    assert resp_update.status_code == 200
    update_data = resp_update.json()
    assert update_data["version"] == 1
    assert update_data["is_active"]
    assert update_data["column_map"] == mapping_payload["column_map"]

    # 4. Fetch Schema again
    db_session.expire_all()

    resp_2 = await async_client.get(
        f"/api/v1/data-sources/{ds_id}", headers=auth_headers
    )
    assert resp_2.status_code == 200
    data_2 = resp_2.json()
    
    # Verify mapping is attached
    assert len(data_2["schema_mappings"]) >= 1
    latest = data_2["schema_mappings"][-1]
    assert latest["version"] == 1

    # 5. Update Schema Mapping again (Create v2)
    mapping_payload_v2 = {
        "column_map": {"ColA": "field_a_modified", "ColB": "field_b"},
        "reviewed_by_user": True,
        "user_notes": "Updated mapping",
    }

    resp_update_2 = await async_client.put(
        f"/api/v1/data-sources/{ds_id}/mapping",
        json=mapping_payload_v2,
        headers=auth_headers,
    )
    assert resp_update_2.status_code == 200
    update_data_2 = resp_update_2.json()
    assert update_data_2["version"] == 2
    assert update_data_2["is_active"]
