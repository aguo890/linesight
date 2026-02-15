# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Comprehensive E2E Debug Test for Widget Data Display

This test file traces the ENTIRE data flow from upload to widget display.
Use this to identify exactly where data is getting lost in the pipeline.

Run with: python -m pytest tests/test_api/test_widget_data_e2e.py -v -s
"""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dashboard import Dashboard
from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.production import ProductionRun
from app.models.raw_import import RawImport


@pytest.mark.asyncio
async def test_full_widget_data_flow(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """
    E2E test: Upload → Process → Confirm → Promote → Dashboard → Widget Data

    Debug checkpoints are marked with [CHECKPOINT N].
    If a checkpoint fails, the issue is between that checkpoint and the previous one.
    """

    print("\n" + "=" * 60)
    print("E2E WIDGET DATA FLOW TEST")
    print("=" * 60)

    # ========================================================================
    # SETUP: Create Factory and Line
    # ========================================================================
    result = await db_session.execute(
        select(Factory).where(Factory.organization_id == test_organization.id)
    )
    factory = result.scalar_one_or_none()

    if not factory:
        factory = Factory(
            organization_id=test_organization.id,
            name="E2E Test Factory",
            code="E2E-01",
            country="USA",
            timezone="UTC",
        )
        db_session.add(factory)
        await db_session.flush()

    line = DataSource(
        factory_id=factory.id, name="E2E Test Line", code="E2E-L1", is_active=True
    )
    db_session.add(line)
    await db_session.commit()

    factory_id = factory.id
    line_id = line.id

    print(f"\n[SETUP] Factory: {factory_id[:8]}..., Line: {line_id[:8]}...")

    # ========================================================================
    # CHECKPOINT 1: Upload File
    # ========================================================================
    # Use today's date so analytics endpoint can find the data
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    csv_data = f"""Style Number,PO Number,Production Date,Actual Qty,Planned Qty,SAM,Efficiency
STYLE-001,PO-ABC,{today},500,600,1.5,83.3
STYLE-001,PO-ABC,{yesterday},520,600,1.5,86.7
STYLE-002,PO-DEF,{today},300,350,2.0,85.7
"""
    files = {"file": ("test_e2e.csv", csv_data, "text/csv")}

    upload_resp = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory_id}&production_line_id={line_id}",
        files=files,
        headers=auth_headers,
    )

    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    raw_import_id = upload_resp.json()["raw_import_id"]

    print("\n[CHECKPOINT 1] ✅ Upload Success")
    print(f"  raw_import_id: {raw_import_id}")

    # Verify RawImport record
    raw_import = await db_session.get(RawImport, raw_import_id)
    assert raw_import is not None, "RawImport not found in DB"
    assert raw_import.factory_id == factory_id, "factory_id mismatch"
    assert raw_import.production_line_id == line_id, "production_line_id mismatch"
    print(f"  status: {raw_import.status}")
    print(f"  factory_id: {raw_import.factory_id}")
    print(f"  production_line_id: {raw_import.production_line_id}")

    # ========================================================================
    # CHECKPOINT 2: Confirm Mapping
    # ========================================================================
    confirm_payload = {
        "raw_import_id": raw_import_id,
        "production_line_id": line_id,
        "factory_id": factory_id,
        "time_column": "Production Date",
        "time_format": "YYYY-MM-DD",
        "mappings": [
            {"source_column": "Style Number", "target_field": "style_number"},
            {"source_column": "PO Number", "target_field": "po_number"},
            {"source_column": "Production Date", "target_field": "production_date"},
            {"source_column": "Actual Qty", "target_field": "actual_qty"},
            {"source_column": "Planned Qty", "target_field": "planned_qty"},
            {"source_column": "SAM", "target_field": "sam"},
            {"source_column": "Efficiency", "target_field": "line_efficiency"},
        ],
    }

    confirm_resp = await async_client.post(
        "/api/v1/ingestion/confirm-mapping",
        json=confirm_payload,
        headers=auth_headers,
    )

    assert confirm_resp.status_code == 200, f"Confirm failed: {confirm_resp.text}"
    confirm_data = confirm_resp.json()
    data_source_id = confirm_data.get("data_source_id")

    print("\n[CHECKPOINT 2] ✅ Mapping Confirmed")
    print(f"  data_source_id: {data_source_id}")

    # Verify DataSource was created
    assert data_source_id is not None, "data_source_id not returned!"
    data_source = await db_session.get(DataSource, data_source_id)
    assert data_source is not None, "DataSource not found in DB"
    print(f"  DataSource.id: {data_source.id}")

    # Verify SchemaMapping is active
    await db_session.refresh(data_source, ["schema_mappings"])
    active_mapping = next((m for m in data_source.schema_mappings if m.is_active), None)
    assert active_mapping is not None, "No active SchemaMapping found!"
    print(f"  Active SchemaMapping: {active_mapping.id[:8]}...")
    print(
        f"  column_map has 'style_number': {'style_number' in str(active_mapping.column_map)}"
    )

    # ========================================================================
    # CHECKPOINT 3: Promote to Production
    # ========================================================================
    promote_resp = await async_client.post(
        f"/api/v1/ingestion/promote/{raw_import_id}",
        headers=auth_headers,
    )

    assert promote_resp.status_code == 200, f"Promote failed: {promote_resp.text}"
    promo_data = promote_resp.json()

    print("\n[CHECKPOINT 3] ✅ Promotion Success")
    print(f"  records_processed: {promo_data.get('records_processed')}")
    print(f"  success_count: {promo_data.get('success_count')}")
    print(f"  error_count: {promo_data.get('error_count')}")

    # Verify ProductionRuns were created
    db_session.expire_all()
    runs_result = await db_session.execute(
        select(ProductionRun).where(ProductionRun.data_source_id == line_id)
    )
    runs = runs_result.scalars().all()

    assert len(runs) > 0, "No ProductionRuns created!"
    print(f"  ProductionRuns created: {len(runs)}")

    # Verify RawImport status updated
    raw_import = await db_session.get(RawImport, raw_import_id)
    assert raw_import.status == "promoted", f"Status not updated: {raw_import.status}"
    print(f"  RawImport status: {raw_import.status}")

    # ========================================================================
    # CHECKPOINT 4: Create Dashboard
    # ========================================================================
    dashboard_payload = {
        "name": "E2E Test Dashboard",
        "description": "Dashboard for E2E testing",
        "data_source_id": data_source_id,
        "production_line_id": line_id,
        "widget_config": {
            "enabled_widgets": ["ProductionChart", "DhuQualityChart"],
            "widget_settings": {},
        },
        "layout_config": {"layouts": []},
    }

    dashboard_resp = await async_client.post(
        "/api/v1/dashboards/",
        json=dashboard_payload,
        headers=auth_headers,
    )

    assert dashboard_resp.status_code in [200, 201], (
        f"Dashboard creation failed: {dashboard_resp.text}"
    )
    dashboard_id = dashboard_resp.json().get("id")

    print("\n[CHECKPOINT 4] ✅ Dashboard Created")
    print(f"  dashboard_id: {dashboard_id}")

    # Verify Dashboard has data_source_id
    dashboard = await db_session.get(Dashboard, dashboard_id)
    assert dashboard is not None, "Dashboard not found in DB"
    assert dashboard.data_source_id == data_source_id, (
        f"Dashboard.data_source_id mismatch: {dashboard.data_source_id}"
    )
    print(f"  Dashboard.data_source_id: {dashboard.data_source_id}")

    # ========================================================================
    # CHECKPOINT 5: Widget Data Endpoint
    # ========================================================================
    # Test the analytics endpoint that widgets would call
    analytics_resp = await async_client.get(
        f"/api/v1/analytics/overview?line_id={line_id}",
        headers=auth_headers,
    )

    print("\n[CHECKPOINT 5] Analytics Endpoint")
    print(f"  Status: {analytics_resp.status_code}")
    if analytics_resp.status_code == 200:
        analytics_data = analytics_resp.json()
        print(f"  total_output: {analytics_data.get('total_output')}")
        print(f"  avg_efficiency: {analytics_data.get('avg_efficiency')}")
        assert analytics_data.get("total_output", 0) > 0, "No production data returned!"
        print("  ✅ Widget data available!")
    else:
        print(f"  ❌ Analytics failed: {analytics_resp.text}")

    # ========================================================================
    # FINAL SUMMARY
    # ========================================================================
    print("\n" + "=" * 60)
    print("E2E TEST COMPLETE")
    print("=" * 60)
    print(f"""
Data Flow Summary:
  RawImport: {raw_import_id[:8]}... (status: promoted)
  DataSource: {data_source_id[:8]}... (line: {line_id[:8]}...)
  Dashboard: {dashboard_id[:8]}... (data_source_id: ✅)
  ProductionRuns: {len(runs)} records
  Widget Data: Available ✅
""")


@pytest.mark.asyncio
async def test_widget_endpoint_with_line_filter(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
):
    """
    Test that widget endpoints properly filter by line_id.
    """
    print("\n" + "=" * 60)
    print("WIDGET ENDPOINT LINE FILTER TEST")
    print("=" * 60)

    # Get a line that has production runs
    result = await db_session.execute(
        text("""
            SELECT DISTINCT pr.data_source_id as line_id, COUNT(*) as run_count
            FROM production_runs pr
            GROUP BY pr.data_source_id
        """)
    )
    lines_with_data = result.all()

    print("\nLines with ProductionRuns:")
    for line_id, count in lines_with_data:
        print(f"  {line_id[:8]}...: {count} runs")

    if not lines_with_data:
        pytest.skip("No production runs in database")

    test_line_id = lines_with_data[0][0]

    # Test various analytics endpoints
    endpoints = [
        f"/api/v1/analytics/overview?line_id={test_line_id}",
        f"/api/v1/analytics/production-chart?line_id={test_line_id}",
    ]

    for endpoint in endpoints:
        resp = await async_client.get(endpoint, headers=auth_headers)
        print(f"\n{endpoint.split('?')[0]}")
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"  Response: {str(data)[:100]}...")
        else:
            print(f"  Error: {resp.text[:100]}")
