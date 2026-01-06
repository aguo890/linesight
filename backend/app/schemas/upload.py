"""
Pydantic schemas for file upload and processing.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.enums import ProcessingStatus

# =============================================================================
# Upload Schemas
# =============================================================================


class UploadResponse(BaseModel):
    """Response after file upload."""

    id: str
    filename: str
    status: str
    message: str
    file_type: str | None = None
    file_size_bytes: int | None = None


class UploadRead(BaseModel):
    """Schema for reading an upload."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    file_type: str | None = None
    file_size_bytes: int | None = None
    status: str
    created_at: datetime


# =============================================================================
# Processing Job Schemas
# =============================================================================


class ProcessingJobRead(BaseModel):
    """Schema for reading a processing job."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    excel_upload_id: str
    status: str
    inferred_schema: dict[str, Any] | None = None
    confidence_score: float | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class ProcessingJobStatus(BaseModel):
    """Lightweight status check response."""

    id: str
    status: ProcessingStatus
    progress_pct: int | None = None
    error_message: str | None = None


# =============================================================================
# Parsed Data Schemas
# =============================================================================


class ColumnMapping(BaseModel):
    """Column mapping result from parser."""

    source_column: str
    target_field: str
    confidence: str
    data_type: str


class ParseResult(BaseModel):
    """Result of parsing an Excel file."""

    success: bool
    record_count: int
    column_mappings: list[ColumnMapping]
    warnings: list[str] = []
    errors: list[str] = []


# =============================================================================
# Preview Schemas
# =============================================================================


class TablePreviewResponse(BaseModel):
    """Preview of CSV/Excel file data."""

    columns: list[str]
    data: list[dict[str, Any]]
    total_rows: int
    preview_rows: int
    filename: str


# =============================================================================
# File Processing Schemas
# =============================================================================


class ProcessFileRequest(BaseModel):
    """Request to process an uploaded file."""

    use_ai_agent: bool = Field(default=False, description="Use AI agent for processing")
    target_model: str | None = Field(
        default=None, description="Target database model hint"
    )


# NOTE: DryRunRecord and DryRunResponse are defined in app/schemas/ingestion.py
# Use DryRunRow and DryRunResponse from ingestion.py for HITL flow


class ProcessFileResponse(BaseModel):
    """Response after triggering file processing."""

    job_id: str
    status: str
    message: str
    records_inserted: int | None = None
    warnings: list[str] = Field(default_factory=list)
    target_tables: list[str] = Field(default_factory=list)


# =============================================================================
# File Listing Schemas
# =============================================================================


class FileListResponse(BaseModel):
    """Paginated list of uploaded files."""

    files: list[UploadRead]
    total: int
    offset: int
    limit: int
