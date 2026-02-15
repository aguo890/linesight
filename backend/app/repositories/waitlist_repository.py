# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.waitlist import Waitlist


class WaitlistRepository:
    """Repository for waitlist operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, email: str, referral_code: str) -> Waitlist:
        """Create a new waitlist entry."""
        waitlist_entry = Waitlist(email=email, referral_code=referral_code)
        self.db.add(waitlist_entry)
        await self.db.flush()
        return waitlist_entry

    async def get_by_email(self, email: str) -> Waitlist | None:
        """Get waitlist entry by email."""
        query = select(Waitlist).where(Waitlist.email == email)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_referral_code(self, referral_code: str) -> Waitlist | None:
        """Get waitlist entry by referral code."""
        query = select(Waitlist).where(Waitlist.referral_code == referral_code)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
