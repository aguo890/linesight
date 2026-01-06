"""
Tests for organization quota enforcement.
Verifies factory and production line creation limits based on subscription tier.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factory import Factory
from app.models.user import Organization, User


@pytest_asyncio.fixture
async def test_factory(db_session: AsyncSession, test_organization):
    """Create a test factory."""
    factory = Factory(
        organization_id=test_organization.id,
        name="Test Factory",
        country="US",
        timezone="UTC",
        is_active=True,
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)
    return factory


@pytest.mark.asyncio
async def test_factory_quota_enforced(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    auth_headers: dict,
):
    """Test that factory creation is blocked when quota is reached."""
    # Set organization quota to 1 factory
    org = await db_session.get(Organization, test_user.organization_id)
    org.max_factories = 1
    await db_session.commit()

    # Create first factory (should succeed)
    response = await async_client.post(
        "/api/v1/factories",
        json={"name": "Factory 1", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    factory1 = response.json()
    assert factory1["name"] == "Factory 1"

    # Attempt to create second factory (should fail with quota error)
    response = await async_client.post(
        "/api/v1/factories",
        json={"name": "Factory 2", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert response.status_code == 403
    error = response.json()
    assert error["detail"]["error"] == "quota_exceeded"
    assert error["detail"]["current_count"] == 1
    assert error["detail"]["max_allowed"] == 1
    assert error["detail"]["upgrade_required"] is True


@pytest.mark.asyncio
async def test_line_quota_enforced(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_factory: Factory,
    auth_headers: dict,
):
    """Test that production line creation is blocked when quota is reached."""
    # Set organization quota to 2 lines per factory
    org = await db_session.get(Organization, test_user.organization_id)
    org.max_lines_per_factory = 2
    await db_session.commit()

    # Create first line (should succeed)
    response = await async_client.post(
        f"/api/v1/factories/{test_factory.id}/lines",
        json={"name": "Line 1"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    line1 = response.json()
    assert line1["name"] == "Line 1"

    # Create second line (should succeed)
    response = await async_client.post(
        f"/api/v1/factories/{test_factory.id}/lines",
        json={"name": "Line 2"},
        headers=auth_headers,
    )
    assert response.status_code == 201

    # Attempt to create third line (should fail with quota error)
    response = await async_client.post(
        f"/api/v1/factories/{test_factory.id}/lines",
        json={"name": "Line 3"},
        headers=auth_headers,
    )
    assert response.status_code == 403
    error = response.json()
    assert error["detail"]["error"] == "quota_exceeded"
    assert error["detail"]["current_count"] == 2
    assert error["detail"]["max_allowed"] == 2
    assert error["detail"]["factory_id"] == test_factory.id


@pytest.mark.asyncio
async def test_soft_deleted_factories_not_counted(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    auth_headers: dict,
):
    """Test that soft-deleted (inactive) factories don't count toward quota."""
    # Set quota to 1
    org = await db_session.get(Organization, test_user.organization_id)
    org.max_factories = 1
    await db_session.commit()

    # Create factory
    response = await async_client.post(
        "/api/v1/factories",
        json={"name": "Factory to Delete", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    factory_id = response.json()["id"]

    # Soft delete factory
    response = await async_client.delete(
        f"/api/v1/factories/{factory_id}", headers=auth_headers
    )
    assert response.status_code == 204

    # Should now be able to create another factory
    response = await async_client.post(
        "/api/v1/factories",
        json={"name": "New Factory", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["name"] == "New Factory"


@pytest.mark.asyncio
async def test_quota_status_endpoint(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_factory: Factory,
    auth_headers: dict,
):
    """Test GET /organizations/quota-status returns correct information."""
    # Set up organization quotas
    org = await db_session.get(Organization, test_user.organization_id)
    org.max_factories = 3
    org.max_lines_per_factory = 5
    await db_session.commit()

    # Create 2 lines in the test factory
    for i in range(2):
        await async_client.post(
            f"/api/v1/factories/{test_factory.id}/lines",
            json={"name": f"Line {i + 1}"},
            headers=auth_headers,
        )

    # Get quota status
    response = await async_client.get(
        "/api/v1/organizations/quota-status", headers=auth_headers
    )
    assert response.status_code == 200

    quota = response.json()
    assert quota["subscription_tier"] == org.subscription_tier

    # Factories quota
    assert quota["factories"]["current"] == 1  # test_factory
    assert quota["factories"]["max"] == 3
    assert quota["factories"]["available"] == 2
    assert quota["factories"]["can_create"] is True

    # Lines quota
    assert quota["lines_per_factory"]["max"] == 5
    assert len(quota["lines_per_factory"]["by_factory"]) == 1

    factory_quota = quota["lines_per_factory"]["by_factory"][0]
    assert factory_quota["factory_id"] == test_factory.id
    assert factory_quota["current"] == 2
    assert factory_quota["available"] == 3
    assert factory_quota["can_create"] is True


@pytest.mark.asyncio
async def test_enterprise_tier_quotas(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    auth_headers: dict,
):
    """Test enterprise tier has higher quotas."""
    # Update to enterprise tier
    org = await db_session.get(Organization, test_user.organization_id)
    org.subscription_tier = "enterprise"
    org.max_factories = 5
    org.max_lines_per_factory = 50
    await db_session.commit()

    # Should be able to create 5 factories
    for i in range(5):
        response = await async_client.post(
            "/api/v1/factories",
            json={"name": f"Factory {i + 1}", "country": "US", "timezone": "UTC"},
            headers=auth_headers,
        )
        assert response.status_code == 201

    # 6th should fail
    response = await async_client.post(
        "/api/v1/factories",
        json={"name": "Factory 6", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_quota_at_exact_limit(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    auth_headers: dict,
):
    """Test quota enforcement when exactly at limit (edge case)."""
    org = await db_session.get(Organization, test_user.organization_id)
    org.max_factories = 2
    await db_session.commit()

    # Create 2 factories
    for i in range(2):
        response = await async_client.post(
            "/api/v1/factories",
            json={"name": f"Factory {i + 1}", "country": "US", "timezone": "UTC"},
            headers=auth_headers,
        )
        assert response.status_code == 201

    # Get quota status - should show can_create=False
    response = await async_client.get(
        "/api/v1/organizations/quota-status", headers=auth_headers
    )
    quota = response.json()
    assert quota["factories"]["current"] == 2
    assert quota["factories"]["can_create"] is False
    assert quota["factories"]["available"] == 0

    # Attempt to create one more (should fail)
    response = await async_client.post(
        "/api/v1/factories",
        json={"name": "Factory 3", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_zero_quota_blocks_creation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    auth_headers: dict,
):
    """Test edge case where quota is set to 0."""
    org = await db_session.get(Organization, test_user.organization_id)
    org.max_factories = 0
    await db_session.commit()

    # Should not be able to create any factories
    response = await async_client.post(
        "/api/v1/factories",
        json={"name": "Factory 1", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert response.status_code == 403
    assert response.json()["detail"]["max_allowed"] == 0
