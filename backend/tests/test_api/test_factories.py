# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_factory(async_client: AsyncClient, auth_headers: dict):
    payload = {
        "name": "Test Factory",
        "code": "TF01",
        "location": "New York",
        "country": "USA",
        "timezone": "EST",
    }
    response = await async_client.post(
        "/api/v1/factories", json=payload, headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Factory"
    assert data["city"] == "New York"
    return data["id"]


@pytest.mark.asyncio
async def test_list_factories(async_client: AsyncClient, auth_headers: dict):
    # Ensure at least one factory exists
    await async_client.post(
        "/api/v1/factories",
        json={"name": "List Test Factory", "code": "LTF01", "country": "USA"},
        headers=auth_headers,
    )

    response = await async_client.get("/api/v1/factories", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_production_line_crud(async_client: AsyncClient, auth_headers: dict):
    # 1. Create factory
    factory_res = await async_client.post(
        "/api/v1/factories",
        json={"name": "Line Factory", "code": "LF01", "country": "USA"},
        headers=auth_headers,
    )
    assert factory_res.status_code == 201
    factory_id = factory_res.json()["id"]

    # 2. Create Line
    line_payload = {
        "name": "Line 1",
        "code": "L1",
        "specialty": "Wovens",
        "target_operators": 20,
        "target_efficiency_pct": 85,
    }
    line_res = await async_client.post(
        f"/api/v1/factories/{factory_id}/lines", json=line_payload, headers=auth_headers
    )
    assert line_res.status_code == 201, line_res.text
    line_id = line_res.json()["id"]
    assert line_res.json()["specialty"] == "Wovens"

    # 3. Get Line
    get_res = await async_client.get(
        f"/api/v1/factories/lines/{line_id}", headers=auth_headers
    )
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Line 1"

    # 4. Update Line
    patch_res = await async_client.patch(
        f"/api/v1/factories/lines/{line_id}",
        json={"name": "Updated Line 1"},
        headers=auth_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Updated Line 1"

    # 5. List Lines for Factory
    list_res = await async_client.get(
        f"/api/v1/factories/{factory_id}/lines", headers=auth_headers
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 6. Delete Line
    del_res = await async_client.delete(
        f"/api/v1/factories/lines/{line_id}", headers=auth_headers
    )
    assert del_res.status_code == 204

    # Verify soft delete behavior (is_active should be False)
    # Re-fetch line
    check_res = await async_client.get(
        f"/api/v1/factories/lines/{line_id}", headers=auth_headers
    )
    assert check_res.status_code == 200
    assert check_res.json()["is_active"] is False

    # Verify list does NOT return deleted line
    list_check = await async_client.get(
        f"/api/v1/factories/{factory_id}/lines", headers=auth_headers
    )
    assert len(list_check.json()) == 0
