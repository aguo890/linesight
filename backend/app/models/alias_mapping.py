"""
Alias Mapping model for learned column aliases.
Enables the system to "remember" user corrections for future matching.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import AliasScope
from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.factory import Factory
    from app.models.user import Organization, User


class AliasMapping(Base, UUIDMixin, TimestampMixin):
    """
    User-learned column aliases for future matching.

    Learning Loop:
    1. User corrects a mapping (e.g., "Sewing_Allowance" → "standard_allowed_minute")
    2. System stores this as an AliasMapping
    3. Future uploads check alias DB before fuzzy/LLM matching
    4. High-usage aliases can be promoted from factory → org → global

    ODSAS Alignment:
    - canonical_field should match ODSAS field names
    - This enables cross-factory data standardization
    """

    __tablename__ = "alias_mappings"

    # Scope configuration
    scope: Mapped[str] = mapped_column(
        String(50),
        default=AliasScope.FACTORY.value,
        nullable=False,
        index=True,
    )

    # Scope identifiers (only one should be set based on scope)
    organization_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    factory_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("factories.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # The actual mapping
    source_alias: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )  # The messy column name (e.g., "Sewing_Allowance", "Eff%")

    source_alias_normalized: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )  # Lowercase, stripped version for matching

    canonical_field: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )  # The target field (e.g., "standard_allowed_minute")

    # Learning metadata
    usage_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )  # How many times this alias has been used

    last_used_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Audit
    created_by_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Quality tracking
    correction_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )  # Times users have corrected THIS alias (indicates bad mapping)

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )  # Can be disabled if correction_count is high

    # Relationships
    organization: Mapped[Optional["Organization"]] = relationship(
        "Organization",
        foreign_keys=[organization_id],
    )
    factory: Mapped[Optional["Factory"]] = relationship(
        "Factory",
        foreign_keys=[factory_id],
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by_id],
    )

    # Constraints
    __table_args__ = (
        # Unique alias per scope
        UniqueConstraint(
            "scope",
            "organization_id",
            "factory_id",
            "source_alias_normalized",
            name="uq_alias_per_scope",
        ),
    )

    def __repr__(self) -> str:
        return f"<AliasMapping('{self.source_alias}' → '{self.canonical_field}', scope={self.scope})>"

    @classmethod
    def normalize_alias(cls, alias: str) -> str:
        """Normalize an alias for matching."""
        return alias.lower().strip().replace(" ", "_").replace("-", "_")

    def increment_usage(self) -> None:
        """Record that this alias was used."""
        self.usage_count += 1
        self.last_used_at = datetime.utcnow()

    def record_correction(self) -> None:
        """Record that a user corrected this alias."""
        self.correction_count += 1
        # Auto-disable if too many corrections
        if self.correction_count >= 3:
            self.is_active = False
