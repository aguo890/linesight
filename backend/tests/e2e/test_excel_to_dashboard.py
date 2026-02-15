# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from pathlib import Path

import pytest


# Helper to load the golden master file
def get_golden_master_path():
    return Path(__file__).parent.parent / "fixtures" / "golden_master_production.xlsx"


@pytest.fixture
async def setup_e2e_environment(db_session):
    """
    Sets up the Factory, Production Line, and DataSource for the E2E test.
    Ensures they are linked to the 'demo@linesight.io' account.
    """
    from sqlalchemy import select

    from app.core.security import hash_password
    from app.models.datasource import DataSource
    from app.models.factory import Factory, ProductionLine
    from app.models.user import Organization, User

    # 0. Ensure Demo User & Org
    # (Mirroring generate_production_data.py logic)
    org_res = await db_session.execute(
        select(Organization).where(Organization.code == "DEMO-ORG")
    )
    org = org_res.scalar_one_or_none()
    if not org:
        org = Organization(name="LineSight Demo Org", code="DEMO-ORG")
        db_session.add(org)
        await db_session.commit()
        await db_session.refresh(org)

    user_res = await db_session.execute(
        select(User).where(User.email == "demo@linesight.io")
    )
    user = user_res.scalar_one_or_none()
    if not user:
        user = User(
            organization_id=org.id,
            email="demo@linesight.io",
            hashed_password=hash_password("demo123"),
            full_name="Demo User",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

    # 1. Factory
    factory = Factory(
        organization_id=org.id,
        name="E2E Verifiable Factory",
        code="E2E-VER-FAC",
        country="EG",  # Match埃及 for realistic Egipto tests
        timezone="Africa/Cairo",
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)

    # 2. Line
    line = ProductionLine(
        factory_id=factory.id,
        name="Verifiable Line 1",
        code="V-LINE-1",
        target_operators=10,
        is_active=True,
    )
    db_session.add(line)
    await db_session.commit()
    await db_session.refresh(line)

    # 3. Data Source
    ds = DataSource(
        production_line_id=line.id,
        source_name="Excel Upload (Verifiable)",
        time_column="production_date",
        description="E2E Test Source for demo@linesight.io",
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    return {
        "user": user,
        "org": org,
        "factory": factory,
        "line": line,
        "data_source": ds,
    }


@pytest.mark.asyncio
async def test_e2e_excel_ingestion_and_dashboard(
    async_client, setup_e2e_environment, db_session
):
    """
    Full End-to-End Test:
    1. Upload Golden Master Excel
    2. Infer Schema & Preview
    3. Promote to Production
    4. Verify Dashboard APIs match the Excel Truth
    """
    env = setup_e2e_environment
    line_id = env["line"].id
    ds_id = env["data_source"].id

    # --- SETUP AUTH ---
    from types import SimpleNamespace

    from app.api.deps import get_current_user
    from app.main import app

    fake_user = SimpleNamespace(
        id=env["user"].id,
        organization_id=env["user"].organization_id,
        role="admin",
        is_active=True,
        preferences="{}",
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user

    # --- STEP 1: UPLOAD ---
    file_path = get_golden_master_path()
    assert file_path.exists(), "Golden Master file not found!"

    with open(file_path, "rb") as f:
        files = {
            "file": (
                "golden_master_production.xlsx",
                f,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        }
        # Route: /ingestion/upload?factory_id=...&production_line_id=...
        response = await async_client.post(
            f"/api/v1/ingestion/upload?factory_id={env['factory'].id}&production_line_id={line_id}",
            files=files,
        )

    assert response.status_code == 200, response.text
    upload_data = response.json()
    raw_import_id = upload_data["raw_import_id"]  # Matches response_model

    # --- STEP 2: INFER SCHEMA (Process) ---
    # Route: /ingestion/process/{id}
    # Pass factory_id query param explicitly
    response = await async_client.post(
        f"/api/v1/ingestion/process/{raw_import_id}",
        params={"factory_id": str(env["factory"].id)},
    )

    assert response.status_code == 200, f"Process failed: {response.text}"

    # Force Confirm Schema (mocking user acceptance)
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models.raw_import import RawImport

    # Re-fetch import to get configs
    result = await db_session.execute(
        select(RawImport)
        .where(RawImport.id == raw_import_id)
        .options(selectinload(RawImport.data_source))
    )
    raw_import_obj = result.scalar_one()

    # Check if a datasource was auto-assigned (if not existing) or we need to link it
    # In upload, we passed line_id, so it might create linked DS or find one.
    # We setup a DS in setup_e2e_environment, but did we link it?
    # Actually, file_processor.infer_schema usually suggests a mapping.
    # Manually create the Active Mapping directly to bypass the 'Confirm' complexity for this test
    # (Checking confirm endpoint is a separate integration test)

    from app.models.datasource import SchemaMapping

    # Check if we already have a mapping? Process endpoint doesn't save to DB usually, just returns.
    # confirm-mapping does the save.
    # Let's manually insert the MAPPING that matches our columns.

    column_map = {
        "production_date": "production_date",
        "shift": "shift",
        "style_number": "style_number",
        "po_number": "po_number",
        "planned_qty": "planned_qty",
        "actual_qty": "actual_qty",
        "operators_present": "operators_present",
        "helpers_present": "helpers_present",
        "worked_minutes": "worked_minutes",
        "sam": "sam",
        "downtime_minutes": "downtime_minutes",
        "downtime_reason": "downtime_reason",
        "defects": "defects",
        "dhu": "dhu",
    }

    # We need to ensure the raw_import is linked to our DS
    raw_import_obj.data_source_id = ds_id
    raw_import_obj.status = "confirmed"  # promote needs this

    # Creates mapping
    mapping = SchemaMapping(
        data_source_id=ds_id, version=1, is_active=True, column_map=column_map
    )
    db_session.add(mapping)
    await db_session.commit()

    # CRITICAL: Expire session to ensure file_processor sees the new mapping
    # because we are using the same session with expire_on_commit=False
    db_session.expire_all()

    # --- STEP 3: PREVIEW (Dry Run) ---
    # Route: GET /ingestion/preview-dry-run/{id}
    response = await async_client.get(
        f"/api/v1/ingestion/preview-dry-run/{raw_import_id}"
    )
    assert response.status_code == 200, f"Preview failed: {response.text}"

    # --- STEP 4: PROMOTE ---
    # Route: POST /ingestion/promote/{id}
    response = await async_client.post(f"/api/v1/ingestion/promote/{raw_import_id}")
    assert response.status_code == 200, f"Promote failed: {response.text}"
    promote_data = response.json()
    # Expect runs to be inserted
    assert promote_data["inserted"] > 0, f"No runs inserted: {promote_data}"

    # --- STEP 5: VERIFICATION (The "Truth" Check) ---

    # 5.1 Overview Stats (Aggregate)
    # 5.1 Overview Stats (Returns "Effective Date" stats, i.e., Last Day Jan 5 -> 8 units)
    response = await async_client.get(f"/api/v1/analytics/overview?line_id={line_id}")
    assert response.status_code == 200, response.text
    stats = response.json()
    assert stats["total_output"] == 8, (
        f"Expected 8 total output (Day 5), got {stats['total_output']}"
    )

    # 5.1.5 Verify Total History via Chart
    response = await async_client.get(
        f"/api/v1/analytics/production-chart?line_id={line_id}&date_from=2025-01-01&date_to=2025-01-07"
    )
    chart_data = response.json()
    total_chart = sum(p["actual"] for p in chart_data["data_points"])
    # Tolerating small diff if logic differs, but expected 288
    assert total_chart == 288, (
        f"Expected 288 total from chart history, got {total_chart}"
    )

    # 5.2 Efficiency Gauge (Current/Avg)
    # Using Overview stats for now

    # 5.3 Quality (DHU)
    from app.models.events import ProductionEvent
    from app.models.quality import QualityInspection

    # Assert Events were created
    result = await db_session.execute(select(ProductionEvent))
    events = result.scalars().all()
    assert len(events) >= 6, f"Expected at least 6 events, found {len(events)}"
    print(f"VERIFIED: {len(events)} ProductionEvents created.")

    # Assert QualityInspections were created (even for 0 defects)
    result = await db_session.execute(select(QualityInspection))
    qis = result.scalars().all()
    assert len(qis) >= 6, (
        f"Expected at least 6 inspections (one per run), found {len(qis)}"
    )
    print(f"VERIFIED: {len(qis)} QualityInspections created.")

    # Assert at least one inspection has 0 defects (if data allows)
    zero_defect_qis = [q for q in qis if q.defects_found == 0]
    assert len(zero_defect_qis) > 0, (
        "No zero-defect inspections found, check test data."
    )
    print(f"VERIFIED: Found {len(zero_defect_qis)} zero-defect inspections.")

    response = await async_client.get(
        f"/api/v1/analytics/dhu?line_id={line_id}&start_date=2025-01-02&end_date=2025-01-02"
    )
    assert response.status_code == 200
    dhu_data = response.json()
    print(f"DEBUG: DHU Response: {dhu_data}")
    # Should get a point for Jan 2nd
    found_day_2 = False
    for point in dhu_data:
        if point["date"] == "2025-01-02":
            # 11.11...
            # Note: Cast to float to handle potential string/decimal mapping quirks in SQLite/API response
            dhu_val = float(point["dhu"])
            assert 11.0 < dhu_val < 11.2, f"Expected ~11.1 DHU, got {dhu_val}"
            found_day_2 = True
    assert found_day_2, "Day 2 DHU data missing"

    # 5.4 Downtime (Reasons)
    # Day 3: "Needle Breakage" (30 mins)
    response = await async_client.get(
        f"/api/v1/analytics/downtime-reasons?line_id={line_id}"
    )
    assert response.status_code == 200
    downtime_data = response.json()
    # Expected: { reasons: [{ reason: "Needle Breakage", count: 1 }] }
    found_needle = False
    for item in downtime_data["reasons"]:
        if item["reason"] == "Needle Breakage":
            assert item["count"] >= 1
            found_needle = True
    assert found_needle, "Downtime Reason 'Needle Breakage' not found in aggregations."

    # 5.5 Production Timeline (Hourly)
    # This might be tricky since we only uploaded SHIFT level data.
    # The backend might spread it or show single point.
    # Just verify valid response for now.
    response = await async_client.get(
        f"/api/v1/analytics/production/hourly?line_id={line_id}"
    )
    assert response.status_code == 200

    # CLEANUP
    app.dependency_overrides.pop(get_current_user)
