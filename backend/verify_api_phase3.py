import sys

import httpx

BASE_URL = "http://localhost:8000/api/v1"
EMAIL = "demo@linesight.io"
PASSWORD = "demo1234"

def run_verification():
    print("[INFO] Starting Phase 3 API Verification...")

    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Login
        print("\n[INFO] Authenticating...")
        try:
            resp = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
            if resp.status_code != 200:
                print(f"[ERROR] Login failed: {resp.status_code} - {resp.text}")
                sys.exit(1)

            token = resp.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print("[SUCCESS] Login successful")
        except Exception as e:
            print(f"[ERROR] Connection failed: {e}")
            print("Is the backend server running? (make run)")
            sys.exit(1)

        # 2. List Factories
        print("\n[INFO] Fetching Factories...")
        resp = client.get("/factories", headers=headers)
        if resp.status_code != 200:
            print(f"[ERROR] Failed to list factories: {resp.status_code} - {resp.text}")
            sys.exit(1)

        factories = resp.json()
        if not factories:
            print("[WARN] No factories found. Cannot proceed with data source creation.")
            sys.exit(1)

        factory = factories[0]
        factory_id = factory["id"]
        print(f"[SUCCESS] Found factory: {factory['name']} ({factory_id})")

        # 3. List Data Sources (New Endpoint)
        print("\n[INFO] Testing GET /data-sources (New Endpoint)...")
        resp = client.get(f"/factories/{factory_id}/data-sources", headers=headers)
        if resp.status_code != 200:
            print(f"[ERROR] Failed to list data sources: {resp.status_code} - {resp.text}")
            sys.exit(1)

        data_sources = resp.json()
        print(f"[SUCCESS] Success! Found {len(data_sources)} data sources.")

        # 4. Create Data Source (New Endpoint)
        print("\n[INFO] Testing POST /data-sources (New Endpoint)...")
        new_ds_payload = {
            "name": "Phase 3 Verified Source",
            "factory_id": factory_id,
            "source_name": "Phase 3 Verified Source",
            "is_active": True
        }
        # Note: factory_id is in the path, but standard POST might expect it in body too or just use path
        # Checking existing tests, creating a line usually happened at /factories/{id}/lines
        # The new endpoint is likely /factories/{id}/data-sources

        resp = client.post(f"/factories/{factory_id}/data-sources", json=new_ds_payload, headers=headers)
        if resp.status_code not in [200, 201]:
             print(f"[ERROR] Failed to create data source: {resp.status_code} - {resp.text}")
             sys.exit(1)

        created_ds = resp.json()
        print(f"[SUCCESS] Created Data Source: {created_ds['name']} ({created_ds['id']})")

        # 5. Verify Old Endpoint is Gone
        print("\n[INFO] Verifying Old Endpoint is GONE (Expect 404)...")
        resp = client.get(f"/factories/{factory_id}/production-lines", headers=headers)
        if resp.status_code == 404:
            print("[SUCCESS] Success! Old /production-lines endpoint returned 404.")
        else:
            print(f"[ERROR] WARNING: Old endpoint returned {resp.status_code}. It should be gone!")
            sys.exit(1)

    print("\n[SUCCESS] PHASE 3 VERIFICATION COMPLETE: ALL CHECKS PASSED")

if __name__ == "__main__":
    run_verification()
