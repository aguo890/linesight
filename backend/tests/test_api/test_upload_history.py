# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.raw_import import RawImport


@pytest.mark.asyncio
async def test_upload_history_segmentation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_organization,
):
    """
    Test that uploads are correctly attributed to production lines and queryable.
    """

    # 1. Setup Lines
    factory = Factory(
        organization_id=test_organization.id,
        name="History Test Factory",
        code="HTF-001",
        country="Test Country",
        timezone="UTC",
    )
    db_session.add(factory)
    await db_session.flush()

    line_a = DataSource(factory_id=factory.id, name="Line A", code="LA")
    line_b = DataSource(factory_id=factory.id, name="Line B", code="LB")
    db_session.add_all([line_a, line_b])
    await db_session.commit()
    await db_session.refresh(line_a)
    await db_session.refresh(line_b)

    line_a_id = line_a.id
    line_b_id = line_b.id

    # 2. Upload Files to different lines
    csv_content = b"header1,header2\nval1,val2"

    # Upload to Line A
    files_a = {"file": ("line_a_file.csv", csv_content, "text/csv")}
    params_a = {"factory_id": factory.id, "production_line_id": line_a_id}
    resp_a = await async_client.post(
        "/api/v1/ingestion/upload", files=files_a, params=params_a, headers=auth_headers
    )
    assert resp_a.status_code == 200

    # Upload to Line B
    files_b = {"file": ("line_b_file.csv", csv_content, "text/csv")}
    params_b = {"factory_id": factory.id, "production_line_id": line_b_id}
    resp_b = await async_client.post(
        "/api/v1/ingestion/upload", files=files_b, params=params_b, headers=auth_headers
    )
    assert resp_b.status_code == 200

    # Upload Unassigned
    files_u = {"file": ("unassigned.csv", csv_content, "text/csv")}
    params_u = {"factory_id": factory.id}
    resp_u = await async_client.post(
        "/api/v1/ingestion/upload", files=files_u, params=params_u, headers=auth_headers
    )
    assert resp_u.status_code == 200

    # 3. Verify Database State
    # We don't have a specific "list imports by line" endpoint yet in core (maybe in analytics or production),
    # but we should at least verify the DB records are correct.

    # Check Line A
    result_a = await db_session.execute(
        select(RawImport).where(RawImport.production_line_id == line_a_id)
    )
    imports_a = result_a.scalars().all()
    assert len(imports_a) == 1
    assert imports_a[0].original_filename == "line_a_file.csv"

    # Check Line B
    result_b = await db_session.execute(
        select(RawImport).where(RawImport.production_line_id == line_b_id)
    )
    imports_b = result_b.scalars().all()
    assert len(imports_b) == 1
    assert imports_b[0].original_filename == "line_b_file.csv"

    # Check Unassigned
    result_u = await db_session.execute(
        select(RawImport).where(
            RawImport.factory_id == factory.id, RawImport.production_line_id.is_(None)
        )
    )
    imports_u = result_u.scalars().all()
    assert len(imports_u) == 1
    assert imports_u[0].original_filename == "unassigned.csv"
