# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Waitlist Service Lifecycle Tests
Sweeps the missing 63% in waitlist_service.py.
"""

import pytest
from unittest.mock import patch
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.waitlist_service import WaitlistService
from app.schemas.waitlist import WaitlistCreate


@pytest.fixture
def waitlist_service(db_session: AsyncSession):
    return WaitlistService(db_session)


@pytest.mark.asyncio
async def test_join_waitlist_duplicate_email(waitlist_service):
    """Test duplicate email raises 409."""
    with patch.object(
        waitlist_service.repo,
        "get_by_email",
        return_value={"email": "existing@example.com"},
    ):
        with pytest.raises(HTTPException) as exc_info:
            await waitlist_service.join_waitlist(
                WaitlistCreate(email="existing@example.com")
            )

        assert exc_info.value.status_code == 409
        assert "already joined" in exc_info.value.detail


@pytest.mark.asyncio
async def test_generate_unique_referral_code_success(waitlist_service):
    """Test referral code generation."""
    with patch.object(waitlist_service.repo, "get_by_referral_code", return_value=None):
        code = await waitlist_service._generate_unique_referral_code()

        assert len(code) == 8
        assert code.isalnum()


@pytest.mark.asyncio
async def test_generate_unique_referral_code_retries(waitlist_service):
    """Test referral code generation with retries."""
    call_count = 0

    async def mock_get_by_referral_code(code):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            return {"code": code}  # Already exists
        return None  # Unique

    with patch.object(
        waitlist_service.repo,
        "get_by_referral_code",
        side_effect=mock_get_by_referral_code,
    ):
        code = await waitlist_service._generate_unique_referral_code()

        assert len(code) == 8


@pytest.mark.asyncio
async def test_generate_unique_referral_code_failure(waitlist_service):
    """Test referral code generation fails after max retries."""
    with patch.object(
        waitlist_service.repo, "get_by_referral_code", return_value={"code": "EXISTS"}
    ):  # Always exists
        with pytest.raises(HTTPException) as exc_info:
            await waitlist_service._generate_unique_referral_code()

        assert exc_info.value.status_code == 500
        assert "unique referral code" in exc_info.value.detail.lower()
