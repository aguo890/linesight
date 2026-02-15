# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Test authentication endpoints.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import Organization, User, UserRole


@pytest.mark.asyncio
async def test_login_success(async_client: AsyncClient, db_session: AsyncSession):
    """Test successful login with valid credentials."""
    # Create test organization
    org = Organization(name="Test Org", code="TEST", primary_email="test@test.com")
    db_session.add(org)
    await db_session.flush()

    # Create test user
    user = User(
        organization_id=org.id,
        email="test@test.com",
        hashed_password=hash_password("testpass123"),
        full_name="Test User",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()

    # Test login using shared async_client fixture
    response = await async_client.post(
        "/api/v1/auth/login", json={"email": "test@test.com", "password": "testpass123"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "test@test.com"
    assert data["user"]["role"] == "system_admin"


@pytest.mark.asyncio
async def test_login_invalid_password(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test login with invalid password."""
    # Create test organization
    org = Organization(name="Test Org 2", code="TEST2", primary_email="test2@test.com")
    db_session.add(org)
    await db_session.flush()

    # Create test user
    user = User(
        organization_id=org.id,
        email="test2@test.com",
        hashed_password=hash_password("correctpass"),
        full_name="Test User 2",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()

    # Test login with wrong password
    response = await async_client.post(
        "/api/v1/auth/login", json={"email": "test2@test.com", "password": "wrongpass"}
    )

    assert response.status_code == 401
    assert "Invalid password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_user_not_found(async_client: AsyncClient):
    """Test login with non-existent user."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@test.com", "password": "somepass"},
    )

    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_success(async_client: AsyncClient):
    """Test successful user registration."""
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@test.com",
            "password": "newpass123",
            "full_name": "New User",
            "organization_name": "New Org",
            "organization_code": "NEWORG",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Registration successful"
    assert "user_id" in data
