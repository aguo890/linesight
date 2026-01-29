"""
Centralized enum definitions for the application.

This module provides a single source of truth for all enums used across
both SQLAlchemy models and Pydantic schemas, eliminating duplicate definitions
and ensuring consistency.

Usage:
    from app.enums import OrderStatus, ShiftType, PriorityLevel
"""

from enum import Enum


def resolve_enum_values(enum_cls):
    """SQLAlchemy values_callable helper to enforce using values instead of names."""
    return [e.value for e in enum_cls]


# =============================================================================
# Production Domain Enums
# =============================================================================


class OrderStatus(str, Enum):
    """Order lifecycle status tracking."""

    PENDING = "pending"  # Order received, not yet started
    CONFIRMED = "confirmed"  # Order confirmed by planning
    CUTTING = "cutting"  # Fabric cutting in progress
    SEWING = "sewing"  # Sewing/assembly in progress
    FINISHING = "finishing"  # Finishing operations (pressing, etc.)
    PACKING = "packing"  # Packing for shipment
    SHIPPED = "shipped"  # Shipped to customer
    CANCELLED = "cancelled"  # Order cancelled


class OrderPriority(str, Enum):
    """Order priority levels."""

    NORMAL = "normal"
    RUSH = "rush"
    CRITICAL = "critical"


class PriorityLevel(str, Enum):
    """General priority levels for various entities."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class ComplexityRating(str, Enum):
    """Style complexity rating for SAM adjustment."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class ShiftType(str, Enum):
    """Production shift identifiers.

    'day'/'night' for 2-shift factories,
    'A'/'B'/'C' for 3-shift factories.
    """

    DAY = "day"
    NIGHT = "night"
    A = "A"
    B = "B"
    C = "C"


# =============================================================================
# User & Organization Enums
# =============================================================================


class SubscriptionTier(str, Enum):
    """Organization subscription tiers."""

    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class UserRole(str, Enum):
    """User roles for RBAC.

    Hierarchy:
    - SYSTEM_ADMIN: Platform-level admin (developer). Can see all organizations.
    - OWNER: Organization owner/CEO. Full access to all factories/lines in their org.
             Can create factories, add lines, assign managers.
    - FACTORY_MANAGER: Assigned to specific factories by owner.
             Can add/edit lines within assigned factory, upload to any line in factory.
    - LINE_MANAGER: Assigned to specific lines by owner/factory manager.
             STRICT ACCESS: Can ONLY view/upload to explicitly assigned lines.
             Cannot view sibling lines or add new lines.
    - ANALYST: Read-only analytics access within organization. Can create dashboards.
    - VIEWER: Read-only access within organization.
    """

    SYSTEM_ADMIN = "system_admin"        # Platform-level admin
    OWNER = "owner"                      # Organization owner/CEO
    FACTORY_MANAGER = "factory_manager"  # Factory-scoped manager
    LINE_MANAGER = "line_manager"        # Line-scoped manager (strict)
    ANALYST = "analyst"                  # Read-only analytics
    VIEWER = "viewer"                    # Read-only access


class RoleScope(str, Enum):
    """Scope levels for user permissions.

    DATA_SOURCE replaces LINE after the refactor.
    """

    ORGANIZATION = "organization"
    FACTORY = "factory"
    DATA_SOURCE = "data_source"  # New: replaces LINE
    LINE = "line"  # Deprecated: kept for migration compatibility


# =============================================================================
# Analytics Enums
# =============================================================================


class PerformanceTier(str, Enum):
    """Performance classification for efficiency metrics."""

    BELOW_TARGET = "below_target"
    ON_TARGET = "on_target"
    ABOVE_TARGET = "above_target"


class PeriodType(str, Enum):
    """Aggregation period types for reports."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


# =============================================================================
# Ingestion/Upload Enums
# =============================================================================


class FileType(str, Enum):
    """Excel file type classification."""

    PRODUCTION = "production"
    QUALITY = "quality"
    CUTTING = "cutting"
    ATTENDANCE = "attendance"
    UNKNOWN = "unknown"


class ProcessingStatus(str, Enum):
    """Processing job status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class MatchTier(str, Enum):
    """Column matching tier in waterfall engine."""

    HASH = "hash"
    FUZZY = "fuzzy"
    LLM = "llm"
    MANUAL = "manual"
    UNMATCHED = "unmatched"


# =============================================================================
# Alias Scope Enum
# =============================================================================


class AliasScope(str, Enum):
    """Scope for alias mappings."""

    GLOBAL = "global"
    ORGANIZATION = "organization"
    FACTORY = "factory"
    DATA_SOURCE = "data_source"  # New: replaces LINE
    LINE = "line"  # Deprecated: kept for migration compatibility
