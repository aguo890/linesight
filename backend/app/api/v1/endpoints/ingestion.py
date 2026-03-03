# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

# backend\app\api\v1\endpoints\ingestion.py
"""
Ingestion API Endpoints.

Handles the HITL (Human-in-the-Loop) data ingestion flow:
1. Upload file → Create RawImport record
2. Process file → Run through Waterfall Matching Engine
3. Confirm mapping → Save SchemaMapping and learn corrections

Schemas are defined in app.schemas.ingestion for reusability.
"""

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.alias_mapping import AliasMapping, AliasScope
from app.models.datasource import DataSource, SchemaMapping
from app.models.raw_import import RawImport, StagingRecord
from app.models.user import User, UserRole

# Import schemas from dedicated module
from app.schemas.ingestion import (
    AvailableField,
    ColumnMappingResult,
    ConfirmMappingRequest,
    ConfirmMappingResponse,
    ProcessingResponse,
    PreviewResponse,
)
from app.services.matching import HybridMatchingEngine

# ProductionLine is an alias for DataSource after the refactor
ProductionLine = DataSource

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


# ============================================================================
# Helper Functions
# ============================================================================


def get_sample_data_from_import(raw_import: RawImport) -> dict[str, list[Any]]:
    """Extract sample data per column from raw import."""
    if not raw_import.sample_data:
        return {}

    try:
        sample_rows = json.loads(raw_import.sample_data)
        headers = json.loads(raw_import.raw_headers) if raw_import.raw_headers else []

        if not sample_rows or not headers:
            return {}

        # Transpose rows to columns
        sample_data = {}
        for i, header in enumerate(headers):
            samples = []
            for row in sample_rows[:5]:  # First 5 rows
                if isinstance(row, list) and i < len(row):
                    val = row[i]
                    if val is not None and str(val).strip():
                        samples.append(val)
                elif isinstance(row, dict):
                    val = row.get(header)
                    if val is not None and str(val).strip():
                        samples.append(val)
            sample_data[header] = samples[:5]  # Max 5 samples

        return sample_data

    except (json.JSONDecodeError, TypeError):
        return {}


# ============================================================================
# API Endpoints
# ============================================================================


@router.get("/history")
async def get_upload_history(
    data_source_id: str | None = None,
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Fetch recent file uploads, optionally filtered by data source."""
    query = select(RawImport).order_by(RawImport.created_at.desc()).limit(limit)

    if data_source_id:
        query = query.where(RawImport.data_source_id == data_source_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/upload", response_model=dict[str, Any], status_code=status.HTTP_201_CREATED)
async def upload_file_for_ingestion(
    file: UploadFile = File(...),
    factory_id: str = Query(..., description="REQUIRED: Factory to upload data to"),
    data_source_id: str | None = Query(
        None, description="Optional: Data source to upload data to"
    ),
    production_line_id: str | None = Query(
        None, description="LEGACY: Use data_source_id instead"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),  # Added authentication
):
    """
    Upload a file and create a RawImport record.

    This is step 1 of the HITL flow. The file is saved and parsed.
    Logic delegated to IngestionService.
    """
    from app.services.ingestion.ingestion_service import IngestionService
    
    service = IngestionService(db)
    return await service.handle_upload(
        file=file,
        factory_id=factory_id,
        data_source_id=data_source_id,
        production_line_id=production_line_id,
        current_user_id=str(current_user.id)
    )



@router.post("/process/{raw_import_id}", response_model=ProcessingResponse)
async def process_file(
    raw_import_id: str,
    factory_id: str | None = Query(None),
    llm_enabled: bool = Query(
        True, description="Enable LLM fallback for ambiguous columns"
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Process an uploaded file through the Hybrid Waterfall Matching Engine.

    This is step 2 of the HITL flow. Returns column mappings with confidence scores.
    Logic delegated to IngestionService.
    """
    from app.services.ingestion.ingestion_service import IngestionService
    
    service = IngestionService(db)
    return await service.process_file(
        raw_import_id=raw_import_id, 
        factory_id=factory_id, 
        llm_enabled=llm_enabled
    )



@router.post("/confirm-mapping", response_model=ConfirmMappingResponse)
async def confirm_mapping(
    request: ConfirmMappingRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Confirm column mappings after user review.

    This is step 3 of the HITL flow. Saves the mapping and optionally
    learns from user corrections for future matching.
    Logic delegated to IngestionService.
    """
    from app.services.ingestion.ingestion_service import IngestionService
    
    service = IngestionService(db)
    return await service.confirm_mapping(request)



@router.get("/fields", response_model=list[AvailableField])
async def get_available_fields():
    """
    Get list of available canonical fields for UI dropdown.
    """
    return [
        AvailableField(field=f["field"], description=f["description"])
        for f in HybridMatchingEngine.get_available_fields()
    ]


@router.get("/date-formats")
async def get_date_formats():
    """
    Get list of available date format options for UI dropdown.

    Returns list of {value, label} objects for select component.
    The 'value' should be stored in DataSource.time_format.
    """
    from app.services.ingestion import get_format_options
    return get_format_options()



@router.get("/uploads")
async def list_uploads(
    production_line_id: str | None = Query(
        None, description="Filter by production line"
    ),
    factory_id: str | None = Query(None, description="Filter by factory"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    List uploaded files with optional filtering by production line or factory.

    Returns paginated list of uploads for display in UI.
    """
    from sqlalchemy import desc

    # Build query
    query = select(RawImport)

    if production_line_id:
        # Check both columns to support legacy and new behavior (where Line ID == DataSource ID)
        query = query.where(
            or_(
                RawImport.production_line_id == production_line_id,
                RawImport.data_source_id == production_line_id,
            )
        )
    elif factory_id:
        query = query.where(RawImport.factory_id == factory_id)

    # Order by most recent first
    query = query.order_by(desc(RawImport.created_at))

    # Count total
    from sqlalchemy import func

    count_query = select(func.count()).select_from(RawImport)
    if production_line_id:
        count_query = count_query.where(
            or_(
                RawImport.production_line_id == production_line_id,
                RawImport.data_source_id == production_line_id,
            )
        )
    elif factory_id:
        count_query = count_query.where(RawImport.factory_id == factory_id)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    uploads = result.scalars().all()

    return {
        "files": [
            {
                "id": upload.id,
                "original_filename": upload.original_filename,
                "file_type": upload.mime_type,
                "file_size_bytes": upload.file_size_bytes,
                "row_count": upload.row_count,
                "status": upload.status,
                "data_source_id": upload.data_source_id,
                "created_at": upload.created_at.isoformat()
                if upload.created_at
                else None,
                "factory_id": upload.factory_id,
                "production_line_id": upload.production_line_id,
            }
            for upload in uploads
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/files/{raw_import_id}/download")
async def download_file(
    raw_import_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Download the original uploaded file.

    Returns file for download or viewing.
    """

    from fastapi.responses import FileResponse

    result = await db.execute(select(RawImport).where(RawImport.id == raw_import_id))
    raw_import = result.scalar_one_or_none()
    if not raw_import:
        raise HTTPException(404, f"RawImport not found: {raw_import_id}")

    file_path = Path(raw_import.file_path)
    if not file_path.exists():
        raise HTTPException(
            404, f"File not found on disk: {raw_import.original_filename}"
        )

    return FileResponse(
        path=str(file_path),
        filename=raw_import.original_filename,
        media_type=raw_import.mime_type or "application/octet-stream",
    )



@router.get("/preview/{raw_import_id}", response_model=PreviewResponse)
async def get_import_preview(raw_import_id: str, db: AsyncSession = Depends(get_db)):
    """Fetches formatted preview data for the frontend TablePreview interface."""
    # 1. Get the RawImport metadata
    import_result = await db.execute(
        select(RawImport).where(RawImport.id == raw_import_id)
    )
    raw_import = import_result.scalar_one_or_none()

    if not raw_import:
        raise HTTPException(404, "Import record not found")

    # 2. Get the staging records
    query = (
        select(StagingRecord)
        .where(StagingRecord.raw_import_id == raw_import_id)
        .limit(10)
    )
    result = await db.execute(query)
    records = result.scalars().all()

    # 3. Parse data and extract columns
    rows = [json.loads(r.record_data) for r in records]

    # Extract column names from the first row if data exists
    columns = []
    if rows:
        columns = list(rows[0].keys())
    elif raw_import.raw_headers:
        columns = json.loads(raw_import.raw_headers)

    # 4. Return the structured object matching frontend TablePreview interface
    # Transform dict rows to list of lists for 'sample_rows' to match FilePreview interface
    sample_rows = []
    if rows:
        for row in rows:
            sample_rows.append([row.get(col) for col in columns])
    elif raw_import.sample_data:
        # Fallback to sample data stored in RawImport if no staging records yet
        try:
            sample_rows = json.loads(raw_import.sample_data)
        except json.JSONDecodeError:
            sample_rows = []

    # Sanitize NaNs in sample_rows (JSON doesn't support NaN)
    import math

    sanitized_rows = []
    for row in sample_rows:
        new_row = []
        for cell in row:
            if isinstance(cell, float) and math.isnan(cell):
                new_row.append(None)
            else:
                new_row.append(cell)
        sanitized_rows.append(new_row)
    sample_rows = sanitized_rows

    return PreviewResponse(
        data=sample_rows,
        columns=columns,
        preview_rows=len(sample_rows),
        total_rows=raw_import.row_count or 0,
        total_columns=len(columns),
        filename=raw_import.original_filename,
        status=raw_import.status,
    )



@router.get("/preview-dry-run/{raw_import_id}")
async def get_dry_run_preview(
    raw_import_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    HITL Preview: Show how data will look after import.
    Returns first 20 rows with before/after comparison.
    """
    from app.services.file_processor import FileProcessingService

    processor = FileProcessingService(db)
    preview_data = await processor.preview_dry_run(raw_import_id)
    return preview_data


@router.delete("/uploads", status_code=204)
async def delete_uploads(
    production_line_id: str = Query(
        ..., description="REQUIRED: Production line to clear history for"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete upload history for a production line.

    This is a destructive action that:
    1. Deletes RawImport records from the database
    2. Deletes physical files from disk
    """
    import logging

    logger = logging.getLogger("app.audit")

    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.OWNER, UserRole.FACTORY_MANAGER, UserRole.LINE_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized to clear history")

    # Verify production line exists and belongs to user's organization
    from app.models.factory import Factory

    line_result = await db.execute(
        select(ProductionLine)
        .join(Factory)
        .where(ProductionLine.id == production_line_id)
        .where(Factory.organization_id == current_user.organization_id)
    )
    line = line_result.scalar_one_or_none()

    if not line:
        raise HTTPException(status_code=404, detail="Production line not found")

    # 1. Fetch all imports for this line
    result = await db.execute(
        select(RawImport).where(RawImport.production_line_id == production_line_id)
    )
    uploads = result.scalars().all()

    if not uploads:
        return None

    # 2. Delete physical files
    deleted_count = 0
    for upload in uploads:
        try:
            file_path = Path(upload.file_path)
            if file_path.exists():
                file_path.unlink()
            deleted_count += 1
        except Exception as e:
            # Log error but continue
            logger.error(f"Error deleting file {upload.file_path}: {e}")

    # 3. Delete DB records
    # Bulk delete is more efficient
    from sqlalchemy import delete

    await db.execute(
        delete(RawImport).where(RawImport.production_line_id == production_line_id)
    )
    await db.commit()

    # Audit Log
    logger.info(
        f"AUDIT: User {current_user.id} ({current_user.email}) cleared history for Line {production_line_id}. Deleted {deleted_count} files/records."
    )

    return None


@router.post("/promote/{raw_import_id}", response_model=dict[str, Any])
async def promote_to_production(
    raw_import_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Step 4: Promote data from a confirmed RawImport to production tables.
    Matches records to Style/Order models and creates ProductionRuns.
    """
    import logging
    import traceback

    logger = logging.getLogger("ingestion.promote")

    logger.info("=" * 60)
    logger.info("PROMOTE ENDPOINT CALLED")
    logger.info(f"  raw_import_id: {raw_import_id}")
    logger.info("=" * 60)

    from app.services.file_processor import FileProcessingService

    # Verify RawImport exists and is confirmed
    result = await db.execute(select(RawImport).where(RawImport.id == raw_import_id))
    raw_import = result.scalar_one_or_none()

    if not raw_import:
        logger.error(f"RawImport not found: {raw_import_id}")
        raise HTTPException(404, f"RawImport {raw_import_id} not found")

    logger.info(f"  raw_import.status: {raw_import.status}")
    logger.info(f"  raw_import.factory_id: {raw_import.factory_id}")
    logger.info(f"  raw_import.production_line_id: {raw_import.production_line_id}")
    logger.info(f"  raw_import.data_source_id: {raw_import.data_source_id}")

    if raw_import.status != "confirmed":
        logger.error(f"Invalid status: {raw_import.status}")
        raise HTTPException(
            400,
            f"Cannot promote RawImport with status '{raw_import.status}'. Must be 'confirmed'.",
        )

    try:
        logger.info("Creating FileProcessingService...")
        service = FileProcessingService(db)
        logger.info("Calling promote_to_production...")
        results = await service.promote_to_production(raw_import_id)
        logger.info(f"Promotion SUCCESS: {results}")

        # Add backward compatibility keys for robust tests
        results["success_count"] = results.get("inserted", 0) + results.get("updated", 0)
        results["error_count"] = results.get("errors", 0)

        return results
    except Exception as e:
        logger.error(f"Promotion FAILED: {str(e)}")
        logger.error(traceback.format_exc())
        print(traceback.format_exc())
        raise HTTPException(500, f"Promotion failed: {str(e)}") from e


@router.get("/mapping-state/{raw_import_id}", response_model=ProcessingResponse)
async def get_mapping_state(
    raw_import_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves the current mapping state for a file without re-running the matching engine.
    Used when a user returns to a partially configured or already processed upload.
    """
    result = await db.execute(select(RawImport).where(RawImport.id == raw_import_id))
    raw_import = result.scalar_one_or_none()

    if not raw_import:
        raise HTTPException(404, "Upload not found")

    # If it hasn't been processed yet, we must run the process logic
    if raw_import.status == "uploaded":
        return await process_file(raw_import_id=raw_import_id, db=db)

    # Re-run matching engine in 'readonly' mode or fetch from saved schema
    # For now, we re-run matching to get the ColumnMappingResult objects
    # but the frontend will use this to fill the dashboard.
    return await process_file(raw_import_id=raw_import_id, db=db)
