from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import DataSource
from app.models.production import ProductionRun
from app.models.raw_import import RawImport
from app.services.file_processor import FileProcessingService


@pytest.mark.asyncio
async def test_full_data_flow(
    db_session: AsyncSession,
    test_organization,
    test_factory,
    test_line,
    async_client,
    auth_headers,
):
    # 1. Setup Data Source & Import
    ds = DataSource(source_name="Test Source", production_line_id=test_line.id)
    db_session.add(ds)
    await db_session.flush()

    # Mock RawImport record
    raw_import = RawImport(
        data_source_id=ds.id,
        original_filename="test.xlsx",
        file_path="mock/path.xlsx",
        file_size_bytes=1000,
        file_hash="dummyhash",
        status="pending",
        factory_id=test_factory.id,
        production_line_id=test_line.id,
    )
    db_session.add(raw_import)
    await db_session.flush()

    processor = FileProcessingService(db_session)

    # 2. Simulate Promoted Data
    records = [
        {
            "production_date": date.today(),
            "style_number": "STY-TEST-01",
            "po_number": "PO-100",
            "planned_qty": 100,
            "actual_qty": 80,
            "sam": 0.5,
            "worked_minutes": 480,  # 8 hours
            "operators_present": 10,
            "dhu": 5.0,
            "defects": 4,
        }
    ]

    # Call internal method to bypass pandas/file complexity
    await processor._insert_production_runs(
        records, factory_id=test_factory.id, production_line_id=test_line.id
    )
    await db_session.commit()

    # Simulate trigger from promote_to_production (since we bypassed it)
    from app.services.dhu_aggregation import run_dhu_aggregation

    await run_dhu_aggregation(db_session, days_back=7, factory_id=test_factory.id)

    # 3. Verify ProductionRun Exists
    runs = await db_session.execute(select(ProductionRun))
    assert len(runs.scalars().all()) == 1, "ProductionRun should be created"

    # DEBUG: Check QualityInspection
    # qi_res = await db_session.execute(select(QualityInspection))
    # assert qi_res.scalars().first() is not None

    # DEBUG: Check DHUReport
    # dhu_reports = await db_session.execute(select(DHUReport))
    # assert len(dhu_reports.scalars().all()) >= 1

    # 4. Check Widget Endpoints (The Failure Points)

    # Production Chart (Should Work)
    resp = await async_client.get(
        "/api/v1/analytics/production-chart", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    daily_point = next((d for d in data["data_points"] if d["actual"] > 0), None)
    assert daily_point is not None, "Production Chart should show data"

    # SAM Performance (Should Fail / Be Empty)
    resp = await async_client.get(
        "/api/v1/analytics/sam-performance", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    # If EfficiencyMetric is missing, these will be 0
    assert data["efficiency"] > 0, (
        "Sam Efficiency should be calculated (EfficiencyMetric missing!)"
    )

    # DHU History (Should Fail / Be Empty)
    resp = await async_client.get("/api/v1/analytics/quality/dhu", headers=auth_headers)
    data = resp.json()
    # If DHUReport is missing (aggregator didn't run), this is empty
    assert len(data) > 0, "DHU History should show data (DHUReport missing!)"
