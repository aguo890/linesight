# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from datetime import date, datetime
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import EfficiencyMetric
from app.models.drafts.compliance import (
    ComplianceStandard,
    TraceabilityRecord,
    VerificationStatus,
)
from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.production import Order, ProductionRun, Style
from app.models.workforce import Worker, WorkerSkill


@pytest.fixture
async def test_factory(db_session: AsyncSession, test_organization):
    factory = Factory(
        organization_id=test_organization.id,
        name="Test Factory Audit",
        code="TF-AUD-001",
        country="Test Country",
        total_workers=100,
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)
    return factory


@pytest.fixture
async def test_line(db_session: AsyncSession, test_factory):
    line = DataSource(
        factory_id=test_factory.id,
        name="Test Line Audit",
        code="TL-AUD",
        is_active=True,
    )
    db_session.add(line)
    await db_session.commit()
    await db_session.refresh(line)
    return line


@pytest.fixture
async def analytics_data(db_session: AsyncSession, test_factory, test_line):
    # 1. Create Style & Order
    style = Style(factory_id=test_factory.id, style_number="STY-ANA-001", base_sam=10.0)
    db_session.add(style)
    await db_session.flush()

    order = Order(
        po_number="PO-ANA-001", style_id=style.id, quantity=1000, status="sewing"
    )
    db_session.add(order)
    await db_session.flush()

    # 2. Create Production Run (Today)
    today = date.today()
    run = ProductionRun(
        factory_id=test_factory.id,
        production_date=today,
        order_id=order.id,
        data_source_id=test_line.id,
        planned_qty=500,
        actual_qty=450,
        worked_minutes=Decimal("4800"),
        operators_present=10,
        sam=Decimal("10.0"),
    )
    db_session.add(run)
    await db_session.flush()

    # 3. Create Efficiency Metric
    metric = EfficiencyMetric(
        production_run_id=run.id,
        efficiency_pct=Decimal("85.5"),
        sam_target=Decimal("5000"),
        sam_actual=Decimal("4500"),
        calculated_at=datetime.utcnow(),
    )
    db_session.add(metric)

    # 4. Create Workers & Skills
    worker1 = Worker(
        factory_id=test_factory.id,
        employee_id="WK-001",
        full_name="High Performer",
        data_source_id=test_line.id,
    )
    worker2 = Worker(
        factory_id=test_factory.id,
        employee_id="WK-002",
        full_name="Low Performer",
        data_source_id=test_line.id,
    )
    db_session.add_all([worker1, worker2])
    await db_session.flush()

    skill1 = WorkerSkill(
        worker_id=worker1.id, operation="Sewing", efficiency_pct=Decimal("95.0")
    )
    skill2 = WorkerSkill(
        worker_id=worker2.id, operation="Sewing", efficiency_pct=Decimal("65.0")
    )
    db_session.add_all([skill1, skill2])

    # 5. Create Traceability Record (Discrepancy)
    record = TraceabilityRecord(
        compliance_standard=ComplianceStandard.UFLPA,
        verification_status=VerificationStatus.FLAGGED,
        risk_notes="Suspicious origin",
        production_run_id=run.id,
    )
    db_session.add(record)

    await db_session.commit()
    return {"run": run, "worker1": worker1, "worker2": worker2, "record": record}


@pytest.mark.asyncio
async def test_get_overview_stats_real(
    async_client: AsyncClient, auth_headers: dict, analytics_data
):
    response = await async_client.get(
        "/api/v1/analytics/overview", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    # Verify stats based on analytics_data
    assert data["total_output"] == 450  # From run.actual_qty
    # efficiency returned as float/decimal
    # Calculated: Earned(4500) / Available(10*4800=48000) = 9.375%
    # AnalyticsService rounds to 2 decimals -> 9.38
    assert abs(float(data["avg_efficiency"]) - 9.38) < 0.1
    assert data["active_lines"] >= 1
    assert data["discrepancies_count"] >= 1


@pytest.mark.asyncio
async def test_get_production_chart_real(
    async_client: AsyncClient, auth_headers: dict, analytics_data
):
    response = await async_client.get(
        "/api/v1/analytics/production-chart", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    points = data["data_points"]
    assert len(points) == 7

    # Find today's point
    date.today().strftime("%a")  # current logic uses %a (Mon, Tue)
    # Actually wait, the current mock logic uses %a. Real logic might use dates or weekdays.
    # The requirement said "last 7 days".
    # Existing mock returns "Mon", "Tue"...
    # We should probably check if the implementation returns what we expect.
    # Let's assume the implementation will return local day names or dates.
    # For now, let's just check that we have non-zero data for today.

    # Note: If the test runs on a specific day, we need to match that.
    # We'll just check sum of actuals.
    total_actual = sum(p["actual"] for p in points)
    assert total_actual == 450


@pytest.mark.asyncio
async def test_get_lowest_performers_real(
    async_client: AsyncClient, auth_headers: dict, analytics_data
):
    response = await async_client.get(
        "/api/v1/analytics/workers/lowest-performers?limit=5", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    workers = data["workers"]

    assert len(workers) > 0
    # Worker 2 (Low Performer - 65%) should be first or present
    assert float(workers[0]["efficiency_pct"]) == 65.0
    assert workers[0]["name"] == "Low Performer"


@pytest.mark.asyncio
async def test_get_discrepancies_real(
    async_client: AsyncClient, auth_headers: dict, analytics_data
):
    response = await async_client.get(
        "/api/v1/analytics/discrepancies", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()

    discrepancies = data["discrepancies"]
    assert len(discrepancies) >= 1
    assert discrepancies[0]["issue_title"] == "Compliance Flagged"
    assert discrepancies[0]["severity"] == "High"  # Or whatever mapping logic uses
