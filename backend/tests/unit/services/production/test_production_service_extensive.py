# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Production Service Extensive Tests
Sweeps the missing 62% in production_service.py.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.production import Order, ProductionRun, Style
from app.schemas.production import (
    OrderCreate,
    OrderUpdate,
    ProductionRunCreate,
    ProductionRunUpdate,
    StyleCreate,
    StyleUpdate,
)
from app.services.production.production_service import ProductionService


@pytest.fixture
async def production_service(db_session: AsyncSession):
    return ProductionService(db_session)


@pytest.fixture
async def test_style(db_session: AsyncSession, test_factory):
    style = Style(
        factory_id=test_factory.id,
        style_number="TEST-001",
        base_sam=Decimal("10.0"),
    )
    db_session.add(style)
    await db_session.commit()
    await db_session.refresh(style)
    return style


@pytest.fixture
async def test_order(db_session: AsyncSession, test_style):
    order = Order(
        style_id=test_style.id,
        po_number="PO-TEST-001",
        quantity=1000,
        status="pending",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)
    return order


@pytest.fixture
async def test_line(db_session: AsyncSession, test_factory):
    line = DataSource(
        factory_id=test_factory.id,
        name="Test Line",
        code="TL-001",
        is_active=True,
    )
    db_session.add(line)
    await db_session.commit()
    await db_session.refresh(line)
    return line


class TestStyleService:
    """Test Style CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_style_success(self, production_service, test_factory):
        """Test creating a style successfully."""
        style_in = StyleCreate(
            factory_id=test_factory.id,
            style_number="STYLE-NEW-001",
            base_sam=Decimal("15.0"),
        )

        style = await production_service.create_style(style_in)

        assert style.style_number == "STYLE-NEW-001"
        assert style.base_sam == Decimal("15.0")

    @pytest.mark.asyncio
    async def test_create_style_factory_not_found(self, production_service):
        """Test creating a style with non-existent factory raises 404."""
        style_in = StyleCreate(
            factory_id="non-existent-factory-id",
            style_number="STYLE-NEW-001",
            base_sam=Decimal("15.0"),
        )

        with pytest.raises(HTTPException) as exc_info:
            await production_service.create_style(style_in)

        assert exc_info.value.status_code == 404
        assert "Factory not found" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_get_style_success(self, production_service, test_style):
        """Test getting a style by ID."""
        style = await production_service.get_style(test_style.id)
        assert style.id == test_style.id

    @pytest.mark.asyncio
    async def test_get_style_not_found(self, production_service):
        """Test getting a non-existent style raises 404."""
        with pytest.raises(HTTPException) as exc_info:
            await production_service.get_style("non-existent-id")

        assert exc_info.value.status_code == 404
        assert "Style not found" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_update_style_success(self, production_service, test_style):
        """Test updating a style."""
        style_in = StyleUpdate(base_sam=Decimal("20.0"))

        style = await production_service.update_style(test_style.id, style_in)

        assert style.base_sam == Decimal("20.0")

    @pytest.mark.asyncio
    async def test_update_style_not_found(self, production_service):
        """Test updating non-existent style raises 404."""
        style_in = StyleUpdate(base_sam=Decimal("20.0"))

        with pytest.raises(HTTPException) as exc_info:
            await production_service.update_style("non-existent-id", style_in)

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_style(self, production_service, test_style):
        """Test deleting a style."""
        await production_service.delete_style(test_style.id)

        # Verify it's gone
        with pytest.raises(HTTPException):
            await production_service.get_style(test_style.id)

    @pytest.mark.asyncio
    async def test_list_runs_with_filters(
        self, production_service, test_order, test_line, test_factory
    ):
        """Test listing runs with filters."""
        # Create a run first
        today = date.today()
        run_in = ProductionRunCreate(
            order_id=test_order.id,
            data_source_id=test_line.id,
            factory_id=test_factory.id,
            production_date=today,
            planned_qty=100,
            actual_qty=90,
            operators_present=5,
            worked_minutes=Decimal("480"),
        )
        await production_service.create_run(run_in)

        # List with date filter
        runs = await production_service.list_runs(date_from=today, date_to=today)
        assert len(runs) >= 1

    @pytest.mark.asyncio
    async def test_list_runs_with_filters(
        self, production_service, test_order, test_line, test_factory
    ):
        """Test listing runs with filters."""
        # Create a run first
        today = date.today()
        run_in = ProductionRunCreate(
            order_id=test_order.id,
            data_source_id=test_line.id,
            factory_id=test_factory.id,
            production_date=today,
            planned_qty=100,
            actual_qty=90,
            operators_present=5,
            worked_minutes=Decimal("480"),
        )
        await production_service.create_run(run_in)

        # List with date filter
        runs = await production_service.list_runs(date_from=today, date_to=today)
        assert len(runs) >= 1
