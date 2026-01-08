"""
Pydantic schemas for Team Management API.
Handles organization member listing and scope assignments.
"""

from pydantic import BaseModel, ConfigDict, EmailStr


class ScopeRead(BaseModel):
    """Response schema for a user scope assignment."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    scope_type: str
    organization_id: str | None = None
    factory_id: str | None = None
    production_line_id: str | None = None
    role: str


class MemberRead(BaseModel):
    """Response schema for an organization member with their scopes."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str | None = None
    role: str
    is_active: bool
    scopes: list[ScopeRead] = []


class ScopeAssign(BaseModel):
    """Request body for assigning a user to a production line."""

    production_line_id: str
    role: str = "manager"
