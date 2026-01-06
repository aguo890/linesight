import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.models.factory import Factory, ProductionLine
from app.models.production import ProductionRun


@pytest.fixture
async def historical_data(db_session, test_organization):
    # Setup Factory & Line
    factory = Factory(
        organization_id=test_organization.id,
        name="Fallback Factory",
        code="FALL-01",
        country="Test",
    )
    db_session.add(factory)
    await db_session.flush()

    line = ProductionLine(
        factory_id=factory.id,
        name="Fallback Line",
        code="FL-1",
        target_operators=10,
        is_active=True,
    )
    db_session.add(line)
    await db_session.flush()

    # Create Style & Order
    from app.models.production import Order, Style

    style = Style(
        id=str(uuid.uuid4()),
        factory_id=factory.id,
        style_number="ST-FALLBACK",
        base_sam=Decimal("1.0"),
    )
    db_session.add(style)
    await db_session.flush()

    order = Order(
        id=str(uuid.uuid4()), style_id=style.id, po_number="PO-FALLBACK", quantity=1000
    )
    db_session.add(order)
    await db_session.flush()

    # Create data for 5 days ago (Historical)
    past_date = date.today() - timedelta(days=5)

    run = ProductionRun(
        id=str(uuid.uuid4()),
        factory_id=factory.id,
        line_id=line.id,
        order_id=order.id,
        production_date=past_date,
        actual_qty=100,
        worked_minutes=100,
        sam=Decimal("1.0"),
        operators_present=10,
    )
    db_session.add(run)

    # Create metric for it
    from app.models.analytics import EfficiencyMetric

    metric = EfficiencyMetric(
        id=str(uuid.uuid4()),
        production_run_id=run.id,
        efficiency_pct=Decimal("100.0"),
        sam_target=Decimal("100"),
        sam_actual=Decimal("100"),
        calculated_at=datetime.utcnow(),
    )
    db_session.add(metric)
    await db_session.commit()

    return {"line": line, "date": past_date}


@pytest.mark.asyncio
async def test_overview_fallback(
    async_client: AsyncClient, auth_headers: dict, historical_data
):
    # 1. Ensure no data for today (implicitly true in clean DB logic or just by chance)
    # The fixture only created data for 5 days ago.

    # 2. Call Overview
    # Should fallback to 5 days ago
    response = await async_client.get(
        "/api/v1/analytics/overview", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    # Verify fallback kicked in
    # Data is from 5 days ago => efficiency 100%
    assert float(data["avg_efficiency"]) == 100.0
    assert data["total_output"] == 100

    # Verify last_updated string contains the date
    past_str = historical_data["date"].strftime("%Y-%m-%d")
    assert past_str in data["last_updated"]
    print(f"\nLast Updated Text: {data['last_updated']}")


@pytest.mark.asyncio
async def test_production_chart_fallback(
    async_client: AsyncClient, auth_headers: dict, historical_data
):
    # Should show data point for our historical date
    response = await async_client.get(
        "/api/v1/analytics/production-chart", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    points = data["data_points"]

    # We expect one point to have actual > 0
    valid_points = [p for p in points if p["actual"] > 0]
    assert len(valid_points) > 0
    assert valid_points[0]["actual"] == 100


@pytest.mark.asyncio
async def test_sam_performance_fallback(
    async_client: AsyncClient, auth_headers: dict, historical_data
):
    # Should show efficiency 100%
    response = await async_client.get(
        "/api/v1/analytics/sam-performance", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    assert float(data["efficiency"]) == 100.0
    assert data["total_sam"] == 100


@pytest.mark.asyncio
async def test_hourly_fallback(
    async_client: AsyncClient, auth_headers: dict, historical_data
):
    # Should fallback to distributed daily totals (since no granular ProductionOutput in fixture)
    # Total 500.
    response = await async_client.get(
        "/api/v1/analytics/hourly-production", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    total = sum(data)
    print(f"\nDEBUG: Hourly Data: {data}")
    print(f"DEBUG: Total Sum: {total}")
    # The dist logic approximates roughly to total. integer math might lose a bit or gain a bit but close
    assert 90 <= total <= 110
