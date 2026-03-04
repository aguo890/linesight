# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
API CRUD Sweep Tests
Sweeps the missing lines across dashboards, factories, and datasource endpoints.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.parametrize(
    "endpoint",
    [
        "/api/v1/dashboards/",
        "/api/v1/factories",
        "/api/v1/data-sources",
    ],
)
@pytest.mark.asyncio
async def test_crud_read_routes_return_200(
    fast_async_client: AsyncClient, auth_headers_override, endpoint
):
    """Test 1: Standard GET routes return 200 OK."""
    headers = auth_headers_override
    response = await fast_async_client.get(endpoint, headers=headers)
    assert response.status_code == 200


@pytest.mark.parametrize(
    "endpoint,uuid",
    [
        ("/api/v1/factories", "00000000-0000-0000-0000-000000000000"),
        ("/api/v1/data-sources", "00000000-0000-0000-0000-000000000000"),
    ],
)
@pytest.mark.asyncio
async def test_crud_get_by_id_returns_404(
    fast_async_client: AsyncClient, auth_headers_override, endpoint, uuid
):
    """Test 2: GET by ID with fake UUID returns 404 Not Found."""
    headers = auth_headers_override
    response = await fast_async_client.get(f"{endpoint}/{uuid}", headers=headers)
    assert response.status_code == 404


@pytest.mark.parametrize(
    "endpoint",
    [
        "/api/v1/factories",
        "/api/v1/data-sources",
    ],
)
@pytest.mark.asyncio
async def test_crud_post_empty_payload_returns_422(
    fast_async_client: AsyncClient, auth_headers_override, endpoint
):
    """Test 3: POST with empty JSON payload returns 422 Unprocessable Entity."""
    headers = auth_headers_override
    response = await fast_async_client.post(endpoint, headers=headers, json={})
    assert response.status_code == 422
