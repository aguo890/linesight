# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_db
from app.schemas.production import (
    OrderCreate,
    OrderRead,
    OrderUpdate,
    ProductionRunCreate,
    ProductionRunRead,
    ProductionRunUpdate,
    StyleCreate,
    StyleRead,
    StyleUpdate,
)
from app.services.production.production_service import ProductionService

router = APIRouter()

# =============================================================================
# Styles Endpoints
# =============================================================================


@router.get("/styles", response_model=list[StyleRead], tags=["Styles"])
async def list_styles(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    factory_id: str | None = None,
    buyer: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """List styles."""
    service = ProductionService(db)
    return await service.list_styles(factory_id, buyer, skip, limit)


@router.post(
    "/styles",
    response_model=StyleRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Styles"],
)
async def create_style(
    style_in: StyleCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new style."""
    service = ProductionService(db)
    return await service.create_style(style_in)


@router.get("/styles/{style_id}", response_model=StyleRead, tags=["Styles"])
async def get_style(
    style_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get style details."""
    service = ProductionService(db)
    return await service.get_style(style_id)


@router.patch("/styles/{style_id}", response_model=StyleRead, tags=["Styles"])
async def update_style(
    style_id: str,
    style_in: StyleUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update a style."""
    service = ProductionService(db)
    return await service.update_style(style_id, style_in)


# =============================================================================
# Orders Endpoints
# =============================================================================


@router.get("/orders", response_model=list[OrderRead], tags=["Orders"])
async def list_orders(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    style_id: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """List orders."""
    service = ProductionService(db)
    return await service.list_orders(style_id, status, skip, limit)


@router.post(
    "/orders",
    response_model=OrderRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Orders"],
)
async def create_order(
    order_in: OrderCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new order."""
    service = ProductionService(db)
    return await service.create_order(order_in)


@router.get("/orders/{order_id}", response_model=OrderRead, tags=["Orders"])
async def get_order(
    order_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get order details."""
    service = ProductionService(db)
    return await service.get_order(order_id)


@router.patch("/orders/{order_id}", response_model=OrderRead, tags=["Orders"])
async def update_order(
    order_id: str,
    order_in: OrderUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update an order."""
    service = ProductionService(db)
    return await service.update_order(order_id, order_in)


# =============================================================================
# Production Runs Endpoints
# =============================================================================


@router.get("/runs", response_model=list[ProductionRunRead], tags=["Production Runs"])
async def list_runs(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    order_id: str | None = None,
    line_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    skip: int = 0,
    limit: int = 1000,  # Increased default limit for charts
    sort_asc: bool = False,
) -> Any:
    """List production runs."""
    service = ProductionService(db)
    return await service.list_runs(
        order_id, line_id, date_from, date_to, skip, limit, sort_asc
    )


@router.post(
    "/runs",
    response_model=ProductionRunRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Production Runs"],
)
async def create_run(
    run_in: ProductionRunCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new production run."""
    service = ProductionService(db)
    return await service.create_run(run_in)


@router.get(
    "/runs/{run_id}", response_model=ProductionRunRead, tags=["Production Runs"]
)
async def get_run(
    run_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get production run details."""
    service = ProductionService(db)
    return await service.get_run(run_id)


@router.patch(
    "/runs/{run_id}", response_model=ProductionRunRead, tags=["Production Runs"]
)
async def update_run(
    run_id: str,
    run_in: ProductionRunUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update a production run."""
    service = ProductionService(db)
    return await service.update_run(run_id, run_in)


@router.delete(
    "/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Production Runs"]
)
async def delete_run(
    run_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a production run."""
    service = ProductionService(db)
    await service.delete_run(run_id)
    return None


@router.delete(
    "/styles/{style_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Styles"]
)
async def delete_style(
    style_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a style."""
    service = ProductionService(db)
    await service.delete_style(style_id)
    return None


@router.delete(
    "/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Orders"]
)
async def delete_order(
    order_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an order."""
    service = ProductionService(db)
    await service.delete_order(order_id)
    return None
