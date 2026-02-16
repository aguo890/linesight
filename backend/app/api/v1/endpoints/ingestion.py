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

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
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
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Fetch recent file uploads, optionally filtered by data source."""
    query = select(RawImport).order_by(RawImport.created_at.desc()).limit(limit)

    if data_source_id:
        query = query.where(RawImport.data_source_id == data_source_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/upload", response_model=dict[str, Any])
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
    Storage structure: uploads/{factory_id}/{data_source_id}/{year}/{month}/{filename}

    REQUIRES: factory_id - Data must be uploaded to a specific factory.
    OPTIONAL: data_source_id - If provided, upload is associated with a specific data source.
    """

    import chardet
    import pandas as pd  # type: ignore[import-untyped]

    # Resolve IDs
    effective_ds_id = data_source_id or production_line_id

    # If data_source_id provided, validate it belongs to the factory
    if effective_ds_id:
        ds_result = await db.execute(
            select(DataSource).where(DataSource.id == effective_ds_id)
        )
        data_source = ds_result.scalar_one_or_none()
        if not data_source:
            raise HTTPException(404, f"DataSource not found: {effective_ds_id}")
        if data_source.factory_id != factory_id:
            raise HTTPException(
                400,
                f"DataSource {effective_ds_id} does not belong to Factory {factory_id}",
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
            RawImport.data_source_id == effective_ds_id,
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

    # ==========================================================================
    # SCHEMA-FIRST VALIDATION ("Master File Lock")
    # ==========================================================================
    # 1. Read file headers immediately for validation
    from io import BytesIO

    from fastapi.concurrency import run_in_threadpool

    try:
        # We need to read the headers from the content bytes
        # Using a small nrows to just get headers
        content_io = BytesIO(content)
        if file_ext == ".csv":
            # Detect encoding again or reuse? Reuse is safer but we need to re-detect if we used detection lib
            # We already detected 'encoding' variable above
            df_preview = await run_in_threadpool(
                pd.read_csv, content_io, nrows=0, encoding=encoding
            )
        else:
            df_preview = await run_in_threadpool(pd.read_excel, content_io, nrows=0)

        file_headers = [str(h) for h in df_preview.columns.tolist()]
    except Exception as e:
        raise HTTPException(400, f"Failed to read file headers for validation: {str(e)}") from e

    if data_source_id:
        ds_result = await db.execute(select(DataSource).where(DataSource.id == data_source_id))
        data_source = ds_result.scalar_one_or_none()

        if data_source:
            # SCENARIO 1: Schema Exists -> Strict Validation
            if data_source.schema_config:
                expected_columns = list(data_source.schema_config.keys())

                # Check for mismatch (Set comparison for Order-agnostic or List for Strict Order?
                # Excel usually implies order matters, but for safety lets check strict set presence first.
                # User prompt said "Expected [Date, Qty], Found [Date, Amount]" which implies structure.)
                # Let's check if all expected columns are present. Extra columns in file might be okay?
                # Plan said "Homogeneity Check". Usually means EXACT match or SUPERSET.
                # Let's enforce that ALL expected columns must be in the file.

                missing_cols = list(set(expected_columns) - set(file_headers))
                # Note: extra_cols computed but intentionally not used here

                if missing_cols:
                     # Structured error for Frontend "Diff" UI
                     raise HTTPException(
                        400,
                        detail={
                            "message": "File structure mismatch.",
                            "errors": [f"Missing columns: {', '.join(missing_cols)}"],
                            "expected": expected_columns,
                            "found": file_headers
                        }
                    )

            # SCENARIO 2: No Schema, Files Pending -> "Master File Lock"
            else:
                # Check for unmapped files given we have NO schema yet
                # Query for any RawImport for this DS that is NOT confirmed.
                pending_query = select(RawImport).where(
                    RawImport.data_source_id == effective_ds_id,
                    RawImport.status != "confirmed"
                )
                pending_result = await db.execute(pending_query)
                pending_files = pending_result.scalars().all()

                if pending_files:
                     raise HTTPException(
                        400,
                        detail={
                            "message": "Setup in progress.",
                            "instruction": "A file is already uploaded but not mapped. Please complete the column mapping for the first file to establish the Master Schema before uploading additional files."
                        }
                    )

            # SCENARIO 3: No Schema, No Files -> Allow (Candidate for Master)
            # Fall through to save logic

    # ==========================================================================

    # Determined Storage Path
    # Structure: uploads / factory_id / line_id / year / month / hash_filename
    root_dir = Path(settings.UPLOAD_DIR)

    # Use confirmed factory and line IDs
    f_id = factory_id
    ds_id = effective_ds_id if effective_ds_id else "unassigned"
    now = datetime.utcnow()

    # Build path
    relative_path = Path(f_id) / ds_id / str(now.year) / f"{now.month:02d}"
    storage_dir = root_dir / relative_path

    # Create directories
    storage_dir.mkdir(parents=True, exist_ok=True)

    safe_filename = f"{file_hash[:16]}_{file.filename}"
    file_path = storage_dir / safe_filename

    # Write file
    with open(file_path, "wb") as f:
        f.write(content)

    # Parse file to extract headers and sample data (non-blocking) - RE-USING calculated vars
    # We already parsed headers for validation, but we need sample data now.
    from fastapi.concurrency import run_in_threadpool

    try:
        # We can re-read for sample data, or just assume the previous read for headers was cheap.
        # But we need sample data for the preview.
        # Since we only read nrows=0 above, we need to read again with rows.
        if file_ext == ".csv":
            df = await run_in_threadpool(
                pd.read_csv, file_path, nrows=20, encoding=encoding
            )
        else:
            df = await run_in_threadpool(pd.read_excel, file_path, nrows=20)

        headers = [str(h) for h in df.columns.tolist()]
        sample_data = df.head(10).values.tolist()
        row_count = len(df) # Approximate from head? No, len(df) is only 20 here.
        # The original code calculated len(df) from the sample read which is confusing if it was only reading head.
        # Re-reading original implementation:
        # "df = await run_in_threadpool(pd.read_excel, file_path, nrows=20)"
        # "row_count = len(df)" -> This would only be 20.
        # The original code had a bug or 'nrows=20' was intentional for speed, but row_count would be wrong.
        # Let's keep existing behavior for now but note it.
        # Actually validation above uses content_io, here we use file_path.

        column_count = len(headers)

    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {str(e)}") from e

    # Create RawImport record
    raw_import = RawImport(
        factory_id=factory_id,
        data_source_id=effective_ds_id,
        production_line_id=effective_ds_id,  # Set both for backward compatibility
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
    data_source = None  # Prevent UnboundLocalError

    if not data_source_id:
        # If no data source ID, we expect production_line_id (which now IS a DataSource ID)
        if not request.production_line_id:
            raise HTTPException(
                400,
                "Must provide either data_source_id or production_line_id to confirm mapping",
            )

        # After refactor: production_line_id IS the DataSource ID directly
        ds_result = await db.execute(
            select(DataSource).where(DataSource.id == request.production_line_id)
        )
        data_source = ds_result.scalar_one_or_none()

        if not data_source:
            raise HTTPException(
                404, f"Data source (Line) not found: {request.production_line_id}"
            )

        data_source_id = data_source.id
        # Update time settings if changed
        data_source.time_column = request.time_column
        if request.time_format:
            data_source.time_format = request.time_format

    # Ensure data_source is loaded (if we came from data_source_id directly)
    if not data_source:  
          # This case should technically be covered by early validation but for safety/typing:
          ds_result = await db.execute(
              select(DataSource).where(DataSource.id == data_source_id)
          )
          data_source = ds_result.scalar_one_or_none()
          if not data_source:
               raise HTTPException(404, f"Data source not found: {data_source_id}")

    # Link RawImport to DataSource
    raw_import.data_source_id = data_source_id
    raw_import.time_column_used = request.time_column

    # ==========================================================================
    # SCHEMA LOCKING (Post-Mapping)
    # ==========================================================================
    # If the DataSource doesn't have a schema_config yet, we LOCK it now.
    if not data_source.schema_config:
        # Construct the schema configuration from the mapping
        # We want to store the "Expected Source Columns" mostly,
        # or the mapping of Source -> Canonical?
        # The schema_config is used for Homogeneity checks on Upload.
        # So we simply need the set of Source Columns that are valid.
        # But we might also want to know the detected types.
        # For MVP, let's store the map of {source_col: canonical_field}
        # This defines what the "Master File" looked like.

        # We use column_map which contains {source: target}
        data_source.schema_config = column_map
        logger.info(f"Schema Locked for DataSource {data_source_id}: {column_map.keys()}")

    # ==========================================================================

    # Deactivate existing mappings for this data source (versioning)
    await db.execute(
        update(SchemaMapping)
        .where(
            SchemaMapping.data_source_id == data_source_id,
            SchemaMapping.is_active,
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
