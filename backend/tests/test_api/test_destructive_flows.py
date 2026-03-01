# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.production import ProductionRun

@pytest.mark.asyncio
async def test_delete_datasource_cascade(
    async_client: AsyncClient, db_session, test_organization, test_user, auth_headers
):
    """Test that deleting a datasource removes child records (runs)."""
    # 1. Setup: Factory MUST belong to the test user's organization for RLS
    factory = Factory(
        organization_id=test_organization.id, # CRITICAL FIX
        name="Cascade Factory",
        code="CF-01",
        country="US",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    # 2. Setup: DataSource
    ds = DataSource(
        factory_id=factory.id,
        name="Cascade Line",
        is_active=True
    )
    db_session.add(ds)
    await db_session.commit()

    from datetime import date
    from app.models.production import Style, Order

    # Create Style and Order for FK constraint
    style = Style(factory_id=factory.id, style_number="STY-CASC")
    db_session.add(style)
    await db_session.flush()

    order = Order(
        style_id=style.id,
        po_number="PO-CASC",
        quantity=1000
    )
    db_session.add(order)
    await db_session.flush()

    # 3. Setup: Child Data (Production Run)
    run = ProductionRun(
        factory_id=factory.id,
        data_source_id=ds.id,
        order_id=order.id, # Required FK
        production_date=date(2026, 2, 1),
        actual_qty=100
    )
    db_session.add(run)
    await db_session.commit()

    # 4. Execute Delete
    response = await async_client.delete(
        f"/api/v1/data-sources/{ds.id}", # FIX: correct URL
        headers=auth_headers
    )
    assert response.status_code == 204

    # 5. Verify Cleanup
    # Datasource gone
    ds_check = await db_session.execute(select(DataSource).where(DataSource.id == ds.id))
    assert ds_check.scalar_one_or_none() is None
    # Run gone (via manual cascade in endpoint)
    run_check = await db_session.execute(select(ProductionRun).where(ProductionRun.id == run.id))
    assert run_check.scalar_one_or_none() is None

@pytest.mark.asyncio
async def test_permissions_restricted_delete(
    async_client: AsyncClient, db_session, test_organization
):
    """Test that a viewer cannot delete a datasource."""
    from app.core.security import create_access_token
    from app.models.user import User, UserRole

    # 1. Setup: Viewer User
    viewer = User(
        organization_id=test_organization.id,
        email="viewer@example.com",
        hashed_password="hashed",
        role=UserRole.VIEWER,
        is_active=True
    )
    db_session.add(viewer)
    
    # Setup Factory/DS (must belong to same org for viewer to even see it, though delete is forbidden)
    factory = Factory(organization_id=test_organization.id, name="View Factory", code="VF-01", country="US", timezone="UTC")
    db_session.add(factory)
    await db_session.flush()
    ds = DataSource(factory_id=factory.id, name="View Line")
    db_session.add(ds)
    await db_session.commit()

    # 2. Attempt Delete with Viewer Token
    token = create_access_token(subject=viewer.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await async_client.delete(
        f"/api/v1/data-sources/{ds.id}", # FIX: correct URL
        headers=headers
    )
    assert response.status_code == 403
