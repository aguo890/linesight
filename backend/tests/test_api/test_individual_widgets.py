from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import DHUReport, EfficiencyMetric
from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.production import Order, ProductionRun, Style
from app.models.workforce import ProductionOutput


@pytest.fixture
async def widget_data(db_session: AsyncSession, test_organization):
    # 1. Setup Factory & Line
    factory = Factory(
        organization_id=test_organization.id,
        name="Widget Test Factory",
        code="WTF-001",
        country="Test Country",
    )
    db_session.add(factory)
    await db_session.flush()

    line = DataSource(
        factory_id=factory.id,
        name="Widget Line A",
        code="WL-A",
        target_operators=15,
        is_active=True,
    )
    db_session.add(line)
    await db_session.flush()

    # 2. Setup Style & Order
    style = Style(
        factory_id=factory.id,
        style_number="STY-WIDGET-01",
        base_sam=12.5,
        description="Complex Widget Style",
    )
    db_session.add(style)
    await db_session.flush()

    order = Order(
        po_number="PO-WIDGET-01", style_id=style.id, quantity=5000, status="sewing"
    )
    db_session.add(order)
    await db_session.flush()

    # 3. Setup Production Runs (Today + Yesterday)
    today = date.today()
    yesterday = today - timedelta(days=1)

    # Run Today
    run_today = ProductionRun(
        factory_id=factory.id,
        data_source_id=line.id,
        order_id=order.id,
        production_date=today,
        actual_qty=1000,
        worked_minutes=540,  # 9 hours
        # earned_minutes is computed: actual_qty * sam. We want 486.
        # 1000 * 0.486 = 486
        sam=Decimal("0.486"),
        operators_present=14,
        helpers_present=1,
        downtime_reason="Machine Failure",
        notes="Needle broke frequently",
    )
    db_session.add(run_today)
    await db_session.flush()

    # Run Yesterday
    run_yesterday = ProductionRun(
        factory_id=factory.id,
        data_source_id=line.id,
        order_id=order.id,
        production_date=yesterday,
        actual_qty=900,
        worked_minutes=540,
        # We want 432 earned minutes. 900 * 0.48 = 432
        sam=Decimal("0.48"),
        operators_present=15,
        helpers_present=0,
    )
    db_session.add(run_yesterday)
    await db_session.flush()

    # 4. Setup Efficiency Metrics
    eff_metric_today = EfficiencyMetric(
        production_run_id=run_today.id,
        efficiency_pct=Decimal("90.0"),
        sam_target=Decimal("5400"),
        sam_actual=Decimal("4860"),
        calculated_at=datetime.utcnow(),
    )
    db_session.add(eff_metric_today)

    eff_metric_yesterday = EfficiencyMetric(
        production_run_id=run_yesterday.id,
        efficiency_pct=Decimal("80.0"),
        sam_target=Decimal("5400"),
        sam_actual=Decimal("4320"),
        calculated_at=datetime.utcnow() - timedelta(days=1),
    )
    db_session.add(eff_metric_yesterday)

    # 5. Setup DHU Reports (Last 7 days)
    dhu_today = DHUReport(
        report_date=today,
        avg_dhu=Decimal("2.5"),
        total_inspected=1000,
        total_defects=25,
        factory_id=factory.id,
    )
    db_session.add(dhu_today)

    dhu_yesterday = DHUReport(
        report_date=yesterday,
        avg_dhu=Decimal("3.0"),
        total_inspected=900,
        total_defects=27,
        factory_id=factory.id,
    )
    db_session.add(dhu_yesterday)

    # 5.1 Create a Worker for ProductionOutput
    from app.models.workforce import Worker

    worker = Worker(
        factory_id=factory.id,
        employee_id="WK-HOURLY-01",
        full_name="Hourly Worker",
    )
    db_session.add(worker)
    await db_session.flush()

    # 6. Setup Hourly Production Output (Granular for Today)
    # 09:00 -> 100 pcs
    output_1 = ProductionOutput(
        production_run_id=run_today.id,
        worker_id=worker.id,
        operation="Sewing",
        # hour=9, # Logic extracts from recorded_at
        recorded_at=datetime.combine(today, datetime.min.time())
        + timedelta(hours=9, minutes=30),
        pieces_completed=100,
    )
    # 10:00 -> 150 pcs
    output_2 = ProductionOutput(
        production_run_id=run_today.id,
        worker_id=worker.id,
        operation="Sewing",
        # hour=10,
        recorded_at=datetime.combine(today, datetime.min.time())
        + timedelta(hours=10, minutes=30),
        pieces_completed=150,
    )
    db_session.add(output_1)
    db_session.add(output_2)

    await db_session.commit()
    return {
        "factory": factory,
        "line": line,
        "run_today": run_today,
        "run_yesterday": run_yesterday,
    }


@pytest.mark.asyncio
async def test_get_hourly_production(
    async_client: AsyncClient, auth_headers: dict, widget_data
):
    """
    Test GET /analytics/hourly-production
    Should return granular data or fallback distribution.
    Since we added ProductionOutput, it should return granular.
    """
    response = await async_client.get(
        "/api/v1/analytics/hourly-production", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 12  # 08:00 to 19:00

    # We added data for 09:00 (index 1) = 100, 10:00 (index 2) = 150
    # indices: 8->0, 9->1, 10->2 ...
    assert data[1] == 100
    assert data[2] == 150
    # Others should be 0 (unless fallback logic kicks in? No, logic prefers granular if exists)
    assert data[0] == 0


@pytest.mark.asyncio
async def test_get_sam_performance(
    async_client: AsyncClient, auth_headers: dict, widget_data
):
    """
    Test GET /analytics/sam-performance
    Should return current efficiency, change, avg SAM, total SAM.
    """
    response = await async_client.get(
        "/api/v1/analytics/sam-performance", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    # Today: Earned=486, Worked=540 => 90%
    # Yesterday: Earned=432, Worked=540 => 80%
    # Change: +10%

    assert float(data["efficiency"]) == 90.0
    assert float(data["efficiency_change"]) == 10.0
    assert float(data["total_sam"]) == 486.0
    # Avg SAM per hour = 486 / (540/60) = 486 / 9 = 54
    assert float(data["avg_sam_per_hour"]) == 54.0


@pytest.mark.asyncio
async def test_get_workforce_stats(
    async_client: AsyncClient, auth_headers: dict, widget_data
):
    """
    Test GET /analytics/workforce
    Should return present, target, absent.
    """
    # Test with line_id filter to be specific
    line_id = widget_data["line"].id
    response = await async_client.get(
        f"/api/v1/analytics/workforce?line_id={line_id}", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    # Target = 15
    # Present = 14 ops + 1 helper = 15
    # Absent = 0
    assert data["target"] == 15
    assert data["present"] == 15
    assert data["absent"] == 0
    assert data["late"] == 0


@pytest.mark.asyncio
async def test_get_dhu_history(
    async_client: AsyncClient, auth_headers: dict, widget_data
):
    """
    Test GET /analytics/dhu
    Should return trend of DHU.
    """
    response = await async_client.get(
        "/api/v1/analytics/dhu?days=7", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    # We added records for Today and Yesterday
    # Order should be ascending date
    assert len(data) >= 2

    # Check values
    today_str = date.today().strftime("%Y-%m-%d")
    yesterday_str = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")

    # Filter for our specific dates
    today_point = next((d for d in data if d["date"] == today_str), None)
    yesterday_point = next((d for d in data if d["date"] == yesterday_str), None)

    assert today_point is not None
    assert float(today_point["dhu"]) == 2.5

    assert yesterday_point is not None
    assert float(yesterday_point["dhu"]) == 3.0


@pytest.mark.asyncio
async def test_get_speed_vs_quality(
    async_client: AsyncClient, auth_headers: dict, widget_data
):
    """
    Test GET /analytics/speed-quality
    Should correlate Efficiency and DHU.
    """
    response = await async_client.get(
        "/api/v1/analytics/speed-quality", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    points = data["data_points"]

    assert len(points) > 0
    # Check Today's point
    # Efficiency 90.0, DHU 2.5
    today_label = date.today().strftime("%a %d")

    point = next((p for p in points if p["date"] == today_label), None)
    assert point is not None
    assert float(point["efficiency_pct"]) == 90.0
    assert float(point["defects_per_hundred"]) == 2.5


@pytest.mark.asyncio
async def test_get_complexity_impact(
    async_client: AsyncClient, auth_headers: dict, widget_data
):
    """
    Test GET /analytics/complexity-impact
    Should return scatter plot points (SAM vs Efficiency).
    """
    response = await async_client.get(
        "/api/v1/analytics/complexity-impact", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    points = data["data_points"]

    assert len(points) >= 1
    # Check for our style
    matched = next((p for p in points if p["style_code"] == "STY-WIDGET-01"), None)
    assert matched is not None
    assert float(matched["sam"]) == 12.5
    # Avg efficiency for this style.
    # Today run (90%) + Yesterday run (matches same order/style? Yes, we reused order)
    # Yesterday 80%. Avg should be 85.0
    assert float(matched["efficiency_pct"]) == 85.0


@pytest.mark.asyncio
async def test_get_downtime_reasons(
    async_client: AsyncClient, auth_headers: dict, widget_data
):
    """
    Test GET /analytics/downtime-reasons
    Should aggregate downtime reasons.
    """
    response = await async_client.get(
        "/api/v1/analytics/downtime-reasons", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    reasons = data["reasons"]

    assert len(reasons) > 0
    # We added "Machine Failure"
    matched = next((r for r in reasons if r["reason"] == "Machine Failure"), None)
    assert matched is not None
    assert matched["count"] >= 1
