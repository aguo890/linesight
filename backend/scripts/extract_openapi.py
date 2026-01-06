# backend/scripts/extract_openapi.py
"""
Extract OpenAPI schema from FastAPI app without running the server.
This enables offline, deterministic frontend SDK generation.
"""

import argparse
import json
import os
import sys

# Add the parent directory to sys.path so we can import the app module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app


def extract_openapi(output_path: str) -> None:
    """Extract OpenAPI schema and save to file."""
    print(f"Extracting OpenAPI schema to {output_path}...")

    # Get the OpenAPI schema dictionary directly from the app
    schema = app.openapi()

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
    args = parser.parse_args()
    extract_openapi(args.output)
