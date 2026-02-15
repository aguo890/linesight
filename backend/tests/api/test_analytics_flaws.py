# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from datetime import date, datetime, time, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.events import ProductionEvent
from app.models.production import ProductionRun


@pytest.mark.asyncio
async def test_hourly_production_no_events_returns_zeros(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_factory,
    test_line,
    test_order,
):
    """
    The 'Null' Test: Ensure that if no ProductionEvents exist,
    the API returns [0, 0, ..., 0] and NOT a fake curve.
    """
    print("\nDEBUG: Starting test_hourly_production_no_events_returns_zeros")
    # 1. Create a Run (so 'total_daily' > 0 if fallback logic was used)
    today = date.today()
    run = ProductionRun(
        production_date=today,
        line_id=test_line.id,
        factory_id=test_factory.id,
        order_id=test_order.id,
        actual_qty=1000,
        planned_qty=1000,
        worked_minutes=480,
        operators_present=10,
        helpers_present=0,
    )
    db_session.add(run)
    print("DEBUG: Run added to session")
    await db_session.commit()
    print("DEBUG: Run committed")

    # 2. Call API
    print("DEBUG: Calling API /api/v1/analytics/hourly-production")
    response = await async_client.get(
        f"/api/v1/analytics/hourly-production?line_id={test_line.id}",
        headers=auth_headers,
    )
    print(f"DEBUG: API Response Status: {response.status_code}")
    print(f"DEBUG: API Response Data: {response.text}")
    assert response.status_code == 200
    data = response.json()

    # 3. Assert Chaos: Expect ZEROS
    assert data == [0] * 12, (
        "Fake Data detected! API returned simulated curve instead of zeros."
    )


@pytest.mark.asyncio
async def test_midnight_boundary_respects_timezone(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_factory,
    test_order,
):
    """
    The 'Midnight' Test: Verify temporal absolutism.
    Events at 23:59 EST should belong to Today.
    Events at 00:01 EST should belong to Tomorrow.
    """
    print("\nDEBUG: Starting test_midnight_boundary_respects_timezone")
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        from backports.zoneinfo import ZoneInfo

    # Create a UNIQUE line for this test to avoid bleeding state from previous tests
    from app.models.factory import ProductionLine

    unique_line = ProductionLine(
        factory_id=test_factory.id, name="Timezone Test Line", code="TZ-LINE"
    )
    db_session.add(unique_line)
    await db_session.commit()
    await db_session.refresh(unique_line)

    # Ensure factory has correct timezone
    test_factory.timezone = "America/New_York"
    db_session.add(test_factory)
    await db_session.commit()
    await db_session.refresh(test_factory)

    factory_tz = ZoneInfo("America/New_York")

    # Calculate "Today" in Factory Time
    now_utc = datetime.now(ZoneInfo("UTC"))
    factory_now = now_utc.astimezone(factory_tz)
    today_factory = factory_now.date()

    print(f"DEBUG: Factory Today: {today_factory}")

    # 1. Create Event very late today (Factory Time)
    near_midnight = datetime.now(factory_tz).replace(
        hour=23, minute=59, second=59, microsecond=0
    )
    near_midnight_utc = near_midnight.astimezone(ZoneInfo("UTC"))

    event_late = ProductionEvent(
        timestamp=near_midnight_utc.replace(tzinfo=None),
        line_id=unique_line.id,
        order_id=test_order.id,
        style_id=test_order.style_id,
        quantity=10,
        event_type="production",
    )
    db_session.add(event_late)

    # 2. Create Event very early tomorrow (Factory Time)
    tomorrow_factory = today_factory + timedelta(days=1)
    # Using datetime.combine(date, time) needs time object
    just_after_midnight_dt = datetime.combine(tomorrow_factory, time.min).replace(
        tzinfo=factory_tz
    ) + timedelta(seconds=1)
    just_after_midnight_utc = just_after_midnight_dt.astimezone(ZoneInfo("UTC"))

    event_early = ProductionEvent(
        timestamp=just_after_midnight_utc.replace(tzinfo=None),
        line_id=unique_line.id,
        order_id=test_order.id,
        style_id=test_order.style_id,
        quantity=20,
        event_type="production",
    )
    db_session.add(event_early)

    await db_session.commit()

    # 3. Check Effective Dates via Repository
    from app.repositories.production_repo import ProductionRepository

    repo = ProductionRepository(db_session)

    # "Today" has data, so it should return Today
    eff_date = await repo.get_effective_date(unique_line.id)
    print(f"DEBUG: Effective Date 1: {eff_date}")
    assert eff_date == today_factory

    # 4. Now delete "Today's" data and check if it flips to "Tomorrow"
    await db_session.delete(event_late)
    await db_session.commit()

    eff_date_2 = await repo.get_effective_date(unique_line.id)
    print(f"DEBUG: Effective Date 2: {eff_date_2}")
    assert eff_date_2 == tomorrow_factory
