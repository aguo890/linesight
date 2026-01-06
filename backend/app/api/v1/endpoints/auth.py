"""
Authentication endpoints for LineSight.
Handles user login, registration, and token management.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import Organization, User, UserRole
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UserInfo,
)

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Authenticate user and return JWT token.

    - **email**: User's email address
    - **password**: User's password (min 8 characters)
    """
    # Find user by email
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Verify password
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Create access token
    access_token = create_access_token(subject=user.id)

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserInfo(
            id=user.id,
            email=user.email,
            full_name=user.full_name or "",
            role=user.role.value,
            organization_id=user.organization_id,
        ),
    )


@router.post(
    "/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    request: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Register a new user and organization.

    Creates both an organization and an admin user for that organization.
    This is typically for new company signups.
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Check if organization code already exists
    result = await db.execute(
        select(Organization).where(Organization.code == request.organization_code)
    )
    existing_org = result.scalar_one_or_none()

    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization code already exists",
        )

    # Create organization
    organization = Organization(
        name=request.organization_name,
        code=request.organization_code,
        primary_email=request.email,
    )
    db.add(organization)
    await db.flush()  # Get the org ID

    # Create admin user
    user = User(
        organization_id=organization.id,
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,  # Auto-verify for MVP
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return RegisterResponse(
        message="Registration successful",
        user_id=user.id,
    )
