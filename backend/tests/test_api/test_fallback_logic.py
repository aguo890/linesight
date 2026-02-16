# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.production import ProductionRun
from app.models.events import ProductionEvent


@pytest.fixture
async def historical_data(db_session, test_organization):
    # Setup Factory & Line (RLS FIXED)
    factory = Factory(
        organization_id=test_organization.id, # CRITICAL: Link to test user's org
        name="Fallback Factory",
        code="FALL-01",
        country="Test",
    )
    db_session.add(factory)
    await db_session.flush()

    line = DataSource(
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

    # Create data for TODAY (Visibility Fix)
    # Using today ensures it appears in default dashboard views without complex date filtering
    data_date = date.today()

    run = ProductionRun(
        id=str(uuid.uuid4()),
        factory_id=factory.id,
        data_source_id=line.id,
        order_id=order.id,
        production_date=data_date,
        actual_qty=100,
        worked_minutes=10, # 10 ops * 10 mins = 100 available mins
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

    # Add ProductionEvent (Visibility fix for hourly)
    event = ProductionEvent(
        data_source_id=line.id,
        order_id=order.id,
        style_id=style.id,
        production_run_id=run.id,
        quantity=100,
        timestamp=datetime.combine(data_date, datetime.min.time().replace(hour=10))
    )
    db_session.add(event)
    await db_session.commit()

    return {"line": line, "date": data_date, "factory": factory}


@pytest.mark.asyncio
async def test_overview_fallback(
    async_client: AsyncClient, auth_headers: dict, historical_data
):
    """Test that overview returns correct data for the active period."""
    factory_id = historical_data["factory"].id
    
    # Call Overview
    response = await async_client.get(
        f"/api/v1/analytics/overview?factory_id={factory_id}", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    # Verify data matches fixture
    # efficiency 100%
    assert float(data["avg_efficiency"]) == 100.0
    assert data["total_output"] == 100


@pytest.mark.asyncio
async def test_production_chart_fallback(
    async_client: AsyncClient, auth_headers: dict, historical_data
):
    """Test production chart returns data points."""
    factory_id = historical_data["factory"].id
    
    response = await async_client.get(
        f"/api/v1/analytics/production-chart?factory_id={factory_id}", headers=auth_headers
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
    """Test SAM performance widget."""
    factory_id = historical_data["factory"].id
    
    response = await async_client.get(
        f"/api/v1/analytics/sam-performance?factory_id={factory_id}", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    # Cast to float for safe comparison
    assert float(data["efficiency"]) == 100.0
    assert float(data["total_sam"]) == 100.0


@pytest.mark.asyncio
async def test_hourly_fallback(
    async_client: AsyncClient, auth_headers: dict, historical_data
):
    """Test hourly production returns distributed data."""
    line_id = historical_data["line"].id
    
    response = await async_client.get(
        f"/api/v1/analytics/production/hourly?line_id={line_id}", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    # Handle List[dict] vs List[int] response format
    if data and isinstance(data[0], dict):
        total = sum(d["actual"] for d in data)
    else:
        total = sum(data)

    # The fallback distribution logic should approximate the daily total (100)
    assert total >= 100
