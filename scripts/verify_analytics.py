# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
EMAIL = "admin@linesight.dev"
PASSWORD = "admin123"

def login():
    url = f"{BASE_URL}/auth/login"
    payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    headers = {
        "Content-Type": "application/json"
    }
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        print("✅ Login Successful")
        return response.json()["access_token"]
    else:
        print(f"❌ Login Failed: {response.text}")
        exit(1)

def test_endpoint(name, url, token, params=None):
    headers = {
        "Authorization": f"Bearer {token}"
    }
    print(f"\nTesting {name}...")
    if params:
        print(f"  Params: {params}")
    
    try:
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            # Basic validation: check if it returns a dict or list (not empty if expected)
            is_valid = False
            if isinstance(data, list):
                is_valid = True # List can be empty but valid
                print(f"  ✅ Status 200. Result Type: List, Length: {len(data)}")
            elif isinstance(data, dict):
                is_valid = True
                print(f"  ✅ Status 200. Result Type: Dict, Keys: {list(data.keys())[:3]}...")
            
            # Print a snippet
            # print(f"  Snippet: {str(data)[:100]}")
            return data
        else:
            print(f"  ❌ Failed with {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        return None

def run_tests():
    token = login()

    # defined ranges
    today = datetime.now().date()
    last_week_start = today - timedelta(days=7)
    
    date_params = {
        "date_from": last_week_start.isoformat(),
        "date_to": today.isoformat()
    }

    # 1. Overview
    test_endpoint("Overview (Default)", f"{BASE_URL}/analytics/overview", token)
    test_endpoint("Overview (Range)", f"{BASE_URL}/analytics/overview", token, params=date_params)

    # 2. Earned Minutes
    test_endpoint("Earned Minutes (Default)", f"{BASE_URL}/analytics/earned-minutes", token)
    test_endpoint("Earned Minutes (Range)", f"{BASE_URL}/analytics/earned-minutes", token, params=date_params)
    
    # 3. Downtime Reasons
    test_endpoint("Downtime (Default)", f"{BASE_URL}/analytics/downtime-reasons", token)
    test_endpoint("Downtime (Range)", f"{BASE_URL}/analytics/downtime-reasons", token, params=date_params)

    # 4. SAM Performance
    test_endpoint("SAM Performance (Default)", f"{BASE_URL}/analytics/sam-performance", token)
    test_endpoint("SAM Performance (Range)", f"{BASE_URL}/analytics/sam-performance", token, params=date_params)

    # 5. Style Progress
    test_endpoint("Style Progress (Default)", f"{BASE_URL}/analytics/production/styles", token)
    test_endpoint("Style Progress (Range)", f"{BASE_URL}/analytics/production/styles", token, params=date_params)

if __name__ == "__main__":
    run_tests()
