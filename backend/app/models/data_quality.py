# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Data Quality Issues model.

Stores physics violations and data quality warnings for admin visibility.
Philosophy: "Don't just warn in console logs - persist for observability."
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class IssueSeverity(str, Enum):
    """Severity levels for data quality issues."""

    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class IssueType(str, Enum):
    """Types of data quality issues."""

    PHYSICS_VIOLATION = "PHYSICS_VIOLATION"
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_VALUE = "INVALID_VALUE"
    DUPLICATE_DATA = "DUPLICATE_DATA"
    SCHEMA_MISMATCH = "SCHEMA_MISMATCH"
    OTHER = "OTHER"


class DataQualityIssue(Base, UUIDMixin, TimestampMixin):
    """
    Persisted record of data quality issues detected during ingestion.

    Enables:
    - Admin visibility into data quality problems
    - Debugging why widget data looks wrong
    - Tracking patterns in data issues over time
    """

    __tablename__ = "data_quality_issues"

    # Link to the source import (Trace ID)
    raw_import_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("raw_imports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Location in the file
    row_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Issue classification
    issue_type: Mapped[str] = mapped_column(
        String(50),
        default=IssueType.OTHER.value,
        nullable=False,
        index=True,
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        default=IssueSeverity.WARNING.value,
        nullable=False,
        index=True,
    )

    # Issue details
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Field context (optional)
    field_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    field_value: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Resolution tracking
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_by_user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    raw_import = relationship("RawImport", backref="quality_issues")

    def __repr__(self) -> str:
        return f"<DataQualityIssue(id={self.id}, type={self.issue_type}, severity={self.severity})>"
