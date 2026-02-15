# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.


import asyncio
import json

import httpx


async def test_endpoint():
    base_url = "http://localhost:8000/api/v1"

    # 1. Login
    login_url = f"{base_url}/auth/login"
    login_data = {
        "email": "admin@linesight.dev",
        "password": "admin123"
    }

    print(f"Logging in to {login_url}...")
    async with httpx.AsyncClient() as client:
        try:
            auth_resp = await client.post(login_url, json=login_data, timeout=10.0)
            print(f"Auth Status: {auth_resp.status_code}")
            if auth_resp.status_code != 200:
                print(f"Auth failed: {auth_resp.text}")
                return

            token = auth_resp.json()["access_token"]
            print("Got access token.")
            headers = {"Authorization": f"Bearer {token}"}

            # 1.5 Check /users/me
            me_url = f"{base_url}/users/me"
            print(f"Requesting {me_url}...")
            me_resp = await client.get(me_url, headers=headers, timeout=10.0)
            print(f"Me Status: {me_resp.status_code}")
            if me_resp.status_code != 200:
                print(f"Me failed: {me_resp.text}")

            # 1.6 Check /analytics/overview
            ov_url = f"{base_url}/analytics/overview"
            print(f"Requesting {ov_url}...")
            ov_resp = await client.get(ov_url, headers=headers, timeout=10.0)
            print(f"Overview Status: {ov_resp.status_code}")
            if ov_resp.status_code != 200:
                print(f"Overview failed: {ov_resp.text}")

            # 2. Trigger Error
            url = f"{base_url}/analytics/production/styles"
            params = {
                "date_from": "2024-12-01",
                "date_to": "2025-04-16",
                "shift": "ALL"
            }
            headers = {"Authorization": f"Bearer {token}"}

            print(f"Requesting {url} with params {params}")
            response = await client.get(url, params=params, headers=headers, timeout=30.0)
            print(f"Status Code: {response.status_code}")
            try:
                data = response.json()
                print("=== ERROR ===")
                print(data.get("error"))
                print("=== TRACEBACK ===")
                print(data.get("traceback"))
                print("=== DEBUG LOG ===")
                print(json.dumps(data.get("debug_log"), indent=2))
            except Exception:
                print(f"Response Body: {response.text}")

        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_endpoint())
