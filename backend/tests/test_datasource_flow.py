import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

# Mark all tests in this module as async
pytestmark = pytest.mark.asyncio

async def test_datasource_flow():
    # Use ASGITransport to communicate directly with the app instance
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        
        # 1. Login
        print("LOG: Attempting login...")
        login_payload = {
            "email": "demo@linesight.io", 
            "password": "demo1234"
        }
        res = await client.post("/api/v1/auth/login", json=login_payload)
        assert res.status_code == 200, f"Login failed: {res.text}"
        
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get Factories
        print("LOG: Fetching factories...")
        res = await client.get("/api/v1/factories", headers=headers)
        assert res.status_code == 200, f"Get factories failed: {res.text}"
        
        factories = res.json()
        print(f"LOG: Found {len(factories)} factories")
        assert len(factories) > 0, "No factories found"
        
        factory_id = None
        ds_id = None
        
        # 3. Create Data Source (Try each factory until one allows it)
        for factory in factories:
            fid = factory["id"]
            print(f"LOG: Attempting to create DS in factory {fid} ({factory.get('name')})...")
            
            payload = {
                "name": f"Integration Test Source {fid[:4]}",
                "factory_id": fid,
                "source_name": "Integration Test Source Async",
                "is_active": True,
                "production_line_id": "compat_test_async"
            }
            res = await client.post(f"/api/v1/factories/{fid}/data-sources", json=payload, headers=headers)
            
            if res.status_code in [200, 201]:
                print(f"LOG: Success! Created in factory {fid}")
                factory_id = fid
                ds_id = res.json()["id"]
                break
            elif res.status_code == 403 and "quota_exceeded" in res.text:
                print(f"LOG: Quota exceeded for factory {fid}, trying next...")
                continue
            else:
                print(f"LOG: Unexpected error for factory {fid}: {res.status_code} {res.text}")
                # Don't break, maybe transient? But usually fatal.
        
        assert factory_id is not None, "Could not create Data Source in ANY factory due to quotas or errors"
        
        # 4. Verify List
        print("LOG: Verifying list...")
        res = await client.get(f"/api/v1/factories/{factory_id}/data-sources", headers=headers)
        assert res.status_code == 200
        items = res.json()
        assert any(i["id"] == ds_id for i in items), "DS not found in list"
        
        # 5. Cleanup
        print("LOG: Cleaning up...")
        # Try primary path
        res = await client.delete(f"/api/v1/factories/data-sources/{ds_id}", headers=headers)
        
        if res.status_code == 404:
             # Try fallback path
             print("LOG: Trying fallback delete path...")
             res = await client.delete(f"/api/v1/data-sources/{ds_id}", headers=headers)
        
        assert res.status_code in [200, 204], f"Cleanup failed: {res.text}"
