# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Test for Quality Data Import.
Verifies that Defect Count, DHU, and Inspection Date are correctly promoted.
"""

from datetime import date
from io import BytesIO

import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.datasource import DataSource, SchemaMapping
from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.production import ProductionRun

# Mock file for quality data
QUALITY_CSV = "Inspection_Date,Style,Line,Diff,Target_Qty,Passed_Qty,Defect_Count,DHU_%\n2024-01-01,ST-100,Line A,Medium,1000,950,50,5.0"


@pytest.fixture
async def setup_quality_test_data(db_session, test_organization):
    """Create test data for quality import (Self-contained)."""
    # 1. Setup Factory & Line
    factory = Factory(
        name="Quality Test Factory",
        organization_id=test_organization.id,
        code="QTF1",
        country="US",
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)

    line = DataSource(
        name="Line A",  # Matches CSV Line column
        factory_id=factory.id,
    )
    db_session.add(line)
    await db_session.commit()
    await db_session.refresh(line)

    # 2. Create a DataSource with SchemaMapping
    ds = DataSource(
        production_line_id=line.id,  # Ensure linked
        source_name="Test Production Data",
        time_column="Inspection_Date",
        description="Test data source",
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    # 3. Create SchemaMapping
    column_map = {
        "Inspection_Date": "inspection_date",
        "Style": "style_number",
        "Line": "notes",
        "Target_Qty": "planned_qty",
        "Passed_Qty": "actual_qty",
        "Defect_Count": "defects",
        "DHU_%": "dhu",
    }

    schema_mapping = SchemaMapping(
        data_source_id=ds.id,
        version=1,
        is_active=True,
        column_map=column_map,
        reviewed_by_user=True,
        user_corrected=False,
        correction_count=0,
    )
    db_session.add(schema_mapping)
    await db_session.commit()

    return factory, line, ds, schema_mapping


@pytest.mark.asyncio
async def test_quality_data_promotion(
    async_client, db_session, auth_headers, setup_quality_test_data
):
    """Test full flow: Upload -> Process -> Promote with Quality Data."""
    factory, line, ds, _ = setup_quality_test_data
    client = async_client  # Use async_client

    # 1. Upload File
    files = {"file": ("quality_test.csv", BytesIO(QUALITY_CSV.encode()), "text/csv")}
    params = {"factory_id": str(factory.id), "production_line_id": line.id}

    response = await client.post(
        "/api/v1/ingestion/upload", headers=auth_headers, files=files, params=params
    )
    assert response.status_code == 200, f"Upload failed: {response.text}"
    raw_import_id = response.json()["raw_import_id"]

    # 2. Process File (Extract headers)
    response = await client.post(
        f"/api/v1/ingestion/process/{raw_import_id}", headers=auth_headers
    )
    assert response.status_code == 200, f"Process failed: {response.text}"

    # 3. Confirm Mapping
    confirmed_mapping = {
        "Inspection_Date": "inspection_date",
        "Style": "style_number",
        "Line": "notes",
        "Target_Qty": "planned_qty",
        "Passed_Qty": "actual_qty",
        "Defect_Count": "defects",
        "DHU_%": "dhu",
    }

    mappings_list = []
    for source, target in confirmed_mapping.items():
        mappings_list.append(
            {
                "source_column": source,
                "target_field": target,
                "ignored": False,
                "user_corrected": False,
            }
        )

    mapping_payload = {
        "raw_import_id": raw_import_id,
        "mappings": mappings_list,
        "time_column": "Inspection_Date",
        "production_line_id": line.id,
        "data_source_id": ds.id,
    }

    response = await client.post(
        "/api/v1/ingestion/confirm-mapping", headers=auth_headers, json=mapping_payload
    )
    assert response.status_code == 200, f"Confirm failed: {response.text}"

    # Verify DB state before promote
    await db_session.refresh(ds)

    # 4. Promote to Production
    response = await client.post(
        f"/api/v1/ingestion/promote/{raw_import_id}", headers=auth_headers
    )
    assert response.status_code == 200, f"Promote failed: {response.text}"
    data = response.json()
    assert data["success_count"] == 1

    # 5. Verify Database Records
    # Fetch Production Run
    query = (
        select(ProductionRun)
        .join(ProductionRun.quality_inspections)
        .options(selectinload(ProductionRun.quality_inspections))
    )
    result = await db_session.execute(query)
    prod_runs = result.scalars().all()

    # Run should match our line and style
    run = next(
        (r for r in prod_runs if r.line_id == line.id and r.actual_qty == 950), None
    )
    assert run, "Production Run not found"

    assert run.actual_qty == 950
    assert len(run.quality_inspections) == 1

    inspection = run.quality_inspections[0]
    assert inspection.defects_found == 50
    assert float(inspection.dhu) == 5.0
    assert inspection.units_checked == 950
    assert inspection.inspected_at.date() == date(2024, 1, 1)
