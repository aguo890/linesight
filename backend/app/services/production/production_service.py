# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from datetime import date

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProductionLine  # Alias for DataSource
from app.models.factory import Factory
from app.models.production import Order, ProductionRun, Style
from app.repositories.production_repo import ProductionRepository
from app.schemas.production import (
    OrderCreate,
    OrderUpdate,
    ProductionRunCreate,
    ProductionRunUpdate,
    StyleCreate,
    StyleUpdate,
)


class ProductionService:
    """
    Service layer for Production domain.
    Orchestrates business logic and data access.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProductionRepository(db)

    # =============================================================================
    # Styles Logic
    # =============================================================================

    async def list_styles(
        self,
        factory_id: str | None = None,
        buyer: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Style]:
        return await self.repo.get_styles(factory_id, buyer, skip, limit)

    async def create_style(self, style_in: StyleCreate) -> Style:
        # Verify factory exists
        factory = await self.db.get(Factory, style_in.factory_id)
        if not factory:
            raise HTTPException(status_code=404, detail="Factory not found")

        style = await self.repo.create_style(style_in.model_dump())
        await self.db.commit()
        await self.db.refresh(style)
        return style

    async def get_style(self, style_id: str) -> Style:
        style = await self.repo.get_style_by_id(style_id)
        if not style:
            raise HTTPException(status_code=404, detail="Style not found")
        return style

    async def update_style(self, style_id: str, style_in: StyleUpdate) -> Style:
        await self.get_style(style_id)  # Ensure existence

        update_data = style_in.model_dump(exclude_unset=True)
        updated_style = await self.repo.update_style(style_id, update_data)
        if not updated_style:
            raise HTTPException(status_code=404, detail="Style not found after update")
        await self.db.commit()
        await self.db.refresh(updated_style)
        return updated_style

    async def delete_style(self, style_id: str) -> None:
        await self.get_style(style_id)  # Ensure existence
        await self.repo.delete_style(style_id)
        await self.db.commit()

    # =============================================================================
    # Orders Logic
    # =============================================================================

    async def list_orders(
        self,
        style_id: str | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Order]:
        return await self.repo.get_orders(style_id, status, skip, limit)

    async def create_order(self, order_in: OrderCreate) -> Order:
        # Verify style exists
        style = await self.db.get(Style, order_in.style_id)
        if not style:
            raise HTTPException(status_code=404, detail="Style not found")

        order = await self.repo.create_order(order_in.model_dump())
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def get_order(self, order_id: str) -> Order:
        order = await self.repo.get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return order

    async def update_order(self, order_id: str, order_in: OrderUpdate) -> Order:
        await self.get_order(order_id)  # Ensure existence

        update_data = order_in.model_dump(exclude_unset=True)
        updated_order = await self.repo.update_order(order_id, update_data)
        if not updated_order:
            raise HTTPException(status_code=404, detail="Order not found after update")
        await self.db.commit()
        await self.db.refresh(updated_order)
        return updated_order

    async def delete_order(self, order_id: str) -> None:
        await self.get_order(order_id)  # Ensure existence
        await self.repo.delete_order(order_id)
        await self.db.commit()

    # =============================================================================
    # Production Runs Logic
    # =============================================================================

    async def list_runs(
        self,
        order_id: str | None = None,
        line_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        skip: int = 0,
        limit: int = 1000,
        sort_asc: bool = False,
    ) -> list[ProductionRun]:
        return await self.repo.get_runs_filtered(
            order_id, line_id, date_from, date_to, skip, limit, sort_asc
        )

    async def create_run(self, run_in: ProductionRunCreate) -> ProductionRun:
        # Verify order exists
        order = await self.db.get(Order, run_in.order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Verify line exists (DataSource)
        line = await self.db.get(ProductionLine, run_in.data_source_id)
        if not line:
            raise HTTPException(status_code=404, detail="Production Line not found")

        run_data = run_in.model_dump()
        # Remove computed fields that don't have setters or shouldn't be set directly
        for field in ["efficiency", "earned_minutes"]:
            run_data.pop(field, None)

        run = await self.repo.create_run(run_data)
        await self.db.commit()

        # Re-fetch instead of refresh to avoid SQLite computed column deadlock possibility
        # relying on repo to get by ID
        return await self.get_run(run.id)

    async def get_run(self, run_id: str) -> ProductionRun:
        run = await self.repo.get_run_by_id(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Production Run not found")
        return run

    async def update_run(
        self, run_id: str, run_in: ProductionRunUpdate
    ) -> ProductionRun:
        await self.get_run(run_id)  # Ensure existence

        update_data = run_in.model_dump(exclude_unset=True)
        updated_run = await self.repo.update_run(run_id, update_data)
        if not updated_run:
            raise HTTPException(status_code=404, detail="Run not found after update")
        await self.db.commit()
        await self.db.refresh(updated_run)
        return updated_run

    async def delete_run(self, run_id: str) -> None:
        await self.get_run(run_id)  # Ensure existence
        await self.repo.delete_run(run_id)
        await self.db.commit()
