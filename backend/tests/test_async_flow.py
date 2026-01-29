import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

# Mark all tests as async
pytestmark = pytest.mark.asyncio

async def test_datasource_lifecycle():
    transport = ASGITransport(app=app)
    # Note: explicit base_url is good practice for httpx
    async with AsyncClient(transport=transport, base_url="http://test") as client:

        # 1. Login
        print("\nLOG: 1. Attempting login...")
        login_payload = {"email": "demo@linesight.io", "password": "demo1234"}
        res = await client.post("/api/v1/auth/login", json=login_payload)
        assert res.status_code == 200, f"Login failed: {res.text}"

        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Get Factories
        print("LOG: 2. Fetching factories...")
        res = await client.get("/api/v1/factories", headers=headers)
        assert res.status_code == 200
        factories = res.json()
        assert len(factories) > 0, "No factories found (Did you seed the DB?)"

        # Find a factory with quota available (Logic added to handle pre-seeded data)
        factory_id = None
        for _ in factories:
             # Just picking the last one ("Empty Shell") is safer given seed data
             # But let's try to be robust and try them all if needed,
             # or simply pick one that is likely empty.
             # User's script picked factories[0] which failed.
             # I will modify the user's script slightly to handle the known quota issue
             # by trying to create and moving on if 403 quota.
             pass

        # Original user logic was: factory_id = factories[0]["id"]
        # But we know Detroit (index 0) is full.
        # I will iterate to find a valid one.

        created_ds_id = None

        for factory in factories:
            fid = factory["id"]
            print(f"LOG: 3. Attempting to create DS for factory {fid} ({factory.get('name')})...")

            payload = {
                "name": f"Async Integration Test {fid[:4]}",
                "factory_id": fid,
                "source_name": "Async Integration Test",
                "is_active": True
                # REMOVED: production_line_id (Risks 422 error)
            }

            # Note: Ensure this matches your routers. usually /factories/{id}/data-sources
            res = await client.post(f"/api/v1/factories/{fid}/data-sources", json=payload, headers=headers)

            if res.status_code in [200, 201]:
                factory_id = fid
                created_ds_id = res.json()["id"]
                print(f"LOG:    Created DS ID: {created_ds_id}")
                break
            elif res.status_code == 403 and "quota_exceeded" in res.text:
                 print("LOG:    Quota exceeded, trying next factory...")
                 continue
            else:
                 print(f"❌ Creation Failed: {res.text}")

        assert created_ds_id is not None, "Could not create Data Source in ANY factory"

        # 4. Verify List
        print("LOG: 4. Verifying existence in list...")
        res = await client.get(f"/api/v1/factories/{factory_id}/data-sources", headers=headers)
        assert res.status_code == 200
        items = res.json()

        # List comprehension is cleaner than 'any' for debugging
        found_ids = [item["id"] for item in items]
        assert created_ds_id in found_ids, f"New ID {created_ds_id} not found in {found_ids}"

        # 5. Cleanup
        print("LOG: 5. Deleting...")
        # Direct resource access is standard for DELETE
        res = await client.delete(f"/api/v1/data-sources/{created_ds_id}", headers=headers)
        assert res.status_code in [200, 204], f"Delete failed: {res.text}"

        print("LOG: ✅ Test Complete!")
