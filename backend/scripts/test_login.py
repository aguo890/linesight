import json

import requests

# Test login endpoint
url = "http://localhost:8000/api/v1/auth/login"
payload = {"email": "demo@linesight.io", "password": "demo1234"}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"Response Body: {response.text}")

    if response.status_code == 200:
        data = response.json()
        print("\n=== LOGIN SUCCESSFUL ===")
        print(f"Access Token: {data.get('access_token', 'N/A')[:50]}...")
        print(f"User: {data.get('user', {})}")
    else:
        print("\n=== LOGIN FAILED ===")
        try:
            error = response.json()
            print(f"Error: {json.dumps(error, indent=2)}")
        except json.JSONDecodeError:
            print(f"Raw error: {response.text}")

except Exception as e:
    print(f"Error making request: {e}")
