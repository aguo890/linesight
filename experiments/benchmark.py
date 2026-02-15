# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.


import asyncio
import httpx
import time
import os
import sys
from datetime import datetime

# Adjust path to find app module if needed, though we primarily hit HTTP
# sys.path.append(os.path.join(os.getcwd(), 'backend'))

BASE_URL = "http://localhost:8000/api/v1"

async def get_token(client):
    # 1. Try registering a new user first (to ensure we have a valid account)
    # Use timestamp to uniqueness
    ts = int(time.time())
    new_email = f"bench_{ts}@example.com"
    new_password = "benchmarkpass"
    
    print(f"Attempting to register new user: {new_email}")
    try:
        reg_response = await client.post(f"{BASE_URL}/auth/register", json={
            "email": new_email,
            "password": new_password,
            "full_name": "Benchmark Bot",
            "organization_name": f"Bench Org {ts}",
            "organization_code": f"BENCH_{ts}"
        })
        
        if reg_response.status_code == 201:
            print("Registration successful!")
            # Login with new credentials
            login_response = await client.post(f"{BASE_URL}/auth/login", json={
                "email": new_email,
                "password": new_password
            })
            if login_response.status_code == 200:
                 return login_response.json()["access_token"]
            else:
                 print(f"Login after registration failed: {login_response.text}")
        else:
            print(f"Registration failed: {reg_response.status_code} {reg_response.text}")

    except Exception as e:
        print(f"Registration error: {e}")

    # 2. Fallback to known credentials if registration fails
    creds = [
        ("demo@linesight.io", "password"),
        ("admin@linesight.io", "admin"),
        ("admin@linesight.io", "password"), 
        ("test@example.com", "testpassword123")
    ]
    
    for email, password in creds:
        try:
            print(f"Trying fallback login {email}...")
            response = await client.post(f"{BASE_URL}/auth/login", json={
                "email": email,
                "password": password
            })
            if response.status_code == 200:
                print(f"Success with {email}")
                return response.json()["access_token"]
        except Exception as e:
            pass
            
    return None

async def benchmark():
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("\n--- Benchmarking ---")

        # 1. Get Available Fields (Try without auth first)
        start = time.perf_counter()
        resp = await client.get(f"{BASE_URL}/ingestion/fields")
        duration = (time.perf_counter() - start) * 1000
        print(f"GET /ingestion/fields (No Auth): {duration:.2f}ms (Status: {resp.status_code})")
        
        # If we need auth for others, we try to authenticate
        if resp.status_code == 401 or resp.status_code == 403:
             print("Fields endpoint requires auth.")
        
        print(f"Authenticating for other endpoints...")
        token = await get_token(client)
        if not token:
            print("Could not authenticate. Aborting.")
            return

        headers = {"Authorization": f"Bearer {token}"}

        # 1. Get Available Fields (With Auth)
        if resp.status_code != 200:
            start = time.perf_counter()
            resp = await client.get(f"{BASE_URL}/ingestion/fields", headers=headers)
            duration = (time.perf_counter() - start) * 1000
            print(f"GET /ingestion/fields (With Auth): {duration:.2f}ms (Status: {resp.status_code})")
        
        # 2. List Factories
        start = time.perf_counter()
        resp = await client.get(f"{BASE_URL}/factories", headers=headers)
        duration = (time.perf_counter() - start) * 1000
        print(f"GET /factories: {duration:.2f}ms (Status: {resp.status_code})")
        
        factories = resp.json()
        if not factories:
            print("No factories found.")
            return

        factory_id = factories[0]['id']
        print(f"Using Factory: {factories[0]['name']} ({factory_id})")

        # 3. List Lines for Factory
        start = time.perf_counter()
        resp = await client.get(f"{BASE_URL}/factories/{factory_id}/lines", headers=headers)
        duration = (time.perf_counter() - start) * 1000
        print(f"GET /factories/{factory_id}/lines: {duration:.2f}ms (Status: {resp.status_code})")

        lines = resp.json()
        line_id = lines[0]['id'] if lines else None
        
        if line_id:
            print(f"Using Line: {lines[0]['name']} ({line_id})")
            # 4. List Data Sources/Uploads
            start = time.perf_counter()
            resp = await client.get(f"{BASE_URL}/ingestion/uploads?production_line_id={line_id}&limit=50", headers=headers)
            duration = (time.perf_counter() - start) * 1000
            print(f"GET /ingestion/uploads (for line): {duration:.2f}ms (Status: {resp.status_code})")
        else:
            print("No lines found.")

if __name__ == "__main__":
    asyncio.run(benchmark())
