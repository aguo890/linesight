# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Tests for sample data API endpoints.
"""

from fastapi.testclient import TestClient


def test_list_sample_files(client: TestClient):
    """Test listing available sample files."""
    response = client.get("/api/v1/samples/sample-files")
    assert response.status_code == 200

    files = response.json()
    assert isinstance(files, list)

    # Should have at least the 3 main sample files
    filenames = [f["filename"] for f in files]
    assert "perfect_production.xlsx" in filenames
    assert "messy_production.xlsx" in filenames
    assert "ambiguous_production.xlsx" in filenames

    # Check file structure
    for file in files:
        assert "filename" in file
        assert "size" in file
        assert "description" in file
        assert file["size"] > 0


def test_download_sample_file(client: TestClient):
    """Test downloading a specific sample file."""
    response = client.get("/api/v1/samples/sample-files/perfect_production.xlsx")
    assert response.status_code == 200

    # Check headers
    assert (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        in response.headers["content-type"]
    )

    # Check content
    content = response.content
    assert len(content) > 0

    # Excel files start with PK (ZIP signature)
    assert content[:2] == b"PK"


def test_download_csv_sample_file(client: TestClient):
    """Test downloading a CSV sample file."""
    response = client.get("/api/v1/samples/sample-files/perfect_production.csv")
    assert response.status_code == 200

    # Check headers
    assert "text/csv" in response.headers["content-type"]

    # Check content
    content = response.text
    assert len(content) > 0
    assert "Date" in content or "date" in content


def test_download_nonexistent_file(client: TestClient):
    """Test downloading a file that doesn't exist."""
    response = client.get("/api/v1/samples/sample-files/nonexistent.xlsx")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_download_with_path_traversal_attempt(client: TestClient):
    """Test that path traversal is blocked."""
    response = client.get("/api/v1/samples/sample-files/../../../etc/passwd")
    # FastAPI often returns 404 for invalid paths if strict validation isn't custom-caught
    assert response.status_code in [400, 404]
    detail = response.json()["detail"].lower()
    assert "invalid" in detail or "not found" in detail


def test_sample_files_have_descriptions(client: TestClient):
    """Test that sample files have meaningful descriptions."""
    response = client.get("/api/v1/samples/sample-files")
    assert response.status_code == 200

    files = response.json()

    # Find the main sample files and check descriptions
    for file in files:
        if file["filename"] == "perfect_production.xlsx":
            assert (
                "clean" in file["description"].lower()
                or "standard" in file["description"].lower()
            )
        elif file["filename"] == "messy_production.xlsx":
            assert (
                "messy" in file["description"].lower()
                or "inconsistent" in file["description"].lower()
            )
        elif file["filename"] == "ambiguous_production.xlsx":
            assert (
                "ambiguous" in file["description"].lower()
                or "ai" in file["description"].lower()
            )
