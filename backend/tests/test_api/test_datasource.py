"""
Tests for DataSource API endpoints.
Uses async patterns consistent with test_ai_decisions.py.
"""

import pytest


@pytest.mark.asyncio
async def test_create_data_source(async_client, auth_headers, test_line):
    """Test creating a new data source."""
    data = {
        "production_line_id": test_line.id,
        "source_name": "Line 1 Production Data",
        "description": "Daily production tracking for Line 1",
        "initial_mapping": {
            "column_map": {
                "Date": "date",
                "Output": "production_count",
                "Efficiency": "efficiency_pct",
            },
            "extraction_rules": {"skip_rows": 1, "header_row": 2},
            "reviewed_by_user": True,
            "user_notes": "Validated mapping",
        },
    }

    response = await async_client.post(
        "/api/v1/datasources", json=data, headers=auth_headers
    )
    assert response.status_code == 201, (
        f"Expected 201, got {response.status_code}: {response.text}"
    )

    result = response.json()
    assert result["production_line_id"] == test_line.id
    assert result["source_name"] == "Line 1 Production Data"
    assert result["is_active"] is True
    assert len(result["schema_mappings"]) == 1

    # Check initial mapping
    mapping = result["schema_mappings"][0]
    assert mapping["version"] == 1
    assert mapping["is_active"] is True
    assert mapping["reviewed_by_user"] is True


@pytest.mark.asyncio
async def test_get_data_source(async_client, auth_headers, test_data_source):
    """Test retrieving a data source by ID."""
    response = await async_client.get(
        f"/api/v1/datasources/{test_data_source.id}", headers=auth_headers
    )
    assert response.status_code == 200

    result = response.json()
    assert result["id"] == test_data_source.id
    assert "source_name" in result
    assert "schema_mappings" in result


@pytest.mark.asyncio
async def test_get_data_source_by_line(
    async_client, auth_headers, test_line, test_data_source
):
    """Test retrieving a data source by production line ID."""
    response = await async_client.get(
        f"/api/v1/datasources/line/{test_line.id}", headers=auth_headers
    )
    assert response.status_code == 200

    result = response.json()
    if result:  # May return null if no data source exists
        assert result["production_line_id"] == test_line.id


@pytest.mark.asyncio
async def test_update_schema_mapping(async_client, auth_headers, test_data_source):
    """Test updating schema mapping (creates new version)."""
    data = {
        "column_map": {
            "Date": "date",
            "Output_Units": "production_count",
            "Line_Efficiency": "efficiency_pct",
            "Downtime": "downtime_minutes",
        },
        "extraction_rules": {
            "skip_rows": 2,
            "header_row": 3,
            "date_format": "MM/DD/YYYY",
        },
        "reviewed_by_user": True,
        "user_notes": "Updated after user review",
    }

    response = await async_client.put(
        f"/api/v1/datasources/{test_data_source.id}/mapping",
        json=data,
        headers=auth_headers,
    )
    assert response.status_code == 200

    result = response.json()
    assert result["version"] > 1  # Should be version 2 or higher
    assert result["is_active"] is True
    assert result["reviewed_by_user"] is True
    assert "Updated after user review" in result["user_notes"]


@pytest.mark.asyncio
async def test_create_duplicate_data_source_fails(
    async_client, auth_headers, test_line, test_data_source
):
    """Test that creating a duplicate data source for the same line fails."""
    # test_data_source already exists for test_line, try to create another
    data = {
        "production_line_id": test_line.id,
        "source_name": "Duplicate Source",
        "description": "Should fail",
    }

    response = await async_client.post(
        "/api/v1/datasources", json=data, headers=auth_headers
    )

    # Should fail since one already exists for this line
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"].lower()


# =============================================================================
# Async Fixtures for DataSource Tests
# =============================================================================


@pytest.fixture
async def test_data_source(async_client, auth_headers, test_line):
    """Create a test data source with initial mapping and return it."""
    data = {
        "production_line_id": test_line.id,
        "source_name": "Test Data Source",
        "description": "For testing",
        "initial_mapping": {
            "column_map": {"Date": "date", "Output": "production_count"},
            "extraction_rules": {"skip_rows": 0, "header_row": 1},
            "reviewed_by_user": False,
            "user_notes": "Initial mapping",
        },
    }

    response = await async_client.post(
        "/api/v1/datasources", json=data, headers=auth_headers
    )
    assert response.status_code == 201, (
        f"Failed to create test data source: {response.text}"
    )

    # Return a simple namespace object with the ID and data
    class DataSourceResult:
        def __init__(self, data):
            self.id = data["id"]
            self.source_name = data["source_name"]
            self.production_line_id = data["production_line_id"]

    return DataSourceResult(response.json())
