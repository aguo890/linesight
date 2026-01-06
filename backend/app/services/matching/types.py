"""
Type definitions for the matching engine.
"""

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.enums import MatchTier


class MatchResult(BaseModel):
    """Result from a single tier of matching."""

    canonical: str | None
    confidence: float = Field(..., ge=0.0, le=1.0)
    tier: MatchTier
    fuzzy_score: int | None = Field(None, ge=0, le=100)
    reasoning: str | None = None

    @field_validator("fuzzy_score", mode="before")
    @classmethod
    def round_fuzzy_score(cls, v: Any) -> int | None:
        if isinstance(v, float):
            return int(round(v))
        return v


class ColumnMatchResult(BaseModel):
    """Complete result for a single column mapping."""

    model_config = ConfigDict(from_attributes=True)

    source_column: str
    target_field: str | None
    confidence: float = Field(..., ge=0.0, le=1.0)
    tier: MatchTier
    fuzzy_score: int | None = Field(None, ge=0, le=100)
    reasoning: str | None = None
    sample_data: list[Any] = Field(default_factory=list)
    needs_review: bool = False
    ignored: bool = False

    @field_validator("fuzzy_score", mode="before")
    @classmethod
    def round_fuzzy_score(cls, v: Any) -> int | None:
        if isinstance(v, float):
            return int(round(v))
        return v

    @property
    def status(self) -> str:
        if self.ignored:
            return "ignored"
        if self.confidence >= 0.9:
            return "auto_mapped"
        if self.confidence >= 0.6:
            return "needs_review"
        return "needs_attention"

    def to_dict(self) -> dict:
        """Legacy support for dictionary conversion."""
        return {
            "source_column": self.source_column,
            "target_field": self.target_field,
            "confidence": round(self.confidence, 3),
            "tier": self.tier.value,
            "fuzzy_score": self.fuzzy_score,
            "reasoning": self.reasoning,
            "sample_data": self.sample_data[:5],
            "needs_review": self.needs_review,
            "ignored": self.ignored,
            "status": self.status,
        }


@dataclass(frozen=True)
class CanonicalFieldDefinition:
    """Single source of truth for canonical field configuration."""

    key: str
    label: str
    category: str


# Define canonical fields once
CANONICAL_DEFINITIONS = [
    # Metrics
    CanonicalFieldDefinition(
        "actual_qty", "Actual pieces produced/passed (Good Output)", "Metrics"
    ),
    CanonicalFieldDefinition(
        "planned_qty", "Target Production Quantity (Daily Target/Plan)", "Metrics"
    ),
    CanonicalFieldDefinition("defects", "Number of defects/rejects found", "Metrics"),
    CanonicalFieldDefinition("dhu", "Defects per Hundred Units (DHU)", "Metrics"),
    CanonicalFieldDefinition("line_efficiency", "Line Efficiency (%)", "Metrics"),
    CanonicalFieldDefinition("sam", "Standard Allowed Minute (SAM/SMV)", "Metrics"),
    CanonicalFieldDefinition(
        "earned_minutes", "Total Earned Minutes (Actual Qty * SAM)", "Metrics"
    ),
    CanonicalFieldDefinition(
        "worked_minutes", "Total Worked/Available Minutes", "Metrics"
    ),
    # Workforce
    CanonicalFieldDefinition(
        "operators_present", "Number of sewing operators present", "Workforce"
    ),
    CanonicalFieldDefinition(
        "helpers_present", "Number of helpers present", "Workforce"
    ),
    CanonicalFieldDefinition(
        "total_manpower", "Total production personnel", "Workforce"
    ),
    # Time
    CanonicalFieldDefinition(
        "production_date", "Date of production (when goods were made)", "Time"
    ),
    CanonicalFieldDefinition(
        "inspection_date", "Date of inspection (when goods were checked)", "Time"
    ),
    CanonicalFieldDefinition("start_time", "Operation start time", "Time"),
    CanonicalFieldDefinition("end_time", "Operation end time", "Time"),
    CanonicalFieldDefinition("shift", "Working shift (Day/Night/A/B)", "Time"),
    CanonicalFieldDefinition(
        "downtime_minutes", "Total non-productive minutes", "Time"
    ),
    CanonicalFieldDefinition(
        "downtime_reason", "Reason for downtime (e.g. Machine Broken)", "Time"
    ),
    # Identifiers
    CanonicalFieldDefinition("style_number", "Garment style/SKU code", "Identifiers"),
    CanonicalFieldDefinition("po_number", "Purchase Order number", "Identifiers"),
    CanonicalFieldDefinition("line_id", "Production Line identifier", "Identifiers"),
    CanonicalFieldDefinition("order_id", "Internal Order ID", "Identifiers"),
    CanonicalFieldDefinition("lot_number", "Fabric lot number", "Identifiers"),
    CanonicalFieldDefinition("batch_number", "Production batch number", "Identifiers"),
    CanonicalFieldDefinition("color", "Color/colorway", "Identifiers"),
    CanonicalFieldDefinition("size", "Garment size", "Identifiers"),
    CanonicalFieldDefinition("buyer", "Brand/customer name", "Identifiers"),
    CanonicalFieldDefinition("season", "Season code (e.g. SS24)", "Identifiers"),
    CanonicalFieldDefinition("notes", "Comments or remarks", "Identifiers"),
]

# Derive helpers dynamically so they never drift
CANONICAL_FIELDS = [d.key for d in CANONICAL_DEFINITIONS]
FIELD_DESCRIPTIONS = {d.key: d.label for d in CANONICAL_DEFINITIONS}
