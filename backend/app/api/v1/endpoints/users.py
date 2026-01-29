"""
User management endpoints.
"""

import json
from contextlib import suppress
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
            # 1. Load existing preferences
            current_prefs = {}
            if current_user.preferences:
                with suppress(Exception):
                    current_prefs = json.loads(current_user.preferences)

            # 2. Merge new values (value is a dict because of exclude_unset=True)
            # Pydantic's model_dump(exclude_unset=True) means 'value' only contains
            # the fields explicitly sent by the client.
            updated_prefs = {**current_prefs, **value}

            # 3. Save back
            setattr(current_user, field, json.dumps(updated_prefs))
        else:
            setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)
    return current_user
