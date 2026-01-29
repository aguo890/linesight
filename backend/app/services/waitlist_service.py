import secrets
import string

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.waitlist_repository import WaitlistRepository
from app.schemas.waitlist import WaitlistCreate, WaitlistResponse


class WaitlistService:
    """Service for handling waitlist business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = WaitlistRepository(db)

    async def join_waitlist(self, data: WaitlistCreate) -> WaitlistResponse:
        """
        Join the waitlist.
        Generates a unique referral code.
        """
        # Check if email already exists
        existing_user = await self.repo.get_by_email(data.email)
        if existing_user:
            # For privacy/experience, we might want to just return success or throw specific error
            # Here we throw 409 as per plan
            raise HTTPException(status_code=409, detail="Email already joined the waitlist.")

        # Generate unique referral code
        referral_code = await self._generate_unique_referral_code()

        # Create entry
        waitlist_entry = await self.repo.create(data.email, referral_code)
        await self.db.commit()
        await self.db.refresh(waitlist_entry)

        return WaitlistResponse.model_validate(waitlist_entry)

    async def _generate_unique_referral_code(self) -> str:
        """Generate a random 8-character string and ensure uniqueness."""
        chars = string.ascii_uppercase + string.digits
        max_retries = 10

        for _ in range(max_retries):
            code = ''.join(secrets.choice(chars) for _ in range(8))
            if not await self.repo.get_by_referral_code(code):
                return code

        raise HTTPException(status_code=500, detail="Could not generate unique referral code.")
