# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_404_json_response(async_client: AsyncClient):
    """Test that 404 errors return valid JSON"""
    response = await async_client.get("/api/v1/non-existent-endpoint")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/json"
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_validation_error_json_response(async_client: AsyncClient, auth_headers):
    """Test that validation errors return valid JSON"""
    # Missing required fields
    response = await async_client.post(
        "/api/v1/factories", json={}, headers=auth_headers
    )
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/json"
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_upload_bad_file_json_response(async_client: AsyncClient, auth_headers):
    """Test that upload errors return valid JSON"""
    # Upload endpoint requires production_line_id
    response = await async_client.post(
        "/api/v1/ingestion/upload",
        files={"file": ("test.txt", b"content", "text/plain")},
        headers=auth_headers,
    )
    # Should fail validation (query param missing) or 400
    assert response.headers["content-type"] == "application/json"
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_delete_204_response(async_client: AsyncClient, auth_headers):
    """Test that delete actions return 204 with NO body"""
    # 1. Create a factory
    create_response = await async_client.post(
        "/api/v1/factories",
        json={
            "name": "Temp Factory for Delete Test",
            "country": "US",
            "timezone": "UTC",
        },
        headers=auth_headers,
    )
    if create_response.status_code == 403:  # Handle quota
        pytest.skip("Quota limit reached, cannot test delete")
    assert create_response.status_code == 201
    factory_id = create_response.json()["id"]

    # 2. Delete the factory
    delete_response = await async_client.delete(
        f"/api/v1/factories/{factory_id}", headers=auth_headers
    )

    # 3. Verify 204 status and EMPTY body
    assert delete_response.status_code == 204
    assert delete_response.content == b""  # Verify completely empty body

    # Verify .json() usage raises error for 204 if httpx follows typical behavior
    # httpx doesn't throw on .json() but Python's json.loads("") raises error
    # We want to confirm there is NO JSON to parse.
    import json

    with pytest.raises(json.JSONDecodeError):  # usually json.decoder.JSONDecodeError
        delete_response.json()
