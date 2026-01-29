"""
DataSource and SchemaMapping API endpoints.
Manages production line data sources and AI-generated column mappings.
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import ProductionLine  # Alias for DataSource
from app.models.datasource import DataSource, SchemaMapping
from app.models.factory import Factory
from app.models.user import User

router = APIRouter()


# Pydantic Schemas
class SchemaMappingCreate(BaseModel):
    column_map: dict = Field(
        ..., description="Mapping from Excel columns to internal fields"
    )
    extraction_rules: dict | None = Field(
        None, description="Parsing rules (skip_rows, header_row, etc.)"
    )
    reviewed_by_user: bool = Field(
        False, description="Whether user has validated this mapping"
    )
    user_notes: str | None = None


class SchemaMappingResponse(BaseModel):
    id: str
    version: int
    is_active: bool
    column_map: dict[str, Any]  # JSON type returns dict directly
    extraction_rules: dict[str, Any] | None
    reviewed_by_user: bool
    user_notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DataSourceCreate(BaseModel):
    production_line_id: str
    source_name: str
    description: str | None = None
    initial_mapping: SchemaMappingCreate | None = None


class DataSourceUpdate(BaseModel):
    """Schema for updating DataSource configuration."""

    name: str | None = None
    code: str | None = None
    specialty: str | None = None
    target_operators: int | None = None
    target_efficiency_pct: int | None = None
    is_active: bool | None = None
    settings: dict | None = None
    time_column: str | None = None
    time_format: str | None = None
    description: str | None = None
    source_name: str | None = None


class DataSourceResponse(BaseModel):
    id: str
    production_line_id: str | None = None  # Legacy field, nullable after refactor
    source_name: str | None = None  # May be None for seeded lines
    description: str | None
    time_column: str | None = None
    time_format: str | None = None
    is_active: bool
    has_active_schema: bool = False  # Computed from schema_mappings
    schema_mappings: list[SchemaMappingResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.post(
    "/data-sources",
    response_model=DataSourceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_data_source(
    data: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new data source for a production line."""

    # Verify production line exists
    result = await db.execute(
        select(ProductionLine).where(ProductionLine.id == data.production_line_id)
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Production line not found")

    # Check if data source already exists for this line
    result = await db.execute(
        select(DataSource).where(
            DataSource.production_line_id == data.production_line_id
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Data source already exists for this production line",
        )

    # Create data source
    data_source = DataSource(
        production_line_id=data.production_line_id,
        source_name=data.source_name,
        description=data.description,
        time_column="production_date",  # Provide a sensible default
    )
    db.add(data_source)
    await db.flush()

    # Create initial schema mapping if provided
    if data.initial_mapping:
        mapping = SchemaMapping(
            data_source_id=data_source.id,
            version=1,
            column_map=data.initial_mapping.column_map,  # Removed json.dumps
            extraction_rules=data.initial_mapping.extraction_rules,  # Removed json.dumps
            reviewed_by_user=data.initial_mapping.reviewed_by_user,
            user_notes=data.initial_mapping.user_notes,
        )
        db.add(mapping)

    await db.commit()
    await db.refresh(data_source)

    return data_source


@router.get("/data-sources/{data_source_id}", response_model=DataSourceResponse)
async def get_data_source(
    data_source_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get data source by ID."""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(DataSource)
        .options(selectinload(DataSource.schema_mappings))
        .where(DataSource.id == data_source_id)
    )
    data_source = result.scalar_one_or_none()

    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")

    return data_source


@router.get("/data-sources", response_model=list[DataSourceResponse])
async def list_data_sources(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all data sources with mappings loaded."""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(DataSource)
        .options(selectinload(DataSource.schema_mappings))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/data-sources/line/{line_id}", response_model=DataSourceResponse | None)
async def get_data_source_by_line(
    line_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get data source by ID (line_id IS the DataSource.id after refactor)."""
    from sqlalchemy.orm import selectinload

    # After refactor: line_id IS the DataSource.id directly
    result = await db.execute(
        select(DataSource)
        .where(DataSource.id == line_id)
        .options(selectinload(DataSource.schema_mappings))
    )
    data_source = result.scalar_one_or_none()

    return data_source


@router.get(
    "/data-sources/by-line/{production_line_id}",
    response_model=DataSourceResponse | None,
)
async def get_datasource_by_line_explicit(
    production_line_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch DataSource config for a specific line.
    Returns 200 with null if not found (graceful init).
    After refactor: production_line_id IS the DataSource.id directly.
    """
    from sqlalchemy.orm import selectinload

    # After refactor: production_line_id IS the DataSource.id
    result = await db.execute(
        select(DataSource)
        .where(DataSource.id == production_line_id)
        .options(selectinload(DataSource.schema_mappings))
    )
    datasource = result.scalar_one_or_none()

    return datasource


@router.put(
    "/data-sources/{data_source_id}/mapping", response_model=SchemaMappingResponse
)
async def update_schema_mapping(
    data_source_id: str,
    mapping_data: SchemaMappingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new version of the schema mapping after user validation."""

    # Verify data source exists
    result = await db.execute(select(DataSource).where(DataSource.id == data_source_id))
    data_source = result.scalar_one_or_none()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")

    # Deactivate previous mappings
    mapping_result = await db.execute(
        select(SchemaMapping).where(
            SchemaMapping.data_source_id == data_source_id, SchemaMapping.is_active
        )
    )
    previous_mappings: list[SchemaMapping] = list(mapping_result.scalars().all())
    max_version = 0
    for prev in previous_mappings:
        prev.is_active = False
        max_version = max(max_version, prev.version)

    # Create new mapping
    new_mapping = SchemaMapping(
        data_source_id=data_source_id,
        version=max_version + 1,
        is_active=True,
        column_map=mapping_data.column_map,  # Removed json.dumps
        extraction_rules=mapping_data.extraction_rules,  # Removed json.dumps
        reviewed_by_user=mapping_data.reviewed_by_user,
        user_notes=mapping_data.user_notes,
    )
    db.add(new_mapping)

    await db.commit()
    await db.refresh(new_mapping)

    return new_mapping


@router.put("/data-sources/{data_source_id}", response_model=DataSourceResponse)
async def update_data_source(
    data_source_id: str,
    datasource_in: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update mappings or time column for a specific DataSource."""
    from sqlalchemy.orm import selectinload

    # Verify data source exists and check ownership
    # After refactor: DataSource has factory_id directly, no need to join ProductionLine
    result = await db.execute(
        select(DataSource)
        .options(selectinload(DataSource.schema_mappings))
        .join(Factory, DataSource.factory_id == Factory.id)
        .where(DataSource.id == data_source_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    datasource = result.scalar_one_or_none()

    if not datasource:
        raise HTTPException(status_code=404, detail="DataSource not found")

    # Update fields that are provided
    update_data = datasource_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(datasource, field, value)

    await db.commit()
    await db.refresh(datasource)

    return datasource


@router.delete("/data-sources/{data_source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(
    data_source_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a data source and all its associated schema mappings.
    """
    import logging

    logger = logging.getLogger("app.audit")

    from app.models.user import UserRole

    # RBAC: Only Owners and Managers can delete
    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.OWNER, UserRole.FACTORY_MANAGER]:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete data sources"
        )

    # Fetch Data Source directly
    # We join Factory to ensure it belongs to the user's organization
    result = await db.execute(
        select(DataSource)
        .join(Factory, DataSource.factory_id == Factory.id)
        .where(DataSource.id == data_source_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    data_source = result.scalar_one_or_none()

    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")

    await db.delete(data_source)
    await db.commit()

    # Audit Log
    logger.info(
        f"AUDIT: User {current_user.id} ({current_user.email}) deleted DataSource {data_source_id}"
    )

    return None
