import pytest
from httpx import AsyncClient

from app.core.config import settings

# -----------------------------------------------------------------------------
# Happy Path Tests
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_user_me(async_client: AsyncClient, auth_headers):
    """
    Ensure authenticated users can fetch their own profile.
    """
    r = await async_client.get(
        f"{settings.API_V1_PREFIX}/users/me", headers=auth_headers
    )
    assert r.status_code == 200
    current_user = r.json()
    assert current_user["is_active"] is True
    assert "email" in current_user


@pytest.mark.asyncio
async def test_update_user_me(async_client: AsyncClient, auth_headers):
    """
    Test updating Profile, Timezone, and Nested Preferences object.
    """
    data = {
        "full_name": "Captain Robust",
        "timezone": "Europe/London",
        "preferences": {"theme": "dark", "country_code": "GB", "notifications": False},
    }
    r = await async_client.patch(
        f"{settings.API_V1_PREFIX}/users/me", headers=auth_headers, json=data
    )
    assert r.status_code == 200
    updated_user = r.json()

    # Verify immediate response
    assert updated_user["full_name"] == "Captain Robust"
    assert updated_user["timezone"] == "Europe/London"
    assert updated_user["preferences"]["theme"] == "dark"

    # Verify persistence (Double check with a fresh GET)
    r2 = await async_client.get(
        f"{settings.API_V1_PREFIX}/users/me", headers=auth_headers
    )
    persisted_user = r2.json()
    assert persisted_user["preferences"]["country_code"] == "GB"


# -----------------------------------------------------------------------------
# Edge Case & Validation Tests
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_user_invalid_timezone(async_client: AsyncClient, auth_headers):
    """
    Strictly validate IANA timezone strings. "Mars/Phobos" should fail.
    """
    data = {"timezone": "Mars/Phobos"}
    r = await async_client.patch(
        f"{settings.API_V1_PREFIX}/users/me", headers=auth_headers, json=data
    )
    with open("test_debug_timezone.log", "w") as f:
        f.write(f"Status: {r.status_code}\nBody: {r.text}")
    assert r.status_code == 422
    # Detail message might vary slightly depending on pydantic/fastapi version,
    # but "Invalid IANA timezone" is what we raised.
    assert "Invalid IANA timezone" in r.text


@pytest.mark.asyncio
async def test_update_user_partial_preferences(async_client: AsyncClient, auth_headers):
    """
    Ensure we can update just one preference field without erasing others
    (depending on your backend logic, usually a merge or replace).
    """
    # 1. Set initial state
    await async_client.patch(
        f"{settings.API_V1_PREFIX}/users/me",
        headers=auth_headers,
        json={"preferences": {"theme": "light", "country_code": "US"}},
    )

    # 2. Update only theme
    r = await async_client.patch(
        f"{settings.API_V1_PREFIX}/users/me",
        headers=auth_headers,
        json={"preferences": {"theme": "dark"}},
    )
    assert r.status_code == 200
    prefs = r.json()["preferences"]

    # If your API does a full replace of the JSON column (standard simple behavior):
    assert prefs["theme"] == "dark"


@pytest.mark.asyncio
async def test_update_user_invalid_preference_type(
    async_client: AsyncClient, auth_headers
):
    """
    Send invalid data types to the typed preferences schema.
    """
    data = {
        "preferences": {
            "notifications": []  # Should be bool, list checks strict type failure better than string
        }
    }
    r = await async_client.patch(
        f"{settings.API_V1_PREFIX}/users/me", headers=auth_headers, json=data
    )
    with open("test_debug_pref.log", "w") as f:
        f.write(f"Status: {r.status_code}\nBody: {r.text}")
    assert r.status_code == 422
