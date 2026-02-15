# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_storage_segmentation(
    async_client: AsyncClient,
    auth_headers: dict,
    db_session,
    test_factory,
    test_line,
    monkeypatch,
    tmp_path,
):
    """
    Test that files are stored in the correct segmented directory structure.
    Structure: uploads/{factory_id}/{line_id}/{year}/{month}/...
    """
    from app.models.factory import ProductionLine

    # Mock settings.UPLOAD_DIR to use a temporary directory
    mock_upload_dir = tmp_path / "uploads"
    mock_upload_dir.mkdir()
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(mock_upload_dir))

    # Use real IDs from fixtures
    factory_id_1 = str(test_factory.id)
    line_id_1 = str(test_line.id)

    # Create a second line in the same factory
    line_2 = ProductionLine(factory_id=test_factory.id, name="Test Line 2", code="TL2")
    db_session.add(line_2)
    await db_session.commit()
    await db_session.refresh(line_2)
    line_id_2 = str(line_2.id)

    # Create test content
    csv_content = b"Col1,Col2\nVal1,Val2"

    # 1. Upload to Line 1
    files_1 = {"file": ("test_line_1.csv", csv_content, "text/csv")}
    params_1 = {"factory_id": factory_id_1, "production_line_id": line_id_1}

    resp_1 = await async_client.post(
        "/api/v1/ingestion/upload", files=files_1, params=params_1, headers=auth_headers
    )
    assert resp_1.status_code == 200, resp_1.text

    # 2. Upload to Line 2
    files_2 = {"file": ("test_line_2.csv", csv_content, "text/csv")}
    params_2 = {"factory_id": factory_id_1, "production_line_id": line_id_2}

    resp_2 = await async_client.post(
        "/api/v1/ingestion/upload", files=files_2, params=params_2, headers=auth_headers
    )
    assert resp_2.status_code == 200, resp_2.text

    # 3. Upload Unassigned (no IDs)
    files_3 = {"file": ("test_unassigned.csv", csv_content, "text/csv")}

    resp_3 = await async_client.post(
        "/api/v1/ingestion/upload", files=files_3, headers=auth_headers
    )
    # API now requires production_line_id, so this should fail with 422
    assert resp_3.status_code == 422, (
        f"Expected 422 for missing params, got {resp_3.status_code}"
    )

    # Verify Directory Structure on Disk
    upload_root = mock_upload_dir

    # Check Line 1 folder exists
    from datetime import datetime

    now = datetime.utcnow()
    year_str = str(now.year)
    month_str = f"{now.month:02d}"

    path_1 = upload_root / factory_id_1 / line_id_1 / year_str / month_str
    assert path_1.exists(), f"Path {path_1} does not exist"
    assert any(f.name.endswith("test_line_1.csv") for f in path_1.iterdir())

    # Check Line 2 folder exists and is separate
    path_2 = upload_root / factory_id_1 / line_id_2 / year_str / month_str
    assert path_2.exists(), f"Path {path_2} does not exist"
    assert any(f.name.endswith("test_line_2.csv") for f in path_2.iterdir())
    assert not any(f.name.endswith("test_line_1.csv") for f in path_2.iterdir())

    # Unassigned upload is no longer supported, so we don't check for its folder.
