# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.raw_import import StagingRecord


@pytest.mark.asyncio
async def test_preview_endpoint_success(
    async_client: AsyncClient, db_session, test_organization, auth_headers
):
    """Test that process_file populates staging and /preview returns it."""
    # 0. Setup: Create Line
    factory = Factory(
        organization_id=test_organization.id,
        name="Test Preview Factory",
        code="TPF-001",
        country="Test Country",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    line = DataSource(
        factory_id=factory.id, name="Test Preview Line", code="TPL-01", is_active=True
    )
    db_session.add(line)
    await db_session.commit()

    # 1. Setup: Upload a file
    line_id = line.id
    csv_content = b"style_number,po_number,quantity,date\nS1,P1,100,2025-01-01\nS2,P2,200,2025-01-02"
    files = {"file": ("test.csv", csv_content, "text/csv")}

    upload_res = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory.id}&production_line_id={line_id}",
        files=files,
        headers=auth_headers,
    )
    assert upload_res.status_code == 200
    raw_import_id = upload_res.json()["raw_import_id"]

    # 2. Process file (should populate StagingRecord)
    # We don't mock the engine here to see if the real pandas logic works
    process_res = await async_client.post(
        f"/api/v1/ingestion/process/{raw_import_id}", headers=auth_headers
    )
    assert process_res.status_code == 200

    # Verify StagingRecords exist in DB
    result = await db_session.execute(
        select(StagingRecord).where(StagingRecord.raw_import_id == raw_import_id)
    )
    records = result.scalars().all()
    assert len(records) == 2

    # 3. Test Preview Endpoint
    preview_res = await async_client.get(
        f"/api/v1/ingestion/preview/{raw_import_id}", headers=auth_headers
    )
    assert preview_res.status_code == 200
    data = preview_res.json()
    # FIX: Expect standard envelope response
    assert "data" in data, "Response should be enveloped in 'data' key"
    assert len(data["data"]) == 2
    # The record_data stores the RAW columns from file as list of lists
    columns = data["columns"]
    style_idx = columns.index("style_number")
    assert data["data"][0][style_idx] == "S1"
    assert data["data"][1][style_idx] == "S2"


@pytest.mark.asyncio
async def test_list_uploads_includes_datasource_id(
    async_client: AsyncClient, db_session, test_organization, auth_headers
):
    """Test that list_uploads includes data_source_id once confirmed."""
    # 1. Setup: Create Factory and Line
    factory = Factory(
        organization_id=test_organization.id,
        name="Source ID Factory",
        code="SIF-001",
        country="Test Country", # Added required field
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()
    
    line = DataSource(factory_id=factory.id, name="Line 1", code="L1")
    db_session.add(line)
    await db_session.commit()

    # 2. Upload and Confirm Mapping
    csv_content = b"style,qty\nS1,10\n"
    files = {"file": ("test.csv", csv_content, "text/csv")}
    upload_res = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory.id}&production_line_id={line.id}",
        files=files,
        headers=auth_headers,
    )
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    raw_import_id = upload_res.json()["raw_import_id"]

    confirm_res = await async_client.post(
        "/api/v1/ingestion/confirm-mapping",
        json={
            "raw_import_id": raw_import_id,
            "mappings": [{"source_column": "style", "target_field": "style_number"}],
            "time_column": "style",
            "production_line_id": line.id,
        },
        headers=auth_headers,
    )
    assert confirm_res.status_code == 200, f"Confirm failed: {confirm_res.text}"

    # 3. List Uploads and Check
    list_res = await async_client.get(
        f"/api/v1/ingestion/uploads?production_line_id={line.id}", headers=auth_headers
    )
    assert list_res.status_code == 200
    files = list_res.json()["files"]
    assert len(files) == 1
    
    ds_id = files[0]["data_source_id"]
    assert ds_id is not None
    
    # 4. Verify we can fetch the DS with this ID
    # The DS ID should match the line.id in the new architecture
    assert ds_id == line.id
    
    ds_res = await async_client.get(
        f"/api/v1/data-sources/{ds_id}", headers=auth_headers
    )
    assert ds_res.status_code == 200
