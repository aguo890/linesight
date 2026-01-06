import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.models.production import Order, ProductionRun
from app.services.matching.types import (
    ColumnMatchResult,
    MatchResult,
    MatchTier,
)
from app.services.matching.validation import validate_canonical_mapping


def test_pydantic_validation():
    # 1. Valid MatchResult
    match = MatchResult(canonical="actual_qty", confidence=0.95, tier=MatchTier.HASH)
    assert match.confidence == 0.95

    # 2. Invalid Confidence (too high)
    with pytest.raises(ValidationError):
        MatchResult(canonical="actual_qty", confidence=1.1, tier=MatchTier.HASH)

    # 3. Invalid Confidence (too low)
    with pytest.raises(ValidationError):
        MatchResult(canonical="actual_qty", confidence=-0.1, tier=MatchTier.HASH)

    # 4. Valid ColumnMatchResult
    col_match = ColumnMatchResult(
        source_column="Produced Qty",
        target_field="actual_qty",
        confidence=0.8,
        tier=MatchTier.FUZZY,
        fuzzy_score=85,
    )
    assert col_match.status == "needs_review"
    assert col_match.to_dict()["status"] == "needs_review"


def test_canonical_mapping_validation():
    # Should not raise any error
    assert validate_canonical_mapping() is True


@pytest.mark.asyncio
async def test_order_hybrid_property():
    order = Order(quantity=1000, qty_sewn=600)
    assert order.percentage_complete == 60.0

    order.qty_sewn = 1000
    assert order.percentage_complete == 100.0

    order.quantity = 0
    assert order.percentage_complete == 0.0


@pytest.mark.asyncio
async def test_production_run_constraints(db_session, test_factory, test_line):
    # This test requires a database session to verify CheckConstraints
    import uuid
    from datetime import date

    from app.models.production import Order, Style

    # 1. Setup Style & Order
    style = Style(
        id=str(uuid.uuid4()),
        factory_id=test_factory.id,
        style_number=f"STYLE-{uuid.uuid4().hex[:6]}",
    )
    db_session.add(style)
    await db_session.flush()

    order = Order(
        id=str(uuid.uuid4()),
        style_id=style.id,
        po_number=f"PO-{uuid.uuid4().hex[:6]}",
        quantity=1000,
    )
    db_session.add(order)
    await db_session.flush()

    # 2. Test Invalid Insert (negative qty)
    run_invalid = ProductionRun(
        id=str(uuid.uuid4()),
        factory_id=test_factory.id,
        line_id=test_line.id,
        order_id=order.id,
        actual_qty=-10,
        operators_present=10,
        worked_minutes=480,
        production_date=date.today(),
        shift="day",
    )
    db_session.add(run_invalid)

    # CheckConstraint violation should raise IntegrityError on commit/flush
    with pytest.raises(IntegrityError):
        await db_session.commit()

    await db_session.rollback()
