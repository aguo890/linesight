import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource import DataSource, SchemaMapping
from app.models.raw_import import RawImport


@pytest.mark.asyncio
async def test_reset_schema_configuration(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """
    Test DELETE /datasources/{id} endpoint.
    Should delete DataSource and associated SchemaMapping.
    """
    # 0. Setup: Factory + Line + DataSource + SchemaMapping
    # Use RAW SQL to insert dependencies to avoid ORM CircularDependencyError during test setup

    factory_id = str(uuid.uuid4())
    line_id = str(uuid.uuid4())
    ds_id = str(uuid.uuid4())
    mapping_id = str(uuid.uuid4())

    await db_session.execute(
        text(f"""
        INSERT INTO factories (id, organization_id, name, code, is_active, country, timezone, created_at, updated_at)
        VALUES ('{factory_id}', '{test_organization.id}', 'Reset Factory', 'RF-001', 1, 'US', 'UTC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """)
    )

    await db_session.execute(
        text(f"""
        INSERT INTO production_lines (id, factory_id, name, code, is_active, created_at, updated_at)
        VALUES ('{line_id}', '{factory_id}', 'Reset Line', 'RL-01', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """)
    )

    await db_session.execute(
        text(f"""
        INSERT INTO data_sources (id, production_line_id, source_name, is_active, time_column, created_at, updated_at)
        VALUES ('{ds_id}', '{line_id}', 'Reset Source', 1, 'Date', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """)
    )

    await db_session.execute(
        text(f"""
        INSERT INTO schema_mappings (id, data_source_id, version, column_map, is_active, reviewed_by_user, user_corrected, created_at, updated_at)
        VALUES ('{mapping_id}', '{ds_id}', 1, '{{"col1": "field1"}}', 1, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """)
    )

    await db_session.commit()

    # 1. Execute Delete
    response = await async_client.delete(
        f"/api/v1/datasources/{ds_id}", headers=auth_headers
    )
    assert response.status_code == 204

    # 2. Verify Deletion
    # Check DataSource gone
    ds_check = await db_session.get(DataSource, ds_id)
    assert ds_check is None

    # Check SchemaMapping gone (cascade)
    sm_result = await db_session.execute(
        select(SchemaMapping).where(SchemaMapping.data_source_id == ds_id)
    )
    sm_check = sm_result.scalars().all()
    assert len(sm_check) == 0


@pytest.mark.asyncio
async def test_clear_upload_history(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
    tmp_path,
):
    """
    Test DELETE /ingestion/uploads endpoint.
    Should delete RawImport records and physical files.
    """
    # 0. Setup: Factory + Line using Raw SQL
    factory_id = str(uuid.uuid4())
    line_id = str(uuid.uuid4())

    await db_session.execute(
        text(f"""
        INSERT INTO factories (id, organization_id, name, code, is_active, country, timezone, created_at, updated_at)
        VALUES ('{factory_id}', '{test_organization.id}', 'History Factory', 'HF-001', 1, 'US', 'UTC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """)
    )

    await db_session.execute(
        text(f"""
        INSERT INTO production_lines (id, factory_id, name, code, is_active, created_at, updated_at)
        VALUES ('{line_id}', '{factory_id}', 'History Line', 'HL-01', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """)
    )

    await db_session.commit()

    # 1. Create a dummy physical file
    dummy_file = tmp_path / "test_deletion.csv"
    dummy_file.write_text("col1,col2\n1,2")
    assert dummy_file.exists()

    # 2. Insert RawImport record using Raw SQL (to avoid ORM overhead in setup)
    import_id = str(uuid.uuid4())
    path_str = str(dummy_file).replace("\\", "/")  # Ensure valid path string

    await db_session.execute(
        text(f"""
        INSERT INTO raw_imports (id, factory_id, production_line_id, original_filename, file_path, file_size_bytes, file_hash, mime_type, status, sheet_count, created_at, updated_at)
        VALUES ('{import_id}', '{factory_id}', '{line_id}', 'test.csv', '{path_str}', 10, 'abc', 'text/csv', 'uploaded', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """)
    )

    await db_session.commit()

    # 4. Execute Delete
    response = await async_client.delete(
        f"/api/v1/ingestion/uploads?production_line_id={line_id}", headers=auth_headers
    )
    assert response.status_code == 204

    # 5. Verify Deletion
    # Check DB record is gone (using ORM get is safe now)
    ri_check = await db_session.get(RawImport, import_id)
    assert ri_check is None

    # Check physical file is gone
    assert not dummy_file.exists()
