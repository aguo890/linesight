# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

# -----------------------------------------------------------------------------
# Tests
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_factory_settings_localization_and_snapshot(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    auth_headers: dict[str, str],
):
    """
    Test 1: Factory Creation with Localization Settings
    Test 2: Production Line Inheritance (Snapshot Strategy)
    Test 3: Production Line Custom Override
    """
    # Increase Quota for this test
    # We need to fetch the org from DB or use the one linked to user
    from sqlalchemy import update

    from app.models.user import Organization

    await db_session.execute(
        update(Organization)
        .where(Organization.id == test_user.organization_id)
        .values(max_lines_per_factory=10, max_factories=5)
    )
    await db_session.commit()

    # -------------------------------------------------------------------------
    # 1. Create Factory with specific Settings
    # -------------------------------------------------------------------------
    factory_data = {
        "name": "Global Factory Inc",
        "code": "GFI-001",
        "country": "Japan",
        "location": "Tokyo",
        "timezone": "Asia/Tokyo",
        "settings": {
            "timezone": "Asia/Tokyo",
            "date_format": "YYYY-MM-DD",
            "measurement_system": "metric",
            "default_shift_pattern": [
                {"name": "Day Shift", "start_time": "08:00", "end_time": "17:00"}
            ],
            "standard_non_working_days": [0],  # Sunday only
        },
    }

    response = await async_client.post(
        "/api/v1/factories",
        json=factory_data,
        headers=auth_headers,
    )
    assert response.status_code == 201, f"Failed to create factory: {response.text}"
    factory = response.json()
    factory_id = factory["id"]

    # Verify Factory Settings Persistence
    assert factory["settings"]["timezone"] == "Asia/Tokyo"
    assert factory["settings"]["measurement_system"] == "metric"
    assert len(factory["settings"]["default_shift_pattern"]) == 1
    assert factory["settings"]["default_shift_pattern"][0]["name"] == "Day Shift"

    # -------------------------------------------------------------------------
    # 2. Create Standard Production Line (Should Snapshot Defaults)
    # -------------------------------------------------------------------------
    line_std_data = {
        "name": "Standard Line",
        "code": "L-STD",
        # No settings provided -> Should inherit
    }

    response = await async_client.post(
        f"/api/v1/factories/{factory_id}/data-sources",
        json=line_std_data,
        headers=auth_headers,
    )
    assert response.status_code == 201, (
        f"Failed to create standard line: {response.text}"
    )
    line_std = response.json()

    # Verify Snapshot
    assert line_std["settings"] is not None
    assert line_std["settings"]["is_custom_schedule"] is False
    # Check if shifts were copied
    assert len(line_std["settings"]["shift_pattern"]) == 1
    assert line_std["settings"]["shift_pattern"][0]["name"] == "Day Shift"
    assert line_std["settings"]["non_working_days"] == [0]

    # -------------------------------------------------------------------------
    # 3. Create Custom Production Line (Should NOT Snapshot or start Empty if custom)
    # -------------------------------------------------------------------------
    line_custom_data = {
        "name": "Custom Line 24/7",
        "code": "L-247",
        "settings": {
            "is_custom_schedule": True,
            # We explicitly provide NO shifts here, or different shifts
        },
    }

    response = await async_client.post(
        f"/api/v1/factories/{factory_id}/data-sources",
        json=line_custom_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    line_custom = response.json()

    # Verify Custom
    assert line_custom["settings"]["is_custom_schedule"] is True
    # Should NOT have the factory defaults because we set custom=True and didn't provide them
    # Depending on implementation, it might be None or Empty List.
    # My implementation:
    # if not is_custom: snapshot
    # else: use whatever is in line_settings
    # So shift_pattern should be None or missing if not provided.
    assert (
        line_custom["settings"].get("shift_pattern") is None
        or len(line_custom["settings"].get("shift_pattern", [])) == 0
    )

    # -------------------------------------------------------------------------
    # 4. Modify Factory Settings (Ensure Snapshot Integrity)
    # -------------------------------------------------------------------------
    # Update factory to have 2 shifts
    update_data = {
        "settings": {
            "default_shift_pattern": [
                {"name": "Morning", "start_time": "06:00", "end_time": "14:00"},
                {"name": "Evening", "start_time": "14:00", "end_time": "22:00"},
            ]
        }
    }

    response = await async_client.patch(
        f"/api/v1/factories/{factory_id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200

    # Verify Standard Line UNCHANGED (Snapshot worked)
    response = await async_client.get(
        f"/api/v1/factories/data-sources/{line_std['id']}",
        headers=auth_headers,
    )
    line_std_refetched = response.json()

    # It should still have "Day Shift" (1 shift), not Morning/Evening
    assert len(line_std_refetched["settings"]["shift_pattern"]) == 1
    assert line_std_refetched["settings"]["shift_pattern"][0]["name"] == "Day Shift"
