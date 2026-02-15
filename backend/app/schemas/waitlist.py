# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from datetime import datetime

from pydantic import BaseModel, EmailStr


class WaitlistCreate(BaseModel):
    """Schema for creating a waitlist entry."""
    email: EmailStr

class WaitlistResponse(BaseModel):
    """Schema for waitlist response."""
    id: int
    email: EmailStr
    referral_code: str
    created_at: datetime

    class Config:
        from_attributes = True
