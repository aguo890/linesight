"""
Factory endpoints for LineSight.
CRUD operations for factories and production lines.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, ManagerUser, get_db
from app.enums import UserRole
from app.models.factory import Factory, ProductionLine
from app.models.user import Organization, UserScope
from app.schemas.factory import (
    FactoryCreate,
    FactoryRead,
    FactoryUpdate,
    FactoryWithLines,
    ProductionLineCreate,
    ProductionLineRead,
    ProductionLineUpdate,
)

router = APIRouter()


# =============================================================================
# Factory Endpoints
# =============================================================================


@router.get("", response_model=list[FactoryRead])
async def list_factories(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get all factories for the current user's organization.
    
    RBAC:
    - OWNER/ADMIN: See all active factories in organization.
    - MANAGER: Only see factories where they have assigned lines.
    """
    query = select(Factory).where(
        Factory.organization_id == current_user.organization_id,
        Factory.is_active
    )

    if current_user.role == UserRole.MANAGER:
        # Get factory IDs from user's line assignments
        # We look for scopes that have a production_line_id
        # The factory_id is also stored in scope, but let's be robust
        scope_query = select(UserScope.factory_id).where(
            UserScope.user_id == current_user.id,
            UserScope.production_line_id.isnot(None)
        ).distinct()
        
        scope_result = await db.execute(scope_query)
        allowed_factory_ids = {row[0] for row in scope_result.fetchall() if row[0]}
        
        # If no assignments, they see no factories
        if not allowed_factory_ids:
            return []
            
        query = query.where(Factory.id.in_(allowed_factory_ids))

    result = await db.execute(query.order_by(Factory.name))
    factories = result.scalars().all()
    return factories


@router.get("/{factory_id}", response_model=FactoryWithLines)
async def get_factory(
    factory_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get a specific factory with its production lines.
    
    RBAC Filtering:
    - SYSTEM_ADMIN/OWNER: See all lines
    - MANAGER: Only see lines assigned via UserScope
    """
    result = await db.execute(
        select(Factory)
        .options(selectinload(Factory.production_lines))
        .where(Factory.id == factory_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    factory = result.scalar_one_or_none()

    if not factory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factory not found",
        )

    # RBAC: Filter lines for managers
    if current_user.role == UserRole.MANAGER:
        # Get line IDs assigned to this manager
        scope_result = await db.execute(
            select(UserScope.production_line_id)
            .where(UserScope.user_id == current_user.id)
            .where(UserScope.production_line_id.isnot(None))
        )
        allowed_line_ids = {row[0] for row in scope_result.fetchall()}
        
        # Filter production_lines to only allowed ones
        factory.production_lines = [
            line for line in factory.production_lines 
            if line.id in allowed_line_ids and line.is_active
        ]

    return factory


@router.post("", response_model=FactoryRead, status_code=status.HTTP_201_CREATED)
async def create_factory(
    factory_data: FactoryCreate,
    current_user: ManagerUser,  # Only managers/admins can create factories
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Create a new factory with quota enforcement.
    """
    # Get organization with quotas
    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    organization = org_result.scalar_one()

    # Count existing active factories
    factory_count_result = await db.execute(
        select(func.count(Factory.id)).where(
            Factory.organization_id == current_user.organization_id, Factory.is_active
        )
    )
    existing_factory_count = factory_count_result.scalar()

    # Enforce quota
    if int(existing_factory_count or 0) >= int(organization.max_factories or 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "quota_exceeded",
                "message": f"Organization has reached maximum factory limit ({organization.max_factories})",
                "current_count": existing_factory_count,
                "max_allowed": organization.max_factories,
                "upgrade_required": True,
            },
        )

    # Check if code exists in org
    if factory_data.code:
        result = await db.execute(
            select(Factory)
            .where(Factory.organization_id == current_user.organization_id)
            .where(Factory.code == factory_data.code)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Factory with code '{factory_data.code}' already exists",
            )

    factory = Factory(
        organization_id=current_user.organization_id,
        name=factory_data.name,
        code=factory_data.code,
        country=factory_data.country or "Unknown",
        city=factory_data.location,
        timezone=factory_data.timezone or "UTC",
        settings=factory_data.settings.model_dump() if factory_data.settings else None,
    )
    db.add(factory)
    await db.commit()
    await db.refresh(factory)
    return factory


@router.patch("/{factory_id}", response_model=FactoryRead)
async def update_factory(
    factory_id: str,
    factory_data: FactoryUpdate,
    current_user: ManagerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update an existing factory.
    """
    result = await db.execute(
        select(Factory)
        .where(Factory.id == factory_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    factory = result.scalar_one_or_none()

    if not factory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factory not found",
        )

    # Update fields
    update_data = factory_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "location":
            factory.city = value
        elif field == "settings":
            # If value is a Pydantic model (FactorySettings), dump it to dict
            if hasattr(value, "model_dump"):
                setattr(factory, field, value.model_dump())
            else:
                setattr(factory, field, value)
        else:
            setattr(factory, field, value)

    await db.commit()
    await db.refresh(factory)
    return factory


@router.delete("/{factory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_factory(
    factory_id: str,
    current_user: ManagerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Soft-delete a factory.
    """
    result = await db.execute(
        select(Factory)
        .where(Factory.id == factory_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    factory = result.scalar_one_or_none()

    if not factory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factory not found",
        )

    # Soft delete factory
    factory.is_active = False
    if factory.code:
        factory.code = f"{factory.code}_deleted_{factory.id[:8]}"

    # Cascade soft delete to production lines
    await db.execute(
        update(ProductionLine)
        .where(ProductionLine.factory_id == factory_id)
        .values(is_active=False)
    )

    await db.commit()
    return None


# =============================================================================
# Production Line Endpoints
# =============================================================================


@router.get("/{factory_id}/lines", response_model=list[ProductionLineRead])
async def list_production_lines(
    factory_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get production lines for a factory.
    
    RBAC Filtering:
    - SYSTEM_ADMIN/OWNER: See all lines in the factory
    - MANAGER: Only see lines assigned via UserScope
    - ANALYST/VIEWER: See all lines (read-only)
    """
    # Verify factory belongs to user's org
    result = await db.execute(
        select(Factory)
        .where(Factory.id == factory_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    factory = result.scalar_one_or_none()

    if not factory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factory not found",
        )

    # Build base query
    query = (
        select(ProductionLine)
        .where(ProductionLine.factory_id == factory_id)
        .where(ProductionLine.is_active)
    )

    # RBAC: Managers only see their assigned lines
    if current_user.role == UserRole.MANAGER:
        # Get line IDs assigned to this manager
        scope_result = await db.execute(
            select(UserScope.production_line_id)
            .where(UserScope.user_id == current_user.id)
            .where(UserScope.production_line_id.isnot(None))
        )
        allowed_line_ids = [row[0] for row in scope_result.fetchall()]
        
        # Filter to only allowed lines
        query = query.where(ProductionLine.id.in_(allowed_line_ids))

    # Execute query
    result = await db.execute(query.order_by(ProductionLine.name))
    lines = result.scalars().all()
    return lines


@router.post(
    "/{factory_id}/lines",
    response_model=ProductionLineRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_production_line(
    factory_id: str,
    line_data: ProductionLineCreate,
    current_user: ManagerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Create a new production line with quota enforcement.
    """
    # Verify factory ownership
    result = await db.execute(
        select(Factory)
        .where(Factory.id == factory_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    factory = result.scalar_one_or_none()

    if not factory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factory not found",
        )

    # Get organization quotas
    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    organization = org_result.scalar_one()

    # Count existing lines for this factory
    line_count_result = await db.execute(
        select(func.count(ProductionLine.id)).where(
            ProductionLine.factory_id == factory_id, ProductionLine.is_active
        )
    )
    existing_line_count = line_count_result.scalar()

    # Enforce quota
    if int(existing_line_count or 0) >= int(organization.max_lines_per_factory or 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "quota_exceeded",
                "message": f"Factory has reached maximum line limit ({organization.max_lines_per_factory})",
                "current_count": existing_line_count,
                "max_allowed": organization.max_lines_per_factory,
                "factory_id": factory_id,
                "upgrade_required": True,
            },
        )

    # Prepare settings (Snapshot Strategy)
    line_settings = {}

    # 1. Start with what was passed in request (if any)
    if line_data.settings:
        if hasattr(line_data.settings, "model_dump"):
            line_settings = line_data.settings.model_dump()
        else:
            line_settings = line_data.settings

    # 2. If NOT custom schedule, enforce snapshot of factory defaults
    is_custom = line_settings.get("is_custom_schedule", False)

    if not is_custom:
        # Get Factory Settings
        factory_settings = factory.settings or {}

        # Snapshot the defaults
        line_settings["is_custom_schedule"] = False
        line_settings["shift_pattern"] = factory_settings.get(
            "default_shift_pattern", []
        )
        line_settings["non_working_days"] = factory_settings.get(
            "standard_non_working_days", [5, 6]
        )

    # Create line
    line = ProductionLine(
        factory_id=factory_id,
        name=line_data.name,
        code=line_data.code,
        specialty=line_data.specialty,
        target_operators=line_data.target_operators,
        target_efficiency_pct=line_data.target_efficiency_pct,
        settings=line_settings,
    )
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return line


# Note: We register these under the main router but the path is /lines/{id},
# so we can't easily put them under /factories prefix unless we change the design.
# A better REST design would be /factories/{id}/lines/{line_id} OR just /lines/{line_id}.
# Given the router prefix is /factories, we can't easily handle /lines root here.
# But we can handle /lines operations if we change how they are registered or add a new router section.
# For now, to keep it simple, I will add them as /factories/lines/{line_id}
# OR I need to export a separate router for lines?
# Actually, I can just use the same router object.
# BUT the router is included with prefix "/factories".
# So `@router.get("/lines/{line_id}")` would become `/factories/lines/{line_id}`.
# This is acceptable functionality.


@router.get("/lines/{line_id}", response_model=ProductionLineRead)
async def get_production_line(
    line_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get a specific production line.
    Path: /factories/lines/{line_id}
    """
    result = await db.execute(
        select(ProductionLine)
        .join(Factory)
        .where(ProductionLine.id == line_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    line = result.scalar_one_or_none()

    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Production line not found",
        )

    return line


@router.patch("/lines/{line_id}", response_model=ProductionLineRead)
async def update_production_line(
    line_id: str,
    line_data: ProductionLineUpdate,
    current_user: ManagerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update a production line.
    Path: /factories/lines/{line_id}
    """
    result = await db.execute(
        select(ProductionLine)
        .join(Factory)
        .where(ProductionLine.id == line_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    line = result.scalar_one_or_none()

    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Production line not found",
        )

    update_data = line_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(line, field, value)

    await db.commit()
    await db.refresh(line)
    return line


@router.delete("/lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_production_line(
    line_id: str,
    current_user: ManagerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Soft-delete a production line.
    Path: /factories/lines/{line_id}
    """
    result = await db.execute(
        select(ProductionLine)
        .join(Factory)
        .where(ProductionLine.id == line_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    line = result.scalar_one_or_none()

    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Production line not found",
        )

    line.is_active = False
    await db.commit()
    return None
