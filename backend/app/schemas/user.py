# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Pydantic schemas for User and Organization.
Used for request validation and response serialization.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# =============================================================================
# Organization Schemas
# =============================================================================


class OrganizationBase(BaseModel):
    """Base organization schema."""

    name: str = Field(..., min_length=1, max_length=255)
    code: str | None = Field(None, max_length=50)
    primary_email: EmailStr | None = None
    primary_phone: str | None = Field(None, max_length=50)


class OrganizationCreate(OrganizationBase):
    """Schema for creating an organization."""

    pass


class OrganizationUpdate(BaseModel):
    """Schema for updating an organization."""

    name: str | None = Field(None, min_length=1, max_length=255)
    code: str | None = Field(None, max_length=50)
    primary_email: EmailStr | None = None
    primary_phone: str | None = Field(None, max_length=50)
    subscription_tier: str | None = None


class OrganizationRead(OrganizationBase):
    """Schema for reading an organization."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    subscription_tier: str
    settings: dict | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("settings", mode="before")
    @classmethod
    def parse_settings(cls, v):
        if isinstance(v, str):
            try:
                import json

                return json.loads(v)
            except Exception:
                return {}
        return v


# =============================================================================
# User Schemas
# =============================================================================


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr
    full_name: str | None = Field(None, max_length=255)


class UserCreate(UserBase):
    """Schema for creating a user."""

    password: str = Field(..., min_length=8)
    role: str = "viewer"



class UserPreferences(BaseModel):
    """Schema for user preferences JSON structure."""

    theme: str = "system"  # light, dark, system
    country_code: str | None = None
    notifications: bool = True
    locale: str = "en-US"


class UserPreferencesUpdate(BaseModel):
    """Schema for updating user preferences (all fields optional for merging)."""

    theme: str | None = None
    country_code: str | None = None
    notifications: bool | None = None
    locale: str | None = None


class UserUpdate(BaseModel):
    """Schema for updating a user."""

    email: EmailStr | None = None
    full_name: str | None = Field(None, max_length=255)
    role: str | None = None
    timezone: str | None = Field(None, max_length=50)
    preferences: UserPreferencesUpdate | dict | None = None
    is_active: bool | None = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str | None) -> str | None:
        if v:
            try:
                import zoneinfo

                zoneinfo.ZoneInfo(v)
            except Exception:
                raise ValueError("Invalid IANA timezone string") from None
        return v


class UserRead(UserBase):
    """Schema for reading a user."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    role: str
    is_active: bool
    is_verified: bool
    timezone: str | None = None
    preferences: UserPreferences | dict | None = None
    last_login: datetime | None = None

    @field_validator("preferences", mode="before")
    @classmethod
    def parse_preferences(cls, v):
        if isinstance(v, str):
            try:
                import json

                return json.loads(v)
            except Exception:
                return {}
        return v

    created_at: datetime
    updated_at: datetime


class UserLogin(BaseModel):
    """Schema for user login."""

    email: EmailStr
    password: str


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """JWT token payload."""

    sub: str  # user_id
    exp: datetime
