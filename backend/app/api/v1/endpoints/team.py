"""
Team Management endpoints for LineSight.
Enables organization owners to manage user assignments to production lines.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import OwnerUser, get_db
from app.enums import RoleScope, UserRole
from app.models.factory import Factory, ProductionLine
from app.models.user import User, UserScope
from app.schemas.team import MemberRead, ScopeAssign, ScopeRead

router = APIRouter()


@router.get("/members", response_model=list[MemberRead])
async def list_organization_members(
    current_user: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    List all organization members with their scope assignments.

    Only accessible by organization owners.
    Returns all users in the organization with their production line assignments.
    """
    # Fetch all users in the organization with their scopes
    result = await db.execute(
        select(User)
        .options(selectinload(User.scopes))
        .where(
            User.organization_id == current_user.organization_id,
            User.is_active == True,
        )
        .order_by(User.full_name, User.email)
    )
    users = result.scalars().all()

    # Convert to response schema
    members = []
    for user in users:
        scopes = [
            ScopeRead(
                id=str(scope.id),
                scope_type=scope.scope_type.value if hasattr(scope.scope_type, 'value') else str(scope.scope_type),
                organization_id=str(scope.organization_id) if scope.organization_id else None,
                factory_id=str(scope.factory_id) if scope.factory_id else None,
                production_line_id=str(scope.production_line_id) if scope.production_line_id else None,
                role=scope.role.value if hasattr(scope.role, 'value') else str(scope.role),
            )
            for scope in user.scopes
        ]
        members.append(
            MemberRead(
                id=str(user.id),
                email=user.email,
                full_name=user.full_name,
                role=user.role.value if hasattr(user.role, 'value') else str(user.role),
                is_active=user.is_active,
                scopes=scopes,
            )
        )

    return members


@router.post("/members/{user_id}/scopes", response_model=ScopeRead, status_code=status.HTTP_201_CREATED)
async def assign_user_to_line(
    user_id: str,
    scope_data: ScopeAssign,
    current_user: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Assign a user to a production line.

    Only accessible by organization owners.
    Creates a new UserScope entry linking the user to the specified production line.
    """
    # Verify target user exists and belongs to same organization
    user_result = await db.execute(
        select(User).where(User.id == user_id)
    )
    target_user = user_result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if target_user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot assign users from a different organization",
        )

    # Verify production line exists and belongs to owner's organization
    line_result = await db.execute(
        select(ProductionLine)
        .join(Factory)
        .where(
            ProductionLine.id == scope_data.production_line_id,
            Factory.organization_id == current_user.organization_id,
        )
    )
    line = line_result.scalar_one_or_none()

    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Production line not found or not in your organization",
        )

    # Get factory ID for the scope
    factory_result = await db.execute(
        select(Factory).where(Factory.id == line.factory_id)
    )
    factory = factory_result.scalar_one()

    # Check if user already has this scope
    existing_scope = await db.execute(
        select(UserScope).where(
            UserScope.user_id == user_id,
            UserScope.production_line_id == scope_data.production_line_id,
        )
    )
    if existing_scope.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already assigned to this production line",
        )

    # Create the scope assignment
    role = UserRole(scope_data.role) if scope_data.role in [r.value for r in UserRole] else UserRole.MANAGER
    
    new_scope = UserScope(
        user_id=user_id,
        scope_type=RoleScope.LINE,
        organization_id=current_user.organization_id,
        factory_id=factory.id,
        production_line_id=scope_data.production_line_id,
        role=role,
    )
    db.add(new_scope)
    await db.commit()
    await db.refresh(new_scope)

    return ScopeRead(
        id=str(new_scope.id),
        scope_type=new_scope.scope_type.value,
        organization_id=str(new_scope.organization_id) if new_scope.organization_id else None,
        factory_id=str(new_scope.factory_id) if new_scope.factory_id else None,
        production_line_id=str(new_scope.production_line_id) if new_scope.production_line_id else None,
        role=new_scope.role.value,
    )


@router.delete("/members/{user_id}/scopes/{scope_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user_scope(
    user_id: str,
    scope_id: str,
    current_user: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Remove a user's scope assignment.

    Only accessible by organization owners.
    Deletes the UserScope entry, removing the user's access to that production line.
    """
    # Verify scope exists and belongs to the specified user
    scope_result = await db.execute(
        select(UserScope).where(
            UserScope.id == scope_id,
            UserScope.user_id == user_id,
        )
    )
    scope = scope_result.scalar_one_or_none()

    if not scope:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scope not found",
        )

    # Verify the scope belongs to a user in the owner's organization
    user_result = await db.execute(
        select(User).where(User.id == user_id)
    )
    target_user = user_result.scalar_one_or_none()

    if not target_user or target_user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify scopes for users in a different organization",
        )

    await db.delete(scope)
    await db.commit()

    return None
