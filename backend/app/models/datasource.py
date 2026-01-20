"""
Data source and schema mapping models.
Enables flexible data ingestion from diverse Excel formats.

After refactor: DataSource is the primary entity that represents both
the physical production line AND its data configuration.
"""

from datetime import date
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import JSON, Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.ai_decision import AIDecision
    from app.models.dashboard import Dashboard
    from app.models.factory import Factory
    from app.models.production import ProductionRun
    from app.models.workforce import Worker


class DataSource(Base, UUIDMixin, TimestampMixin):
    """
    Unified entity representing a production line and its data configuration.
    
    This model combines what was previously split between ProductionLine and DataSource:
    - Physical line attributes (name, code, target_operators, specialty)
    - Data configuration (time_column, time_format, schema_mappings)
    - Hierarchy support for appending non-overlapping data segments
    """

    __tablename__ = "data_sources"

    # ==========================================================================
    # Factory FK (merged from ProductionLine)
    # ==========================================================================
    factory_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("factories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ==========================================================================
    # Physical Line Attributes (merged from ProductionLine)
    # ==========================================================================
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    # Capacity
    target_operators: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_efficiency_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Configuration
    settings: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    
    # Specialization
    specialty: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g., 'Knits', 'Wovens'
    
    # Supervisor
    supervisor_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("workers.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ==========================================================================
    # Data Source Configuration (original DataSource fields)
    # ==========================================================================
    
    # Legacy reference to old production_lines table (nullable, for migration)
    production_line_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        nullable=True,
        index=True,
    )
    
    # Source Metadata
    source_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
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

    # ==========================================================================
    # Schema Configuration (Schema-First Architecture)
    # ==========================================================================
    schema_config: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        doc="Master schema configuration (e.g., {'Date': 'date', 'Qty': 'int'}). Enforces homogeneity.",
    )

    # ==========================================================================
    # Hierarchy Support (for append feature)
    # ==========================================================================
    parent_data_source_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("data_sources.id", ondelete="CASCADE"),
        nullable=True,
    )
    is_segment: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    date_range_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_range_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    # ==========================================================================
    # Status
    # ==========================================================================
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ==========================================================================
    # Relationships
    # ==========================================================================
    factory: Mapped["Factory"] = relationship(
        "Factory",
        back_populates="data_sources",
    )
    supervisor: Mapped[Optional["Worker"]] = relationship(
        "Worker",
        foreign_keys=[supervisor_id],
        lazy="selectin",
    )
    production_runs: Mapped[list["ProductionRun"]] = relationship(
        "ProductionRun",
        back_populates="data_source",
        lazy="selectin",
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
    
    # Self-referential hierarchy
    parent: Mapped[Optional["DataSource"]] = relationship(
        "DataSource",
        remote_side="DataSource.id",
        back_populates="segments",
        foreign_keys=[parent_data_source_id],
    )
    segments: Mapped[list["DataSource"]] = relationship(
        "DataSource",
        back_populates="parent",
        foreign_keys=[parent_data_source_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<DataSource(id={self.id}, name={self.name}, factory_id={self.factory_id})>"


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
