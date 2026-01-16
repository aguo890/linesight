from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

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
