# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest

# Mark all tests in this module as async
pytestmark = pytest.mark.asyncio


async def test_datasource_flow(async_client, auth_headers):
    """
    Integration test for the DataSource lifecycle using app fixtures.
    """
    # 1. Get Factories
    print("LOG: Fetching factories...")
    res = await async_client.get("/api/v1/factories", headers=auth_headers)
    assert res.status_code == 200, f"Get factories failed: {res.text}"

    factories = res.json()
    print(f"LOG: Found {len(factories)} factories")
    assert len(factories) > 0, "No factories found"

    factory_id = factories[0]["id"]
    print(f"LOG: Using factory {factory_id}")

    # 2. Create Data Source
    payload = {
        "name": "Integration Test Source Async",
        "source_name": "Integration Test Source Async",
        "production_line_id": "compat_test_async",
        "description": "Created via async integration test",
    }
    # Create via factory-scoped endpoint
    res = await async_client.post(
        f"/api/v1/factories/{factory_id}/data-sources",
        json=payload,
        headers=auth_headers,
    )
    assert res.status_code == 201, f"Create DS failed: {res.text}"
    ds_id = res.json()["id"]

    # 3. Verify List
    print("LOG: Verifying list...")
    res = await async_client.get(
        f"/api/v1/factories/{factory_id}/data-sources", headers=auth_headers
    )
    assert res.status_code == 200
    items = res.json()
    assert any(i["id"] == ds_id for i in items), "DS not found in list"

    # 4. Get Individual
    res = await async_client.get(
        f"/api/v1/factories/data-sources/{ds_id}", headers=auth_headers
    )
    assert res.status_code == 200
    assert res.json()["id"] == ds_id

    # 5. Cleanup
    print("LOG: Cleaning up...")
    res = await async_client.delete(
        f"/api/v1/factories/data-sources/{ds_id}", headers=auth_headers
    )
    assert res.status_code == 204, f"Cleanup failed: {res.text}"
