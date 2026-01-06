"""
AI Decision tracking model.
Stores LLM reasoning for schema inference and code generation.
"""

import enum

from sqlalchemy import JSON, Column, Float, ForeignKey, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class AgentType(str, enum.Enum):
    """Type of AI agent that made the decision."""

    SCHEMA_INFERENCE = "schema_inference"
    CODE_GENERATION = "code_generation"


class AIDecision(Base, UUIDMixin, TimestampMixin):
    """
    Tracks AI decision-making for transparency and debugging.

    Use cases:
    - Debugging: See why AI chose specific column mappings
    - Auditing: Track all AI usage for compliance
    - Cost tracking: Monitor token usage per file
    - Improvement: Identify patterns to add to fuzzy matcher
    """

    __tablename__ = "ai_decisions"

    # Link to data source (optional - may be used for ad-hoc analysis)
    data_source_id = Column(
        String(36), ForeignKey("data_sources.id"), nullable=True, index=True
    )

    # Agent metadata
    agent_type = Column(SQLEnum(AgentType), nullable=False, index=True)  # type: ignore[var-annotated]
    model_used = Column(String(50), nullable=False)  # "deepseek-v3", "gpt-4o", etc.

    # Input/Output summaries (truncated for storage efficiency)
    input_summary = Column(Text, nullable=False)  # First 500 chars of input
    output_summary = Column(Text, nullable=False)  # Key results

    # Confidence and reasoning
    confidence = Column(Float, nullable=True)  # Overall confidence score (0.0-1.0)
    reasoning = Column(JSON, nullable=True)  # Structured reasoning from LLM

    # Performance metadata
    performance_metadata = Column(
        JSON, nullable=True
    )  # tokens_used, latency_ms, temperature, etc.

    # Relationships
    data_source = relationship("DataSource", back_populates="ai_decisions")

    def __repr__(self):
        return f"<AIDecision(id={self.id}, agent_type={self.agent_type}, model={self.model_used}, confidence={self.confidence})>"
