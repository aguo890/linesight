import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factory import Factory, ProductionLine
from app.models.user import Organization, User


@pytest.mark.asyncio
async def test_factory_deletion_cascade_behavior(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    auth_headers: dict,
):
    """
    Verify that deleting a factory soft-deletes it and checks cascade behavior for lines.
    Requirement: "Verify that deleting a factory cascades correctly (or soft deletes) and updates the quota counts."
    """
    # 1. Setup: Create factory and lines
    org = await db_session.get(Organization, test_user.organization_id)
    org.max_factories = 5
    org.max_lines_per_factory = 5
    await db_session.commit()

    # Create factory
    response = await async_client.post(
        "/api/v1/factories",
        json={"name": "Cascade Test Factory", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    factory_id = response.json()["id"]

    # Create 2 lines
    for i in range(2):
        await async_client.post(
            f"/api/v1/factories/{factory_id}/lines",
            json={"name": f"Line {i}"},
            headers=auth_headers,
        )

    # Verify lines exist and are active
    lines_response = await async_client.get(
        f"/api/v1/factories/{factory_id}/lines", headers=auth_headers
    )
    assert lines_response.status_code == 200
    lines = lines_response.json()
    assert len(lines) == 2
    for line in lines:
        assert line["is_active"] is True

    # 2. Action: Delete Factory
    delete_response = await async_client.delete(
        f"/api/v1/factories/{factory_id}", headers=auth_headers
    )
    assert delete_response.status_code == 204

    # 3. Verification: Factory should be inactive
    # Direct DB check to verify is_active=False
    factory = await db_session.get(Factory, factory_id)
    assert factory.is_active is False
    # Check it can't be found via API (assuming list filters active)
    list_response = await async_client.get("/api/v1/factories", headers=auth_headers)
    assert not any(f["id"] == factory_id for f in list_response.json())

    # 4. Verification: Lines should be... ?
    # If "cascade correctly" means soft-delete lines, they should be inactive.
    # If "cascade" only applied to hard deletes in DB, they might still be active but orphaned from API view?

    # Let's check DB state of lines
    result = await db_session.execute(
        select(ProductionLine).where(ProductionLine.factory_id == factory_id)
    )
    db_lines = result.scalars().all()

    # Check if they are active or inactive
    # We assert what we EXPECT. If requirement is "cascades correctly", usually means children are deleted too.
    # But since I saw the code didn't implement it, I expect this to fail if I assert they are inactive.
    # However, for verification purposes, I will assertions checks their state and print/fail if active.

    active_lines = [line for line in db_lines if line.is_active]

    if active_lines:
        pytest.fail(
            f"Factory soft-deletion did not cascade to lines! {len(active_lines)} lines are still active."
        )

    assert len(active_lines) == 0
