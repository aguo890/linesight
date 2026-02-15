# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Pydantic schemas for DataSource.

DataSource is the unified entity representing a production line's
configuration, data ingestion settings, and hierarchy support.
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# =============================================================================
# DataSource Settings
# =============================================================================


class DataSourceSettings(BaseModel):
    """
    Settings specific to a data source.
    Can be inherited from Factory defaults or overridden.
    """

    is_custom_schedule: bool = Field(
        default=False, description="If false, uses factory defaults"
    )

    # Effective Schedule (Snapshotted or Custom)
    shift_pattern: list[dict] | None = None
    non_working_days: list[int] | None = None

    model_config = ConfigDict(extra="allow")


# =============================================================================
# DataSource Base Schemas
# =============================================================================


class DataSourceBase(BaseModel):
    """Base data source schema with common fields."""

    name: str = Field(..., min_length=1, max_length=100)
    code: str | None = Field(None, max_length=50)
    specialty: str | None = Field(None, max_length=100)
    target_operators: int | None = Field(None, ge=0)
    target_efficiency_pct: int | None = Field(None, ge=0, le=100)


class DataSourceCreate(DataSourceBase):
    """Schema for creating a data source."""

    factory_id: str = Field(..., description="ID of the factory this data source belongs to")
    settings: DataSourceSettings | None = None

    # Data source configuration
    source_name: str | None = Field(None, max_length=255)
    description: str | None = None
    time_column: str | None = Field(None, max_length=100)
    time_format: str | None = Field(None, max_length=50)


class DataSourceUpdate(BaseModel):
    """Schema for updating a data source."""

    name: str | None = Field(None, min_length=1, max_length=100)
    code: str | None = None
    specialty: str | None = None
    target_operators: int | None = Field(None, ge=0)
    target_efficiency_pct: int | None = Field(None, ge=0, le=100)
    is_active: bool | None = None
    settings: DataSourceSettings | dict[str, Any] | None = None

    # Data source configuration
    source_name: str | None = None
    description: str | None = None
    time_column: str | None = None
    time_format: str | None = None


class DataSourceRead(DataSourceBase):
    """Schema for reading a data source."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    factory_id: str
    supervisor_id: str | None = None

    # Data source configuration
    source_name: str | None = None
    description: str | None = None
    time_column: str | None = None
    time_format: str | None = None

    # Settings
    settings: DataSourceSettings | dict[str, Any] | None = None

    # Hierarchy fields
    parent_data_source_id: str | None = None
    is_segment: bool = False
    date_range_start: date | None = None
    date_range_end: date | None = None

    # Status
    is_active: bool
    created_at: datetime
    updated_at: datetime


class DataSourceReadWithSegments(DataSourceRead):
    """Data source with child segments."""

    segments: list["DataSourceRead"] = []


# =============================================================================
# Append Request Schema (for Phase 5)
# =============================================================================


class DataSourceAppendRequest(BaseModel):
    """Request schema for appending a new data segment."""

    date_range_start: date = Field(..., description="Start date of the new segment")
    date_range_end: date = Field(..., description="End date of the new segment")
    source_name: str | None = Field(None, description="Optional name for the segment")


# =============================================================================
# Legacy Compatibility Aliases
# =============================================================================

# These aliases maintain backward compatibility during migration
ProductionLineBase = DataSourceBase
ProductionLineCreate = DataSourceCreate
ProductionLineUpdate = DataSourceUpdate
ProductionLineRead = DataSourceRead
ProductionLineSettings = DataSourceSettings
