"""
Data source and schema mapping models.
Enables flexible data ingestion from diverse Excel formats.
"""

from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.ai_decision import AIDecision
    from app.models.dashboard import Dashboard
    from app.models.factory import ProductionLine


class DataSource(Base, UUIDMixin, TimestampMixin):
    """
    Represents a production line's specific data source configuration.
    Each line can have its own Excel file structure.
    """

    __tablename__ = "data_sources"

    # Production Line FK
    production_line_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("production_lines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        unique=True,  # One data source per line
    )

    # Source Metadata
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Time Configuration
    time_column: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        doc="The canonical column name used for time-series data (e.g., 'production_date')",
    )
    time_format: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        doc="Date/time format string (e.g., 'YYYY-MM-DD', 'MM/DD/YYYY')",
    )

    # Active Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    production_line: Mapped["ProductionLine"] = relationship(
        "ProductionLine",
        back_populates="data_source",
    )
    schema_mappings: Mapped[list["SchemaMapping"]] = relationship(
        "SchemaMapping",
        back_populates="data_source",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    ai_decisions: Mapped[list["AIDecision"]] = relationship(
        "AIDecision",
        back_populates="data_source",
        lazy="selectin",
    )
    dashboards: Mapped[list["Dashboard"]] = relationship(
        "Dashboard",
        back_populates="data_source",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<DataSource(id={self.id}, line_id={self.production_line_id})>"


class SchemaMapping(Base, UUIDMixin, TimestampMixin):
    """
    AI-generated mapping from Excel columns to internal field names.
    Stored as a versioned record for auditability.
    """

    __tablename__ = "schema_mappings"

    # Data Source FK
    data_source_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("data_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Version Control
    version: Mapped[int] = mapped_column(default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Mapping Definition (JSON)
    # Example: {"Units": "production_count", "Eff%": "efficiency_pct"}
    column_map: Mapped[dict] = mapped_column(
        JSON, nullable=False
    )  # JSON type for automatic dict handling

    # AI Extraction Rules (JSON)
    # Example: {"skip_rows": 2, "header_row": 3, "date_format": "MM/DD/YYYY"}
    extraction_rules: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # JSON type for automatic dict handling

    # Human Review Status
    reviewed_by_user: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    user_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Waterfall Matching Metadata
    # Tracks which tier was used and confidence for each column mapping
    matching_tier: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )  # 'hash', 'fuzzy', 'llm', 'manual'

    tier_confidence: Mapped[float | None] = mapped_column(
        nullable=True,
    )  # Average confidence across all column mappings (0.0-1.0)

    tier_breakdown: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )  # JSON: per-column tier and confidence {"col": {"tier": "fuzzy", "confidence": 0.87}}

    fuzzy_scores: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )  # JSON: RapidFuzz scores per column {"col": 92}

    # User Correction Tracking
    user_corrected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    correction_count: Mapped[int | None] = mapped_column(default=0, nullable=True)
    correction_history: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )  # JSON: [{"from": "style", "to": "style_number", "at": "2024-12-27T..."}]

    # Relationships
    data_source: Mapped["DataSource"] = relationship(
        "DataSource",
        back_populates="schema_mappings",
    )

    def __repr__(self) -> str:
        return f"<SchemaMapping(id={self.id}, version={self.version}, active={self.is_active})>"
