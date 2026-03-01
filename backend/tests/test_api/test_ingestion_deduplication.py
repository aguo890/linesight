# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.raw_import import RawImport


@pytest.mark.asyncio
async def test_ingestion_deduplication(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """Test that uploading the same file twice returns the same record."""
    # 0. Setup: Create Factory and Line
    factory = Factory(
        organization_id=test_organization.id,
        name="Dedupe Factory",
        code="DF-001",
        country="Test Country",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    line = DataSource(
        factory_id=factory.id, name="Dedupe Line", code="DL-01", is_active=True
    )
    db_session.add(line)
    await db_session.commit()

    # 1. First Upload
    csv_content = b"Date,Style,Qty,Eff\n2025-01-01,S-001,100,85"
    files = {"file": ("test_dedupe.csv", csv_content, "text/csv")}

    response1 = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory.id}&production_line_id={line.id}",
        files=files,
        headers=auth_headers,
    )
    assert response1.status_code == 200
    data1 = response1.json()
    raw_import_id1 = data1["raw_import_id"]
    assert "already_exists" not in data1

    # 2. Second Upload (Same file, same line)
    files = {"file": ("test_dedupe.csv", csv_content, "text/csv")}
    response2 = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory.id}&production_line_id={line.id}",
        files=files,
        headers=auth_headers,
    )
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["raw_import_id"] == raw_import_id1
    assert data2["already_exists"] is True


@pytest.mark.asyncio
async def test_mapping_state_endpoint(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """Test the GET /mapping-state/{id} endpoint."""
    # Setup similar to above...
    factory = Factory(
        organization_id=test_organization.id,
        name="State Factory",
        code="SF-001",
        country="US",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()
    line = DataSource(
        factory_id=factory.id, name="State Line", code="SL-01", is_active=True
    )
    db_session.add(line)
    await db_session.commit()

    # Use unique content to avoid hash collision with previous test
    csv_content = b"Date,Style,Qty,Eff\n2025-02-01,S-002,200,90"
    files = {"file": ("test_state.csv", csv_content, "text/csv")}
    upload_res = await async_client.post(
        f"/api/v1/ingestion/upload?factory_id={factory.id}&production_line_id={line.id}",
        files=files,
        headers=auth_headers,
    )
    assert upload_res.status_code == 200
    raw_import_id = upload_res.json()["raw_import_id"]

    # Mock engine for mapping-state
    with patch(
        "app.api.v1.endpoints.ingestion.HybridMatchingEngine"
    ) as mock_engine_cls:
        instance = mock_engine_cls.return_value
        instance.initialize = AsyncMock()
        # Fix mock structure: use simple string for tier to avoid Enum/Pydantic serialization issues
        instance.match_columns.return_value = [
            MagicMock(
                source_column="Date",
                target_field="production_date",
                status="auto_mapped",
                confidence=0.9,
                tier="fuzzy",
                fuzzy_score=90,
                reasoning="",
                sample_data=[],
                ignored=False,
                needs_review=False,
            )
        ]
        instance.get_stats.return_value = {"total": 1, "mapped": 1}

        # Call mapping-state
        response = await async_client.get(
            f"/api/v1/ingestion/mapping-state/{raw_import_id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["raw_import_id"] == raw_import_id
        assert len(data["columns"]) == 1


@pytest.mark.asyncio
async def test_process_idempotency(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """Test that processing a 'confirmed' import doesn't revert its status."""
    factory = Factory(
        organization_id=test_organization.id,
        name="Idem Factory",
        code="IF-001",
        country="US",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()
    line = DataSource(
        factory_id=factory.id, name="Idem Line", code="IL-01", is_active=True
    )
    db_session.add(line)
    await db_session.commit()

    ri = RawImport(
        factory_id=factory.id,
        production_line_id=line.id,
        original_filename="test.csv",
        file_path="fake/path",
        file_size_bytes=100,
        file_hash="fakehash",
        status="confirmed",
        raw_headers='["Date"]',
    )
    db_session.add(ri)
    await db_session.commit()

    with patch(
        "app.api.v1.endpoints.ingestion.HybridMatchingEngine"
    ) as mock_engine_cls:
        instance = mock_engine_cls.return_value
        instance.initialize = AsyncMock()
        instance.match_columns.return_value = []
        instance.get_stats.return_value = {}

        # Process it again
        await async_client.post(
            f"/api/v1/ingestion/process/{ri.id}", headers=auth_headers
        )

        # Verify status remains 'confirmed'
        await db_session.refresh(ri)
        assert ri.status == "confirmed"
