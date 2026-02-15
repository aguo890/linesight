# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Golden Master Integration Test: Excel → Widget Output Integrity

Verifies that known Excel input produces exact expected widget output values.
This is the ultimate data integrity test for the Excel-to-Dashboard pipeline.
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factory import Factory, ProductionLine
from app.models.production import ProductionRun


@pytest.mark.asyncio
async def test_golden_master_excel_to_overview_widget(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """
    Golden Master Test: Verify known Excel input produces expected Overview widget output.

    Fixture Data:
    - Style: GOLD-001, Date: today
    - Row 1: Actual=500, Planned=600
    - Row 2: Actual=300, Planned=400

    Expected Overview Output:
    - total_output: 800 (500 + 300)
    """

    # ========================================================================
    # SETUP
    # ========================================================================
    factory = Factory(
        organization_id=test_organization.id,
        name="Golden Master Factory",
        code="GOLD-01",
        country="USA",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    line = ProductionLine(
        factory_id=factory.id, name="Golden Master Line", code="GOLD-L1", is_active=True
    )
    db_session.add(line)
    await db_session.commit()

    factory_id = factory.id
    line_id = line.id
    today = date.today().isoformat()

    # ========================================================================
    # 1. Upload Golden Master CSV with KNOWN values
    # ========================================================================
    csv_data = f"""Style Number,PO Number,Production Date,Actual Qty,Planned Qty,SAM,Operators,Helpers,Worked Minutes
GOLD-001,PO-GOLD-A,{today},500,600,2.0,10,5,480
GOLD-002,PO-GOLD-B,{today},300,400,1.5,8,2,480
"""
    files = {"file": ("golden_master.csv", csv_data, "text/csv")}

    upload_resp = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
        files=files,
        headers=auth_headers,
    )
    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    raw_import_id = upload_resp.json()["raw_import_id"]

    # ========================================================================
    # 2. Confirm Mapping with exact column mappings
    # ========================================================================
    confirm_payload = {
        "raw_import_id": raw_import_id,
        "production_line_id": line_id,
        "factory_id": factory_id,
        "time_column": "Production Date",
        "mappings": [
            {"source_column": "Style Number", "target_field": "style_number"},
            {"source_column": "PO Number", "target_field": "po_number"},
            {"source_column": "Production Date", "target_field": "production_date"},
            {"source_column": "Actual Qty", "target_field": "actual_qty"},
            {"source_column": "Planned Qty", "target_field": "planned_qty"},
            {"source_column": "SAM", "target_field": "sam"},
            {"source_column": "Operators", "target_field": "operators_present"},
            {"source_column": "Helpers", "target_field": "helpers_present"},
            {"source_column": "Worked Minutes", "target_field": "worked_minutes"},
        ],
    }

    confirm_resp = await async_client.post(
        "/api/v1/ingestion/confirm-mapping",
        json=confirm_payload,
        headers=auth_headers,
    )
    assert confirm_resp.status_code == 200, f"Confirm failed: {confirm_resp.text}"

    # ========================================================================
    # 3. Promote to Production
    # ========================================================================
    promote_resp = await async_client.post(
        f"/api/v1/ingestion/promote/{raw_import_id}",
        headers=auth_headers,
    )
    assert promote_resp.status_code == 200, f"Promote failed: {promote_resp.text}"

    promo_data = promote_resp.json()
    # Should have inserted 2 runs
    assert (
        promo_data.get("inserted", 0) >= 2 or promo_data.get("status") == "promoted"
    ), f"Expected at least 2 inserts, got: {promo_data}"

    # Verify ProductionRuns in DB
    db_session.expire_all()
    runs_result = await db_session.execute(
        select(ProductionRun).where(ProductionRun.line_id == line_id)
    )
    runs = runs_result.scalars().all()
    assert len(runs) >= 2, f"Expected at least 2 runs, got {len(runs)}"

    # ========================================================================
    # 4. Call Overview Widget API
    # ========================================================================
    overview_resp = await async_client.get(
        f"/api/v1/analytics/overview?line_id={line_id}",
        headers=auth_headers,
    )
    assert overview_resp.status_code == 200, f"Overview failed: {overview_resp.text}"

    overview_data = overview_resp.json()

    # ========================================================================
    # 5. GOLDEN ASSERTIONS - Exact Values
    # ========================================================================

    # Total Output should be 500 + 300 = 800
    assert overview_data["total_output"] == 800, (
        f"INTEGRITY FAIL: Expected total_output=800, got {overview_data['total_output']}"
    )

    print("\n" + "=" * 60)
    print("GOLDEN MASTER TEST PASSED ✅")
    print("=" * 60)
    print("  Expected total_output: 800")
    print(f"  Actual total_output:   {overview_data['total_output']}")
    print("=" * 60)


@pytest.mark.asyncio
async def test_golden_master_physics_validation_triggers(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """
    Test that physics validation flags anomalous data.

    Fixture: Impossibly high efficiency scenario
    - Actual Qty: 1000 units
    - SAM: 10 minutes per unit = 10,000 earned minutes
    - Operators: 2, Helpers: 0 = 2 workers
    - Worked Minutes: 60 = 120 available minutes
    - Efficiency: 10,000 / 120 = 8,333% (CRITICAL ANOMALY)

    Expected: DataQualityIssue should be created with PHYSICS_VIOLATION type
    """
    from sqlalchemy import text

    # ========================================================================
    # SETUP
    # ========================================================================
    factory = Factory(
        organization_id=test_organization.id,
        name="Physics Test Factory",
        code="PHY-01",
        country="USA",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    line = ProductionLine(
        factory_id=factory.id, name="Physics Test Line", code="PHY-L1", is_active=True
    )
    db_session.add(line)
    await db_session.commit()

    factory_id = factory.id
    line_id = line.id
    today = date.today().isoformat()

    # ========================================================================
    # 1. Upload CSV with ANOMALOUS data (impossible efficiency)
    # ========================================================================
    csv_data = f"""Style Number,PO Number,Production Date,Actual Qty,Planned Qty,SAM,Operators,Helpers,Worked Minutes
ANOMALY-001,PO-BAD,{today},1000,1000,10.0,2,0,60
"""
    files = {"file": ("anomaly.csv", csv_data, "text/csv")}

    upload_resp = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
        files=files,
        headers=auth_headers,
    )
    assert upload_resp.status_code == 200
    raw_import_id = upload_resp.json()["raw_import_id"]

    # ========================================================================
    # 2. Confirm Mapping
    # ========================================================================
    confirm_payload = {
        "raw_import_id": raw_import_id,
        "production_line_id": line_id,
        "factory_id": factory_id,
        "time_column": "Production Date",
        "mappings": [
            {"source_column": "Style Number", "target_field": "style_number"},
            {"source_column": "PO Number", "target_field": "po_number"},
            {"source_column": "Production Date", "target_field": "production_date"},
            {"source_column": "Actual Qty", "target_field": "actual_qty"},
            {"source_column": "Planned Qty", "target_field": "planned_qty"},
            {"source_column": "SAM", "target_field": "sam"},
            {"source_column": "Operators", "target_field": "operators_present"},
            {"source_column": "Helpers", "target_field": "helpers_present"},
            {"source_column": "Worked Minutes", "target_field": "worked_minutes"},
        ],
    }

    confirm_resp = await async_client.post(
        "/api/v1/ingestion/confirm-mapping",
        json=confirm_payload,
        headers=auth_headers,
    )
    assert confirm_resp.status_code == 200

    # ========================================================================
    # 3. Promote (should trigger physics validation)
    # ========================================================================
    promote_resp = await async_client.post(
        f"/api/v1/ingestion/promote/{raw_import_id}",
        headers=auth_headers,
    )
    assert promote_resp.status_code == 200

    # ========================================================================
    # 4. Verify DataQualityIssue was created
    # ========================================================================
    result = await db_session.execute(
        text("""
            SELECT * FROM data_quality_issues
            WHERE raw_import_id = :import_id
            AND issue_type = 'PHYSICS_VIOLATION'
        """),
        {"import_id": raw_import_id},
    )
    issues = result.fetchall()

    assert len(issues) >= 1, (
        f"Expected at least 1 PHYSICS_VIOLATION issue, got {len(issues)}"
    )

    # Verify the issue mentions high efficiency
    issue_messages = [row.message for row in issues]
    has_efficiency_warning = any(
        "Efficiency" in msg or "High" in msg for msg in issue_messages
    )

    print("\n" + "=" * 60)
    print("PHYSICS VALIDATION TEST PASSED ✅")
    print("=" * 60)
    print(f"  DataQualityIssues created: {len(issues)}")
    print(f"  Messages: {issue_messages}")
    print("=" * 60)

    assert has_efficiency_warning, (
        f"Expected efficiency-related warning message, got: {issue_messages}"
    )
