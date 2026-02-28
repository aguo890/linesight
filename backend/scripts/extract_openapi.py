# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

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

# Add backend directory to sys.path to allow importing app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.main import app


def extract_openapi(output_path: str, api_url: str | None = None) -> None:
    """Fetch OpenAPI schema from running API and save to file."""
    if api_url:
        openapi_url = f"{api_url}/api/v1/openapi.json"
        print(f"Fetching OpenAPI schema from {openapi_url}...")

        try:
            response = requests.get(openapi_url, timeout=10)
            response.raise_for_status()
            schema = response.json()
        except requests.RequestException as e:
            print(f"❌ Failed to fetch schema from {openapi_url}")
            print(f"   Error: {e}")
            print("   Make sure the API is running (docker-compose up -d)")
            sys.exit(1)
    else:
        print("Extracting OpenAPI schema directly from FastAPI app in memory...")
        schema = app.openapi()

    # --- Schema Simplification Logic ---
    print("✂️  Simplifying schema names...")

    components = schema.get("components", {})
    schemas = components.get("schemas", {})

    # 1. Calculate Renaming Map
    renaming_map = {} # old_long_name -> new_short_name
    used_names = set()

    # Sort keys to ensure deterministic ordering for collision resolution
    sorted_schema_names = sorted(schemas.keys())

    for schema_name in sorted_schema_names:
        # Split name by dots
        parts = schema_name.split(".")

        # Try shortest name (last segment)
        candidate_name = parts[-1]

        # Collision Handling
        if candidate_name in used_names:
            # Fallback: prepend parent module to make unique (e.g., Datasource_DataSourceCreate)
            # If parts has at least 2 segments
            if len(parts) >= 2:
                candidate_name = parts[-2] + "_" + parts[-1]

            # (Safety) If still collision, keep original (rare but possible)
            if candidate_name in used_names:
                candidate_name = schema_name.replace(".", "_") # Sanitize dots if keeping full name

        used_names.add(candidate_name)
        renaming_map[schema_name] = candidate_name

    print(f"   Renamed {len(renaming_map)} schemas.")

    # Helper function to recursively update refs
    def recursive_update_refs(node, map_lookup):
        if isinstance(node, list):
            return [recursive_update_refs(item, map_lookup) for item in node]

        if isinstance(node, dict):
            new_node = {}
            for key, value in node.items():
                if key == "$ref" and isinstance(value, str):
                    # Value looks like "#/components/schemas/App.Long.Name"
                    if value.startswith("#/components/schemas/"):
                        old_ref_name = value.replace("#/components/schemas/", "")
                        if old_ref_name in map_lookup:
                            new_node[key] = f"#/components/schemas/{map_lookup[old_ref_name]}"
                        else:
                            new_node[key] = value
                    else:
                         new_node[key] = value
                else:
                    new_node[key] = recursive_update_refs(value, map_lookup)
            return new_node

        return node

    # 2. Update Schema Definitions
    new_schemas = {}
    for old_name, schema_body in schemas.items():
        new_name = renaming_map[old_name]
        # Recursively fix internal refs inside this schema immediately
        fixed_schema_body = recursive_update_refs(schema_body, renaming_map)
        new_schemas[new_name] = fixed_schema_body

    components["schemas"] = new_schemas
    schema["components"] = components

    # 3. Update Paths and Global Refs
    if "paths" in schema:
        schema["paths"] = recursive_update_refs(schema["paths"], renaming_map)

    # Ensure the directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)

    print(f"✓ Schema extraction complete: {output_path}")
    print(f"  - Endpoints: {len(schema.get('paths', {}))}")
    print(f"  - Schemas: {len(new_schemas)}")


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
        help="API base URL (optional, defaults to extracting from memory)",
        default=None,
    )
    args = parser.parse_args()
    extract_openapi(args.output, args.api_url)
