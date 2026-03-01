# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

# backend\app\schemas\ingestion.py
"""
Pydantic schemas for Data Ingestion (HITL Flow).

This module defines schemas for:
- File processing and column mapping
- User confirmation of mappings
- Dry-run preview responses

The HITL (Human-in-the-Loop) flow:
1. Upload file → Create RawImport record
2. Process file → Run through Waterfall Matching Engine
3. Confirm mapping → Save SchemaMapping and learn corrections
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.enums import MatchTier


class ColumnMappingResult(BaseModel):
    """
    API response for a single column mapping result.

    Represents the engine's best guess for mapping a source column
    to a canonical target field, with confidence scoring.
    """

    source_column: str = Field(
        ..., description="Original column name from uploaded file"
    )
    target_field: str | None = Field(
        None, description="Canonical field name (e.g., 'actual_qty', 'production_date')"
    )
    confidence: float = Field(
        ..., ge=0, le=1, description="Confidence score (0.0 to 1.0)"
    )
    tier: MatchTier = Field(
        ...,
        description="Matching tier used: 'hash', 'fuzzy', 'llm', 'manual', 'unmatched'",
    )
    fuzzy_score: float | None = Field(
        None, description="RapidFuzz similarity score (0-100) if tier='fuzzy'"
    )
    reasoning: str | None = Field(
        None, description="Explanation from matching engine (especially for LLM tier)"
    )
    sample_data: list[Any] = Field(
        default_factory=list,
        description="Sample values from this column (first 5 non-null)",
    )
    needs_review: bool = Field(
        False, description="True if confidence is medium (0.6-0.9)"
    )
    ignored: bool = Field(
        False, description="True if column should be skipped during import"
    )
    status: str = Field(
        ...,
        description="Status: 'auto_mapped', 'needs_review', 'needs_attention', 'ignored'",
    )


class ProcessingResponse(BaseModel):
    """
    Response from processing a file through the waterfall matching engine.

    Contains all column mapping results with statistics.
    """

    raw_import_id: str = Field(..., description="UUID of the RawImport record")
    filename: str = Field(..., description="Original filename")
    columns: list[ColumnMappingResult] = Field(
        ..., description="Mapping results for each column"
    )
    stats: dict[str, Any] = Field(
        default_factory=dict,
        description="Engine statistics (tier counts, processing time)",
    )
    auto_mapped_count: int = Field(
        ..., description="Number of columns auto-mapped with high confidence"
    )
    needs_review_count: int = Field(
        ..., description="Number of columns needing user review"
    )
    needs_attention_count: int = Field(
        ..., description="Number of columns that couldn't be mapped"
    )


# =============================================================================
# Confirmation Schemas
# =============================================================================


class ColumnMappingConfirmation(BaseModel):
    """
    User's confirmed mapping for a single column.

    Used when submitting final mappings after review.
    """

    source_column: str = Field(..., description="Original column name from file")
    target_field: str | None = Field(
        None, description="Canonical field to map to (None if ignored)"
    )
    ignored: bool = Field(False, description="True if column should be skipped")
    user_corrected: bool = Field(
        False, description="True if user changed the AI suggestion"
    )


class ConfirmMappingRequest(BaseModel):
    """
    Request to confirm column mappings after user review.

    This is step 3 of the HITL flow. Saves the mapping and optionally
    learns from user corrections for future matching.
    """

    raw_import_id: str = Field(..., description="UUID of the RawImport to confirm")
    mappings: list[ColumnMappingConfirmation] = Field(
        ..., description="List of confirmed column mappings"
    )
    time_column: str = Field(
        ..., description="REQUIRED: Source column name for time/date data"
    )
    time_format: str | None = Field(
        None, description="Date format (e.g., 'YYYY-MM-DD', 'DD/MM/YYYY')"
    )
    data_source_id: str | None = Field(
        None, description="UUID of existing DataSource to associate with"
    )
    production_line_id: str | None = Field(
        None, description="UUID of ProductionLine (required if no data_source_id)"
    )
    factory_id: str | None = Field(
        None, description="UUID of Factory for scoped alias learning"
    )
    learn_corrections: bool = Field(
        True,
        description="Whether to save corrections to alias database for future matching",
    )

    @model_validator(mode="after")
    def check_unique_target_fields(self) -> "ConfirmMappingRequest":
        """Ensure no two columns map to the same target field."""
        target_fields = [
            m.target_field for m in self.mappings if m.target_field and not m.ignored
        ]
        duplicates = [f for f in set(target_fields) if target_fields.count(f) > 1]
        if duplicates:
            raise ValueError(f"Duplicate target field mappings: {duplicates}")
        return self


class ConfirmMappingResponse(BaseModel):
    """Response after confirming mapping."""

    schema_mapping_id: str = Field(
        ..., description="UUID of created/updated SchemaMapping"
    )
    data_source_id: str = Field(..., description="UUID of associated DataSource")
    learned_aliases: int = Field(
        ..., description="Number of new aliases learned from corrections"
    )
    message: str = Field(..., description="Human-readable success message")


# =============================================================================
# Utility Schemas
# =============================================================================


class AvailableField(BaseModel):
    """Available canonical field for UI dropdown."""

    field: str = Field(..., description="Canonical field name (e.g., 'actual_qty')")
    description: str = Field(..., description="Human-readable description")


class DryRunRow(BaseModel):
    """Single row in dry-run preview showing before/after."""

    row_number: int = Field(..., description="Row number in original file (1-indexed)")
    original: dict[str, Any] = Field(
        ..., description="Original data as key-value pairs"
    )
    transformed: dict[str, Any] = Field(
        ..., description="Transformed data using confirmed mapping"
    )
    validation_errors: list[str] = Field(
        default_factory=list, description="Validation errors for this row"
    )
    validation_warnings: list[str] = Field(
        default_factory=list, description="Validation warnings for this row"
    )


class DryRunResponse(BaseModel):
    """Response for dry-run preview endpoint."""

    raw_import_id: str = Field(..., description="UUID of the RawImport")
    filename: str = Field(..., description="Original filename")
    total_rows: int = Field(..., description="Total rows in file")
    preview_rows: int = Field(..., description="Number of rows in preview")
    rows: list[DryRunRow] = Field(
        ..., description="Preview rows with before/after data"
    )
    column_mapping: dict[str, str] = Field(
        ..., description="Active column mapping used for transformation"
    )
    error_count: int = Field(..., description="Total validation errors across all rows")
    warning_count: int = Field(
        ..., description="Total validation warnings across all rows"
    )


class RawImportUploadResponse(BaseModel):
    """Response from file upload endpoint in the ingestion flow."""

    raw_import_id: str = Field(..., description="UUID of created RawImport record")
    filename: str = Field(..., description="Original filename")
    columns: int = Field(..., description="Number of columns detected")
    rows: int = Field(..., description="Number of rows detected")
    already_exists: bool = Field(
        False, description="True if file was already uploaded (deduplication)"
    )


class UploadListItem(BaseModel):
    """Single item in uploads list."""

    id: str
    original_filename: str
    file_type: str | None
    file_size_bytes: int
    row_count: int | None
    status: str
    data_source_id: str | None
    created_at: datetime | None
    factory_id: str | None
    production_line_id: str | None


class UploadListResponse(BaseModel):
    """Response for uploads list endpoint."""

    files: list[UploadListItem]
    total: int
    offset: int
    limit: int


class PreviewResponse(BaseModel):
    """
    Response for previewing uploaded file data before processing.
    """
    data: list[list[Any]] = Field(..., description="First N rows of data for preview")
    columns: list[str] = Field(..., description="Column headers detected")
    preview_rows: int = Field(..., description="Number of rows included in this preview")
    total_rows: int = Field(..., description="Total rows in the file")
    total_columns: int = Field(..., description="Total columns in the file")
    filename: str = Field(..., description="Name of the uploaded file")
    status: str = Field(..., description="Current status of the raw import")
