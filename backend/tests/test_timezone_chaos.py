# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.production_repo import ProductionRepository


@pytest.mark.asyncio
async def test_timezone_chaos_midnight_boundary():
    """
    Scenario:
    - Server (System) Time: 2026-01-05 11:00 AM NY Time (UTC-5)
    - Factory Time: Japan (UTC+9).
    - 11:00 AM NY = 16:00 UTC = 01:00 AM Tomorrow (Jan 6) in Japan.

    Goal: get_effective_date() must return Jan 6, NOT Jan 5.
    """

    # 1. Setup Mock DB Session
    mock_db = MagicMock(spec=AsyncSession)

    # Mock result to return NO data for "Today", forcing "Today" return
    # We want to verify clearly that "Today" is calculated correctly first.
    # repo.execute returns a result proxy with scalar()
    mock_result = MagicMock()
    mock_result.scalar.return_value = 0  # No production runs found
    mock_db.execute.return_value = mock_result

    repo = ProductionRepository(mock_db)

    # 2. Freeze Time: "2026-01-05 16:00:00 UTC"
    # This is Jan 5th 11:00 EST, but Jan 6th 01:00 JST.
    fixed_now = datetime(2026, 1, 5, 16, 0, 0, tzinfo=timezone.utc)

    with patch("app.repositories.production_repo.datetime") as mock_datetime:
        mock_datetime.now.return_value = fixed_now
        mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)

        # 3. Test with Tokyo Timezone
        tokyo_date = await repo.get_effective_date(timezone_str="Asia/Tokyo")

        # 4. Test with NY Timezone
        ny_date = await repo.get_effective_date(timezone_str="America/New_York")

    print(f"Tokyo Date: {tokyo_date}")
    print(f"NY Date: {ny_date}")

    assert tokyo_date == date(2026, 1, 6), f"Expected Jan 6 for Tokyo, got {tokyo_date}"
    assert ny_date == date(2026, 1, 5), f"Expected Jan 5 for NY, got {ny_date}"
