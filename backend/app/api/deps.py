# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

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

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, SecurityScopes, OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import settings

# Security scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

async def get_current_user(
    security_scopes: SecurityScopes,
    token: str = Depends(oauth2_scheme)
) -> dict:
    """
    Validate JWT token statelessly and verify required scopes.
    Returns a dict with user identity and scopes to avoid DB hits.
    """
    if security_scopes.scopes:
        authenticate_value = f'Bearer scope="{security_scopes.scope_str}"'
    else:
        authenticate_value = "Bearer"

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: str | None = payload.get("sub")
        token_scopes: list[str] = payload.get("scopes", [])
        org_id: str | None = payload.get("organization_id")
        user_role: str | None = payload.get("role")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": authenticate_value},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": authenticate_value},
        )

    # Validate that the token contains all required scopes
    for scope in security_scopes.scopes:
        if scope not in token_scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
                headers={"WWW-Authenticate": authenticate_value},
            )

    # Return the basic user identity parsed from the token statelessly
    return {
        "id": user_id, 
        "scopes": token_scopes, 
        "organization_id": org_id,
        "role": user_role,
        "is_active": True
    }



async def get_current_active_user(
    current_token: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Ensure user is active and fetch full user from database."""
    user_id = current_token.get("id")
    result = await db.execute(select(User).where(User.id == user_id, User.is_active))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


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
CurrentUser = Annotated[User, Depends(get_current_active_user)]
ActiveUser = Annotated[User, Depends(get_current_active_user)]
AdminUser = Annotated[User, Depends(require_admin)]  # SYSTEM_ADMIN or OWNER
SystemAdminUser = Annotated[User, Depends(require_system_admin)]  # SYSTEM_ADMIN only
OwnerUser = Annotated[User, Depends(require_owner)]  # SYSTEM_ADMIN or OWNER
ManagerUser = Annotated[User, Depends(require_manager_or_above)]  # SYSTEM_ADMIN, OWNER, or MANAGER
DbSession = Annotated[AsyncSession, Depends(get_db)]
