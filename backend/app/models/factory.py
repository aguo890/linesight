"""
Factory and ProductionLine models.
Physical manufacturing facility entities.
"""

from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.analytics import DHUReport
    from app.models.datasource import DataSource
    from app.models.production import ProductionRun, Style
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
    code: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)

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
    production_lines: Mapped[list["ProductionLine"]] = relationship(
        "ProductionLine",
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


class ProductionLine(Base, UUIDMixin, TimestampMixin):
    """
    Sewing line or production cell within a factory.
    The basic unit of production capacity.
    """

    __tablename__ = "production_lines"

    # Factory FK
    factory_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey(
            "factories.id", ondelete="CASCADE", use_alter=True, name="fk_line_factory"
        ),
        nullable=False,
        index=True,
    )

    # Basic Info
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

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    factory: Mapped["Factory"] = relationship(
        "Factory",
        back_populates="production_lines",
    )
    production_runs: Mapped[list["ProductionRun"]] = relationship(
        "ProductionRun",
        back_populates="line",
        lazy="selectin",
    )
    supervisor: Mapped[Optional["Worker"]] = relationship(
        "Worker",
        foreign_keys=[supervisor_id],
        lazy="selectin",
    )
    data_source: Mapped[Optional["DataSource"]] = relationship(
        "DataSource",
        back_populates="production_line",
        uselist=False,
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<ProductionLine(id={self.id}, name={self.name})>"
