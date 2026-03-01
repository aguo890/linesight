# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from datetime import date

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
async def test_delete_204_response(
    async_client: AsyncClient, 
    db_session, 
    auth_headers, 
    test_factory, 
    test_line,
    test_order
):
    """Test that delete actions return 204 with NO body"""
    # 1. Create a Production Run to delete
    # FIX: Correct payload schema
    payload = {
        "factory_id": str(test_factory.id),
        "data_source_id": str(test_line.id),
        "order_id": str(test_order.id),
        "production_date": str(date.today()),
        "shift": "day",
        "actual_qty": 100,
        "planned_qty": 100,
        "operators_present": 5,
        "worked_minutes": 300, # 5 ops * 60 mins
        "sam": 1.5
    }

    create_response = await async_client.post(
        "/api/v1/production/runs",
        json=payload,
        headers=auth_headers,
    )
    
    assert create_response.status_code == 201, f"Setup failed: {create_response.text}"
    run_id = create_response.json()["id"]

    # 2. Delete the run
    delete_response = await async_client.delete(
        f"/api/v1/production/runs/{run_id}", headers=auth_headers
    )

    # 3. Verify 204 status and EMPTY body
    assert delete_response.status_code == 204
    assert delete_response.content == b""  # Verify completely empty body
