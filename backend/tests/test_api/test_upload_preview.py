# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Test file upload and preview endpoints.
"""

from pathlib import Path

import pytest
from fastapi import status


# Point to the directory created by your fixture
TEST_DATA_DIR = Path(__file__).parent.parent / "data"


@pytest.mark.asyncio
async def test_upload_csv_file(async_client, auth_headers, test_factory, test_line):
    """Test uploading a CSV file."""
    test_file_path = TEST_DATA_DIR / "test_e2e.csv"

    with open(test_file_path, "rb") as f:
        response = await async_client.post(
            "/api/v1/ingestion/upload",
            files={"file": ("test.csv", f, "text/csv")},
            params={"factory_id": test_factory.id, "production_line_id": test_line.id},
            headers=auth_headers,
        )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "raw_import_id" in data
    assert data["filename"] == "test.csv"

    return data["raw_import_id"]


@pytest.mark.asyncio
async def test_preview_csv_file(async_client, auth_headers, test_factory, test_line):
    """Test previewing an uploaded CSV file."""
    # First upload a file
    test_file_path = TEST_DATA_DIR / "test_e2e.csv"

    with open(test_file_path, "rb") as f:
        upload_response = await async_client.post(
            "/api/v1/ingestion/upload",
            files={"file": ("test.csv", f, "text/csv")},
            params={"factory_id": test_factory.id, "production_line_id": test_line.id},
            headers=auth_headers,
        )

    raw_import_id = upload_response.json()["raw_import_id"]

    # Process the file to populate staging records
    await async_client.post(
        f"/api/v1/ingestion/process/{raw_import_id}",
        headers=auth_headers,
    )

    # Now preview it
    response = await async_client.get(
        f"/api/v1/ingestion/preview/{raw_import_id}",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert "columns" in data
    assert "data" in data
    assert "preview_rows" in data
    assert "filename" in data
    assert isinstance(data["columns"], list)
    assert isinstance(data["data"], list)
    assert len(data["data"]) > 0
    assert len(data["data"]) <= 10  # Default preview rows


@pytest.mark.asyncio
async def test_preview_excel_file(async_client, auth_headers, test_factory, test_line):
    """Test previewing an uploaded Excel file."""
    test_file_path = TEST_DATA_DIR / "perfect_production.xlsx"

    with open(test_file_path, "rb") as f:
        upload_response = await async_client.post(
            "/api/v1/ingestion/upload",
            files={
                "file": (
                    "test.xlsx",
                    f,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            params={"factory_id": test_factory.id, "production_line_id": test_line.id},
            headers=auth_headers,
        )

    raw_import_id = upload_response.json()["raw_import_id"]

    # Process the file to populate staging records
    await async_client.post(
        f"/api/v1/ingestion/process/{raw_import_id}",
        headers=auth_headers,
    )

    # Preview the file
    response = await async_client.get(
        f"/api/v1/ingestion/preview/{raw_import_id}",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert len(data["data"]) <= 10  # Default preview limit


@pytest.mark.asyncio
async def test_preview_nonexistent_file(async_client, auth_headers):
    """Test previewing a file that doesn't exist."""
    response = await async_client.get(
        "/api/v1/ingestion/preview/nonexistent-id",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_upload_invalid_file_extension(
    async_client, auth_headers, test_factory, test_line
):
    """Test uploading a file with invalid extension."""
    response = await async_client.post(
        "/api/v1/ingestion/upload",
        files={"file": ("test.txt", b"test content", "text/plain")},
        params={"factory_id": test_factory.id, "production_line_id": test_line.id},
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
