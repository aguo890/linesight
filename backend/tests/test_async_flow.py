# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

# Mark all tests as async
pytestmark = pytest.mark.asyncio


async def test_datasource_lifecycle(fast_async_client: AsyncClient, test_factory):
    """
    Test datasource lifecycle using PostgreSQL transactional fixtures.
    Uses fast_async_client with auth bypass for speed and reliability.
    """
    # 1. Create Data Source (auth already handled by fixture)
    payload = {
        "name": f"Async Integration Test {test_factory.id[:4]}",
        "factory_id": test_factory.id,
        "source_name": "Async Integration Test",
        "is_active": True,
    }

    res = await fast_async_client.post(
        f"/api/v1/factories/{test_factory.id}/data-sources", json=payload
    )

    if res.status_code == 403 and "quota_exceeded" in res.text:
        pytest.skip("Factory quota exceeded - test environment limitation")

    assert res.status_code in [200, 201], f"Creation failed: {res.text}"
    created_ds_id = res.json()["id"]

    # 2. Verify List
    res = await fast_async_client.get(
        f"/api/v1/factories/{test_factory.id}/data-sources"
    )
    assert res.status_code == 200
    items = res.json()

    found_ids = [item["id"] for item in items]
    assert created_ds_id in found_ids, (
        f"New ID {created_ds_id} not found in {found_ids}"
    )

    # 3. Cleanup
    res = await fast_async_client.delete(f"/api/v1/data-sources/{created_ds_id}")
    assert res.status_code in [200, 204], f"Delete failed: {res.text}"
