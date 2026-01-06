"""
User management endpoints.
"""

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserRead)
async def read_user_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Get current user.
    """
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_user_me(
    user_in: UserUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update current user.
    """
    # Check for email uniqueness if email is being updated
    if user_in.email and user_in.email != current_user.email:
        result = await db.execute(select(User).where(User.email == user_in.email))
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

    # Update user fields
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "preferences" and value is not None:
            # Serialize dictionary to JSON string for database storage
            setattr(current_user, field, json.dumps(value))
        else:
            setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)
    return current_user
