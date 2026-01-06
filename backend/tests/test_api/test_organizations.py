import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_my_organization(
    async_client: AsyncClient, auth_headers: dict, test_organization
):
    response = await async_client.get("/api/v1/organizations/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_organization.id
    assert data["name"] == test_organization.name


@pytest.mark.asyncio
async def test_update_my_organization(async_client: AsyncClient, auth_headers: dict):
    update_data = {"name": "Updated Org Name", "primary_phone": "123-456-7890"}
    response = await async_client.patch(
        "/api/v1/organizations/me", json=update_data, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Org Name"
    assert data["primary_phone"] == "123-456-7890"


@pytest.mark.asyncio
async def test_get_organization_by_id(
    async_client: AsyncClient, auth_headers: dict, test_organization
):
    response = await async_client.get(
        f"/api/v1/organizations/{test_organization.id}", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["id"] == test_organization.id
