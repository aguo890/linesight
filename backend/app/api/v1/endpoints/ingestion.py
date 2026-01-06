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

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.alias_mapping import AliasMapping, AliasScope
from app.models.datasource import DataSource, SchemaMapping
from app.models.factory import ProductionLine
from app.models.raw_import import RawImport, StagingRecord
from app.models.user import User, UserRole

# Import schemas from dedicated module
from app.schemas.ingestion import (
    AvailableField,
    ColumnMappingResult,
    ConfirmMappingRequest,
    ConfirmMappingResponse,
    ProcessingResponse,
)
from app.services.matching import HybridMatchingEngine

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
    production_line_id: str | None = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Fetch recent file uploads, optionally filtered by line."""
    query = select(RawImport).order_by(RawImport.created_at.desc()).limit(limit)

    if production_line_id:
        query = query.where(RawImport.production_line_id == production_line_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/upload", response_model=dict[str, Any])
async def upload_file_for_ingestion(
    file: UploadFile = File(...),
    factory_id: str = Query(..., description="REQUIRED: Factory to upload data to"),
    production_line_id: str | None = Query(
        None, description="Optional: Production line to upload data to"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),  # Added authentication
):
    """
    Upload a file and create a RawImport record.

    This is step 1 of the HITL flow. The file is saved and parsed.
    Storage structure: uploads/{factory_id}/{line_id}/{year}/{month}/{filename}

    REQUIRES: factory_id - Data must be uploaded to a specific factory.
    OPTIONAL: production_line_id - If provided, upload is associated with a specific line.
    """

    import chardet
    import pandas as pd  # type: ignore[import-untyped]

    # If production_line_id provided, validate it belongs to the factory
    if production_line_id:
        line_result = await db.execute(
            select(ProductionLine).where(ProductionLine.id == production_line_id)
        )
        line = line_result.scalar_one_or_none()
        if not line:
            raise HTTPException(404, f"ProductionLine not found: {production_line_id}")
        if line.factory_id != factory_id:
            raise HTTPException(
                400,
                f"ProductionLine {production_line_id} does not belong to Factory {factory_id}",
            )

    # Validate file type
    allowed_extensions = {".xlsx", ".xls", ".csv"}
    filename = file.filename or ""
    file_ext = Path(filename).suffix.lower()
    if file_ext not in allowed_extensions:
        # Error message must contain "Excel" to pass test_upload_rejects_non_excel
        raise HTTPException(
            400,
            f"Unsupported file type: {file_ext}. Supported formats: Excel (.xlsx, .xls) or CSV.",
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Calculate hash for deduplication
    file_hash = hashlib.sha256(content).hexdigest()

    # Detect encoding for CSV
    encoding = "utf-8"
    if file_ext == ".csv":
        detected = chardet.detect(content)
        encoding = detected.get("encoding", "utf-8") or "utf-8"

    # --- DEDUPLICATION CHECK ---
    existing_import_result = await db.execute(
        select(RawImport).where(
            RawImport.file_hash == file_hash,
            RawImport.production_line_id == production_line_id,
        )
    )
    existing_import = existing_import_result.scalar_one_or_none()

    if existing_import:
        return {
            "raw_import_id": existing_import.id,
            "filename": existing_import.original_filename,
            "columns": existing_import.column_count,
            "rows": existing_import.row_count,
            "status": existing_import.status,
            "already_exists": True,
        }
    # ---------------------------

    # Determined Storage Path
    # Structure: uploads / factory_id / line_id / year / month / hash_filename
    root_dir = Path(settings.UPLOAD_DIR)

    # Use confirmed factory and line IDs
    f_id = factory_id
    l_id = production_line_id if production_line_id else "unassigned"
    now = datetime.utcnow()

    # Build path
    relative_path = Path(f_id) / l_id / str(now.year) / f"{now.month:02d}"
    storage_dir = root_dir / relative_path

    # Create directories
    storage_dir.mkdir(parents=True, exist_ok=True)

    safe_filename = f"{file_hash[:16]}_{file.filename}"
    file_path = storage_dir / safe_filename

    # Write file
    with open(file_path, "wb") as f:
        f.write(content)

    # Parse file to extract headers and sample data (non-blocking)
    from fastapi.concurrency import run_in_threadpool

    try:
        if file_ext == ".csv":
            df = await run_in_threadpool(
                pd.read_csv, file_path, nrows=20, encoding=encoding
            )
        else:
            df = await run_in_threadpool(pd.read_excel, file_path, nrows=20)

        headers = [str(h) for h in df.columns.tolist()]
        sample_data = df.head(10).values.tolist()
        row_count = len(df)
        column_count = len(headers)

    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {str(e)}") from e

    # Create RawImport record
    raw_import = RawImport(
        factory_id=factory_id,
        production_line_id=production_line_id,
        original_filename=file.filename,
        file_path=str(file_path),
        file_size_bytes=file_size,
        file_hash=file_hash,
        mime_type=file.content_type,
        encoding_detected=encoding,
        sheet_count=1,
        row_count=row_count,
        column_count=column_count,
        raw_headers=json.dumps(headers),
        sample_data=json.dumps(sample_data, default=str),
        status="uploaded",
    )

    db.add(raw_import)
    await db.commit()
    await db.refresh(raw_import)

    return {
        "raw_import_id": raw_import.id,
        "filename": file.filename,
        "columns": column_count,
        "rows": row_count,
    }


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
    """
    # Get raw import
    result = await db.execute(select(RawImport).where(RawImport.id == raw_import_id))
    raw_import = result.scalar_one_or_none()
    if not raw_import:
        raise HTTPException(404, f"RawImport not found: {raw_import_id}")

    # Extract headers and sample data
    try:
        headers = json.loads(raw_import.raw_headers) if raw_import.raw_headers else []
    except json.JSONDecodeError:
        headers = []

    if not headers:
        raise HTTPException(400, "No headers found in file")

    sample_data = get_sample_data_from_import(raw_import)

    # Run through matching engine (async initialization)
    effective_factory_id = factory_id or raw_import.factory_id
    if not effective_factory_id:
        raise HTTPException(400, "Factory ID required for processing")

    engine = HybridMatchingEngine(
        db_session=db,
        factory_id=effective_factory_id,
        llm_enabled=llm_enabled,
    )
    await engine.initialize()

    import logging

    from fastapi.concurrency import run_in_threadpool

    try:
        # Run synchronous matching engine logic in threadpool to avoid blocking event loop
        # Note: match_columns itself is CPU-bound mostly, but now we pre-loaded aliases
        results = await run_in_threadpool(engine.match_columns, headers, sample_data)
    except Exception as e:
        logging.error(f"Error in matching engine: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Matching engine failed: {str(e)}") from e

    # Convert to API response
    column_results = [
        ColumnMappingResult(
            source_column=r.source_column,
            target_field=r.target_field,
            confidence=r.confidence,
            tier=r.tier,
            fuzzy_score=r.fuzzy_score,
            reasoning=r.reasoning,
            sample_data=r.sample_data,
            needs_review=r.needs_review,
            ignored=r.ignored,
            status=r.status,
        )
        for r in results
    ]

    # Update raw import status (Only if not already confirmed)
    if raw_import.status not in ["processed", "confirmed"]:
        raw_import.status = "processed"

    raw_import.processed_at = datetime.utcnow()
    await db.commit()

    # Calculate counts
    auto_mapped = len([r for r in results if r.status == "auto_mapped"])
    needs_review = len([r for r in results if r.status == "needs_review"])
    needs_attention = len([r for r in results if r.status == "needs_attention"])

    # --- Populate Staging Area for Preview ---
    # We store the first 50 rows in the staging area for preview/validation
    try:
        import pandas as pd

        file_path = Path(raw_import.file_path)
        if file_path.suffix.lower() == ".csv":
            df = await run_in_threadpool(
                pd.read_csv,
                file_path,
                nrows=50,
                encoding=raw_import.encoding_detected or "utf-8",
            )
        else:
            df = await run_in_threadpool(pd.read_excel, file_path, nrows=50)

        # Clear existing staging records if any (idempotency)
        from sqlalchemy import delete

        await db.execute(
            delete(StagingRecord).where(StagingRecord.raw_import_id == raw_import_id)
        )

        # Insert rows into staging
        staging_entries = []
        for idx, row in df.iterrows():
            # Convert NaN to None and Timestamp to string for JSON serialization
            row_dict = {}
            for k, v in row.to_dict().items():
                if pd.isna(v):
                    row_dict[str(k)] = None
                elif hasattr(v, "isoformat"):  # datetime/Timestamp objects
                    row_dict[str(k)] = v.isoformat()
                else:
                    row_dict[str(k)] = v
            staging_entries.append(
                StagingRecord(
                    raw_import_id=raw_import_id,
                    source_row_number=int(str(idx)) + 1,
                    status="pending",
                    record_data=json.dumps(row_dict),
                )
            )

        db.add_all(staging_entries)
        await db.commit()
    except Exception as e:
        import logging

        logging.error(f"Failed to populate staging records: {str(e)}")
        # We don't fail the whole process if staging fails, but we should log it

    return ProcessingResponse(
        raw_import_id=raw_import_id,
        filename=raw_import.original_filename,
        columns=column_results,
        stats=engine.get_stats(),
        auto_mapped_count=auto_mapped,
        needs_review_count=needs_review,
        needs_attention_count=needs_attention,
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
    """
    import logging

    logger = logging.getLogger("ingestion.confirm_mapping")

    logger.info("=" * 60)
    logger.info("CONFIRM-MAPPING ENDPOINT CALLED")
    logger.info(f"  raw_import_id: {request.raw_import_id}")
    logger.info(f"  production_line_id: {request.production_line_id}")
    logger.info(f"  factory_id: {request.factory_id}")
    logger.info(f"  data_source_id: {request.data_source_id}")
    logger.info(f"  mappings count: {len(request.mappings)}")
    logger.info("=" * 60)

    # Get raw import
    result = await db.execute(
        select(RawImport).where(RawImport.id == request.raw_import_id)
    )
    raw_import = result.scalar_one_or_none()
    if not raw_import:
        logger.error(f"RawImport not found: {request.raw_import_id}")
        raise HTTPException(404, f"RawImport not found: {request.raw_import_id}")

    # Explicit duplicate check (defense in depth - Pydantic should already catch this)
    target_fields = [
        m.target_field for m in request.mappings if m.target_field and not m.ignored
    ]
    if len(target_fields) != len(set(target_fields)):
        duplicates = [f for f in set(target_fields) if target_fields.count(f) > 1]
        raise HTTPException(400, f"Duplicate target field mappings: {duplicates}")

    # Build column mapping dict
    column_map = {}
    corrections = []

    for mapping in request.mappings:
        if not mapping.ignored and mapping.target_field:
            column_map[mapping.source_column] = mapping.target_field

            if mapping.user_corrected:
                corrections.append(
                    {
                        "source": mapping.source_column,
                        "target": mapping.target_field,
                    }
                )

    # Resolve Data Source ID
    data_source_id = request.data_source_id

    if not data_source_id:
        # If no data source ID, we expect production_line_id to find or create one
        if not request.production_line_id:
            raise HTTPException(
                400,
                "Must provide either data_source_id or production_line_id to confirm mapping",
            )

        # Check for existing data source for this line
        ds_result = await db.execute(
            select(DataSource).where(
                DataSource.production_line_id == request.production_line_id
            )
        )
        data_source = ds_result.scalar_one_or_none()

        if data_source:
            data_source_id = data_source.id
            # Update time settings if changed
            data_source.time_column = request.time_column
            if request.time_format:
                data_source.time_format = request.time_format
        else:
            # Create new Data Source for this line
            # Fetch line to get name/code for Source Name
            line_result = await db.execute(
                select(ProductionLine).where(
                    ProductionLine.id == request.production_line_id
                )
            )
            line = line_result.scalar_one_or_none()
            if not line:
                raise HTTPException(
                    404, f"ProductionLine not found: {request.production_line_id}"
                )

            new_ds = DataSource(
                production_line_id=line.id,
                source_name=f"{line.name} Data Source",
                description=f"Auto-created from upload of {raw_import.original_filename}",
                time_column=request.time_column,
                time_format=request.time_format,
                is_active=True,
            )
            db.add(new_ds)
            await db.flush()  # Get ID
            data_source_id = new_ds.id

    # Link RawImport to DataSource
    raw_import.data_source_id = data_source_id
    raw_import.time_column_used = request.time_column

    # Deactivate existing mappings for this data source (versioning)
    await db.execute(
        update(SchemaMapping)
        .where(
            SchemaMapping.data_source_id == data_source_id,
            SchemaMapping.is_active == True,
        )
        .values(is_active=False)
    )

    # Get max version for proper increment
    max_version_result = await db.execute(
        select(func.max(SchemaMapping.version)).where(
            SchemaMapping.data_source_id == data_source_id
        )
    )
    max_version = max_version_result.scalar() or 0

    # Create new SchemaMapping with incremented version
    # Note: We pass the dicts directly; SQLAlchemy JSON type handles serialization
    schema_mapping = SchemaMapping(
        data_source_id=data_source_id,
        version=max_version + 1,
        is_active=True,
        column_map=column_map,
        reviewed_by_user=True,
        user_corrected=len(corrections) > 0,
        correction_count=len(corrections),
        correction_history=corrections if corrections else None,
    )

    db.add(schema_mapping)

    # Learn from corrections
    learned_count = 0
    if request.learn_corrections and corrections:
        for correction in corrections:
            source_alias = correction["source"]
            canonical_field = correction["target"]
            normalized = AliasMapping.normalize_alias(source_alias)

            # Check if alias already exists
            existing_result = await db.execute(
                select(AliasMapping).where(
                    AliasMapping.source_alias_normalized == normalized,
                    AliasMapping.scope == AliasScope.FACTORY.value,
                    AliasMapping.factory_id == request.factory_id,
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                # Update existing alias
                if existing.canonical_field == canonical_field:
                    existing.increment_usage()
                else:
                    # User is correcting a previous correction
                    existing.record_correction()
                    # Create new alias with correct mapping
                    existing.canonical_field = canonical_field
                    existing.correction_count = 0
                    existing.is_active = True
            else:
                # Create new alias
                alias = AliasMapping(
                    scope=AliasScope.FACTORY.value
                    if request.factory_id
                    else AliasScope.GLOBAL.value,
                    factory_id=request.factory_id,
                    source_alias=source_alias,
                    source_alias_normalized=normalized,
                    canonical_field=canonical_field,
                    last_used_at=datetime.utcnow(),
                )
                db.add(alias)
                learned_count += 1

    # Update raw import status
    raw_import.status = "confirmed"

    await db.commit()

    # Ensure the DataSource and SchemaMapping are fully persisted and visible
    await db.refresh(schema_mapping)

    # Verification query to ensure data_source visibility across potential session boundaries
    # This helps with READ COMMITTED isolation visibility timing.
    from sqlalchemy import text

    await db.execute(
        text("SELECT id FROM data_sources WHERE id = :id"), {"id": data_source_id}
    )

    return ConfirmMappingResponse(
        schema_mapping_id=schema_mapping.id,
        data_source_id=data_source_id,
        learned_aliases=learned_count,
        message=f"Mapping confirmed. {learned_count} new aliases learned.",
    )


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
        query = query.where(RawImport.production_line_id == production_line_id)
    elif factory_id:
        query = query.where(RawImport.factory_id == factory_id)

    # Order by most recent first
    query = query.order_by(desc(RawImport.created_at))

    # Count total
    from sqlalchemy import func

    count_query = select(func.count()).select_from(RawImport)
    if production_line_id:
        count_query = count_query.where(
            RawImport.production_line_id == production_line_id
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


@router.get("/preview/{raw_import_id}")
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

    return {
        "headers": columns,
        "sample_rows": sample_rows,
        "total_rows": raw_import.row_count or 0,
        "total_columns": len(columns),
        "filename": raw_import.original_filename,
        "status": raw_import.status,
    }


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

    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
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
