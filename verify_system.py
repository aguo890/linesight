#!/usr/bin/env python
"""
LineSight System Verification Script
Verifies all services are properly connected and functioning.
"""

import sys
import requests
import psycopg2

# Configuration
API_URL = "http://localhost:8000"
DB_HOST = "127.0.0.1"
DB_PORT = 5434
DB_USER = "postgres"
DB_PASSWORD = "root"
DB_NAME = "linesight"

TEST_USER = "demo@linesight.io"
TEST_PASS = "demo1234"


def check(name: str, success: bool, detail: str = ""):
    """Print a check result."""
    icon = "✅" if success else "❌"
    msg = f"{icon} {name}"
    if detail:
        msg += f" - {detail}"
    print(msg)
    return success


def main():
    print("\n" + "=" * 50)
    print("  LineSight System Verification")
    print("=" * 50 + "\n")
    
    all_passed = True

    # 1. Database Connection
    print("📦 DATABASE")
    print("-" * 30)
    try:
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT, user=DB_USER,
            password=DB_PASSWORD, database=DB_NAME
        )
        cur = conn.cursor()
        
        # Check version
        cur.execute("SELECT version();")
        version = cur.fetchone()[0].split(",")[0]
        all_passed &= check("PostgreSQL Connection", True, version)
        
        # Check table count
        cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
        table_count = cur.fetchone()[0]
        all_passed &= check("Tables Created", table_count >= 20, f"{table_count} tables")
        
        # Check user count
        cur.execute("SELECT COUNT(*) FROM users;")
        user_count = cur.fetchone()[0]
        all_passed &= check("Seeded Users", user_count > 0, f"{user_count} users")
        
        # Check factory count
        cur.execute("SELECT COUNT(*) FROM factories;")
        factory_count = cur.fetchone()[0]
        all_passed &= check("Seeded Factories", factory_count > 0, f"{factory_count} factories")
        
        conn.close()
    except Exception as e:
        all_passed &= check("PostgreSQL Connection", False, str(e))

    # 2. API Health
    print("\n🌐 API")
    print("-" * 30)
    try:
        resp = requests.get(f"{API_URL}/health", timeout=5)
        all_passed &= check("API Health Endpoint", resp.status_code == 200, f"Status {resp.status_code}")
    except requests.RequestException as e:
        all_passed &= check("API Health Endpoint", False, str(e))

    # 3. Authentication
    print("\n🔐 AUTHENTICATION")
    print("-" * 30)
    try:
        resp = requests.post(
            f"{API_URL}/api/v1/auth/login",
            json={"email": TEST_USER, "password": TEST_PASS},
            timeout=5
        )
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("access_token", "")[:20] + "..."
            all_passed &= check("Login Endpoint", True, f"Token: {token}")
            
            # Verify user info was returned with login
            user_info = data.get("user", {})
            user_email = user_info.get("email", "")
            user_role = user_info.get("role", "")
            if user_email == TEST_USER:
                all_passed &= check("User Info Returned", True, f"{user_email} ({user_role})")
            else:
                all_passed &= check("User Info Returned", False, "Missing user data in response")
        else:
            all_passed &= check("Login Endpoint", False, f"Status {resp.status_code}: {resp.text[:100]}")
    except requests.RequestException as e:
        all_passed &= check("Login Endpoint", False, str(e))

    # 4. Frontend (optional check)
    print("\n🖥️ FRONTEND")
    print("-" * 30)
    try:
        resp = requests.get("http://localhost:5173", timeout=5)
        all_passed &= check("Frontend Dev Server", resp.status_code == 200, "Vite running")
    except requests.RequestException:
        check("Frontend Dev Server", False, "Not reachable (may be expected if not started)")

    # Summary
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 ALL CHECKS PASSED!")
    else:
        print("⚠️ SOME CHECKS FAILED - Review above for details")
    print("=" * 50 + "\n")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
