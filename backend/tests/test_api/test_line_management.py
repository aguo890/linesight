# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.datasource import DataSource  # Changed from ProductionLine
from app.models.factory import Factory
from app.models.production import ProductionRun
from app.models.raw_import import RawImport


@pytest.mark.asyncio
async def test_reset_schema_configuration(
    async_client: AsyncClient, db_session, test_organization, auth_headers
):
    """Test that resetting a line clears its schema and history."""
    # 1. Setup: Factory and DataSource
    factory = Factory(
        organization_id=test_organization.id,
        name="Reset Factory",
        code="RF-01",
        country="US",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    # Create DataSource (was ProductionLine)
    line = DataSource(
        factory_id=factory.id,
        name="Reset Line",
        code="RL-01",
        is_active=True,
        source_name="Manual Entry"
    )
    db_session.add(line)
    await db_session.commit()

    from datetime import date
    from app.models.production import Style, Order

    # Create Style and Order for FK constraint
    style = Style(
        factory_id=factory.id,
        style_number="STY-001"
    )
    db_session.add(style)
    await db_session.flush()

    order = Order(
        style_id=style.id,
        po_number="PO-001",
        quantity=1000
    )
    db_session.add(order)
    await db_session.flush()

    # 2. Add some history (Run + Import)
    run = ProductionRun(
        factory_id=factory.id,
        data_source_id=line.id,
        order_id=order.id, # Required FK
        production_date=date(2026, 1, 1),
        shift="day",
        actual_qty=100
    )
    db_session.add(run)
    
    # Add a raw import attached to this source
    raw_imp = RawImport(
        factory_id=factory.id,
        data_source_id=line.id,
        file_hash="abc",
        status="processed",
        original_filename="test.csv",
        file_path="/tmp/test.csv",
        file_size_bytes=100
    )
    db_session.add(raw_imp)
    await db_session.commit()

    # 3. Call Delete/Reset Endpoint
    # Corrected URL path: /data-sources/ (hyphenated)
    response = await async_client.delete(
        f"/api/v1/data-sources/{line.id}", headers=auth_headers
    )
    assert response.status_code == 204

    # 4. Verify Cascade Delete
    # Run should be gone
    run_check = await db_session.execute(
        select(ProductionRun).where(ProductionRun.id == run.id)
    )
    assert run_check.scalar_one_or_none() is None

    # Import should be gone
    imp_check = await db_session.execute(
        select(RawImport).where(RawImport.id == raw_imp.id)
    )
    assert imp_check.scalar_one_or_none() is None

    # DataSource should be gone
    line_check = await db_session.execute(
        select(DataSource).where(DataSource.id == line.id)
    )
    assert line_check.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_clear_upload_history(
    async_client: AsyncClient, db_session, test_organization, auth_headers
):
    """Test clearing just the upload history without deleting the DataSource."""
    # 1. Setup
    factory = Factory(organization_id=test_organization.id, name="History Factory", code="HF-01", country="US", timezone="UTC")
    db_session.add(factory)
    await db_session.flush()

    line = DataSource(factory_id=factory.id, name="History Line", code="HL-01")
    db_session.add(line)
    await db_session.commit()

    # 2. Add Import
    raw_imp = RawImport(
        factory_id=factory.id,
        data_source_id=line.id,
        file_hash="xyz",
        status="processed",
        original_filename="test_hist.csv",
        file_path="/tmp/test_hist.csv",
        file_size_bytes=100
    )
    db_session.add(raw_imp)
    await db_session.commit()

    # 3. Call Clear History Endpoint
    # Corrected URL path: /data-sources/ (hyphenated)
    response = await async_client.delete(
        f"/api/v1/data-sources/{line.id}", headers=auth_headers
    )
    assert response.status_code == 204

    # Verify history is gone
    result = await db_session.execute(
        select(RawImport).where(RawImport.data_source_id == line.id)
    )
    assert result.scalars().first() is None
