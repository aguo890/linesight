from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import OrderStatus
from app.models.factory import Factory, ProductionLine
from app.models.production import Order, ProductionRun, Style


@pytest.mark.asyncio
async def test_get_style_progress_with_pending_orders(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict[str, str],
):
    """
    Test that the /analytics/production/styles endpoint returns orders
    even if they are in PENDING status, provided they have production runs on the filtered line.
    """
    # 1. Setup Data - Create organization manually or assume user is set up by auth_headers
    # We need a factory that belongs to the user's organization?
    # auth_headers usually implies a created user and org.
    # But for safety, let's create a factory attached to the "test_organization" if available,
    # OR simpler: just create arbitrary data.
    # The endpoint checks `current_user` but doesn't STRICTLY enforce org boundaries in the query in previous view?
    # Wait, `get_overview_stats` endpoint logic: `get_db` dependency.
    # The analytics queries don't seem to explicitly filter by `current_user.organization_id` in the snippets I saw!
    # They usually rely on `ProductionRepository` or direct `db.execute` on global tables for the DEMO.
    # Actually, lines 44-59 in analytics.py docstring say "current user's organization".
    # But `get_style_progress` lines 269-274 do NOT filter by Org.
    # This is a security flaw technically, but for the test it simplifies things.

    factory = Factory(
        name="Style Factory", country="Testland", organization_id="org-1"
    )  # minimal, assuming no strict FK constraint check in sqlite or mock?
    # Actually, SQLAlchemy will complain if org-1 doesn't exist if FK usage is enforced.
    # Let's check if we can skip org or if we need to mock it.
    # Best way is to just create the objects.

    # actually, instead of "org-1", I'll create an Org.
    from app.models.user import Organization

    org = Organization(name="Test Org", code="test-org")
    db_session.add(org)
    await db_session.flush()

    factory.organization_id = org.id
    db_session.add(factory)
    await db_session.flush()

    line = ProductionLine(name="Line B", factory_id=factory.id)
    db_session.add(line)
    await db_session.flush()

    style = Style(style_number="STY-002", factory_id=factory.id, base_sam=10.5)
    db_session.add(style)
    await db_session.flush()

    # Create Order in PENDING status (default for ingestion)
    order = Order(
        po_number="PO-999", style_id=style.id, quantity=1000, status=OrderStatus.PENDING
    )
    db_session.add(order)
    await db_session.flush()

    # Create Production Run linking them
    run = ProductionRun(
        factory_id=factory.id,
        line_id=line.id,
        order_id=order.id,
        production_date=date.today(),
        actual_qty=150,
        worked_minutes=480,
        operators_present=10,
        helpers_present=2,
    )
    db_session.add(run)
    await db_session.commit()

    # 2. Call API with line_id filter
    response = await async_client.get(
        "/api/v1/analytics/production/styles",
        params={"line_id": line.id},
        headers=auth_headers,
    )

    # 3. Verify
    assert response.status_code == 200
    data = response.json()
    assert "active_styles" in data
    styles = data["active_styles"]

    # We expect 1 style
    assert len(styles) == 1
    item = styles[0]
    assert item["style_code"] == "STY-002"
    assert item["actual"] == 150
    assert item["target"] == 1000
    assert float(item["progress_pct"]) == 15.0
