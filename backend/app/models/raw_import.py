"""
Raw Import model for immutable data lake.
Preserves uploaded files exactly as received for audit trails.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.datasource import DataSource
    from app.models.factory import Factory, ProductionLine
    from app.models.user import User


class RawImport(Base, UUIDMixin, TimestampMixin):
    """
    Immutable record of uploaded file for audit trail.

    Philosophy: Every uploaded file is preserved exactly as received.
    This enables:
    - Full traceability for compliance (UFLPA)
    - Re-processing with improved algorithms
    - Debugging data issues
    """

    __tablename__ = "raw_imports"

    # Ownership
    uploaded_by_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    factory_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("factories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    production_line_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("production_lines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Link to DataSource configuration (set after confirm-mapping)
    data_source_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("data_sources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Time column used for this upload (for tracking across multiple uploads)
    time_column_used: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        doc="The source column name mapped to time for this upload",
    )

    # File metadata
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)  # Storage path
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    encoding_detected: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # UTF-8, GB18030, etc.

    # Parsing metadata
    sheet_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    sheet_names: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    column_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    header_row_detected: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # 0-indexed

    # Raw content snapshots (for preview without re-reading file)
    raw_headers: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON array of original column names
    sample_data: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON - first 20 rows

    # Processing status
    status: Mapped[str] = mapped_column(
        String(50),
        default="uploaded",
        nullable=False,
    )  # 'uploaded', 'processing', 'processed', 'failed'
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    uploaded_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[uploaded_by_id],
    )
    factory: Mapped[Optional["Factory"]] = relationship(
        "Factory",
        foreign_keys=[factory_id],
    )
    production_line: Mapped[Optional["ProductionLine"]] = relationship(
        "ProductionLine",
        foreign_keys=[production_line_id],
    )
    data_source: Mapped[Optional["DataSource"]] = relationship(
        "DataSource",
        foreign_keys=[data_source_id],
    )
    staging_records: Mapped[list["StagingRecord"]] = relationship(
        "StagingRecord",
        back_populates="raw_import",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<RawImport(id={self.id}, filename={self.original_filename}, status={self.status})>"


class StagingRecord(Base, UUIDMixin, TimestampMixin):
    """
    Staging area for data before promotion to production.

    Philosophy: Data is "guilty until proven innocent".
    - Loose typing (all TEXT initially)
    - No NOT NULL constraints on data fields
    - Validation happens here, not on insert
    """

    __tablename__ = "staging_records"

    # Parent import
    raw_import_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("raw_imports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Row tracking
    source_row_number: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # Original row in file

    # Status
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
    )  # 'pending', 'validated', 'promoted', 'rejected'

    # Validation results
    validation_errors: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON array
    validation_warnings: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON array

    # Data (stored as JSON - loose typing)
    record_data: Mapped[str] = mapped_column(Text, nullable=False)  # JSON object

    # Normalized data (after mapping applied)
    normalized_data: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON object

    # Quality metrics
    quality_score: Mapped[float | None] = mapped_column(nullable=True)  # 0-100
    null_field_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Promotion tracking
    promoted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    promoted_to_table: Mapped[str | None] = mapped_column(String(100), nullable=True)
    promoted_record_id: Mapped[str | None] = mapped_column(CHAR(36), nullable=True)

    # Relationships
    raw_import: Mapped["RawImport"] = relationship(
        "RawImport",
        back_populates="staging_records",
    )

    def __repr__(self) -> str:
        return f"<StagingRecord(id={self.id}, row={self.source_row_number}, status={self.status})>"
