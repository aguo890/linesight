# backend/scripts/extract_openapi.py
"""
Extract OpenAPI schema from FastAPI app.
Fetches from running API server (Docker-first workflow).
"""

import argparse
import json
import os
import sys

import requests


def extract_openapi(output_path: str, api_url: str = "http://localhost:8000") -> None:
    """Fetch OpenAPI schema from running API and save to file."""
    openapi_url = f"{api_url}/api/v1/openapi.json"
    print(f"Fetching OpenAPI schema from {openapi_url}...")
    
    try:
        response = requests.get(openapi_url, timeout=10)
        response.raise_for_status()
        schema = response.json()
    except requests.RequestException as e:
        print(f"❌ Failed to fetch schema from {openapi_url}")
        print(f"   Error: {e}")
        print(f"   Make sure the API is running (docker-compose up -d)")
        sys.exit(1)

    # Ensure the directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)

    print(f"✓ Schema extraction complete: {output_path}")
    print(f"  - Endpoints: {len(schema.get('paths', {}))}")
    print(f"  - Schemas: {len(schema.get('components', {}).get('schemas', {}))}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract OpenAPI schema from FastAPI app"
    )
    parser.add_argument(
        "--output",
        help="Output path for openapi.json",
        default="../frontend/swagger.json",
    )
    parser.add_argument(
        "--api-url",
        help="API base URL",
        default="http://localhost:8000",
    )
    args = parser.parse_args()
    extract_openapi(args.output, args.api_url)
