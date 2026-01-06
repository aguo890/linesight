"""
Tests for Upload API endpoints.
"""

import io

import pandas as pd
import pytest
from httpx import AsyncClient

from app.models.factory import ProductionLine


class TestUploadEndpoints:
    """Test file upload endpoints."""

    @pytest.mark.asyncio
    async def test_upload_endpoint_requires_auth(self, async_client: AsyncClient):
        """Test that upload endpoint requires authentication."""
        # Include dummy param so it passes validation (422) and hits auth check (401)
        response = await async_client.post(
            "/api/v1/ingestion/upload?factory_id=00000000-0000-0000-0000-000000000000&production_line_id=00000000-0000-0000-0000-000000000000",
            files={
                "file": (
                    "test.xlsx",
                    b"fake content",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        # Should fail without auth
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_upload_rejects_non_excel(
        self, async_client: AsyncClient, auth_headers: dict, test_factory, db_session
    ):
        """Test that non-Excel files are rejected."""
        # Create a line to satisfy the endpoint requirement
        line = ProductionLine(
            factory_id=test_factory.id, name="Test Line 1", code="TL-1"
        )
        db_session.add(line)
        await db_session.commit()

        response = await async_client.post(
            f"/api/v1/ingestion/upload?factory_id={test_factory.id}&production_line_id={line.id}",
            files={"file": ("test.pdf", b"fake content", "application/pdf")},
            headers=auth_headers,
        )
        assert response.status_code == 400
        # Adapt assertion depending on specific error message structure
        assert "Excel" in str(response.json())

    @pytest.mark.asyncio
    async def test_upload_accepts_xlsx(
        self, async_client: AsyncClient, auth_headers: dict, test_factory, db_session
    ):
        """Test that .xlsx files are accepted."""
        # Create a line to satisfy the endpoint requirement
        line = ProductionLine(
            factory_id=test_factory.id, name="Test Line 2", code="TL-2"
        )
        db_session.add(line)
        await db_session.commit()

        # Create a valid in-memory Excel file
        df = pd.DataFrame({"col1": [1, 2], "col2": ["A", "B"]})
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        content = output.getvalue()

        response = await async_client.post(
            f"/api/v1/ingestion/upload?factory_id={test_factory.id}&production_line_id={line.id}",
            files={
                "file": (
                    "production.xlsx",
                    content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        # Assuming the endpoint returns 200 OK with raw_import_id (based on test_ingestion_deduplication)
        assert response.status_code in [200, 202]
        data = response.json()
        assert "raw_import_id" in data
