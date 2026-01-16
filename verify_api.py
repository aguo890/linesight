#!/usr/bin/env python
"""
LineSight API Verification Script (httpx)
Tests all OpenAPI endpoints matching the frontend's generated client.
Uses httpx for async HTTP requests.
"""

import asyncio
import sys
from typing import Any

import httpx

# Configuration
API_URL = "http://127.0.0.1:8000"
TEST_USER = "demo@linesight.io"
TEST_PASS = "demo1234"


class APIClient:
    """Simple httpx client mimicking frontend's axios-client.ts"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.token: str | None = None
        self.client = httpx.AsyncClient(base_url=base_url, timeout=10.0, follow_redirects=True)
    
    async def close(self):
        await self.client.aclose()
    
    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers
    
    async def post(self, url: str, data: dict[str, Any]) -> httpx.Response:
        return await self.client.post(url, json=data, headers=self._headers())
    
    async def get(self, url: str) -> httpx.Response:
        return await self.client.get(url, headers=self._headers())
    
    # ========== OpenAPI Endpoints (matching frontend/src/api/endpoints) ==========
    
    # Authentication
    async def login(self, email: str, password: str) -> httpx.Response:
        """POST /api/v1/auth/login"""
        return await self.post("/api/v1/auth/login", {"email": email, "password": password})
    
    # Health
    async def health(self) -> httpx.Response:
        """GET /health"""
        return await self.client.get("/health")
    
    # Factories
    async def list_factories(self) -> httpx.Response:
        """GET /api/v1/factories"""
        return await self.get("/api/v1/factories")
    
    # Data Sources
    async def list_data_sources(self, factory_id: str) -> httpx.Response:
        """GET /api/v1/factories/{factory_id}/data-sources"""
        return await self.get(f"/api/v1/factories/{factory_id}/data-sources")
    
    # Dashboards
    async def list_dashboards(self) -> httpx.Response:
        """GET /api/v1/dashboards"""
        return await self.get("/api/v1/dashboards")
    
    # Team Members
    async def list_team_members(self) -> httpx.Response:
        """GET /api/v1/organizations/members"""
        return await self.get("/api/v1/organizations/members")


def check(name: str, success: bool, detail: str = "") -> bool:
    """Print a check result."""
    icon = "[OK]" if success else "[FAIL]"
    msg = f"{icon} {name}"
    if detail:
        msg += f" - {detail}"
    print(msg)
    return success


async def main():
    print("\n" + "=" * 60)
    print("  LineSight OpenAPI Endpoint Verification (httpx)")
    print("=" * 60 + "\n")
    
    client = APIClient(API_URL)
    all_passed = True
    
    try:
        # 1. Health Check
        print("[HEALTH]")
        print("-" * 40)
        resp = await client.health()
        all_passed &= check("GET /health", resp.status_code == 200, f"Status {resp.status_code}")
        
        # 2. Authentication
        print("\n[AUTHENTICATION]")
        print("-" * 40)
        resp = await client.login(TEST_USER, TEST_PASS)
        if resp.status_code == 200:
            data = resp.json()
            client.token = data.get("access_token")
            user = data.get("user", {})
            all_passed &= check(
                "POST /api/v1/auth/login", 
                True, 
                f"Token OK, User: {user.get('email')} ({user.get('role')})"
            )
        else:
            all_passed &= check("POST /api/v1/auth/login", False, f"Status {resp.status_code}")
        
        # 3. Factories (requires auth)
        print("\n[FACTORIES]")
        print("-" * 40)
        resp = await client.list_factories()
        if resp.status_code == 200:
            factories = resp.json()
            count = len(factories) if isinstance(factories, list) else "?"
            all_passed &= check("GET /api/v1/factories", True, f"{count} factories returned")
            
            # Test data sources for first factory
            if factories and len(factories) > 0:
                factory_id = factories[0].get("id")
                factory_name = factories[0].get("name", "Unknown")
                resp = await client.list_data_sources(factory_id)
                if resp.status_code == 200:
                    sources = resp.json()
                    count = len(sources) if isinstance(sources, list) else "?"
                    all_passed &= check(
                        f"GET /api/v1/factories/{{id}}/data-sources", 
                        True, 
                        f"{count} sources in '{factory_name}'"
                    )
                else:
                    all_passed &= check("GET /api/v1/factories/{id}/data-sources", False, f"Status {resp.status_code}")
        else:
            all_passed &= check("GET /api/v1/factories", False, f"Status {resp.status_code}")
        
        # 4. Dashboards
        print("\n[DASHBOARDS]")
        print("-" * 40)
        resp = await client.list_dashboards()
        if resp.status_code == 200:
            dashboards = resp.json()
            count = len(dashboards) if isinstance(dashboards, list) else "?"
            all_passed &= check("GET /api/v1/dashboards", True, f"{count} dashboards")
        else:
            all_passed &= check("GET /api/v1/dashboards", False, f"Status {resp.status_code}")
        
        # 5. Team Members
        print("\n[TEAM MEMBERS]")
        print("-" * 40)
        resp = await client.list_team_members()
        if resp.status_code == 200:
            members = resp.json()
            count = len(members) if isinstance(members, list) else "?"
            all_passed &= check("GET /api/v1/organizations/members", True, f"{count} members")
        else:
            all_passed &= check("GET /api/v1/organizations/members", False, f"Status {resp.status_code}")
    
    except httpx.RequestError as e:
        all_passed &= check("Connection", False, str(e))
    
    finally:
        await client.close()
    
    # Summary
    print("\n" + "=" * 60)
    if all_passed:
        print(">>> ALL OPENAPI ENDPOINTS PASSED! <<<")
    else:
        print("!!! SOME ENDPOINTS FAILED - Review above for details !!!")
    print("=" * 60 + "\n")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
