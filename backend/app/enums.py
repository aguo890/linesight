"""
Centralized enum definitions for the application.

This module provides a single source of truth for all enums used across
both SQLAlchemy models and Pydantic schemas, eliminating duplicate definitions
and ensuring consistency.

Usage:
    from app.enums import OrderStatus, ShiftType, PriorityLevel
"""

from enum import StrEnum

# =============================================================================
# Production Domain Enums
# =============================================================================


class OrderStatus(StrEnum):
    """Order lifecycle status tracking."""

    PENDING = "pending"  # Order received, not yet started
    CONFIRMED = "confirmed"  # Order confirmed by planning
    CUTTING = "cutting"  # Fabric cutting in progress
    SEWING = "sewing"  # Sewing/assembly in progress
    FINISHING = "finishing"  # Finishing operations (pressing, etc.)
    PACKING = "packing"  # Packing for shipment
    SHIPPED = "shipped"  # Shipped to customer
    CANCELLED = "cancelled"  # Order cancelled


class OrderPriority(StrEnum):
    """Order priority levels."""

    NORMAL = "normal"
    RUSH = "rush"
    CRITICAL = "critical"


class PriorityLevel(StrEnum):
    """General priority levels for various entities."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class ComplexityRating(StrEnum):
    """Style complexity rating for SAM adjustment."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class ShiftType(StrEnum):
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


class SubscriptionTier(StrEnum):
    """Organization subscription tiers."""

    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class UserRole(StrEnum):
    """User roles for RBAC."""

    ADMIN = "admin"
    MANAGER = "manager"
    ANALYST = "analyst"
    VIEWER = "viewer"


class RoleScope(StrEnum):
    """Scope levels for user permissions."""

    ORGANIZATION = "organization"
    FACTORY = "factory"
    LINE = "line"


# =============================================================================
# Analytics Enums
# =============================================================================


class PerformanceTier(StrEnum):
    """Performance classification for efficiency metrics."""

    BELOW_TARGET = "below_target"
    ON_TARGET = "on_target"
    ABOVE_TARGET = "above_target"


class PeriodType(StrEnum):
    """Aggregation period types for reports."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


# =============================================================================
# Ingestion/Upload Enums
# =============================================================================


class FileType(StrEnum):
    """Excel file type classification."""

    PRODUCTION = "production"
    QUALITY = "quality"
    CUTTING = "cutting"
    ATTENDANCE = "attendance"
    UNKNOWN = "unknown"


class ProcessingStatus(StrEnum):
    """Processing job status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class MatchTier(StrEnum):
    """Column matching tier in waterfall engine."""

    HASH = "hash"
    FUZZY = "fuzzy"
    LLM = "llm"
    MANUAL = "manual"
    UNMATCHED = "unmatched"


# =============================================================================
# Alias Scope Enum
# =============================================================================


class AliasScope(StrEnum):
    """Scope for alias mappings."""

    GLOBAL = "global"
    ORGANIZATION = "organization"
    FACTORY = "factory"
    LINE = "line"
