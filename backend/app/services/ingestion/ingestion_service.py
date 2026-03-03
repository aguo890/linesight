import chardet
import hashlib
import json
import logging
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd  # type: ignore[import-untyped]
from fastapi import HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.datasource import DataSource
from app.models.raw_import import RawImport

logger = logging.getLogger(__name__)

class IngestionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def handle_upload(self, file: UploadFile, factory_id: str, data_source_id: str | None, production_line_id: str | None, current_user_id: str) -> dict[str, Any]:
        """
        Handles the file upload, validation, and initial database record creation.
        Wraps the entire database write operation in an ACID transaction.
        """
        # Resolve IDs
        effective_ds_id = data_source_id or production_line_id

        # If data_source_id provided, validate it belongs to the factory
        if effective_ds_id:
            ds_result = await self.db.execute(
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
        existing_import_result = await self.db.execute(
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
        try:
            content_io = BytesIO(content)
            if file_ext == ".csv":
                df_preview = await run_in_threadpool(
                    pd.read_csv, content_io, nrows=0, encoding=encoding
                )
            else:
                df_preview = await run_in_threadpool(pd.read_excel, content_io, nrows=0)

            file_headers = [str(h) for h in df_preview.columns.tolist()]
        except Exception as e:
            raise HTTPException(400, f"Failed to read file headers for validation: {str(e)}") from e

        if effective_ds_id:
            ds_result = await self.db.execute(select(DataSource).where(DataSource.id == effective_ds_id))
            data_source = ds_result.scalar_one_or_none()

            if data_source:
                # SCENARIO 1: Schema Exists -> Strict Validation
                if data_source.schema_config:
                    expected_columns = list(data_source.schema_config.keys())
                    missing_cols = list(set(expected_columns) - set(file_headers))

                    if missing_cols:
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
                    pending_query = select(RawImport).where(
                        RawImport.data_source_id == effective_ds_id,
                        RawImport.status != "confirmed"
                    )
                    pending_result = await self.db.execute(pending_query)
                    pending_files = pending_result.scalars().all()

                    if pending_files:
                         raise HTTPException(
                            400,
                            detail={
                                "message": "Setup in progress.",
                                "instruction": "A file is already uploaded but not mapped. Please complete the column mapping for the first file to establish the Master Schema before uploading additional files."
                            }
                        )

        # ==========================================================================

        # Determined Storage Path
        root_dir = Path(settings.UPLOAD_DIR)
        f_id = factory_id
        ds_id = effective_ds_id if effective_ds_id else "unassigned"
        now = datetime.utcnow()

        relative_path = Path(f_id) / ds_id / str(now.year) / f"{now.month:02d}"
        storage_dir = root_dir / relative_path
        storage_dir.mkdir(parents=True, exist_ok=True)

        safe_filename = f"{file_hash[:16]}_{file.filename}"
        file_path = storage_dir / safe_filename

        # Write file
        with open(file_path, "wb") as f:
            f.write(content)

        # Parse file to extract headers and sample data
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
            data_source_id=effective_ds_id,
            production_line_id=effective_ds_id,
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

        try:
            self.db.add(raw_import)
            await self.db.flush()  # Validate constraints without permanently saving yet
            await self.db.commit()
            await self.db.refresh(raw_import)
            
            return {
                "raw_import_id": raw_import.id,
                "filename": file.filename,
                "columns": column_count,
                "rows": row_count,
            }
        except HTTPException as he:
            await self.db.rollback()
            raise he
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to save raw import. Rolled back. Error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail="Database transaction failed during upload."
            )

    async def process_file(self, raw_import_id: str, factory_id: str | None, llm_enabled: bool) -> Any:
        from app.schemas.ingestion import ColumnMappingResult, ProcessingResponse
        from app.services.matching import HybridMatchingEngine
        from app.models.raw_import import StagingRecord

        # Get raw import
        result = await self.db.execute(select(RawImport).where(RawImport.id == raw_import_id))
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

        # Local helper for sample data extraction
        def get_sample_data(ri: RawImport) -> dict[str, list[Any]]:
            if not ri.sample_data:
                return {}
            try:
                sample_rows = json.loads(ri.sample_data)
                h = json.loads(ri.raw_headers) if ri.raw_headers else []
                if not sample_rows or not h: return {}
                
                sample_out = {}
                for i, head in enumerate(h):
                    s = []
                    for row in sample_rows[:5]:
                        if isinstance(row, list) and i < len(row):
                            val = row[i]
                            if val is not None and str(val).strip(): s.append(val)
                        elif isinstance(row, dict):
                            val = row.get(head)
                            if val is not None and str(val).strip(): s.append(val)
                    sample_out[head] = s[:5]
                return sample_out
            except (json.JSONDecodeError, TypeError):
                return {}

        sample_data = get_sample_data(raw_import)

        effective_factory_id = factory_id or raw_import.factory_id
        if not effective_factory_id:
            raise HTTPException(400, "Factory ID required for processing")

        engine = HybridMatchingEngine(
            db_session=self.db,
            factory_id=effective_factory_id,
            llm_enabled=llm_enabled,
        )
        await engine.initialize()

        try:
            results = await run_in_threadpool(engine.match_columns, headers, sample_data)
        except Exception as e:
            logger.error(f"Error in matching engine: {str(e)}", exc_info=True)
            raise HTTPException(500, f"Matching engine failed: {str(e)}") from e

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

        try:
            if raw_import.status not in ["processed", "confirmed"]:
                raw_import.status = "processed"

            raw_import.processed_at = datetime.utcnow()
            await self.db.flush()
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to update raw import status. Rolled back. Error: {e}")
            raise HTTPException(status_code=500, detail="Database transaction failed during processing.")

        auto_mapped = len([r for r in results if r.status == "auto_mapped"])
        needs_review = len([r for r in results if r.status == "needs_review"])
        needs_attention = len([r for r in results if r.status == "needs_attention"])

        # Populate Staging Area
        try:
            file_path_obj = Path(raw_import.file_path)
            encoding = raw_import.encoding_detected or "utf-8"
            
            if file_path_obj.suffix.lower() == ".csv":
                df = await run_in_threadpool(pd.read_csv, file_path_obj, nrows=50, encoding=encoding)
            else:
                df = await run_in_threadpool(pd.read_excel, file_path_obj, nrows=50)

            from sqlalchemy import delete
            await self.db.execute(delete(StagingRecord).where(StagingRecord.raw_import_id == raw_import_id))

            staging_entries = []
            for idx, row in df.iterrows():
                row_dict = {}
                for k, v in row.to_dict().items():
                    if pd.isna(v): row_dict[str(k)] = None
                    elif hasattr(v, "isoformat"): row_dict[str(k)] = v.isoformat()
                    else: row_dict[str(k)] = v
                staging_entries.append(
                    StagingRecord(
                        raw_import_id=raw_import_id,
                        source_row_number=int(str(idx)) + 1,
                        status="pending",
                        record_data=json.dumps(row_dict),
                    )
                )

            try:
                self.db.add_all(staging_entries)
                await self.db.flush()
                await self.db.commit()
            except Exception as e:
                await self.db.rollback()
                logger.error(f"Failed to commit staging records. Rolled back. Error: {e}")
                raise
        except Exception as e:
            logger.error(f"Failed to populate staging records: {str(e)}")

        return ProcessingResponse(
            raw_import_id=raw_import_id,
            filename=raw_import.original_filename,
            columns=column_results,
            stats=engine.get_stats(),
            auto_mapped_count=auto_mapped,
            needs_review_count=needs_review,
            needs_attention_count=needs_attention,
        )

    async def confirm_mapping(self, request: Any) -> Any:
        from app.schemas.ingestion import ConfirmMappingResponse
        from app.models.datasource import SchemaMapping
        from app.models.alias_mapping import AliasMapping, AliasScope
        from sqlalchemy import update, func, or_, text
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
        result = await self.db.execute(
            select(RawImport).where(RawImport.id == request.raw_import_id)
        )
        raw_import = result.scalar_one_or_none()
        if not raw_import:
            logger.error(f"RawImport not found: {request.raw_import_id}")
            raise HTTPException(404, f"RawImport not found: {request.raw_import_id}")

        # Explicit duplicate check
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
        data_source = None

        if not data_source_id:
            if not request.production_line_id:
                raise HTTPException(
                    400,
                    "Must provide either data_source_id or production_line_id to confirm mapping",
                )

            ds_result = await self.db.execute(
                select(DataSource).where(DataSource.id == request.production_line_id)
            )
            data_source = ds_result.scalar_one_or_none()

            if not data_source:
                raise HTTPException(
                    404, f"Data source (Line) not found: {request.production_line_id}"
                )

            data_source_id = data_source.id
            data_source.time_column = request.time_column
            if request.time_format:
                data_source.time_format = request.time_format

        if not data_source:  
            ds_result = await self.db.execute(
                select(DataSource).where(DataSource.id == data_source_id)
            )
            data_source = ds_result.scalar_one_or_none()
            if not data_source:
                raise HTTPException(404, f"Data source not found: {data_source_id}")

        raw_import.data_source_id = data_source_id
        raw_import.time_column_used = request.time_column

        # SCHEMA LOCKING (Post-Mapping)
        if not data_source.schema_config:
            data_source.schema_config = column_map
            logger.info(f"Schema Locked for DataSource {data_source_id}: {column_map.keys()}")

        try:
            # Deactivate existing mappings for this data source (versioning)
            await self.db.execute(
                update(SchemaMapping)
                .where(
                    SchemaMapping.data_source_id == data_source_id,
                    SchemaMapping.is_active,
                )
                .values(is_active=False)
            )

            # Get max version for proper increment
            max_version_result = await self.db.execute(
                select(func.max(SchemaMapping.version)).where(
                    SchemaMapping.data_source_id == data_source_id
                )
            )
            max_version = max_version_result.scalar() or 0

            # Create new SchemaMapping with incremented version
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

            self.db.add(schema_mapping)

            # Learn from corrections
            learned_count = 0
            if request.learn_corrections and corrections:
                for correction in corrections:
                    source_alias = correction["source"]
                    canonical_field = correction["target"]
                    normalized = AliasMapping.normalize_alias(source_alias)

                    existing_result = await self.db.execute(
                        select(AliasMapping).where(
                            AliasMapping.source_alias_normalized == normalized,
                            AliasMapping.scope == AliasScope.FACTORY.value,
                            AliasMapping.factory_id == request.factory_id,
                        )
                    )
                    existing = existing_result.scalar_one_or_none()

                    if existing:
                        if existing.canonical_field == canonical_field:
                            existing.increment_usage()
                        else:
                            existing.record_correction()
                            existing.canonical_field = canonical_field
                            existing.correction_count = 0
                            existing.is_active = True
                    else:
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
                        self.db.add(alias)
                        learned_count += 1

            # Update raw import status
            raw_import.status = "confirmed"

            await self.db.flush()
            await self.db.commit()
            await self.db.refresh(schema_mapping)
            
            await self.db.execute(
                text("SELECT id FROM data_sources WHERE id = :id"), {"id": data_source_id}
            )

            return ConfirmMappingResponse(
                schema_mapping_id=schema_mapping.id,
                data_source_id=data_source_id,
                learned_aliases=learned_count,
                message=f"Mapping confirmed. {learned_count} new aliases learned.",
            )

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to confirm mapping. Rolled back to prevent orphaned schemas. Error: {e}")
            raise HTTPException(status_code=500, detail="Mapping confirmation failed, changes rolled back.")

