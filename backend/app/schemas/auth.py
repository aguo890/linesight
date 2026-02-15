# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Auth Pydantic schemas.
Request/response models for authentication endpoints.
"""

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Login request payload."""

    email: EmailStr
    password: str = Field(..., min_length=8)


class LoginResponse(BaseModel):
    """Login response with JWT token."""

    access_token: str
    token_type: str = "bearer"
    user: "UserInfo"

    model_config = {"from_attributes": True}


class UserInfo(BaseModel):
    """User information returned after login."""

    id: str
    email: str
    full_name: str
    role: str
    organization_id: str
    timezone: str | None = None
    preferences: dict | None = None
    avatar_url: str | None = None


class RegisterRequest(BaseModel):
    """Registration request payload."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=255)
    organization_name: str = Field(..., min_length=2, max_length=255)
    organization_code: str = Field(..., min_length=2, max_length=50)


class RegisterResponse(BaseModel):
    """Registration response."""

    message: str
    user_id: str
