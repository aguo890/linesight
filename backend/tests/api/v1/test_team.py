# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Tests for Team Management API endpoints.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.enums import RoleScope, UserRole
from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.user import Organization, User, UserScope

# =============================================================================
# Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def owner_org(db_session):
    """Create a test organization for owner tests."""
    org = Organization(
        name="Owner Test Org",
        code="OWNER-ORG",
        primary_email="owner@test.com",
    )
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest_asyncio.fixture
async def owner_user(db_session, owner_org):
    """Create an owner user."""
    user = User(
        organization_id=owner_org.id,
        email="owner@test.com",
        hashed_password=hash_password("owner123"),
        full_name="Test Owner",
        role=UserRole.OWNER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def manager_user(db_session, owner_org):
    """Create a manager user in the same organization."""
    user = User(
        organization_id=owner_org.id,
        email="manager@test.com",
        hashed_password=hash_password("manager123"),
        full_name="Test Manager",
        role=UserRole.MANAGER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def other_org(db_session):
    """Create a different organization."""
    org = Organization(
        name="Other Org",
        code="OTHER-ORG",
        primary_email="other@test.com",
    )
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest_asyncio.fixture
async def other_org_user(db_session, other_org):
    """Create a user in a different organization."""
    user = User(
        organization_id=other_org.id,
        email="other@test.com",
        hashed_password=hash_password("other123"),
        full_name="Other User",
        role=UserRole.MANAGER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_factory_for_team(db_session, owner_org):
    """Create a test factory in the owner's organization."""
    factory = Factory(
        organization_id=owner_org.id,
        name="Team Test Factory",
        code="TF-TEAM",
        country="US",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)
    return factory


@pytest_asyncio.fixture
async def test_line_for_team(db_session, test_factory_for_team):
    """Create a test data source (production line)."""
    line = DataSource(
        factory_id=test_factory_for_team.id,
        name="Team Test Line",
        code="TL-TEAM",
    )
    db_session.add(line)
    await db_session.commit()
    await db_session.refresh(line)
    return line


@pytest_asyncio.fixture
async def owner_headers(owner_user):
    """Generate auth headers for owner user."""
    token = create_access_token(subject=owner_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def manager_headers(manager_user):
    """Generate auth headers for manager user."""
    token = create_access_token(subject=manager_user.id)
    return {"Authorization": f"Bearer {token}"}


# =============================================================================
# Tests
# =============================================================================


@pytest.mark.asyncio
async def test_list_members_as_owner(
    async_client: AsyncClient,
    owner_user,
    manager_user,
    owner_headers,
):
    """Owner can list all organization members."""
    response = await async_client.get(
        f"{settings.API_V1_PREFIX}/organizations/members",
        headers=owner_headers,
    )

    assert response.status_code == 200
    members = response.json()

    # Should include both owner and manager
    assert len(members) >= 2
    emails = [m["email"] for m in members]
    assert "owner@test.com" in emails
    assert "manager@test.com" in emails


@pytest.mark.asyncio
async def test_list_members_as_manager_forbidden(
    async_client: AsyncClient,
    manager_user,
    manager_headers,
):
    """Manager cannot list organization members (403)."""
    response = await async_client.get(
        f"{settings.API_V1_PREFIX}/organizations/members",
        headers=manager_headers,
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_assign_user_to_line(
    async_client: AsyncClient,
    owner_user,
    manager_user,
    test_line_for_team,
    owner_headers,
):
    """Owner can assign a user to a production line."""
    response = await async_client.post(
        f"{settings.API_V1_PREFIX}/organizations/members/{manager_user.id}/scopes",
        headers=owner_headers,
        json={
            "data_source_id": str(test_line_for_team.id),
            "role": "manager",
        },
    )

    assert response.status_code == 201
    scope = response.json()
    assert scope["data_source_id"] == str(test_line_for_team.id)
    assert scope["scope_type"] == "line"
    assert scope["role"] == "manager"


@pytest.mark.asyncio
async def test_remove_user_scope(
    async_client: AsyncClient,
    db_session,
    owner_user,
    manager_user,
    test_factory_for_team,
    test_line_for_team,
    owner_headers,
    owner_org,
):
    """Owner can remove a user's scope assignment."""
    # First create a scope
    scope = UserScope(
        user_id=manager_user.id,
        scope_type=RoleScope.LINE,
        organization_id=owner_org.id,
        factory_id=test_factory_for_team.id,
        data_source_id=test_line_for_team.id,
        role=UserRole.MANAGER,
    )
    db_session.add(scope)
    await db_session.commit()
    await db_session.refresh(scope)

    # Now remove it
    response = await async_client.delete(
        f"{settings.API_V1_PREFIX}/organizations/members/{manager_user.id}/scopes/{scope.id}",
        headers=owner_headers,
    )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_cannot_assign_cross_org_user(
    async_client: AsyncClient,
    owner_user,
    other_org_user,
    test_line_for_team,
    owner_headers,
):
    """Cannot assign a user from a different organization (403)."""
    response = await async_client.post(
        f"{settings.API_V1_PREFIX}/organizations/members/{other_org_user.id}/scopes",
        headers=owner_headers,
        json={
            "data_source_id": str(test_line_for_team.id),
            "role": "manager",
        },
    )

    assert response.status_code == 403
    assert "different organization" in response.json()["detail"]
