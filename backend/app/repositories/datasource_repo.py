"""
DataSource Repository - Data Access Layer for Data Source Management.

Handles all database operations related to data sources and schema mappings.
"""

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.datasource import DataSource, SchemaMapping


class DataSourceRepository:
    """Repository for data source and schema mapping operations."""

    def __init__(self, db: AsyncSession):
        """
        Initialize the repository with a database session.

        Args:
            db: Async SQLAlchemy session
        """
        self.db = db

    async def get_by_id(self, datasource_id: str) -> DataSource | None:
        """
        Fetch a data source by ID with schema mappings loaded.

        Args:
            datasource_id: Data source UUID

        Returns:
            DataSource instance or None if not found
        """
        query = (
            select(DataSource)
            .options(selectinload(DataSource.schema_mappings))
            .where(DataSource.id == datasource_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_line(self, line_id: str) -> DataSource | None:
        """
        Fetch the data source for a specific production line.

        Args:
            line_id: Production line UUID

        Returns:
            DataSource instance or None if not found
        """
        query = (
            select(DataSource)
            .options(selectinload(DataSource.schema_mappings))
            .where(DataSource.production_line_id == line_id)
            .where(DataSource.is_active)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_all_for_line(
        self, line_id: str, include_inactive: bool = False
    ) -> list[DataSource]:
        """
        Fetch all data sources for a production line.

        Args:
            line_id: Production line UUID
            include_inactive: Whether to include inactive data sources

        Returns:
            List of DataSource instances
        """
        query = select(DataSource).where(DataSource.production_line_id == line_id)

        if not include_inactive:
            query = query.where(DataSource.is_active)

        query = query.order_by(desc(DataSource.created_at))

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_latest_for_line(self, line_id: str) -> DataSource | None:
        """
        Get the most recent active data source for a production line.

        Args:
            line_id: Production line UUID

        Returns:
            DataSource instance or None if not found
        """
        query = (
            select(DataSource)
            .options(selectinload(DataSource.schema_mappings))
            .where(DataSource.production_line_id == line_id)
            .where(DataSource.is_active)
            .order_by(desc(DataSource.created_at))
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create(self, datasource_data: dict) -> DataSource:
        """
        Create a new data source.

        Args:
            datasource_data: Dictionary containing data source fields

        Returns:
            Created DataSource instance

        Note:
            Caller is responsible for committing the transaction
        """
        datasource = DataSource(**datasource_data)
        self.db.add(datasource)
        await self.db.flush()
        return datasource

    async def delete(self, datasource_id: str) -> bool:
        """
        Delete a data source (cascade will handle schema mappings).

        Args:
            datasource_id: Data source UUID to delete

        Returns:
            True if deleted, False if not found

        Note:
            Caller is responsible for committing the transaction
        """
        datasource = await self.get_by_id(datasource_id)
        if not datasource:
            return False

        await self.db.delete(datasource)
        await self.db.flush()
        return True

    async def get_active_mapping(self, datasource_id: str) -> SchemaMapping | None:
        """
        Get the active schema mapping for a data source.

        Args:
            datasource_id: Data source UUID

        Returns:
            Active SchemaMapping instance or None
        """
        query = (
            select(SchemaMapping)
            .where(SchemaMapping.data_source_id == datasource_id)
            .where(SchemaMapping.is_active)
            .order_by(desc(SchemaMapping.version))
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_mapping(self, mapping_data: dict) -> SchemaMapping:
        """
        Create a new schema mapping.

        Args:
            mapping_data: Dictionary containing schema mapping fields

        Returns:
            Created SchemaMapping instance

        Note:
            Caller is responsible for committing the transaction
        """
        mapping = SchemaMapping(**mapping_data)
        self.db.add(mapping)
        await self.db.flush()
        return mapping

    async def deactivate_previous_mappings(self, datasource_id: str) -> None:
        """
        Deactivate all previous schema mappings for a data source.
        Used when creating a new active mapping.

        Args:
            datasource_id: Data source UUID

        Note:
            Caller is responsible for committing the transaction
        """
        query = (
            select(SchemaMapping)
            .where(SchemaMapping.data_source_id == datasource_id)
            .where(SchemaMapping.is_active)
        )
        result = await self.db.execute(query)
        mappings = result.scalars().all()

        for mapping in mappings:
            mapping.is_active = False

        await self.db.flush()
