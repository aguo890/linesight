# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from datetime import date
import pandas as pd
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import os

from app.models.datasource import DataSource, SchemaMapping
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
    tmp_path,
):
    # 1. Setup Data Source (Using test_line from fixture which is a DataSource)
    # Ensure test_line has no existing mappings to confuse things
    # (assuming clean DB or transaction rollback)

    # 2. Define Mappings (Identity mapping for simplicity)
    column_map = {
        "Production Date": "production_date",
        "Style": "style_number",
        "PO": "po_number",
        "Planned Qty": "planned_qty",
        "Actual Qty": "actual_qty",
        "SAM": "sam",
        "Worked Minutes": "worked_minutes",
        "Operators": "operators_present",
        "DHU": "dhu",
        "Defects": "defects",
        # Required for lookups
        "Buyer": "buyer",
        "Season": "season"
    }

    # Create & Save SchemaMapping
    schema_map = SchemaMapping(
        data_source_id=test_line.id,
        version=1,
        is_active=True,
        column_map=column_map,
        reviewed_by_user=True
    )
    db_session.add(schema_map)
    await db_session.flush()

    # 3. Create Real Excel File
    # Data that matches the mapping
    records = [
        {
            "Production Date": date.today(),
            "Style": "STY-TEST-01",
            "PO": "PO-100",
            "Planned Qty": 100,
            "Actual Qty": 80,
            "SAM": 0.5,
            "Worked Minutes": 480,
            "Operators": 10,
            "DHU": 5.0,
            "Defects": 4,
            "Buyer": "TestBrand",
            "Season": "SS24"
        }
    ]
    df = pd.DataFrame(records)
    
    # Ensure constraints logic: Style must be created if not exists? 
    # IngestionOrchestrator.validator usually *resolves* styles.
    # If style doesn't exist, RecordValidator might fail or auto-create depending on config.
    # The default behavior for "Resolve Styles" usually assumes they exist or creates them?
    # Let's check validator... usually strict.
    # But wait, the original test didn't create styles manually.
    # The original test passed `records` to `_insert_production_runs`.
    # `_insert_production_runs` likely did lookups.
    
    # Let's Pre-Create Style and Order to be safe, as Ingestion typically requires them.
    from app.models.production import Style, Order
    
    style = Style(
        factory_id=test_factory.id,
        style_number="STY-TEST-01",
        base_sam=0.5,
        buyer="TestBrand",
        season="SS24"
    )
    db_session.add(style)
    await db_session.flush()
    
    order = Order(
        style_id=style.id,
        po_number="PO-100",
        quantity=1000,
    )
    # Order doesn't have factory_id in recent schema view, inherited from Style.
    
    db_session.add(order)
    await db_session.commit() # Commit to ensure they are visible

    file_path = tmp_path / "test_ingestion.xlsx"
    df.to_excel(file_path, index=False)

    # 4. Create RawImport
    raw_import = RawImport(
        data_source_id=test_line.id,
        original_filename="test_ingestion.xlsx",
        file_path=str(file_path),
        file_size_bytes=os.path.getsize(file_path),
        file_hash="dummyhash_integration",
        status="confirmed", # Ready to promote
        factory_id=test_factory.id,
        production_line_id=test_line.id, # Legacy compatibility
        sheet_count=1,
        row_count=1,
        column_count=len(records[0])
    )
    db_session.add(raw_import)
    await db_session.commit() # Commit so separate thread/session can see it if needed
    
    # 5. Execute Promote
    processor = FileProcessingService(db_session)
    
    # Use the PUBLIC method now
    await processor.promote_to_production(raw_import.id)
    
    # 6. Run Aggregation
    from app.services.dhu_aggregation import run_dhu_aggregation
    await run_dhu_aggregation(db_session, days_back=7, factory_id=test_factory.id)

    # 7. Verify ProductionRun Exists
    runs = await db_session.execute(select(ProductionRun).where(ProductionRun.source_import_id == raw_import.id))
    assert len(runs.scalars().all()) == 1, "ProductionRun should be created"

    # 8. Check Analytics Endpoints
    
    # Production Chart
    resp = await async_client.get(
        f"/api/v1/analytics/production-chart?line_id={test_line.id}", headers=auth_headers
    )
    # Note: production-chart often requires line_id param or defaults.
    assert resp.status_code == 200
    data = resp.json()
    daily_point = next((d for d in data["data_points"] if d["actual"] > 0), None)
    assert daily_point is not None, "Production Chart should show data"

    # SAM Performance
    resp = await async_client.get(
        f"/api/v1/analytics/sam-performance?line_id={test_line.id}", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["efficiency"]) > 0, "Sam Efficiency should be calculated"

    # DHU History
    resp = await async_client.get(f"/api/v1/analytics/dhu?line_id={test_line.id}", headers=auth_headers)
    data = resp.json()
    assert len(data) > 0, "DHU History should show data"
