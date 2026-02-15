# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Dashboard Pydantic schemas for API request/response validation.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class LayoutItem(BaseModel):
    """Widget layout position and size in grid."""

    widget_id: str = Field(..., description="Unique identifier for the widget")
    x: int = Field(..., ge=0, description="X position in grid")
    y: int = Field(..., ge=0, description="Y position in grid")
    w: int = Field(..., gt=0, description="Width in grid units")
    h: int = Field(..., gt=0, description="Height in grid units")


class WidgetConfig(BaseModel):
    """Dashboard widget configuration."""

    enabled_widgets: list[str] = Field(
        default_factory=list, description="List of enabled widget types"
    )
    widget_settings: dict[str, Any] | None = Field(
        None, description="Per-widget custom settings"
    )


class LayoutConfig(BaseModel):
    """Dashboard layout configuration."""

    layouts: list[LayoutItem] = Field(
        default_factory=list, description="Widget layout items"
    )


# Request Schemas


class DashboardCreate(BaseModel):
    """Schema for creating a new dashboard."""

    name: str = Field(..., min_length=1, max_length=200, description="Dashboard name")
    description: str | None = Field(None, description="Dashboard description")
    data_source_id: str | None = Field(
        None, description="UUID of the linked ExcelUpload"
    )
    widget_config: WidgetConfig | None = Field(None, description="Widget configuration")
    layout_config: LayoutConfig | None = Field(None, description="Layout configuration")


class DashboardUpdate(BaseModel):
    """Schema for updating an existing dashboard."""

    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    data_source_id: str | None = None
    widget_config: WidgetConfig | None = None
    layout_config: LayoutConfig | None = None


# Response Schemas


class DashboardResponse(BaseModel):
    """Basic dashboard response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    description: str | None = None
    data_source_id: str | None = None
    widget_config: str | None = None  # JSON string from DB
    layout_config: str | None = None  # JSON string from DB
    created_at: datetime
    updated_at: datetime


class DashboardDetailResponse(DashboardResponse):
    """Detailed dashboard response with widget data."""

    widget_data: dict[str, Any] | None = Field(
        default_factory=dict, description="Actual widget data fetched from data source"
    )


class DashboardListResponse(BaseModel):
    """List of dashboards for a user."""

    dashboards: list[DashboardResponse]
    count: int


# Widget Suggestion Schemas


class SuggestedWidget(BaseModel):
    """AI-suggested widget based on data analysis."""

    widget_type: str = Field(
        ..., description="Type of widget (e.g., 'line_efficiency_gauge')"
    )
    reason: str = Field(..., description="Human-readable explanation for suggestion")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0-1)")
    data_mapping: dict[str, str] = Field(
        default_factory=dict, description="Mapping of widget fields to data columns"
    )


class WidgetSuggestionsResponse(BaseModel):
    """Response containing AI-suggested widgets."""

    suggested_widgets: list[SuggestedWidget] = Field(default_factory=list)
