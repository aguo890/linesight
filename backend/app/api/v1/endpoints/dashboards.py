"""
Dashboard API endpoints for managing user-created custom dashboards.
Provides CRUD operations and widget configuration management.
"""

import json
import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.enums import UserRole
from app.models import Dashboard, User, UserScope
from app.schemas.dashboard import (
    DashboardCreate,
    DashboardDetailResponse,
    DashboardListResponse,
    DashboardResponse,
    DashboardUpdate,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/", response_model=DashboardResponse, status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    dashboard_in: DashboardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new dashboard with widget configuration.

    - **name**: Dashboard name (required)
    - **description**: Optional description
    - **data_source_id**: Optional link to DataSource
    - **widget_config**: Widget configuration (enabled widgets + settings)
    - **layout_config**: Grid layout configuration
    """
    logger.info(
        f"Attempting to create dashboard for user {current_user.id}. Payload: {dashboard_in.model_dump()}"
    )

    # Validate data source if provided
    if dashboard_in.data_source_id:
        logger.info(f"Validating DataSource ID: {dashboard_in.data_source_id}")
        # Verify data source exists and belongs to user's organization
        # Verify data source exists and belongs to user's organization
        # We use a retry loop here to handle potential transaction visibility delays
        import asyncio

        from app.models.datasource import DataSource
        from app.models.factory import Factory

        max_retries = 3
        retry_delay = 0.1  # 100ms
        data_source = None

        for attempt in range(max_retries):
            result = await db.execute(
                select(DataSource)
                .join(Factory, DataSource.factory_id == Factory.id)
                .where(
                    DataSource.id == dashboard_in.data_source_id,
                    Factory.organization_id == current_user.organization_id,
                )
            )
            data_source = result.scalar_one_or_none()

            if data_source:
                logger.info(
                    f"DataSource {dashboard_in.data_source_id} found on attempt {attempt + 1}"
                )
                break

            logger.warning(
                f"DataSource {dashboard_in.data_source_id} NOT found on attempt {attempt + 1}. Retrying..."
            )
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)

        if not data_source:
            logger.error(
                f"DataSource {dashboard_in.data_source_id} lookup failed after {max_retries} attempts."
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Data source not found or you don't have access. This may be a timing issue if the data source was just created.",
            )

        # RBAC Check
        if current_user.role == UserRole.LINE_MANAGER:
            # Line Manager: Must be assigned to this specific line
            scope_check = await db.execute(
                select(UserScope).where(
                    UserScope.user_id == current_user.id,
                    UserScope.production_line_id == data_source.id
                )
            )
            if not scope_check.scalar_one_or_none():
                 raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Line Manager: You do not have permission for this production line."
                )
        elif current_user.role == UserRole.FACTORY_MANAGER:
            # Factory Manager: Must be assigned to the factory of this line
            # We have the Factory object joined in the query above (Factory.id)
            # data_source variable holds the result which is just DataSource object?
            # Wait, the query (lines 65-75) selects DataSource but joins Factory.
            # Does result.scalar_one_or_none() return just DataSource? Yes.
            # So we don't have Factory.id easily unless we explicitly select it or access via relationship?
            # Relationships might not be loaded.
            # But we filtered by Factory.organization_id.
            
            # Let's check UserScope for this factory.
            # We explicitly fetch the line -> factory relationship to be safe.
            scope_check = await db.execute(
                select(UserScope).where(
                    UserScope.user_id == current_user.id,
                    UserScope.factory_id == data_source.factory_id
                )
            )
            if not scope_check.scalar_one_or_none():
                 raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Factory Manager: You do not have permission for this factory."
                )

    try:
        # Create dashboard
        dashboard = Dashboard(
            user_id=current_user.id,
            name=dashboard_in.name,
            description=dashboard_in.description,
            data_source_id=dashboard_in.data_source_id,
            widget_config=json.dumps(dashboard_in.widget_config.model_dump())
            if dashboard_in.widget_config
            else None,
            layout_config=json.dumps(dashboard_in.layout_config.model_dump())
            if dashboard_in.layout_config
            else None,
        )

        db.add(dashboard)
        await db.commit()
        await db.refresh(dashboard)

        logger.info(f"Dashboard created successfully with ID: {dashboard.id}")
        return dashboard

    except Exception as e:
        logger.error(f"DB Error creating dashboard: {str(e)}")
        logger.error(traceback.format_exc())
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during dashboard creation: {str(e)}",
        ) from e


# I am not sure how to do it like, basically this needs to be the CEO view. What does the ceo want to see?
@router.get("/", response_model=DashboardListResponse)
async def list_dashboards(
    factory_id: str | None = Query(None, description="Filter dashboards by factory"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all dashboards for the current user.
    Returns dashboards ordered by most recently updated.
    Optional filtering by factory_id.
    """
    from app.models.datasource import DataSource
    from app.models.factory import Factory

    logger.debug(f"Dashboard list requested. factory_id={factory_id}, user_id={current_user.id}, role={current_user.role}")

    try:
        # Start with base query
        stmt = select(Dashboard).where(Dashboard.user_id == current_user.id)
        
        # Track if we've joined DataSource to avoid duplicate joins
        datasource_joined = False

        # Factory filter - always requires joining DataSource -> Factory
        if factory_id:
            logger.debug("Applying factory_id filter")
            stmt = (
                stmt.join(DataSource, Dashboard.data_source_id == DataSource.id)
                .join(Factory, DataSource.factory_id == Factory.id)
                .where(Factory.id == factory_id)
            )
            datasource_joined = True

        # RBAC: Managers only see dashboards for lines they are assigned to
        if current_user.role == UserRole.LINE_MANAGER:
            logger.debug("Applying LINE_MANAGER RBAC filter")
            # Line Manager: filter by assigned lines
            scope_query = select(UserScope.production_line_id).where(
                UserScope.user_id == current_user.id,
                UserScope.production_line_id.isnot(None)
            )
            scope_result = await db.execute(scope_query)
            allowed_ids = [row[0] for row in scope_result.fetchall()]

            # Only join DataSource if NOT already joined
            if not datasource_joined:
                stmt = stmt.outerjoin(DataSource, Dashboard.data_source_id == DataSource.id)
            
            stmt = stmt.where(
                (Dashboard.data_source_id.is_(None)) | 
                (DataSource.id.in_(allowed_ids))
            )
            
        elif current_user.role == UserRole.FACTORY_MANAGER:
            logger.debug("Applying FACTORY_MANAGER RBAC filter")
            # Factory Manager: filter by assigned factories
            factory_scope_query = select(UserScope.factory_id).where(
                UserScope.user_id == current_user.id
            )
            scope_result = await db.execute(factory_scope_query)
            allowed_factory_ids = [row[0] for row in scope_result.fetchall()]

            if factory_id:
                # If factory_id IS provided, check if that factory_id is allowed
                if factory_id not in allowed_factory_ids:
                    # Return empty if requested factory is not allowed
                    return {"dashboards": [], "count": 0}
            else:
                # No factory_id filter - join DataSource if not already joined
                if not datasource_joined:
                    stmt = stmt.outerjoin(DataSource, Dashboard.data_source_id == DataSource.id)
                
                stmt = stmt.where(
                    (Dashboard.data_source_id.is_(None)) | 
                    (DataSource.factory_id.in_(allowed_factory_ids))
                )

        stmt = stmt.order_by(Dashboard.updated_at.desc())

        result = await db.execute(stmt)
        dashboards = result.scalars().all()
        logger.debug(f"Found {len(dashboards)} dashboards")
        return {
            "dashboards": dashboards,
            "count": len(dashboards),
        }

    except Exception as e:
        # 2. TRAP: Catch the crash and force it to print FULL details to the terminal
        print("\n❌ CRITICAL EXCEPTION CAUGHT ❌", file=sys.stderr)
        print(f"Error Type: {type(e).__name__}", file=sys.stderr)
        print(f"Error Message: {str(e)}", file=sys.stderr)
        print("--- STACK TRACE ---", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        print("-------------------", file=sys.stderr)
        
        # Re-raise so the 500 error still happens (we just wanted to read it)
        raise HTTPException(status_code=500, detail=str(e))


# Proably needs to update/refactored since we need to make sure that the root dashboard isnt
# just 1 single production line, its an overall view of all factories and lines, still dont know how am going to do that
@router.get("/{dashboard_id}", response_model=DashboardDetailResponse)
async def get_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific dashboard with widget data.

    Returns the dashboard configuration plus actual widget data
    fetched from the linked data source, including production line ID for filtering.
    """
    # Using selectinload for async loading of relationships
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.data_source))
        .where(Dashboard.id == dashboard_id, Dashboard.user_id == current_user.id)
    )
    dashboard = result.scalar_one_or_none()

    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found"
        )

    # Get production_line_id from data_source if it exists
    production_line_id = None
    if dashboard.data_source:
        production_line_id = dashboard.data_source.id

    # RBAC Reference Check
    if production_line_id:
        if current_user.role == UserRole.LINE_MANAGER:
            scope_check = await db.execute(
                select(UserScope).where(
                    UserScope.user_id == current_user.id,
                    UserScope.production_line_id == production_line_id
                )
            )
            if not scope_check.scalar_one_or_none():
                 raise HTTPException(status_code=403, detail="Forbidden")
        
        elif current_user.role == UserRole.FACTORY_MANAGER:
            scope_check = await db.execute(
                select(UserScope).where(
                    UserScope.user_id == current_user.id,
                    UserScope.factory_id == dashboard.data_source.factory_id
                )
            )
            if not scope_check.scalar_one_or_none():
                 raise HTTPException(status_code=403, detail="Forbidden")

    # TODO: Fetch actual widget data from data source
    # This will be implemented when we build the widget data fetcher
    widget_data = {"production_line_id": production_line_id}

    return DashboardDetailResponse(
        id=dashboard.id,
        user_id=dashboard.user_id,
        name=dashboard.name,
        description=dashboard.description,
        data_source_id=dashboard.data_source_id,
        widget_config=dashboard.widget_config,
        layout_config=dashboard.layout_config,
        created_at=dashboard.created_at,
        updated_at=dashboard.updated_at,
        widget_data=widget_data,
    )


@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: str,
    dashboard_in: DashboardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update dashboard configuration.

    Allows updating name, description, data source, widget config, and layout.
    Only provided fields will be updated.
    """
    result = await db.execute(
        select(Dashboard).where(
            Dashboard.id == dashboard_id, Dashboard.user_id == current_user.id
        )
    )
    dashboard = result.scalar_one_or_none()

    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found"
        )

    # Validate data source if being updated
    if dashboard_in.data_source_id is not None:
        from app.models.datasource import DataSource
        from app.models.factory import Factory

        ds_result = await db.execute(
            select(DataSource)
            .join(Factory, DataSource.factory_id == Factory.id)
            .where(
                DataSource.id == dashboard_in.data_source_id,
                Factory.organization_id == current_user.organization_id,
            )
        )
        data_source = ds_result.scalar_one_or_none()

        if not data_source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Data source not found or you don't have access",
            )

        # RBAC Check
        if current_user.role == UserRole.LINE_MANAGER:
            scope_check = await db.execute(
                select(UserScope).where(
                    UserScope.user_id == current_user.id,
                    UserScope.production_line_id == data_source.id
                )
            )
            if not scope_check.scalar_one_or_none():
                 raise HTTPException(status_code=403, detail="Forbidden")
        elif current_user.role == UserRole.FACTORY_MANAGER:
            # Check factory access (DataSource -> Factory)
            # data_source query above joined Factory already?
            # Yes: join(Factory, DataSource.factory_id == Factory.id)
            # But did we select Factory? select(DataSource).join(...)
            # We can re-fetch or assume validation logic similar to create.
            # Simplified:
            scope_check = await db.execute(
                select(UserScope).where(
                    UserScope.user_id == current_user.id,
                    UserScope.factory_id == data_source.factory_id
                )
            )
            if not scope_check.scalar_one_or_none():
                 raise HTTPException(status_code=403, detail="Forbidden")

    # Update fields
    update_data = dashboard_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "widget_config" and value is not None:
            # Widget config might also suffer from double dump if not careful, applying same pattern
            if isinstance(value, dict):
                setattr(dashboard, field, json.dumps(value))
            else:
                # It might still be a Pydantic model at this point if model_dump didn't recurse fully?
                # dashboard_in.model_dump() usually recurses.
                # Let's stick to the requested fix specifically for layout_config but also be safe for widget_config
                # The user only provided fix for layout_config but consistency is good.
                # However, I will strictly follow the user request for layout_config to be safe.
                # Actually, dashboard_in.model_dump() makes everything dicts.
                # The original code called value.model_dump() which failed because value was a dict.

                try:
                    setattr(dashboard, field, json.dumps(value.model_dump()))
                except AttributeError:
                    setattr(dashboard, field, json.dumps(value))

        elif field == "layout_config" and value is not None:
            # If value is already a dict (from model_dump), just stringify it
            # If it's already a string (from frontend JSON.stringify), use it as is
            if isinstance(value, dict):
                setattr(dashboard, field, json.dumps(value))
            else:
                setattr(dashboard, field, str(value))
        else:
            setattr(dashboard, field, value)

    await db.commit()
    await db.refresh(dashboard)

    return dashboard


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a dashboard.

    This will remove the dashboard but not the linked data source.
    """
    result = await db.execute(
        select(Dashboard).where(
            Dashboard.id == dashboard_id, Dashboard.user_id == current_user.id
        )
    )
    dashboard = result.scalar_one_or_none()

    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found"
        )

    await db.delete(dashboard)
    await db.commit()

    return None
