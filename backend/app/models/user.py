"""
User and Organization models.
Core entities for multi-tenant SaaS architecture.
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import RoleScope, SubscriptionTier, UserRole, resolve_enum_values
from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.dashboard import Dashboard
    from app.models.factory import Factory


class Organization(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Multi-tenant organization entity.
    Root of the tenant hierarchy - all data is scoped to an organization.
    """

    __tablename__ = "organizations"

    # Basic Info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)

    # Subscription
    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        Enum(SubscriptionTier, values_callable=resolve_enum_values),
        default=SubscriptionTier.STARTER,
        nullable=False,
    )

    # Settings (JSON for flexibility)
    settings: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string

    # Subscription Quotas (admin-controlled)
    max_factories: Mapped[int] = mapped_column(
        Integer,
        default=1,  # Free tier default
        nullable=False,
    )
    max_lines_per_factory: Mapped[int] = mapped_column(
        Integer,
        default=1,  # Free tier default
        nullable=False,
    )

    # Contact
    primary_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    primary_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="organization",
        lazy="selectin",
    )
    factories: Mapped[list["Factory"]] = relationship(
        "Factory",
        back_populates="organization",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Organization(id={self.id}, name={self.name})>"


class User(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Platform user with authentication credentials.
    Scoped to an organization for multi-tenancy.
    """

    __tablename__ = "users"

    # Organization FK
    organization_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Authentication
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Profile
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    timezone: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default="UTC"
    )
    preferences: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string

    # Authorization
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=resolve_enum_values),
        default=UserRole.VIEWER,
        nullable=False,
    )

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Session tracking
    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="users",
    )

    dashboards: Mapped[list["Dashboard"]] = relationship(
        "Dashboard",
        back_populates="user",
        lazy="selectin",
    )
    scopes: Mapped[list["UserScope"]] = relationship(
        "UserScope",
        back_populates="user",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"


class UserScope(Base, UUIDMixin, TimestampMixin):
    """
    Granular access control link.
    Maps a user to a specific entity (Org, Factory, or Line) with a role.
    """

    __tablename__ = "user_scopes"

    user_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    scope_type: Mapped[RoleScope] = mapped_column(
        Enum(RoleScope, values_callable=resolve_enum_values),
        nullable=False,
    )

    # Target Entity IDs (nullable depending on scope type)
    organization_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
    )
    factory_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("factories.id", ondelete="CASCADE"),
        nullable=True,
    )
    # Renamed from production_line_id to data_source_id in migration
    data_source_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("data_sources.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Specific role within this scope
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=resolve_enum_values),
        default=UserRole.VIEWER,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="scopes")

    def __repr__(self) -> str:
        return f"<UserScope(user_id={self.user_id}, type={self.scope_type}, role={self.role})>"
