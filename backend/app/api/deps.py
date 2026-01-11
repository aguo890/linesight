"""
FastAPI dependency injection utilities.
Provides database sessions, authentication, and common dependencies.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

# Security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Validate JWT token and return current user.

    Raises:
        HTTPException: If token is invalid or user not found
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    result = await db.execute(select(User).where(User.id == user_id, User.is_active))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Ensure user is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return current_user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """Require system admin or owner role."""
    from app.enums import UserRole

    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_system_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """Require system admin role (platform-level access)."""
    from app.enums import UserRole

    if current_user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System admin access required",
        )
    return current_user


async def require_owner(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """Require owner role (organization-level access for creating lines, etc.)."""
    from app.enums import UserRole

    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required",
        )
    return current_user


async def require_manager_or_above(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """Require manager, owner, or system admin role."""
    from app.enums import UserRole

    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.OWNER, UserRole.FACTORY_MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required",
        )
    return current_user


# Type aliases for dependency injection
CurrentUser = Annotated[User, Depends(get_current_user)]
ActiveUser = Annotated[User, Depends(get_current_active_user)]
AdminUser = Annotated[User, Depends(require_admin)]  # SYSTEM_ADMIN or OWNER
SystemAdminUser = Annotated[User, Depends(require_system_admin)]  # SYSTEM_ADMIN only
OwnerUser = Annotated[User, Depends(require_owner)]  # SYSTEM_ADMIN or OWNER
ManagerUser = Annotated[User, Depends(require_manager_or_above)]  # SYSTEM_ADMIN, OWNER, or MANAGER
DbSession = Annotated[AsyncSession, Depends(get_db)]
