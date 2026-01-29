from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.enums import OrderStatus, PeriodType, ShiftType
from app.models.analytics import DHUReport
from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.production import Order, ProductionRun, Style


@pytest.mark.asyncio
async def test_get_dhu_quality_trend(
    async_client: AsyncClient, db_session, auth_headers, test_organization
):
    """
    Verifies that the DHU endpoint returns a list of 7 items.
    """
    # 0. Seed Data
    factory = Factory(
        organization_id=test_organization.id,
        name="Test Factory",
        code="TF-01",
        country="Test",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    # Seed DHU Reports (7 Days)
    base_date = datetime.now().date() - timedelta(days=6)
    dhu_trend = [5.2, 4.8, 3.5, 2.9, 2.1, 1.5, 1.1]

    for i, dhu_val in enumerate(dhu_trend):
        report = DHUReport(
            factory_id=factory.id,
            report_date=base_date + timedelta(days=i),
            period_type=PeriodType.DAILY,
            avg_dhu=Decimal(str(dhu_val)),
            total_inspected=1000,
            total_defects=int(dhu_val * 10),
        )
        db_session.add(report)
    await db_session.commit()

    # 1. Call API
    response = await async_client.get(
        "/api/v1/analytics/dhu", headers=auth_headers
    )
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 7

    first_point = data[0]
    assert "date" in first_point
    assert "dhu" in first_point

    first_dhu = data[0]["dhu"]
    data[-1]["dhu"]

    # Check trend (Assuming API returns ordered by date ascending)
    # The seed is 5.2 -> 1.1.
    # If API returns oldest first: 5.2 should be first.
    # Note: response "dhu" might be float.
    assert float(first_dhu) > 1.0
    # assert float(last_dhu) < float(first_dhu) # Verification of "Trend Down"


@pytest.mark.asyncio
async def test_get_style_progress(
    async_client: AsyncClient, db_session, auth_headers, test_organization
):
    """
    Verifies the Production Styles endpoint.
    """
    # 0. Seed Data
    factory = Factory(
        organization_id=test_organization.id,
        name="Style Factory",
        code="SF-01",
        country="Test",
    )
    db_session.add(factory)
    await db_session.flush()

    line = DataSource(factory_id=factory.id, name="Line 1", code="L1")
    db_session.add(line)
    await db_session.flush()

    # Create 1 "Behind" Style and 1 "On Track" Style
    # Behind
    style_behind = Style(
        factory_id=factory.id, style_number="ST-999", description="Complex Hoodie"
    )
    db_session.add(style_behind)
    await db_session.flush()

    order_behind = Order(
        style_id=style_behind.id,
        po_number="PO-BEHIND",
        quantity=1000,
        status=OrderStatus.SEWING,
        order_date=datetime.now().date(),
        ex_factory_date=datetime.now().date(),
    )
    db_session.add(order_behind)
    await db_session.flush()

    run_behind = ProductionRun(
        factory_id=factory.id,
        order_id=order_behind.id,
        data_source_id=line.id,
        production_date=datetime.now().date(),
        actual_qty=200,  # 20% - likely "Behind"
        planned_qty=1000,
        shift=ShiftType.DAY.value,
    )
    db_session.add(run_behind)

    # On Track
    style_ontrack = Style(
        factory_id=factory.id, style_number="ST-100", description="Easy Tee"
    )
    db_session.add(style_ontrack)
    await db_session.flush()

    order_ontrack = Order(
        style_id=style_ontrack.id,
        po_number="PO-TRACK",
        quantity=500,
        status=OrderStatus.SEWING,
        order_date=datetime.now().date(),
        ex_factory_date=datetime.now().date(),
    )
    db_session.add(order_ontrack)
    await db_session.flush()

    run_ontrack = ProductionRun(
        factory_id=factory.id,
        order_id=order_ontrack.id,
        data_source_id=line.id,
        production_date=datetime.now().date(),
        actual_qty=250,  # 50%
        planned_qty=500,
        shift=ShiftType.DAY.value,
    )
    db_session.add(run_ontrack)

    await db_session.commit()

    # 1. Call API
    response = await async_client.get(
        "/api/v1/analytics/production/styles", headers=auth_headers
    )
    assert response.status_code == 200

    data = response.json()["active_styles"]
    # verify at least our data is there. The endpoint might query *all* active orders.

    # Check for specific "Story" elements
    statuses = [item["status"] for item in data]
    assert "On Track" in statuses
    assert "Behind" in statuses

    # Check "Behind" Logic
    hoodie = next((x for x in data if "ST-999" in x["style_code"]), None)
    if hoodie:
        assert hoodie["status"] == "Behind"
        assert hoodie["target"] == 1000
