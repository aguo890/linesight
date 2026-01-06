"""
Test SchemaMapping versioning and reuse behavior.

Verifies that:
1. Confirming a new mapping deactivates previous mappings
2. Version numbers increment properly
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import SchemaMapping
from app.models.factory import Factory, ProductionLine


@pytest.mark.asyncio
async def test_confirm_mapping_deactivates_previous(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """
    Test that confirming a new mapping:
    1. Deactivates all previous active mappings for the data source
    2. Creates new mapping with incremented version number
    """

    # ========================================================================
    # SETUP: Create Factory, Line for the test
    # ========================================================================
    factory = Factory(
        organization_id=test_organization.id,
        name="Schema Test Factory",
        code="SCH-01",
        country="USA",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    line = ProductionLine(
        factory_id=factory.id, name="Schema Test Line", code="SCH-L1", is_active=True
    )
    db_session.add(line)
    await db_session.commit()

    factory_id = factory.id
    line_id = line.id

    # ========================================================================
    # STEP 1: Upload file
    # ========================================================================
    csv_data = """Style Number,PO Number,Actual Qty,Production Date
STYLE-001,PO-ABC,100,2026-01-05
"""
    files = {"file": ("test_schema.csv", csv_data, "text/csv")}

    upload_resp = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
        files=files,
        headers=auth_headers,
    )
    assert upload_resp.status_code == 200
    raw_import_id = upload_resp.json()["raw_import_id"]

    # ========================================================================
    # STEP 2: First confirm-mapping call
    # ========================================================================
    first_mappings = [
        {"source_column": "Style Number", "target_field": "style_number"},
        {"source_column": "PO Number", "target_field": "po_number"},
        {"source_column": "Actual Qty", "target_field": "actual_qty"},
        {"source_column": "Production Date", "target_field": "production_date"},
    ]

    confirm_payload_v1 = {
        "raw_import_id": raw_import_id,
        "production_line_id": line_id,
        "factory_id": factory_id,
        "time_column": "Production Date",
        "mappings": first_mappings,
    }

    resp_v1 = await async_client.post(
        "/api/v1/ingestion/confirm-mapping",
        json=confirm_payload_v1,
        headers=auth_headers,
    )
    assert resp_v1.status_code == 200
    data_source_id_v1 = resp_v1.json()["data_source_id"]
    schema_mapping_id_v1 = resp_v1.json()["schema_mapping_id"]

    # Verify v1 mapping is active
    mapping_v1 = await db_session.get(SchemaMapping, schema_mapping_id_v1)
    assert mapping_v1 is not None
    assert mapping_v1.is_active == True
    assert mapping_v1.version == 1

    # ========================================================================
    # STEP 3: Upload a second file (simulating repeat upload)
    # ========================================================================
    csv_data_2 = """Style Number,PO Number,Actual Qty,SAM,Production Date
STYLE-002,PO-DEF,200,1.5,2026-01-05
"""
    files_2 = {"file": ("test_schema_v2.csv", csv_data_2, "text/csv")}

    upload_resp_2 = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
        files=files_2,
        headers=auth_headers,
    )
    assert upload_resp_2.status_code == 200
    raw_import_id_2 = upload_resp_2.json()["raw_import_id"]

    # ========================================================================
    # STEP 4: Second confirm-mapping with different mapping
    # ========================================================================
    second_mappings = [
        {"source_column": "Style Number", "target_field": "style_number"},
        {"source_column": "PO Number", "target_field": "po_number"},
        {"source_column": "Actual Qty", "target_field": "actual_qty"},
        {"source_column": "SAM", "target_field": "sam"},
        {"source_column": "Production Date", "target_field": "production_date"},
    ]

    confirm_payload_v2 = {
        "raw_import_id": raw_import_id_2,
        "production_line_id": line_id,
        "factory_id": factory_id,
        "time_column": "Production Date",  # Required field
        "data_source_id": data_source_id_v1,  # Reuse existing data source
        "mappings": second_mappings,
    }

    resp_v2 = await async_client.post(
        "/api/v1/ingestion/confirm-mapping",
        json=confirm_payload_v2,
        headers=auth_headers,
    )
    assert resp_v2.status_code == 200
    schema_mapping_id_v2 = resp_v2.json()["schema_mapping_id"]

    # ========================================================================
    # ASSERTIONS: Verify versioning behavior
    # ========================================================================

    # Refresh v1 mapping from DB
    await db_session.refresh(mapping_v1)

    # V1 should now be INACTIVE
    assert mapping_v1.is_active == False, (
        f"Previous mapping should be deactivated, got is_active={mapping_v1.is_active}"
    )

    # V2 should be ACTIVE with incremented version
    mapping_v2 = await db_session.get(SchemaMapping, schema_mapping_id_v2)
    assert mapping_v2 is not None
    assert mapping_v2.is_active == True, (
        f"New mapping should be active, got is_active={mapping_v2.is_active}"
    )
    assert mapping_v2.version == 2, f"Version should be 2, got {mapping_v2.version}"

    # Verify only ONE active mapping per data source
    result = await db_session.execute(
        select(SchemaMapping).where(
            SchemaMapping.data_source_id == data_source_id_v1,
            SchemaMapping.is_active == True,
        )
    )
    active_mappings = result.scalars().all()
    assert len(active_mappings) == 1, (
        f"Should have exactly 1 active mapping, got {len(active_mappings)}"
    )


@pytest.mark.asyncio
async def test_schema_mapping_version_increments_correctly(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """
    Test that version numbers increment correctly even after multiple updates.
    """
    # Create factory/line
    factory = Factory(
        organization_id=test_organization.id,
        name="Version Test Factory",
        code="VER-01",
        country="USA",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    line = ProductionLine(
        factory_id=factory.id, name="Version Test Line", code="VER-L1", is_active=True
    )
    db_session.add(line)
    await db_session.commit()

    factory_id = factory.id
    line_id = line.id

    versions_created = []

    # Create 3 mappings in succession
    for i in range(1, 4):
        csv_data = f"Col{i},Value\ndata,{i}\n"
        files = {"file": (f"test_v{i}.csv", csv_data, "text/csv")}

        upload_resp = await async_client.post(
            f"/api/v1/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
            files=files,
            headers=auth_headers,
        )
        raw_import_id = upload_resp.json()["raw_import_id"]

        confirm_payload = {
            "raw_import_id": raw_import_id,
            "production_line_id": line_id,
            "factory_id": factory_id,
            "time_column": f"Col{i}",  # Required field
            "mappings": [
                {"source_column": f"Col{i}", "target_field": "style_number"},
            ],
        }

        resp = await async_client.post(
            "/api/v1/ingestion/confirm-mapping",
            json=confirm_payload,
            headers=auth_headers,
        )
        assert resp.status_code == 200

        mapping = await db_session.get(SchemaMapping, resp.json()["schema_mapping_id"])
        versions_created.append(mapping.version)

    # Verify versions are 1, 2, 3
    assert versions_created == [1, 2, 3], (
        f"Versions should be [1, 2, 3], got {versions_created}"
    )
