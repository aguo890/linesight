# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Dashboard Repository - Data Access Layer for Dashboard Management.

Handles all database operations related to user dashboards.
"""

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ProductionLine  # Alias for DataSource
from app.models.dashboard import Dashboard
from app.models.datasource import DataSource


class DashboardRepository:
    """Repository for dashboard operations."""

    def __init__(self, db: AsyncSession):
        """
        Initialize the repository with a database session.

        Args:
            db: Async SQLAlchemy session
        """
        self.db = db

    async def get_by_id(self, dashboard_id: str) -> Dashboard | None:
        """
        Get a dashboard by ID with data source loaded.

        Args:
            dashboard_id: Dashboard UUID

        Returns:
            Dashboard instance or None if not found
        """
        query = (
            select(Dashboard)
            .options(selectinload(Dashboard.data_source))
            .where(Dashboard.id == dashboard_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_user(self, user_id: str) -> list[Dashboard]:
        """
        Get all dashboards for a specific user.

        Args:
            user_id: User UUID

        Returns:
            List of Dashboard instances
        """
        query = (
            select(Dashboard)
            .options(selectinload(Dashboard.data_source))
            .where(Dashboard.user_id == user_id)
            .order_by(Dashboard.created_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_factory(self, factory_id: str, user_id: str) -> list[Dashboard]:
        """
        Get all dashboards for a specific factory.

        This joins Dashboard -> DataSource -> ProductionLine -> Factory
        to filter dashboards by factory.

        Args:
            factory_id: Factory UUID
            user_id: User UUID (to ensure user has access)

        Returns:
            List of Dashboard instances
        """
        query = (
            select(Dashboard)
            .join(DataSource, Dashboard.data_source_id == DataSource.id)
            .join(ProductionLine, DataSource.production_line_id == ProductionLine.id)
            .where(
                and_(
                    ProductionLine.factory_id == factory_id,
                    Dashboard.user_id == user_id,
                )
            )
            .options(selectinload(Dashboard.data_source))
            .order_by(Dashboard.created_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(self, dashboard_data: dict) -> Dashboard:
        """
        Create a new dashboard.

        Args:
            dashboard_data: Dictionary containing dashboard fields

        Returns:
            Created Dashboard instance

        Note:
            Caller is responsible for committing the transaction
        """
        dashboard = Dashboard(**dashboard_data)
        self.db.add(dashboard)
        await self.db.flush()
        return dashboard

    async def update(self, dashboard_id: str, updates: dict) -> Dashboard | None:
        """
        Update a dashboard's fields.

        Args:
            dashboard_id: Dashboard UUID
            updates: Dictionary of fields to update

        Returns:
            Updated Dashboard instance or None if not found

        Note:
            Caller is responsible for committing the transaction
        """
        dashboard = await self.get_by_id(dashboard_id)
        if not dashboard:
            return None

        for key, value in updates.items():
            if hasattr(dashboard, key):
                setattr(dashboard, key, value)

        await self.db.flush()
        return dashboard

    async def delete(self, dashboard_id: str) -> bool:
        """
        Delete a dashboard.

        Args:
            dashboard_id: Dashboard UUID

        Returns:
            True if deleted, False if not found

        Note:
            Caller is responsible for committing the transaction
        """
        dashboard = await self.get_by_id(dashboard_id)
        if not dashboard:
            return False

        await self.db.delete(dashboard)
        await self.db.flush()
        return True

    async def exists_for_datasource(self, datasource_id: str) -> bool:
        """
        Check if any dashboards exist for a given data source.

        Args:
            datasource_id: DataSource UUID

        Returns:
            True if dashboards exist, False otherwise
        """
        query = (
            select(Dashboard.id)
            .where(Dashboard.data_source_id == datasource_id)
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None
