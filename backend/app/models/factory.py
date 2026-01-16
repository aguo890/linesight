"""
Factory models.
Physical manufacturing facility entities.

Note: ProductionLine has been consolidated into DataSource as of the
data-source refactor. See models/datasource.py for the unified entity.
"""

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.analytics import DHUReport
    from app.models.datasource import DataSource
    from app.models.production import Style
    from app.models.user import Organization
    from app.models.workforce import Worker


class Factory(Base, UUIDMixin, TimestampMixin):
    """
    Physical manufacturing facility.
    Represents a single factory location within an organization.
    """

    __tablename__ = "factories"

    # Organization FK
    organization_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey(
            "organizations.id",
            ondelete="CASCADE",
            use_alter=True,
            name="fk_factory_org",
        ),
        nullable=False,
        index=True,
    )

    # Basic Info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # Location
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)

    # Capacity
    total_lines: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_workers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    daily_capacity_units: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Certifications (JSON array)
    certifications: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Configuration (New Field)
    # Stores operating shifts, custom alerts, or UI preferences
    settings: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    
    # Display Preference
    # Default 'en-US' or derived from country (e.g., 'vi-VN' if Country='VN')
    locale: Mapped[str] = mapped_column(String(20), default="en-US", nullable=False)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="factories",
    )
    # Renamed from production_lines to data_sources after refactor
    data_sources: Mapped[list["DataSource"]] = relationship(
        "DataSource",
        back_populates="factory",
        lazy="selectin",
    )
    workers: Mapped[list["Worker"]] = relationship(
        "Worker",
        back_populates="factory",
        lazy="selectin",
    )
    styles: Mapped[list["Style"]] = relationship(
        "Style",
        back_populates="factory",
        lazy="selectin",
    )
    # ARCHIVED: fabric_lots relationship moved to models/drafts/cutting.py

    dhu_reports: Mapped[list["DHUReport"]] = relationship(
        "DHUReport",
        back_populates="factory",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Factory(id={self.id}, name={self.name}, country={self.country})>"


# =============================================================================
# DEPRECATED: ProductionLine has been merged into DataSource
# =============================================================================
# The ProductionLine model has been removed. All its functionality is now
# in the DataSource model (models/datasource.py).
#
# For backward compatibility during migration, you can use:
#   from app.models.datasource import DataSource as ProductionLine
#
# But prefer updating all references to use DataSource directly.
# =============================================================================
