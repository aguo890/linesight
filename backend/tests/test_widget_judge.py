import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest

from app.models.factory import Factory, ProductionLine
from app.models.production import Order, ProductionRun, Style

# Setup Logger
logger = logging.getLogger(__name__)


@pytest.fixture
async def judge_data(db_session, test_organization):
    """
    Seeds specific known values for the Judge Tests.
    - Factory: Tokyo Timezone
    - Line A: Target 100, Operators 10
    - Line B: Target 200, Operators 20 (Ghost Filter Trap)
    - Data: Production Run for Line A only.
    """
    # 1. Factory in Tokyo
    factory = Factory(
        organization_id=test_organization.id,
        name="Judgement Factory",
        code="JUDGE-01",
        country="Japan",
        timezone="Asia/Tokyo",
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)

    # 2. Line A (The Subject)
    line_a = ProductionLine(
        factory_id=factory.id,
        name="Line A",
        code="L-A",
        target_operators=15,  # Target Headcount
        is_active=True,
    )
    db_session.add(line_a)

    # 3. Line B (The Ghost)
    line_b = ProductionLine(
        factory_id=factory.id,
        name="Line B",
        code="L-B",
        target_operators=25,  # Different target to distinuish
        is_active=True,
    )
    db_session.add(line_b)
    await db_session.commit()
    await db_session.refresh(line_a)
    await db_session.refresh(line_b)

    # 4. Tokyo Date Calculation
    now_utc = datetime.now(timezone.utc)
    tokyo_tz = ZoneInfo("Asia/Tokyo")
    tokyo_today = now_utc.astimezone(tokyo_tz).date()

    # 5. Production Run for Line A (Today in Tokyo)
    # We need a style/order first due to FKs
    style = Style(factory_id=factory.id, style_number="ST-JUDGE", base_sam=10.0)
    db_session.add(style)
    await db_session.commit()

    order = Order(style_id=style.id, po_number="PO-JUDGE", quantity=1000)
    db_session.add(order)
    await db_session.commit()

    run_a = ProductionRun(
        factory_id=factory.id,
        line_id=line_a.id,
        order_id=order.id,
        production_date=tokyo_today,
        shift="day",
        actual_qty=50,  # KNOWN VALUE
        planned_qty=100,  # KNOWN VALUE
        operators_present=12,  # KNOWN VALUE
        helpers_present=3,  # KNOWN VALUE (Total = 15)
        worked_minutes=480,
        sam=10.0,
    )
    db_session.add(run_a)

    # 6. Production Run for Line B (Ghost Data)
    # Should NOT appear when querying Line A
    run_b = ProductionRun(
        factory_id=factory.id,
        line_id=line_b.id,
        order_id=order.id,
        production_date=tokyo_today,
        shift="day",
        actual_qty=80,
        planned_qty=200,
        operators_present=20,
        helpers_present=0,
        worked_minutes=480,
        sam=10.0,
    )
    db_session.add(run_b)

    await db_session.commit()

    return {
        "factory": factory,
        "line_a": line_a,
        "line_b": line_b,
        "run_a": run_a,
        "tokyo_today": tokyo_today,
    }


@pytest.mark.asyncio
async def test_judge_workforce_integrity_and_scope(
    async_client, judge_data, db_session
):
    """
    JUDGE TEST: Workforce Widget
    1. Integrity: Must return exact present count (12+3=15). No simulations.
    2. Scope: Must return Line A target (15), NOT Sum(A+B)=40.
    """
    line_id = judge_data["line_a"].id

    # ... mock user ...
    from types import SimpleNamespace

    from app.api.deps import get_current_user
    from app.main import app

    fake_user = SimpleNamespace(
        id="judge-user",
        organization_id=judge_data["factory"].organization_id,
        role="admin",
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user

    response = await async_client.get(f"/api/v1/analytics/workforce?line_id={line_id}")
    app.dependency_overrides.pop(get_current_user)

    assert response.status_code == 200, f"Response: {response.text}"
    data = response.json()

    # INTEGRITY CHECK
    # Run A: Ops 12, Helpers 3 => Total Present 15.
    assert data["present"] == 15, (
        f"Integrity Fail: Expected 15 present, got {data['present']}"
    )

    # SCOPE CHECK
    # Line A Target: 15. Line B Target: 25.
    # If Ghost Filter is broken, it might sum all active lines (15+25=40) or fail.
    # The API logic for 'target' should pull from ProductionLine.target_operators for THIS line.
    assert data["target"] == 15, (
        f"Scope Fail: Expected 15 target (Line A), got {data['target']}"
    )

    # ABSENT CHECK (Zero Tolerance)
    # If no data on "absent", it should be 0. Not simulated "10%".
    # (15 target - 15 present) = 0 absent?
    # Wait, the code said "absent = 0" explicit hardcode in my fix.
    assert data["absent"] == 0
    assert data["late"] == 0


@pytest.mark.asyncio
async def test_judge_overview_timezone_and_scope(async_client, judge_data):
    """
    JUDGE TEST: Overview Stats
    1. Timezone: Must find the production run from 'Today' (Tokyo time).
       If it used Server Time (assumed NY), it might mismatch if boundary logic failed (though chaos test covered that).
       This verifies E2E.
    2. Scope: Must only count Line A's output (50), not Line B's (80).
    """
    line_id = judge_data["line_a"].id

    from types import SimpleNamespace

    from app.api.deps import get_current_user
    from app.main import app

    fake_user = SimpleNamespace(
        id="judge-user",
        organization_id=judge_data["factory"].organization_id,
        role="admin",
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user

    response = await async_client.get(f"/api/v1/analytics/overview?line_id={line_id}")
    app.dependency_overrides.pop(get_current_user)

    assert response.status_code == 200
    data = response.json()

    # Line A Actual Qty = 50. Line B = 80.
    # If it leaked, it might be 130.
    # If timezone failed, it might be 0 (if it looked for "yesterday" via server time vs factory time).
    assert data["total_output"] == 50, (
        f"Overview Fail: Expected 50 produced, got {data['total_output']}"
    )


@pytest.mark.asyncio
async def test_judge_no_fake_simulation(async_client, judge_data):
    """
    JUDGE TEST: Style Progress
    Verify removal of "ST-999" simulation.
    We didn't seed "ST-999". We seeded "ST-JUDGE".
    Any reference to "ST-999" logic should be gone.
    """
    line_id = judge_data["line_a"].id

    from types import SimpleNamespace

    from app.api.deps import get_current_user
    from app.main import app

    fake_user = SimpleNamespace(
        id="judge-user",
        organization_id=judge_data["factory"].organization_id,
        role="admin",
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user

    # Call Style Progress
    response = await async_client.get(
        f"/api/v1/analytics/production/styles?line_id={line_id}"
    )
    app.dependency_overrides.pop(get_current_user)

    assert response.status_code == 200
    data = response.json()  # List of styles

    # We expect 'ST-JUDGE'
    found = False
    # We expect 'ST-JUDGE'
    found = False
    for item in data["active_styles"]:
        if (
            "ST-JUDGE" in item["style_code"]
        ):  # Response uses style_code, NOT style_number (check schema)
            found = True
            # Status should be "In Progress" because we have 50/100 (50%).
            # Not "Behind" (simulated) or "On Track" (hardcoded).
            # Logic: >=90 Completed, >0 In Progress, Else Pending.
            assert item["status"] == "In Progress", (
                f"Status Fail: Expected 'In Progress', got {item['status']}"
            )

    assert found, "ST-JUDGE style not found in progress"
