"""
Pydantic schemas for Team Management API.
Handles organization member listing and scope assignments.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class ScopeRead(BaseModel):
    """Response schema for a user scope assignment."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    scope_type: str
    organization_id: str | None = None
    factory_id: str | None = None
    data_source_id: str | None = None  # Renamed from production_line_id
    role: str


class MemberRead(BaseModel):
    """Response schema for an organization member with their scopes."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str | None = None
    avatar_url: str | None = None
    role: str
    is_active: bool
    last_login: datetime | None = None
    scopes: list[ScopeRead] = []


class ScopeAssign(BaseModel):
    """Request body for assigning a user to a data source."""

    data_source_id: str
    role: str = "manager"
