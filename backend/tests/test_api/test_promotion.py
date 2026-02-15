# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.production import Order, ProductionRun, Style
from app.models.raw_import import RawImport


@pytest.mark.asyncio
async def test_promotion_logic_full_cycle(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """
    Test the full data promotion flow:
    1. Setup Line
    2. Upload CSV with 'style_number', 'po_number', 'actual_qty', 'efficiency_pct'
    3. Confirm Mapping
    4. Promote to Production
    5. Verify Style/Order auto-creation and ProductionRun linkage
    """

    # 1. Setup hierarchy
    result = await db_session.execute(
        select(Factory).where(Factory.organization_id == test_organization.id)
    )
    factory = result.scalar_one_or_none()

    if not factory:
        factory = Factory(
            organization_id=test_organization.id,
            name="Promotion Test Factory",
            code="PTF-01",
            country="USA",
            timezone="UTC",
        )
        db_session.add(factory)
        await db_session.flush()

    line = DataSource(
        factory_id=factory.id, name="Promotion Line A", code="PLA-01", is_active=True
    )
    db_session.add(line)
    await db_session.commit()

    line_id = line.id
    factory_id = factory.id

    # 2. Upload File (CSV)
    # Note: 'Eff' contains '%' to test cleaning logic
    csv_data = "Item_No,Order_No,Output,Eff\nSTYLE-XYZ,PO-ABC,500,85%\nSTYLE-XYZ,PO-ABC,250,0.90"
    files = {"file": ("test_promo.csv", csv_data, "text/csv")}

    upload_resp = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
        files=files,
        headers=auth_headers,
    )
    assert upload_resp.status_code == 200
    raw_import_id = upload_resp.json()["raw_import_id"]

    # 3. Confirm Mapping
    # We must provide time_column (even if not in CSV for this test, we'll map it to one to satisfy validator)
    confirm_payload = {
        "raw_import_id": raw_import_id,
        "production_line_id": line_id,
        "factory_id": factory_id,
        "time_column": "Item_No",  # Dummy time column for now
        "mappings": [
            {"source_column": "Item_No", "target_field": "style_number"},
            {"source_column": "Order_No", "target_field": "po_number"},
            {"source_column": "Output", "target_field": "actual_qty"},
            {"source_column": "Eff", "target_field": "efficiency_pct"},
        ],
    }

    confirm_resp = await async_client.post(
        "/api/v1/ingestion/confirm-mapping", json=confirm_payload, headers=auth_headers
    )
    assert confirm_resp.status_code == 200

    # 4. Promote to Production
    promote_resp = await async_client.post(
        f"/api/v1/ingestion/promote/{raw_import_id}", headers=auth_headers
    )
    assert promote_resp.status_code == 200
    promo_data = promote_resp.json()
    assert promo_data["success_count"] == 2
    assert promo_data["error_count"] == 0

    # 5. Verify Database Records
    # A. Check Style creation
    db_session.expire_all()

    style_result = await db_session.execute(
        select(Style).where(
            Style.style_number == "STYLE-XYZ", Style.factory_id == factory_id
        )
    )
    style = style_result.scalar_one_or_none()
    assert style is not None

    # B. Check Order creation
    order_result = await db_session.execute(
        select(Order).where(Order.po_number == "PO-ABC", Order.style_id == style.id)
    )
    order = order_result.scalar_one_or_none()
    assert order is not None

    # C. Check ProductionRun creation
    run_result = await db_session.execute(
        select(ProductionRun).where(
            ProductionRun.order_id == order.id, ProductionRun.line_id == line_id
        )
    )
    runs = run_result.scalars().all()
    assert len(runs) == 2

    # Check if quantities match (500 and 250)
    qtys = sorted([r.actual_qty for r in runs])
    assert qtys == [250, 500]

    # Verify RawImport status updated
    db_session.expire_all()
    raw_import_result = await db_session.execute(
        select(RawImport).where(RawImport.id == raw_import_id)
    )
    raw_import = raw_import_result.scalar_one()
    assert raw_import.status == "promoted"
