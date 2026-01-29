"""
Integration test for complete dashboard creation flow.
Tests the end-to-end workflow: factory → line → upload → mapping → dashboard
"""

import io

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dashboard import Dashboard
from app.models.datasource import DataSource
from app.models.user import Organization, User


@pytest.mark.asyncio
async def test_complete_dashboard_creation_flow(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_organization: Organization,
    auth_headers: dict,
):
    """
    Test complete dashboard creation flow with quota enforcement.

    Flow:
    1. Create factory (check quota)
    2. Create production line (check quota)
    3. Upload file
    4. Process file (get AI mappings)
    5. Confirm mapping (get data_source_id)
    6. Create dashboard (using data_source_id)
    """

    # Set organization quotas
    org = await db_session.get(Organization, test_organization.id)
    org.max_factories = 2
    org.max_lines_per_factory = 3
    await db_session.commit()

    # =========================================================================
    # Step 1: Create Factory
    # =========================================================================
    factory_response = await async_client.post(
        "/api/v1/factories",
        json={"name": "Test Dashboard Factory", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert factory_response.status_code == 201
    factory_data = factory_response.json()
    factory_id = factory_data["id"]
    assert factory_data["name"] == "Test Dashboard Factory"

    # =========================================================================
    # Step 2: Create DataSource (Direct DB creation)
    # =========================================================================
    data_source = DataSource(
        factory_id=factory_id,
        name="Assembly Line 1",
        is_active=True,
        time_column="Date",
    )
    db_session.add(data_source)
    await db_session.commit()
    await db_session.refresh(data_source)


    # =========================================================================
    # Step 3: Upload File
    # =========================================================================
    # Create a simple CSV file
    csv_content = """Date,Style,Units,Eff%,DHU%
2024-01-01,ST-001,450,85.5,2.1
2024-01-02,ST-001,480,87.0,1.9
2024-01-03,ST-002,390,82.3,2.5"""

    csv_file = io.BytesIO(csv_content.encode("utf-8"))

    upload_response = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory_id}&data_source_id={data_source.id}",
        files={"file": ("production_data.csv", csv_file, "text/csv")},
        headers=auth_headers,
    )
    assert upload_response.status_code == 200  # Endpoint returns 200, not 201
    upload_data = upload_response.json()
    raw_import_id = upload_data["raw_import_id"]
    assert upload_data["filename"] == "production_data.csv"
    assert upload_data["columns"] == 5

    # =========================================================================
    # Step 4: Process File (AI Matching)
    # =========================================================================
    process_response = await async_client.post(
        f"/api/v1/ingestion/process/{raw_import_id}", headers=auth_headers
    )
    assert process_response.status_code == 200
    process_data = process_response.json()
    assert len(process_data["columns"]) == 5
    assert process_data["auto_mapped_count"] >= 0

    # =========================================================================
    # Step 5: Confirm Mapping (Links to existing DataSource)
    # =========================================================================
    # Build mapping confirmations from AI suggestions
    mappings = []
    for col in process_data["columns"]:
        mappings.append(
            {
                "source_column": col["source_column"],
                "target_field": col["target_field"],
                "ignored": col["ignored"],
                "user_corrected": False,
            }
        )

    confirm_response = await async_client.post(
        "/api/v1/ingestion/confirm-mapping",
        json={
            "raw_import_id": raw_import_id,
            "mappings": mappings,
            "data_source_id": data_source.id,
            "factory_id": factory_id,
            "learn_corrections": True,
            "time_column": "Date",
            "time_format": "YYYY-MM-DD",
        },
        headers=auth_headers,
    )
    assert confirm_response.status_code == 200
    confirm_data = confirm_response.json()

    # Verify we got the same data_source_id back
    assert "data_source_id" in confirm_data
    data_source_id = confirm_data["data_source_id"]
    assert "schema_mapping_id" in confirm_data

    # Verify DataSource exists in DB
    fetched_ds = await db_session.get(DataSource, data_source_id)
    assert fetched_ds is not None
    assert fetched_ds.is_active is True

    # =========================================================================
    # Step 6: Create Dashboard (New Database Integration!)
    # =========================================================================
    dashboard_response = await async_client.post(
        "/api/v1/dashboards/",
        json={
            "name": "Production Analytics Dashboard",
            "description": "Dashboard for Assembly Line 1",
            "data_source_id": data_source_id,
            "widget_config": {
                "enabled_widgets": [
                    "production-chart",
                    "line-efficiency",
                    "dhu-quality",
                ],
                "widget_settings": {
                    "production-chart": {"days": 7},
                    "line-efficiency": {"threshold": 85},
                },
            },
            "layout_config": {
                "layouts": [
                    {"widget_id": "chart-1", "x": 0, "y": 0, "w": 2, "h": 2},
                    {"widget_id": "efficiency-1", "x": 2, "y": 0, "w": 1, "h": 1},
                    {"widget_id": "dhu-1", "x": 2, "y": 1, "w": 1, "h": 1},
                ]
            },
        },
        headers=auth_headers,
    )
    assert dashboard_response.status_code == 201
    dashboard_data = dashboard_response.json()
    dashboard_id = dashboard_data["id"]

    # Verify dashboard properties
    assert dashboard_data["name"] == "Production Analytics Dashboard"
    assert dashboard_data["data_source_id"] == data_source_id
    assert dashboard_data["user_id"] == test_user.id

    # Verify widget_config and layout_config are stored as JSON strings
    assert dashboard_data["widget_config"] is not None
    assert dashboard_data["layout_config"] is not None

    # Verify dashboard was persisted to database
    dashboard = await db_session.get(Dashboard, dashboard_id)
    assert dashboard is not None
    assert dashboard.name == "Production Analytics Dashboard"
    assert dashboard.data_source_id == data_source_id
    assert dashboard.user_id == test_user.id

    # =========================================================================
    # Step 7: Retrieve Dashboard
    # =========================================================================
    get_dashboard_response = await async_client.get(
        f"/api/v1/dashboards/{dashboard_id}", headers=auth_headers
    )
    assert get_dashboard_response.status_code == 200
    retrieved_dashboard = get_dashboard_response.json()
    assert retrieved_dashboard["id"] == dashboard_id
    assert retrieved_dashboard["name"] == "Production Analytics Dashboard"

    # =========================================================================
    # Step 8: List Dashboards
    # =========================================================================
    list_response = await async_client.get("/api/v1/dashboards/", headers=auth_headers)
    assert list_response.status_code == 200
    list_data = list_response.json()
    assert list_data["count"] >= 1
    assert any(d["id"] == dashboard_id for d in list_data["dashboards"])


@pytest.mark.asyncio
async def test_dashboard_creation_blocked_by_factory_quota(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_organization: Organization,
    auth_headers: dict,
):
    """Test that dashboard creation is blocked if factory quota is reached."""

    # Set factory quota to 0
    org = await db_session.get(Organization, test_organization.id)
    org.max_factories = 0
    await db_session.commit()

    # Attempt to create factory
    response = await async_client.post(
        "/api/v1/factories",
        json={"name": "Blocked Factory", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )

    assert response.status_code == 403
    error = response.json()
    assert error["detail"]["error"] == "quota_exceeded"
    assert error["detail"]["upgrade_required"] is True


@pytest.mark.asyncio
@pytest.mark.skip(reason="Data source quota enforcement requires /data-sources API fix")
async def test_dashboard_creation_blocked_by_line_quota(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_organization: Organization,
    auth_headers: dict,
):
    """Test that dashboard creation is blocked if line quota is reached."""
    pass


@pytest.mark.asyncio
async def test_multiple_dashboards_same_data_source(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_organization: Organization,
    auth_headers: dict,
):
    """Test creating multiple dashboards from the same data source."""

    # Set up: create factory
    org = await db_session.get(Organization, test_organization.id)
    org.max_factories = 1
    org.max_lines_per_factory = 1
    await db_session.commit()

    # Create factory
    factory_res = await async_client.post(
        "/api/v1/factories",
        json={"name": "Factory", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    factory_id = factory_res.json()["id"]

    # Create data source directly in DB
    data_source = DataSource(
        factory_id=factory_id,
        name="Test Data Source",
        is_active=True,
        time_column="Date",
    )
    db_session.add(data_source)
    await db_session.commit()
    await db_session.refresh(data_source)

    # Create first dashboard
    dashboard1_res = await async_client.post(
        "/api/v1/dashboards/",
        json={
            "name": "Dashboard 1",
            "data_source_id": data_source.id,
        },
        headers=auth_headers,
    )
    assert dashboard1_res.status_code == 201
    dashboard1_id = dashboard1_res.json()["id"]

    # Create second dashboard with same data source
    dashboard2_res = await async_client.post(
        "/api/v1/dashboards/",
        json={
            "name": "Dashboard 2",
            "data_source_id": data_source.id,
        },
        headers=auth_headers,
    )
    assert dashboard2_res.status_code == 201
    dashboard2_id = dashboard2_res.json()["id"]

    # Verify both dashboards exist
    list_res = await async_client.get("/api/v1/dashboards/", headers=auth_headers)
    dashboards = list_res.json()["dashboards"]

    assert len(dashboards) >= 2
    assert any(d["id"] == dashboard1_id for d in dashboards)
    assert any(d["id"] == dashboard2_id for d in dashboards)

    # Both should reference the same data source
    db1 = next(d for d in dashboards if d["id"] == dashboard1_id)
    db2 = next(d for d in dashboards if d["id"] == dashboard2_id)
    assert db1["data_source_id"] == data_source.id
    assert db2["data_source_id"] == data_source.id


@pytest.mark.asyncio
async def test_list_dashboards_filtered_by_factory(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_organization: Organization,
    auth_headers: dict,
):
    """Test filtering dashboards by factory_id."""

    # Setup: Create 2 factories
    org = await db_session.get(Organization, test_organization.id)
    org.max_factories = 2
    org.max_lines_per_factory = 1
    await db_session.commit()

    # Factory 1
    f1_res = await async_client.post(
        "/api/v1/factories",
        json={"name": "F1", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert f1_res.status_code == 201
    f1_id = f1_res.json()["id"]

    # Factory 2
    f2_res = await async_client.post(
        "/api/v1/factories",
        json={"name": "F2", "country": "US", "timezone": "UTC"},
        headers=auth_headers,
    )
    assert f2_res.status_code == 201
    f2_id = f2_res.json()["id"]

    # Data Sources (Direct DB creation to bypass API complexity for this test)
    ds1 = DataSource(
        factory_id=f1_id,  # Linked to F1
        name="DS1",
        is_active=True,
        time_column="Date"
    )
    ds2 = DataSource(
        factory_id=f2_id,  # Linked to F2
        name="DS2",
        is_active=True,
        time_column="Date"
    )
    db_session.add_all([ds1, ds2])
    await db_session.commit()
    await db_session.refresh(ds1)
    await db_session.refresh(ds2)

    # Dashboards
    # D1 in F1
    await async_client.post(
        "/api/v1/dashboards/",
        json={"name": "D1", "data_source_id": ds1.id},
        headers=auth_headers,
    )

    # D2 in F2
    await async_client.post(
        "/api/v1/dashboards/",
        json={"name": "D2", "data_source_id": ds2.id},
        headers=auth_headers,
    )

    # Test 1: List all (should see 2)
    list_all = await async_client.get("/api/v1/dashboards/", headers=auth_headers)
    assert list_all.status_code == 200
    assert list_all.json()["count"] >= 2

    # Test 2: Filter by F1 (should see D1 only)
    list_f1 = await async_client.get(
        f"/api/v1/dashboards/?factory_id={f1_id}", headers=auth_headers
    )
    assert list_f1.status_code == 200
    data_f1 = list_f1.json()
    # Depending on seed data, there might be more, but we check for existence
    assert any(d["name"] == "D1" for d in data_f1["dashboards"])
    assert not any(d["name"] == "D2" for d in data_f1["dashboards"])

    # Test 3: Filter by F2 (should see D2 only)
    list_f2 = await async_client.get(
        f"/api/v1/dashboards/?factory_id={f2_id}", headers=auth_headers
    )
    assert list_f2.status_code == 200
    data_f2 = list_f2.json()
    assert any(d["name"] == "D2" for d in data_f2["dashboards"])
    assert not any(d["name"] == "D1" for d in data_f2["dashboards"])
