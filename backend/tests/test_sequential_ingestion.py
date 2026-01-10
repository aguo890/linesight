import pytest
import pandas as pd
import io
from datetime import datetime, timedelta
from sqlalchemy import select
from app.models.production import ProductionRun
from app.models.datasource import DataSource

# --- Helper: Generate Mock Excel ---
def create_mock_excel(start_date, days, base_value, filename):
    data = []
    current = datetime.strptime(start_date, "%Y-%m-%d")
    for i in range(days):
        data.append({
            "Date": current,
            "Units Produced": base_value + i,
            "Efficiency": 90 + (i % 5),
            "Style": "TEST-STYLE-001",
            "PO": "PO-12345"
        })
        current += timedelta(days=1)
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
    output.seek(0)
    return filename, output, len(df)

@pytest.mark.asyncio
async def test_jan_feb_march_continuity(async_client, db_session, test_factory, auth_headers):
    """
    Verifies that uploading Jan, Feb, and March reports sequentially
    results in a single continuous time-series in the database.
    """
    
    # 1. ARRANGE: Create the Data Source Manually
    # We do this to ensure we are testing the NEW architecture (Data Source ID)
    # and avoiding legacy ProductionLine lookup logic.
    data_source = DataSource(
        factory_id=test_factory.id,
        name="Sequential Test Line",
        is_active=True
    )
    db_session.add(data_source)
    await db_session.commit()
    await db_session.refresh(data_source)
    
    print(f"--- Created Test Data Source: {data_source.id} ---")

    # Generate 3 sequential files
    files = [
        create_mock_excel("2024-01-01", 31, 100, "Jan.xlsx"),
        create_mock_excel("2024-02-01", 29, 200, "Feb.xlsx"),
        create_mock_excel("2024-03-01", 31, 300, "Mar.xlsx")
    ]
    
    total_expected_rows = 0

    # 2. ACT: Process each file
    for filename, file_content, row_count in files:
        print(f"--- Uploading {filename} ---")
        
        # A. Upload
        files_payload = {"file": (filename, file_content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        resp = await async_client.post(
            f"/api/v1/ingestion/upload?factory_id={test_factory.id}&data_source_id={data_source.id}",
            files=files_payload,
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        raw_import_id = resp.json()["raw_import_id"]
        
        # B. Process (Generate Mappings)
        resp = await async_client.post(
            f"/api/v1/ingestion/process/{raw_import_id}?factory_id={test_factory.id}",
            headers=auth_headers
        )
        assert resp.status_code == 200
        
        # C. Confirm Mapping
        # We explicitly pass the data_source_id to link them together
        mapping_payload = {
            "raw_import_id": raw_import_id,
            "factory_id": test_factory.id,
            "data_source_id": data_source.id,
            "production_line_id": None, 
            "time_column": "Date",
            "time_format": "YYYY-MM-DD",
            "mappings": [
                {
                    "source_column": "Date", 
                    "target_field": "production_date", 
                    "confidence": 1.0, 
                    "status": "confirmed"
                },
                {
                    "source_column": "Units Produced", 
                    "target_field": "actual_qty", 
                    "confidence": 1.0, 
                    "status": "confirmed"
                },
                {
                    "source_column": "Style", 
                    "target_field": "style_number", 
                    "confidence": 1.0, 
                    "status": "confirmed"
                },
                {
                    "source_column": "PO", 
                    "target_field": "po_number", 
                    "confidence": 1.0, 
                    "status": "confirmed"
                }
            ]
        }
        
        resp = await async_client.post(
            "/api/v1/ingestion/confirm-mapping",
            json=mapping_payload,
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Confirm mapping failed: {resp.text}"

        # D. Promote to Production
        resp = await async_client.post(
            f"/api/v1/ingestion/promote/{raw_import_id}",
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Promote failed: {resp.text}"
        
        total_expected_rows += row_count

    # 3. ASSERT: Verify Continuity
    result = await db_session.execute(
        select(ProductionRun)
        .where(ProductionRun.data_source_id == data_source.id)
        .order_by(ProductionRun.production_date.asc())
    )
    runs = result.scalars().all()

    # Logic Checks
    print(f"Total Rows: {len(runs)} (Expected: {total_expected_rows})")
    assert len(runs) == total_expected_rows
    
    # Check start and end
    # Note: production_date is offset-naive or aware depending on DB, but generally datetime
    assert runs[0].production_date.strftime("%Y-%m-%d") == "2024-01-01"
    assert runs[-1].production_date.strftime("%Y-%m-%d") == "2024-03-31"
    
    # Check the "seam" between Jan and Feb
    # Jan had 31 rows (indexes 0-30). Index 30 is Jan 31. Index 31 is Feb 1.
    jan_end = runs[30]
    feb_start = runs[31]
    
    print(f"Seam Check: {jan_end.production_date} -> {feb_start.production_date}")
    assert jan_end.production_date.month == 1
    assert feb_start.production_date.month == 2
    assert feb_start.production_date > jan_end.production_date
