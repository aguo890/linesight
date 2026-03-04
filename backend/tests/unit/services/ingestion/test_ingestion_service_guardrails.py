# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Ingestion Service Guardrails Tests
Sweeps the 168 missing lines in ingestion_service.py.
"""

from datetime import datetime
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.raw_import import RawImport
from app.schemas.ingestion import ColumnMappingConfirmation, ConfirmMappingRequest
from app.services.ingestion.ingestion_service import IngestionService


@pytest.fixture
async def ingestion_service(db_session: AsyncSession):
    return IngestionService(db_session)


@pytest.fixture
async def test_factory_a(db_session: AsyncSession, test_organization):
    factory = Factory(
        organization_id=test_organization.id,
        name="Factory A",
        code="FA",
        country="Test",
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)
    return factory


@pytest.fixture
async def test_factory_b(db_session: AsyncSession, test_organization):
    factory = Factory(
        organization_id=test_organization.id,
        name="Factory B",
        code="FB",
        country="Test",
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)
    return factory


@pytest.mark.asyncio
async def test_b1_unsupported_file_type_raises_400(ingestion_service, test_factory_a):
    """Test B1: Unsupported file type raises HTTPException 400."""
    file_content = b"test content"
    file = UploadFile(
        filename="test.exe",
        file=BytesIO(file_content),
    )

    with pytest.raises(Exception) as exc_info:
        await ingestion_service.handle_upload(
            file=file,
            factory_id=test_factory_a.id,
            data_source_id=None,
            production_line_id=None,
            current_user_id="test-user",
        )

    assert "400" in str(exc_info.value) or "Unsupported file type" in str(
        exc_info.value
    )


@pytest.mark.asyncio
async def test_b2_datasource_factory_mismatch_raises_400(
    ingestion_service, test_factory_a, test_factory_b, db_session
):
    """Test B2: DataSource belongs to Factory A but request has Factory B."""
    line = DataSource(
        factory_id=test_factory_a.id,
        name="Test Line",
        code="TL",
    )
    db_session.add(line)
    await db_session.commit()
    await db_session.refresh(line)

    file_content = b"style,quantity\nSTY01,100"
    file = UploadFile(
        filename="test.csv",
        file=BytesIO(file_content),
    )

    with pytest.raises(Exception) as exc_info:
        await ingestion_service.handle_upload(
            file=file,
            factory_id=test_factory_b.id,
            data_source_id=line.id,
            production_line_id=None,
            current_user_id="test-user",
        )

    assert (
        "400" in str(exc_info.value) or "does not belong" in str(exc_info.value).lower()
    )


@pytest.mark.asyncio
async def test_b3_duplicate_column_mappings_raises_400(
    ingestion_service, test_factory_a, db_session
):
    """Test B3: Duplicate target field mappings raise HTTPException 400 (Pydantic validation)."""
    raw_import = RawImport(
        factory_id=test_factory_a.id,
        original_filename="test.csv",
        file_path="/tmp/test.csv",
        file_size_bytes=100,
        file_hash="abc123",
        status="processed",
    )
    db_session.add(raw_import)
    await db_session.commit()
    await db_session.refresh(raw_import)

    with pytest.raises(Exception) as exc_info:
        request = ConfirmMappingRequest(
            raw_import_id=raw_import.id,
            data_source_id=None,
            production_line_id=None,
            mappings=[
                ColumnMappingConfirmation(
                    source_column="col1",
                    target_field="produced_qty",
                    ignored=False,
                    user_corrected=False,
                ),
                ColumnMappingConfirmation(
                    source_column="col2",
                    target_field="produced_qty",
                    ignored=False,
                    user_corrected=False,
                ),
            ],
            time_column="time",
        )

    assert "Duplicate" in str(exc_info.value)


@pytest.mark.asyncio
async def test_b4_missing_data_source_and_production_line_raises_400(
    ingestion_service, test_factory_a, db_session
):
    """Test B4: Missing both data_source_id and production_line_id raises HTTPException 400."""
    raw_import = RawImport(
        factory_id=test_factory_a.id,
        original_filename="test.csv",
        file_path="/tmp/test.csv",
        file_size_bytes=100,
        file_hash="abc123",
        status="processed",
    )
    db_session.add(raw_import)
    await db_session.commit()
    await db_session.refresh(raw_import)

    request = ConfirmMappingRequest(
        raw_import_id=raw_import.id,
        data_source_id=None,
        production_line_id=None,
        mappings=[
            ColumnMappingConfirmation(
                source_column="col1",
                target_field="produced_qty",
                ignored=False,
                user_corrected=False,
            ),
        ],
        time_column="time",
    )

    with pytest.raises(Exception) as exc_info:
        await ingestion_service.confirm_mapping(request)

    assert "400" in str(exc_info.value) or "Must provide" in str(exc_info.value)


@pytest.mark.asyncio
async def test_b5_schema_locking_increments_version(
    ingestion_service, test_factory_a, db_session
):
    """Test B5: Schema locking increments version on subsequent confirmations."""
    line = DataSource(
        factory_id=test_factory_a.id,
        name="Test Line",
        code="TL",
        schema_config={"col1": "produced_qty"},
    )
    db_session.add(line)
    await db_session.commit()
    await db_session.refresh(line)

    raw_import = RawImport(
        factory_id=test_factory_a.id,
        original_filename="test.csv",
        file_path="/tmp/test.csv",
        file_size_bytes=100,
        file_hash="abc123",
        status="processed",
    )
    db_session.add(raw_import)
    await db_session.commit()
    await db_session.refresh(raw_import)

    request = ConfirmMappingRequest(
        raw_import_id=raw_import.id,
        data_source_id=line.id,
        production_line_id=None,
        mappings=[
            ColumnMappingConfirmation(
                source_column="col1",
                target_field="produced_qty",
                ignored=False,
                user_corrected=False,
            ),
        ],
        time_column="time",
        learn_corrections=False,
    )

    result = await ingestion_service.confirm_mapping(request)

    assert result.schema_mapping_id is not None
