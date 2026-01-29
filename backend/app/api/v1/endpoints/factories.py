"""
Factory endpoints for LineSight.
CRUD operations for factories and data sources (formerly production lines).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, ManagerUser, get_db
from app.enums import UserRole
from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.user import Organization, UserScope
from app.schemas.datasource import (
    DataSourceCreate,
    DataSourceRead,
    DataSourceUpdate,
)
from app.schemas.factory import (
    FactoryCreate,
    FactoryRead,
    FactoryUpdate,
    FactoryWithDataSources,
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

    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.OWNER, UserRole.FACTORY_MANAGER]:
        # Get factory IDs from user's scope assignments
        scope_query = select(UserScope.factory_id).where(
            UserScope.user_id == current_user.id
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


@router.get("/{factory_id}", response_model=FactoryWithDataSources)
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
        .options(selectinload(Factory.data_sources))
        .where(Factory.id == factory_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    factory = result.scalar_one_or_none()

    if not factory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factory not found",
        )

    # RBAC: Filter data sources for LINE_MANAGER (Factory Manager sees all)
    if current_user.role == UserRole.LINE_MANAGER:
        # Get data source IDs assigned to this manager
        scope_result = await db.execute(
            select(UserScope.data_source_id)
            .where(UserScope.user_id == current_user.id)
            .where(UserScope.data_source_id.isnot(None))
        )
        allowed_ds_ids = {row[0] for row in scope_result.fetchall()}

        # Filter data_sources to only allowed ones
        factory.data_sources = [
            ds for ds in factory.data_sources
            if ds.id in allowed_ds_ids and ds.is_active
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

    # Cascade soft delete to data sources
    await db.execute(
        update(DataSource)
        .where(DataSource.factory_id == factory_id)
        .values(is_active=False)
    )

    await db.commit()
    return None


# =============================================================================
# Data Source Endpoints (formerly Production Lines)
# =============================================================================


@router.get("/{factory_id}/data-sources", response_model=list[DataSourceRead])
async def list_data_sources(
    factory_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get data sources for a factory.

    RBAC Filtering:
    - SYSTEM_ADMIN/OWNER: See all data sources in the factory
    - MANAGER: Only see data sources assigned via UserScope
    - ANALYST/VIEWER: See all data sources (read-only)
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
        select(DataSource)
        .where(DataSource.factory_id == factory_id)
        .where(DataSource.is_active)
    )

    # RBAC: Line Managers only see their assigned data sources
    if current_user.role == UserRole.LINE_MANAGER:
        # Get data source IDs assigned to this manager
        scope_result = await db.execute(
            select(UserScope.data_source_id)
            .where(UserScope.user_id == current_user.id)
            .where(UserScope.data_source_id.isnot(None))
        )
        allowed_ds_ids = [row[0] for row in scope_result.fetchall()]

        # Filter to only allowed data sources
        query = query.where(DataSource.id.in_(allowed_ds_ids))

    # Execute query
    result = await db.execute(query.order_by(DataSource.name))
    data_sources = result.scalars().all()
    return data_sources


@router.post(
    "/{factory_id}/data-sources",
    response_model=DataSourceRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_data_source(
    factory_id: str,
    ds_data: DataSourceCreate,
    current_user: ManagerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Create a new data source with quota enforcement.
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

    # Count existing data sources for this factory
    ds_count_result = await db.execute(
        select(func.count(DataSource.id)).where(
            DataSource.factory_id == factory_id, DataSource.is_active
        )
    )
    existing_ds_count = ds_count_result.scalar()

    # Enforce quota (max_lines_per_factory applies to data sources now)
    if int(existing_ds_count or 0) >= int(organization.max_lines_per_factory or 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "quota_exceeded",
                "message": f"Factory has reached maximum data source limit ({organization.max_lines_per_factory})",
                "current_count": existing_ds_count,
                "max_allowed": organization.max_lines_per_factory,
                "factory_id": factory_id,
                "upgrade_required": True,
            },
        )

    # Prepare settings (Snapshot Strategy)
    ds_settings = {}

    # 1. Start with what was passed in request (if any)
    if ds_data.settings:
        if hasattr(ds_data.settings, "model_dump"):
            ds_settings = ds_data.settings.model_dump()
        else:
            ds_settings = ds_data.settings

    # 2. If NOT custom schedule, enforce snapshot of factory defaults
    is_custom = ds_settings.get("is_custom_schedule", False)

    if not is_custom:
        # Get Factory Settings
        factory_settings = factory.settings or {}

        # Snapshot the defaults
        ds_settings["is_custom_schedule"] = False
        ds_settings["shift_pattern"] = factory_settings.get(
            "default_shift_pattern", []
        )
        ds_settings["non_working_days"] = factory_settings.get(
            "standard_non_working_days", [5, 6]
        )

    # Create data source
    data_source = DataSource(
        factory_id=factory_id,
        name=ds_data.name,
        code=ds_data.code,
        specialty=ds_data.specialty,
        target_operators=ds_data.target_operators,
        target_efficiency_pct=ds_data.target_efficiency_pct,
        settings=ds_settings,
        source_name=ds_data.source_name,
        description=ds_data.description,
        time_column=ds_data.time_column,
        time_format=ds_data.time_format,
    )
    db.add(data_source)
    await db.commit()
    await db.refresh(data_source)
    return data_source


# Note: Data source CRUD by ID uses /data-sources/{id} path
# The router prefix is /factories so full path is /factories/data-sources/{ds_id}


@router.get("/data-sources/{ds_id}", response_model=DataSourceRead)
async def get_data_source(
    ds_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get a specific data source.
    Path: /factories/data-sources/{ds_id}
    """
    result = await db.execute(
        select(DataSource)
        .join(Factory)
        .where(DataSource.id == ds_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    data_source = result.scalar_one_or_none()

    if not data_source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data source not found",
        )

    return data_source


@router.patch("/data-sources/{ds_id}", response_model=DataSourceRead)
async def update_data_source(
    ds_id: str,
    ds_data: DataSourceUpdate,
    current_user: ManagerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update a data source.
    Path: /factories/data-sources/{ds_id}
    """
    result = await db.execute(
        select(DataSource)
        .join(Factory)
        .where(DataSource.id == ds_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    data_source = result.scalar_one_or_none()

    if not data_source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data source not found",
        )

    update_data = ds_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(data_source, field, value)

    await db.commit()
    await db.refresh(data_source)
    return data_source


@router.delete("/data-sources/{ds_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(
    ds_id: str,
    current_user: ManagerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Soft-delete a data source.
    Path: /factories/data-sources/{ds_id}
    """
    result = await db.execute(
        select(DataSource)
        .join(Factory)
        .where(DataSource.id == ds_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    data_source = result.scalar_one_or_none()

    if not data_source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data source not found",
        )

    data_source.is_active = False
    await db.commit()
    return None
