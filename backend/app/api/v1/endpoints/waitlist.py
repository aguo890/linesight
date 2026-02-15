# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.waitlist import WaitlistCreate, WaitlistResponse
from app.services.waitlist_service import WaitlistService

router = APIRouter()

@router.post("/", response_model=WaitlistResponse, status_code=201)
async def join_waitlist(
    data: WaitlistCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Join the waitlist.
    Returns the created entry with a unique referral code.
    """
    service = WaitlistService(db)
    return await service.join_waitlist(data)
