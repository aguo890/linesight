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
from app.models.datasource import DataSource, SchemaMapping
from app.models.factory import Factory, ProductionLine
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

    time_column: str | None = None
    time_format: str | None = None
    description: str | None = None
    source_name: str | None = None


class DataSourceResponse(BaseModel):
    id: str
    production_line_id: str
    source_name: str
    description: str | None
    time_column: str | None = None
    time_format: str | None = None
    is_active: bool
    schema_mappings: list[SchemaMappingResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.post(
    "/datasources",
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


@router.get("/datasources/{data_source_id}", response_model=DataSourceResponse)
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


@router.get("/datasources", response_model=list[DataSourceResponse])
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


@router.get("/datasources/line/{line_id}", response_model=DataSourceResponse | None)
async def get_data_source_by_line(
    line_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get data source for a specific production line."""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(DataSource)
        .where(DataSource.production_line_id == line_id)
        .options(selectinload(DataSource.schema_mappings))
    )
    data_source = result.scalar_one_or_none()

    return data_source


@router.get(
    "/datasources/by-line/{production_line_id}",
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
    Alias/Explicit endpoint for validate-mapping flow.
    """
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(DataSource)
        .where(DataSource.production_line_id == production_line_id)
        .options(selectinload(DataSource.schema_mappings))
    )
    datasource = result.scalar_one_or_none()

    return datasource


@router.put(
    "/datasources/{data_source_id}/mapping", response_model=SchemaMappingResponse
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


@router.put("/datasources/{data_source_id}", response_model=DataSourceResponse)
async def update_data_source(
    data_source_id: str,
    datasource_in: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update mappings or time column for a specific DataSource."""
    from sqlalchemy.orm import selectinload

    # Verify data source exists and check ownership
    result = await db.execute(
        select(DataSource)
        .options(selectinload(DataSource.schema_mappings))
        .join(ProductionLine)
        .join(Factory)
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


@router.delete("/datasources/{data_source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(
    data_source_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a data source and all its associated schema mappings.
    The database cascade should handle the mappings, but we'll be explicit if needed.
    """
    import logging

    logger = logging.getLogger("app.audit")

    from app.models.user import UserRole

    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete data sources"
        )

    # Verify data source exists and check ownership
    # We join to ensure it belongs to the user's organization
    result = await db.execute(
        select(DataSource)
        .join(ProductionLine)
        .join(Factory)
        .where(DataSource.id == data_source_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    data_source = result.scalar_one_or_none()

    if not data_source:
        # Check if it exists but belongs to another org (to discern 403 vs 404)
        # But for security, 404 is safer to avoid enumeration.
        # Alternatively, if we want to be strict about "Forbidden", we check existence first then permission.
        # Given the previous join failed, it's either not found or not owned.
        raise HTTPException(status_code=404, detail="Data source not found")

    await db.delete(data_source)
    await db.commit()

    # Audit Log
    logger.info(
        f"AUDIT: User {current_user.id} ({current_user.email}) deleted DataSource {data_source_id}"
    )

    return None
