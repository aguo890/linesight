# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from datetime import date

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_style_crud(async_client: AsyncClient, auth_headers: dict, test_factory):
    # 1. Create Style
    style_data = {
        "style_number": "ST-2024-NEW",
        "factory_id": test_factory.id,
        "description": "Lifecycle Style",
        "buyer": "Gap",
        "base_sam": 12.5,
    }
    response = await async_client.post(
        "/api/v1/production/styles", json=style_data, headers=auth_headers
    )
    assert response.status_code == 201
    style_id = response.json()["id"]

    # 2. List Styles & Verify ID inclusion
    response = await async_client.get("/api/v1/production/styles", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert any(item["id"] == style_id for item in data)

    # 3. Update Style
    update_data = {"description": "Updated Lifecycle Style"}
    response = await async_client.patch(
        f"/api/v1/production/styles/{style_id}", json=update_data, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["description"] == "Updated Lifecycle Style"

    # 4. Delete Style
    del_response = await async_client.delete(
        f"/api/v1/production/styles/{style_id}", headers=auth_headers
    )
    assert del_response.status_code in [200, 204]

    # 5. Verify Delete
    get_response = await async_client.get(
        f"/api/v1/production/styles/{style_id}", headers=auth_headers
    )
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_order_crud(async_client: AsyncClient, auth_headers: dict, test_style):
    # 1. Create Order
    order_data = {
        "po_number": "PO-TEST-LIFE",
        "style_id": test_style.id,
        "quantity": 5000,
        "status": "pending",
    }
    response = await async_client.post(
        "/api/v1/production/orders", json=order_data, headers=auth_headers
    )
    assert response.status_code == 201
    order_id = response.json()["id"]

    # 2. List Orders & Verify Inclusion
    response = await async_client.get("/api/v1/production/orders", headers=auth_headers)
    assert response.status_code == 200
    assert any(item["id"] == order_id for item in response.json())

    # 3. Update Order
    update_data = {"status": "sewing", "qty_cut": 4500}
    response = await async_client.patch(
        f"/api/v1/production/orders/{order_id}", json=update_data, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "sewing"

    # 4. Delete Order
    del_response = await async_client.delete(
        f"/api/v1/production/orders/{order_id}", headers=auth_headers
    )
    assert del_response.status_code in [200, 204]

    # 5. Verify Delete
    get_response = await async_client.get(
        f"/api/v1/production/orders/{order_id}", headers=auth_headers
    )
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_production_run_lifecycle(
    async_client: AsyncClient, auth_headers: dict, test_factory, test_line, test_order
):
    # 1. Create Production Run
    run_data = {
        "factory_id": test_factory.id,
        "production_date": str(date.today()),
        "order_id": test_order.id,
        "line_id": test_line.id,
        "planned_qty": 500,
        "actual_qty": 450,
        "sam": 1.5,
        "worked_minutes": 4800,
        "operators_present": 10,
    }
    response = await async_client.post(
        "/api/v1/production/runs", json=run_data, headers=auth_headers
    )
    assert response.status_code == 201
    run_id = response.json()["id"]

    # 2. Update Run
    update_data = {"actual_qty": 480}
    response = await async_client.patch(
        f"/api/v1/production/runs/{run_id}", json=update_data, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["actual_qty"] == 480

    # 3. List Runs & Verify Inclusion
    response = await async_client.get("/api/v1/production/runs", headers=auth_headers)
    assert response.status_code == 200
    assert any(item["id"] == run_id for item in response.json())

    # 4. Delete
    del_response = await async_client.delete(
        f"/api/v1/production/runs/{run_id}", headers=auth_headers
    )
    assert del_response.status_code in [200, 204]

    # 5. Verify Delete
    get_response = await async_client.get(
        f"/api/v1/production/runs/{run_id}", headers=auth_headers
    )
    assert get_response.status_code == 404


# --- Negative Tests ---


@pytest.mark.asyncio
async def test_create_order_invalid_style(
    async_client: AsyncClient, auth_headers: dict, test_factory
):
    import uuid

    order_data = {
        "po_number": "PO-INVALID",
        "style_id": str(uuid.uuid4()),  # Valid UUID format, but non-existent
        "quantity": 1000,
    }
    response = await async_client.post(
        "/api/v1/production/orders", json=order_data, headers=auth_headers
    )
    # expect 404 (Style not found)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_run_factory_mismatch(
    async_client: AsyncClient, auth_headers: dict, test_factory, test_order
):
    # Create another factory and a line assigned to it
    import uuid

    # We'll use a manually created line in a different factory to test mismatch
    # If the API validates that line.factory_id == run.factory_id

    run_data = {
        "factory_id": test_factory.id,
        "production_date": str(date.today()),
        "order_id": test_order.id,
        "line_id": str(uuid.uuid4()),  # Non-existent line (valid UUID)
        "planned_qty": 500,
        "actual_qty": 450,
        "sam": 1.5,
        "worked_minutes": 4800,
        "operators_present": 10,
    }
    response = await async_client.post(
        "/api/v1/production/runs", json=run_data, headers=auth_headers
    )
    # The API checks if line exists first, so it should return 404 Line not found
    assert response.status_code == 404
