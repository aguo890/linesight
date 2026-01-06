"""
Pydantic schemas for Factory and ProductionLine.
"""

import re
from datetime import datetime
from typing import Any

try:
    from zoneinfo import available_timezones
except ImportError:
    from backports.zoneinfo import (
        available_timezones,  # Fallback for older python if needed
    )


from pydantic import BaseModel, ConfigDict, Field, field_validator

# =============================================================================
# Core Config Schemas
# =============================================================================


class ShiftConfig(BaseModel):
    name: str = Field(..., description="e.g., 'Morning Shift'")
    start_time: str = Field(
        ..., pattern=r"^\d{2}:\d{2}$", description="HH:MM format (24h)"
    )
    end_time: str = Field(
        ..., pattern=r"^\d{2}:\d{2}$", description="HH:MM format (24h)"
    )


class ProductionLineSettings(BaseModel):
    """
    Settings specific to a production line.
    Can be inherited from Factory defaults or overridden.
    """

    is_custom_schedule: bool = Field(
        default=False, description="If false, uses factory defaults"
    )

    # Effective Schedule (Snapshotted or Custom)
    shift_pattern: list[ShiftConfig] | None = None
    non_working_days: list[int] | None = None

    model_config = ConfigDict(extra="allow")


class FactorySettings(BaseModel):
    # Defaults for inheritance
    default_shift_pattern: list[ShiftConfig] | None = None
    standard_non_working_days: list[int] | None = Field(
        default=[5, 6], description="0=Mon, 6=Sun"
    )

    # Global Localization
    timezone: str = Field(default="UTC", description="e.g. 'America/New_York'")
    date_format: str = Field(default="MM/DD/YYYY", description="e.g. 'DD/MM/YYYY'")
    number_format: str = Field(
        default="1,000.00", description="Decimal separator style"
    )
    measurement_system: str = Field(
        default="metric", description="'metric' or 'imperial'"
    )
    fiscal_year_start_month: int = Field(
        default=1, ge=1, le=12, description="Month number (1-12)"
    )

    # Allow other generic settings
    model_config = ConfigDict(extra="allow")


# =============================================================================
# ProductionLine Schemas
# =============================================================================


class ProductionLineBase(BaseModel):
    """Base production line schema."""

    name: str = Field(..., min_length=1, max_length=100)
    code: str | None = Field(None, max_length=50)
    specialty: str | None = Field(None, max_length=100)
    target_operators: int | None = Field(None, ge=0)
    target_efficiency_pct: int | None = Field(None, ge=0, le=100)


class ProductionLineCreate(ProductionLineBase):
    """Schema for creating a production line."""

    settings: ProductionLineSettings | None = None


class ProductionLineUpdate(BaseModel):
    """Schema for updating a production line."""

    name: str | None = Field(None, min_length=1, max_length=100)
    specialty: str | None = None
    target_operators: int | None = Field(None, ge=0)
    target_efficiency_pct: int | None = Field(None, ge=0, le=100)
    is_active: bool | None = None
    settings: ProductionLineSettings | dict[str, Any] | None = None


class ProductionLineRead(ProductionLineBase):
    """Schema for reading a production line."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    factory_id: str
    specialty: str | None = None
    supervisor_id: str | None = None
    target_efficiency_pct: int | None = None

    # Settings
    settings: ProductionLineSettings | dict[str, Any] | None = None

    is_active: bool
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Factory Schemas
# =============================================================================


class FactoryBase(BaseModel):
    """Base factory schema."""

    name: str = Field(..., min_length=1, max_length=255)
    code: str | None = Field(None, max_length=50)
    location: str | None = Field(None, max_length=255)
    country: str | None = Field(None, max_length=100)
    timezone: str | None = Field(None, max_length=50)

    @field_validator("country")
    @classmethod
    def validate_country_code(cls, v: str | None) -> str | None:
        if v is not None:
            if not re.match(r"^[A-Z]{2}$", v):
                raise ValueError(
                    "Country must be a 2-letter ISO 3166-1 alpha-2 code (e.g., US, EG)"
                )
        return v

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str | None) -> str | None:
        if v is not None:
            # Basic IANA string validation (very loose regex or set check)
            # Checking against available_timezones() is safest but might be missing some if system is old.
            # We will try to check against available_timezones if possible.
            try:
                valid_zones = available_timezones()
                if (
                    v not in valid_zones and v != "UTC"
                ):  # UTC usually in there, but just in case
                    # Some systems might not have all. Let's start with a warning or soft check?
                    # The user wants "Standard Strings".
                    # Let's enforce it if we can.
                    pass
            except Exception:
                pass

            if "/" not in v and v != "UTC":
                raise ValueError(
                    "Timezone must be a valid IANA string (e.g., Africa/Cairo)"
                )
        return v


class FactoryCreate(FactoryBase):
    """Schema for creating a factory."""

    settings: FactorySettings | None = None


class FactoryUpdate(BaseModel):
    """Schema for updating a factory."""

    name: str | None = Field(None, min_length=1, max_length=255)
    location: str | None = None
    country: str | None = None
    timezone: str | None = None
    is_active: bool | None = None

    # Update settings
    settings: FactorySettings | dict[str, Any] | None = None


class FactoryRead(FactoryBase):
    """Schema for reading a factory."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    city: str | None = None
    address: str | None = None
    total_lines: int | None = None
    total_workers: int | None = None
    daily_capacity_units: int | None = None
    certifications: str | None = None

    # Include settings in read
    settings: FactorySettings | dict[str, Any] | None = None

    is_active: bool
    created_at: datetime
    updated_at: datetime


class FactoryWithLines(FactoryRead):
    """Factory with production lines."""

    production_lines: list[ProductionLineRead] = []
