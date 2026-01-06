#!/usr/bin/env python
"""
Quick test script to verify SchemaMapping versioning works.

Run with: python scripts/verify_versioning.py

Prerequisites:
- Backend must be running (make run)
- Demo user must exist (run generate_production_data.py first)
"""

import asyncio

import httpx

API_BASE = "http://localhost:8000/api/v1"
EMAIL = "version_test@linesight.io"
PASSWORD = "Password123!"  # Compliant password


async def main():
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        print("=" * 60)
        print("SCHEMA MAPPING VERSIONING TEST")
        print("=" * 60)

        # 0. Register (ignore if exists)
        print("\n[0] Registering test user...")
        try:
            reg_resp = await client.post(
                f"{API_BASE}/auth/register",
                json={
                    "email": EMAIL,
                    "password": PASSWORD,
                    "full_name": "Version Test User",
                    "organization_name": "Version Test Org",
                    "organization_code": "VER-TEST",
                },
            )
            if reg_resp.status_code == 201:
                print("✅ Registered new user")
            else:
                print(
                    f"ℹ️  Registration skipped/failed (might exist): {reg_resp.status_code}"
                )
        except Exception as e:
            print(f"⚠️  Registration error: {e}")

        # 1. Login
        print("\n[1] Logging in...")
        login_resp = await client.post(
            f"{API_BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD}
        )
        if login_resp.status_code != 200:
            print(f"❌ Login failed: {login_resp.text}")
            return

        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"✅ Logged in as {EMAIL}")

        # 2. Get a factory and line
        print("\n[2] Getting factory and line...")
        factories_resp = await client.get(f"{API_BASE}/factories/", headers=headers)
        if factories_resp.status_code != 200:
            print(
                f"❌ Failed to list factories: {factories_resp.status_code} {factories_resp.text}"
            )
            return

        factories = factories_resp.json()
        if not factories:
            print("   No factories found. Creating verification factory...")
            create_fac_resp = await client.post(
                f"{API_BASE}/factories/",
                headers=headers,
                json={
                    "name": "Verification Factory",
                    "code": "VER-FAC-01",
                    "country": "US",
                    "timezone": "UTC",
                },
            )
            if create_fac_resp.status_code != 201:
                print(f"❌ Failed to create factory: {create_fac_resp.text}")
                return
            factory = create_fac_resp.json()
        else:
            factory = factories[0]

        factory_id = factory["id"]
        print(f"   Factory: {factory['name']} ({factory_id[:8]}...)")

        # Get production lines
        lines_resp = await client.get(
            f"{API_BASE}/factories/{factory_id}/lines", headers=headers
        )
        if lines_resp.status_code != 200:
            print("❌ Failed to list lines.")
            return

        lines = lines_resp.json()
        if not lines:
            print("   No lines found. Creating verification line...")
            create_line_resp = await client.post(
                f"{API_BASE}/factories/{factory_id}/lines",
                headers=headers,
                json={"name": "Verification Line", "code": "VER-L1"},
            )
            if create_line_resp.status_code != 201:
                print(f"❌ Failed to create line: {create_line_resp.text}")
                return
            line = create_line_resp.json()
        else:
            line = lines[0]

        line_id = line["id"]
        print(f"   Line: {line['name']} ({line_id[:8]}...)")

        # 3. Upload first file
        print("\n[3] Uploading first file...")
        csv_data_v1 = """Style Number,PO Number,Actual Qty,Production Date
VERSION-TEST-001,PO-V1,100,2026-01-05
"""
        files = {"file": ("version_test_v1.csv", csv_data_v1, "text/csv")}

        upload_resp_v1 = await client.post(
            f"{API_BASE}/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
            files=files,
            headers=headers,
        )
        if upload_resp_v1.status_code != 200:
            print(f"❌ Upload failed: {upload_resp_v1.text}")
            return

        raw_import_id_v1 = upload_resp_v1.json()["raw_import_id"]
        print(f"✅ Uploaded: {raw_import_id_v1[:8]}...")

        # 4. Confirm first mapping
        print("\n[4] Confirming first mapping (should create version 1)...")
        confirm_payload_v1 = {
            "raw_import_id": raw_import_id_v1,
            "production_line_id": line_id,
            "factory_id": factory_id,
            "time_column": "Production Date",
            "mappings": [
                {"source_column": "Style Number", "target_field": "style_number"},
                {"source_column": "PO Number", "target_field": "po_number"},
                {"source_column": "Actual Qty", "target_field": "actual_qty"},
                {"source_column": "Production Date", "target_field": "production_date"},
            ],
        }

        confirm_resp_v1 = await client.post(
            f"{API_BASE}/ingestion/confirm-mapping",
            json=confirm_payload_v1,
            headers=headers,
        )
        if confirm_resp_v1.status_code != 200:
            print(f"❌ Confirm failed: {confirm_resp_v1.text}")
            return

        data_source_id = confirm_resp_v1.json()["data_source_id"]
        mapping_id_v1 = confirm_resp_v1.json()["schema_mapping_id"]
        print(f"✅ SchemaMapping v1: {mapping_id_v1[:8]}...")
        print(f"   DataSource: {data_source_id[:8]}...")

        # 5. Upload second file
        print("\n[5] Uploading second file...")
        csv_data_v2 = """Style Number,PO Number,Actual Qty,SAM,Production Date
VERSION-TEST-002,PO-V2,200,1.5,2026-01-05
"""
        files_v2 = {"file": ("version_test_v2.csv", csv_data_v2, "text/csv")}

        upload_resp_v2 = await client.post(
            f"{API_BASE}/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
            files=files_v2,
            headers=headers,
        )
        raw_import_id_v2 = upload_resp_v2.json()["raw_import_id"]
        print(f"✅ Uploaded: {raw_import_id_v2[:8]}...")

        # 6. Confirm second mapping (should create version 2 and deactivate v1)
        print(
            "\n[6] Confirming second mapping (should create version 2, deactivate v1)..."
        )
        confirm_payload_v2 = {
            "raw_import_id": raw_import_id_v2,
            "production_line_id": line_id,
            "factory_id": factory_id,
            "time_column": "Production Date",
            "data_source_id": data_source_id,  # Reuse existing data source
            "mappings": [
                {"source_column": "Style Number", "target_field": "style_number"},
                {"source_column": "PO Number", "target_field": "po_number"},
                {"source_column": "Actual Qty", "target_field": "actual_qty"},
                {"source_column": "SAM", "target_field": "sam"},
                {"source_column": "Production Date", "target_field": "production_date"},
            ],
        }

        confirm_resp_v2 = await client.post(
            f"{API_BASE}/ingestion/confirm-mapping",
            json=confirm_payload_v2,
            headers=headers,
        )
        if confirm_resp_v2.status_code != 200:
            print(f"❌ Confirm failed: {confirm_resp_v2.text}")
            return

        mapping_id_v2 = confirm_resp_v2.json()["schema_mapping_id"]
        print(f"✅ SchemaMapping v2: {mapping_id_v2[:8]}...")

        # 7. Verification - Query the database via API isn't possible,
        #    so we print instructions for manual verification
        print("\n" + "=" * 60)
        print("VERIFICATION")
        print("=" * 60)
        print(f"""
Run this query in DBeaver to verify:

SELECT id, version, is_active, created_at 
FROM schema_mappings 
WHERE data_source_id = '{data_source_id}'
ORDER BY version DESC;

Expected Result:
┌────────────────┬─────────┬───────────┐
│ version        │ is_active                │
├────────────────┼─────────┼───────────┤
│ 2              │ 1 (TRUE)                 │  ← NEW (active)
│ 1              │ 0 (FALSE)                │  ← OLD (deactivated)
└────────────────┴─────────┴───────────┘

If v1 shows is_active=0 and v2 shows is_active=1, versioning works! ✅
""")


if __name__ == "__main__":
    asyncio.run(main())
