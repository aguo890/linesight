"""
AI Decision API endpoints.
Provides transparency into AI schema inference and code generation decisions.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.ai_decision import AgentType, AIDecision
from app.models.user import User

router = APIRouter()


# Pydantic Schemas
class AIDecisionResponse(BaseModel):
    id: str
    created_at: datetime
    data_source_id: str | None
    agent_type: str
    model_used: str
    input_summary: str
    output_summary: str
    confidence: float | None
    reasoning: dict | None
    performance_metadata: dict | None = None  # Changed from 'metadata' to match model

    model_config = ConfigDict(from_attributes=True)


class AIDecisionListResponse(BaseModel):
    decisions: list[AIDecisionResponse]
    total: int
    limit: int
    offset: int


@router.get("/ai-decisions", response_model=AIDecisionListResponse)
async def list_ai_decisions(
    data_source_id: str | None = Query(None, description="Filter by data source ID"),
    agent_type: AgentType | None = Query(None, description="Filter by agent type"),
    start_date: datetime | None = Query(None, description="Filter by start date"),
    end_date: datetime | None = Query(None, description="Filter by end date"),
    limit: int = Query(50, ge=1, le=100, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List AI decisions with optional filtering.

    Useful for:
    - Debugging: See why AI made specific decisions
    - Auditing: Track all AI usage
    - Cost tracking: Monitor token usage
    - Performance analysis: Compare model latencies
    """
    # Build query
    query = select(AIDecision)

    # Apply filters
    if data_source_id:
        query = query.where(AIDecision.data_source_id == data_source_id)
    if agent_type:
        query = query.where(AIDecision.agent_type == agent_type)
    if start_date:
        query = query.where(AIDecision.created_at >= start_date)
    if end_date:
        query = query.where(AIDecision.created_at <= end_date)

    # Get total count
    count_query = select(AIDecision.id)
    if data_source_id:
        count_query = count_query.where(AIDecision.data_source_id == data_source_id)
    if agent_type:
        count_query = count_query.where(AIDecision.agent_type == agent_type)
    if start_date:
        count_query = count_query.where(AIDecision.created_at >= start_date)
    if end_date:
        count_query = count_query.where(AIDecision.created_at <= end_date)

    count_result = await db.execute(count_query)
    total = len(count_result.all())

    # Apply pagination and ordering
    query = query.order_by(desc(AIDecision.created_at)).limit(limit).offset(offset)

    result = await db.execute(query)
    decisions = result.scalars().all()

    return AIDecisionListResponse(
        decisions=[AIDecisionResponse.model_validate(d) for d in decisions],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/ai-decisions/{decision_id}", response_model=AIDecisionResponse)
async def get_ai_decision(
    decision_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific AI decision by ID with full details."""
    result = await db.execute(select(AIDecision).where(AIDecision.id == decision_id))
    decision = result.scalar_one_or_none()

    if not decision:
        raise HTTPException(status_code=404, detail="AI decision not found")

    return decision


@router.get(
    "/datasources/{data_source_id}/ai-decisions",
    response_model=list[AIDecisionResponse],
)
async def get_data_source_ai_decisions(
    data_source_id: str,
    limit: int = Query(
        10, ge=1, le=50, description="Number of recent decisions to return"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get recent AI decisions for a specific data source.

    Useful for debugging a specific file's processing history.
    """
    query = (
        select(AIDecision)
        .where(AIDecision.data_source_id == data_source_id)
        .order_by(desc(AIDecision.created_at))
        .limit(limit)
    )

    result = await db.execute(query)
    decisions = result.scalars().all()

    return decisions
