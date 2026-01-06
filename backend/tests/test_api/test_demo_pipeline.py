"""
Demo Pipeline Test - Realistic E2E Simulation

This test simulates the COMPLETE backend pipeline for demo@linesight.io:
1. Creates a new Factory with a ProductionLine
2. Uploads the actual Master_Widget_Test_Data.xlsx file
3. Confirms the column mapping
4. Promotes data to production tables
5. Verifies data accessibility via analytics endpoints

Run with: python -m pytest tests/test_api/test_demo_pipeline.py -v
"""

from datetime import date
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factory import Factory, ProductionLine
from app.models.production import Order, ProductionRun, Style
from app.models.raw_import import RawImport

# Path to the test Excel file
TEST_DATA_PATH = (
    Path(__file__).parent.parent.parent / "test_data" / "Master_Widget_Test_Data.xlsx"
)


@pytest.fixture
async def demo_factory_line(db_session: AsyncSession, test_organization):
    """Create demo factory and production line."""
    result = await db_session.execute(
        select(Factory).where(Factory.organization_id == test_organization.id)
    )
    factory = result.scalar_one_or_none()

    if not factory:
        factory = Factory(
            organization_id=test_organization.id,
            name="Demo Factory",
            code="DEMO-001",
            country="USA",
            timezone="America/New_York",
        )
        db_session.add(factory)
        await db_session.flush()

    line = ProductionLine(
        factory_id=factory.id,
        name="Demo Line A",
        code=f"DLA-{int(date.today().strftime('%Y%m%d%H%M%S'))}",
        is_active=True,
    )
    db_session.add(line)
    await db_session.commit()

    return {"factory": factory, "line": line}


@pytest.mark.asyncio
async def test_demo_full_pipeline_with_excel_file(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    demo_factory_line,
):
    """
    Complete demo simulation using Master_Widget_Test_Data.xlsx.

    Tests:
    1. Factory and Line creation
    2. Excel file upload
    3. Column mapping confirmation
    4. Data promotion to production tables
    5. Verification of Style, Order, ProductionRun creation
    6. Analytics endpoint accessibility
    """
    setup = demo_factory_line
    factory_id = str(setup["factory"].id)
    line_id = str(setup["line"].id)

    # Verify test file exists
    assert TEST_DATA_PATH.exists(), f"Test file not found: {TEST_DATA_PATH}"

    # Step 1: Upload Excel file
    with open(TEST_DATA_PATH, "rb") as f:
        file_content = f.read()

    files = {
        "file": (
            "Master_Widget_Test_Data.xlsx",
            file_content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    }

    upload_resp = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
        files=files,
        headers=auth_headers,
    )
    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    raw_import_id = upload_resp.json()["raw_import_id"]

    # Step 2: Confirm column mappings
    mappings = [
        {"source_column": "style_number", "target_field": "style_number"},
        {"source_column": "po_number", "target_field": "po_number"},
        {"source_column": "buyer", "target_field": "buyer"},
        {"source_column": "production_date", "target_field": "production_date"},
        {"source_column": "shift", "target_field": "shift"},
        {"source_column": "actual_qty", "target_field": "actual_qty"},
        {"source_column": "planned_qty", "target_field": "planned_qty"},
        {"source_column": "operators_present", "target_field": "operators_present"},
        {"source_column": "helpers_present", "target_field": "helpers_present"},
        {"source_column": "defects", "target_field": "defects"},
        {"source_column": "dhu", "target_field": "dhu"},
        {"source_column": "downtime_minutes", "target_field": "downtime_minutes"},
        {"source_column": "downtime_reason", "target_field": "downtime_reason"},
    ]

    confirm_resp = await async_client.post(
        "/api/v1/ingestion/confirm-mapping",
        json={
            "raw_import_id": raw_import_id,
            "production_line_id": line_id,
            "factory_id": factory_id,
            "time_column": "production_date",
            "mappings": mappings,
        },
        headers=auth_headers,
    )
    assert confirm_resp.status_code == 200, f"Confirm failed: {confirm_resp.text}"
    data_source_id = confirm_resp.json().get("data_source_id")
    assert data_source_id is not None, "DataSource not created!"

    # Step 3: Promote to production
    promote_resp = await async_client.post(
        f"/api/v1/ingestion/promote/{raw_import_id}",
        headers=auth_headers,
    )
    assert promote_resp.status_code == 200, f"Promote failed: {promote_resp.text}"
    promote_data = promote_resp.json()

    success_count = promote_data.get("success_count", 0)
    error_count = promote_data.get("error_count", 0)

    assert success_count > 0, f"No records promoted! Errors: {error_count}"

    # Step 4: Verify database records
    db_session.expire_all()

    # Check Styles created
    styles_result = await db_session.execute(
        select(Style).where(Style.factory_id == factory_id)
    )
    styles = styles_result.scalars().all()
    style_numbers = {s.style_number for s in styles}

    assert len(styles) >= 1, "No styles created!"
    assert "ST-001" in style_numbers, "Expected style ST-001 not found!"

    # Check Orders created
    orders_result = await db_session.execute(
        select(Order).join(Style).where(Style.factory_id == factory_id)
    )
    orders = orders_result.scalars().all()
    po_numbers = {o.po_number for o in orders}

    assert len(orders) >= 1, "No orders created!"
    assert "PO-1001" in po_numbers or "PO-1002" in po_numbers, "Expected PO not found!"

    # Check ProductionRuns
    runs_result = await db_session.execute(
        select(ProductionRun).where(ProductionRun.line_id == line_id)
    )
    runs = runs_result.scalars().all()

    assert len(runs) == success_count, f"Expected {success_count} runs, got {len(runs)}"

    # Step 5: Test analytics endpoint
    overview_resp = await async_client.get(
        f"/api/v1/analytics/overview?line_id={line_id}",
        headers=auth_headers,
    )
    assert overview_resp.status_code == 200

    # Step 6: Verify RawImport status
    raw_import = await db_session.get(RawImport, raw_import_id)
    assert raw_import.status == "promoted"


@pytest.mark.asyncio
async def test_demo_data_values_integrity(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    demo_factory_line,
):
    """
    Verify specific values from Master_Widget_Test_Data.xlsx
    are correctly stored in the database.
    """
    setup = demo_factory_line
    factory_id = str(setup["factory"].id)
    line_id = str(setup["line"].id)

    # Upload file
    with open(TEST_DATA_PATH, "rb") as f:
        file_content = f.read()

    files = {
        "file": (
            "Master_Widget_Test_Data.xlsx",
            file_content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    }

    upload_resp = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
        files=files,
        headers=auth_headers,
    )
    assert upload_resp.status_code == 200
    raw_import_id = upload_resp.json()["raw_import_id"]

    # Confirm with minimal required mappings
    confirm_resp = await async_client.post(
        "/api/v1/ingestion/confirm-mapping",
        json={
            "raw_import_id": raw_import_id,
            "production_line_id": line_id,
            "factory_id": factory_id,
            "time_column": "production_date",
            "mappings": [
                {"source_column": "style_number", "target_field": "style_number"},
                {"source_column": "po_number", "target_field": "po_number"},
                {"source_column": "production_date", "target_field": "production_date"},
                {"source_column": "actual_qty", "target_field": "actual_qty"},
                {"source_column": "planned_qty", "target_field": "planned_qty"},
            ],
        },
        headers=auth_headers,
    )
    assert confirm_resp.status_code == 200

    # Promote
    promote_resp = await async_client.post(
        f"/api/v1/ingestion/promote/{raw_import_id}",
        headers=auth_headers,
    )
    assert promote_resp.status_code == 200
    promote_data = promote_resp.json()

    assert promote_data["success_count"] >= 5, "Expected at least 5 records"

    # Verify specific styles and POs from the Excel file
    db_session.expire_all()

    styles_result = await db_session.execute(
        select(Style).where(Style.factory_id == factory_id)
    )
    styles = styles_result.scalars().all()
    style_numbers = {s.style_number for s in styles}

    # From the Excel sample: ST-001, ST-002, ST-003
    assert "ST-001" in style_numbers
    assert "ST-002" in style_numbers

    orders_result = await db_session.execute(
        select(Order).join(Style).where(Style.factory_id == factory_id)
    )
    orders = orders_result.scalars().all()
    po_numbers = {o.po_number for o in orders}

    # From the Excel sample: PO-1001, PO-1002, PO-1003
    assert "PO-1001" in po_numbers
    assert "PO-1002" in po_numbers

    # Verify production runs have quantities
    runs_result = await db_session.execute(
        select(ProductionRun).where(ProductionRun.line_id == line_id)
    )
    runs = runs_result.scalars().all()

    total_actual = sum(r.actual_qty or 0 for r in runs)
    assert total_actual > 0, "No actual_qty values found!"
