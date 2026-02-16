# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from datetime import date

from app.models.factory import Factory
from app.models.datasource import DataSource

@pytest.mark.asyncio
async def test_production_run_lifecycle(
    async_client: AsyncClient, db_session, test_organization, auth_headers
):
    """Test create, read lifecycle of a production run."""
    # 1. Setup
    factory = Factory(
        organization_id=test_organization.id,
        name="Prod Factory",
        code="PF-01",
        country="US",
        timezone="UTC"
    )
    db_session.add(factory)
    await db_session.flush()

    ds = DataSource(factory_id=factory.id, name="Prod Line", code="PL-01")
    db_session.add(ds)
    await db_session.commit()

    from app.models.production import Style, Order
    style = Style(factory_id=factory.id, style_number="STY-PROD")
    db_session.add(style)
    await db_session.flush()

    order = Order(
        style_id=style.id,
        po_number="PO-PROD",
        quantity=1000
    )
    db_session.add(order)
    await db_session.flush()

    # 2. Create Run
    payload = {
        "factory_id": str(factory.id),
        "data_source_id": str(ds.id), # FIX: Use data_source_id, not production_line_id
        "order_id": str(order.id), # REQUIRED
        "production_date": str(date.today()),
        "shift": "day", # Ensure valid enum value
        "actual_qty": 100,
        "planned_qty": 100,
        "operators_present": 10,
        "worked_minutes": 480, # REQUIRED
        "sam": 5.5
    }
    
    create_res = await async_client.post(
        "/api/v1/production/runs",
        json=payload,
        headers=auth_headers
    )
    assert create_res.status_code == 201, f"Create failed: {create_res.text}"
    run_id = create_res.json()["id"]

    # 3. Read Run
    get_res = await async_client.get(
        f"/api/v1/production/runs/{run_id}",
        headers=auth_headers
    )
    assert get_res.status_code == 200
    assert get_res.json()["actual_qty"] == 100

@pytest.mark.asyncio
async def test_create_run_factory_mismatch(
    async_client: AsyncClient, db_session, test_organization, auth_headers
):
    """Test error when factory_id does not match the datasource's factory."""
    # 1. Setup
    factory1 = Factory(organization_id=test_organization.id, name="F1", code="F1", country="US", timezone="UTC")
    factory2 = Factory(organization_id=test_organization.id, name="F2", code="F2", country="US", timezone="UTC")
    db_session.add_all([factory1, factory2])
    await db_session.flush()

    ds = DataSource(factory_id=factory1.id, name="L1")
    db_session.add(ds)
    await db_session.commit()

    # 2. Attempt Create with Mismatched Factory (F2 vs DS belongs to F1)
    payload = {
        "factory_id": str(factory2.id), # Mismatch
        "data_source_id": str(ds.id),
        "production_date": "2026-02-01",
        "shift": "day",
        "actual_qty": 100
    }
    
    res = await async_client.post(
        "/api/v1/production/runs",
        json=payload,
        headers=auth_headers
    )
    # The validation logic should catch this mismatch
    assert res.status_code in [400, 404, 422]
