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
from app.models import Dashboard, User
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
        from app.models.factory import Factory, ProductionLine

        max_retries = 3
        retry_delay = 0.1  # 100ms
        data_source = None

        for attempt in range(max_retries):
            result = await db.execute(
                select(DataSource)
                .join(
                    ProductionLine, DataSource.production_line_id == ProductionLine.id
                )
                .join(Factory, ProductionLine.factory_id == Factory.id)
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
    stmt = select(Dashboard).where(Dashboard.user_id == current_user.id)

    if factory_id:
        from app.models.datasource import DataSource
        from app.models.factory import Factory, ProductionLine

        stmt = (
            stmt.join(DataSource, Dashboard.data_source_id == DataSource.id)
            .join(ProductionLine, DataSource.production_line_id == ProductionLine.id)
            .join(Factory, ProductionLine.factory_id == Factory.id)
            .where(Factory.id == factory_id)
        )

    stmt = stmt.order_by(Dashboard.updated_at.desc())

    result = await db.execute(stmt)
    dashboards = result.scalars().all()

    return {
        "dashboards": dashboards,
        "count": len(dashboards),
    }


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
        production_line_id = dashboard.data_source.production_line_id

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
        from app.models.factory import Factory, ProductionLine

        ds_result = await db.execute(
            select(DataSource)
            .join(ProductionLine, DataSource.production_line_id == ProductionLine.id)
            .join(Factory, ProductionLine.factory_id == Factory.id)
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
