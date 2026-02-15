# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import DataSource
from app.models.factory import Factory, ProductionLine


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

    # 1. Setup
    factory = Factory(
        organization_id=test_organization.id,
        name="Schema Test Factory",
        code="STF-001",
        country="Test Country",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    line = ProductionLine(
        factory_id=factory.id, name="Schema Line 1", code="SL-01", is_active=True
    )
    db_session.add(line)
    await db_session.flush()

    # Create valid DataSource
    # (In real app, created via ingestion confirmation, but we can create directly or use endpoint)
    ds = DataSource(
        production_line_id=line.id, source_name="Schema Test Source", is_active=True
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    # Cache IDs for API calls
    line_id = line.id
    ds_id = ds.id

    # 2. Fetch Schema by Line
    resp = await async_client.get(
        f"/api/v1/datasources/line/{line_id}", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == ds_id
    assert len(data["schema_mappings"]) == 0

    # 3. Update Schema Mapping (Create v1)
    mapping_payload = {
        "column_map": {"ColA": "field_a", "ColB": "field_b"},
        "reviewed_by_user": True,
        "user_notes": "Initial mapping",
    }

    resp_update = await async_client.put(
        f"/api/v1/datasources/{ds_id}/mapping",
        json=mapping_payload,
        headers=auth_headers,
    )
    assert resp_update.status_code == 200
    update_data = resp_update.json()
    assert update_data["version"] == 1
    assert update_data["is_active"]
    assert update_data["column_map"] == mapping_payload["column_map"]

    # 4. Fetch Schema again
    # Manually expire session to simulate new request (since test client shares session)
    db_session.expire_all()

    resp_2 = await async_client.get(
        f"/api/v1/datasources/line/{line_id}", headers=auth_headers
    )
    assert resp_2.status_code == 200
    data_2 = resp_2.json()
    assert len(data_2["schema_mappings"]) == 1
    assert data_2["schema_mappings"][0]["version"] == 1

    # 5. Update Schema Mapping again (Create v2)
    mapping_payload_v2 = {
        "column_map": {"ColA": "field_a_modified", "ColB": "field_b"},
        "reviewed_by_user": True,
        "user_notes": "Updated mapping",
    }

    resp_update_2 = await async_client.put(
        f"/api/v1/datasources/{ds_id}/mapping",
        json=mapping_payload_v2,
        headers=auth_headers,
    )
    assert resp_update_2.status_code == 200
    update_data_2 = resp_update_2.json()
    assert update_data_2["version"] == 2
    assert update_data_2["is_active"]

    # Verify v1 is inactive and v2 is active
    db_session.expire_all()
    resp_3 = await async_client.get(
        f"/api/v1/datasources/line/{line_id}", headers=auth_headers
    )
    assert resp_3.status_code == 200
    data_3 = resp_3.json()
    mappings = data_3["schema_mappings"]
    assert len(mappings) == 2

    v1 = next(m for m in mappings if m["version"] == 1)
    v2 = next(m for m in mappings if m["version"] == 2)

    assert not v1["is_active"]
    assert v2["is_active"]
