# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Analytics Hybrid Coverage Tests
Sweeps the 239 missing lines in endpoints/analytics.py using fast_async_client.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.production import Order, ProductionRun, Style


@pytest.fixture
async def analytics_fallback_data(
    db_session: AsyncSession, test_organization, test_factory, test_line
):
    """Create data for downtime fallback testing."""
    style = Style(factory_id=test_factory.id, style_number="STY-FB-001", base_sam=5.0)
    db_session.add(style)
    await db_session.flush()

    order = Order(
        po_number="PO-FB-001", style_id=style.id, quantity=100, status="sewing"
    )
    db_session.add(order)
    await db_session.flush()

    yesterday = date.today() - timedelta(days=1)
    run = ProductionRun(
        factory_id=test_factory.id,
        production_date=yesterday,
        order_id=order.id,
        data_source_id=test_line.id,
        planned_qty=100,
        actual_qty=50,
        worked_minutes=240,
        operators_present=5,
        downtime_reason="",
        notes="Machine maintenance required",
    )
    db_session.add(run)

    await db_session.commit()
    return {"run": run, "line": test_line}


@pytest.fixture
async def analytics_workforce_data(
    db_session: AsyncSession, test_organization, test_factory, test_line
):
    """Create data for workforce org filtering."""
    test_line.target_operators = 10
    db_session.add(test_line)
    await db_session.commit()
    return {"line": test_line}


@pytest.mark.asyncio
async def test_analytics_workforce_without_line_id_returns_org_aggregate(
    fast_async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers_override,
    test_organization,
    test_factory,
    analytics_workforce_data,
):
    """Test A2: Workforce org filtering (lines 986-1009) - no line_id triggers org-level aggregation."""
    headers = auth_headers_override
    response = await fast_async_client.get(
        "/api/v1/analytics/workforce",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "target" in data
    assert data["target"] == 10


@pytest.mark.asyncio
async def test_analytics_downtime_fallback_uses_keyword_frequency(
    fast_async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers_override,
    test_organization,
    test_factory,
    test_line,
    analytics_fallback_data,
):
    """Test A3: Downtime fallback logic (lines 762-805) - no downtime_reason triggers keyword analysis."""
    headers = auth_headers_override
    response = await fast_async_client.get(
        f"/api/v1/analytics/downtime-reasons?line_id={test_line.id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "reasons" in data
    reasons = data["reasons"]
    assert len(reasons) > 0
    machine_reason = next((r for r in reasons if r["reason"] == "Machine"), None)
    assert machine_reason is not None
    assert machine_reason["count"] >= 1


@pytest.mark.asyncio
async def test_analytics_production_styles_validation_error(
    fast_async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers_override,
    test_factory,
):
    """Test A4: Validation error handling - invalid date format returns 422."""
    headers = auth_headers_override
    response = await fast_async_client.get(
        "/api/v1/analytics/production/styles?date_from=not-a-date&date_to=2025-01-01",
        headers=headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_analytics_date_range_with_explicit_dates(
    fast_async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers_override,
    test_factory,
    test_line,
):
    """Test: Date range logic with explicit dates triggers previous period calculation."""
    headers = auth_headers_override
    today = date.today()
    week_ago = today - timedelta(days=7)
    response = await fast_async_client.get(
        f"/api/v1/analytics/overview?line_id={test_line.id}&date_from={week_ago}&date_to={today}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_output" in data
