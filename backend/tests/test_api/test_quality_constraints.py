"""
Regression Test: QualityInspection Composite Unique Constraint

This test verifies that the database enforces the composite unique constraint
on (production_run_id, inspection_type) for the quality_inspections table.

Without this constraint, UPSERT operations fail with:
- InvalidColumnReferenceError: there is no unique or exclusion constraint...

This test ensures the constraint cannot be accidentally removed in future refactors.

Created: 2026-01-29
Ticket: Database constraint mismatch fix for QualityInspection upserts
"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.datasource import DataSource
from app.models.production import Order, ProductionRun, Style
from app.models.quality import InspectionType, QualityInspection


@pytest.mark.asyncio
async def test_quality_inspection_allows_different_types_per_run(
    db_session, test_factory
):
    """
    Verify that a ProductionRun CAN have multiple QualityInspections 
    of DIFFERENT types (e.g., ENDLINE and INLINE).
    
    This is valid per the domain model: multiple inspection checkpoints 
    occur during manufacturing.
    """
    # Setup: Create DataSource (replaces deprecated ProductionLine)
    data_source = DataSource(
        id=str(uuid.uuid4()),
        factory_id=test_factory.id,
        name=f"Test Line {uuid.uuid4().hex[:6]}",
    )
    db_session.add(data_source)
    await db_session.flush()

    # Setup: Create Style -> Order -> ProductionRun
    style = Style(
        id=str(uuid.uuid4()),
        factory_id=test_factory.id,
        style_number=f"ST-{uuid.uuid4().hex[:6]}",
        base_sam=2.5,
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

    run = ProductionRun(
        id=str(uuid.uuid4()),
        factory_id=test_factory.id,
        data_source_id=data_source.id,
        order_id=order.id,
        actual_qty=100,
        operators_present=10,
        helpers_present=2,
        worked_minutes=480,
        shift="day",
    )
    db_session.add(run)
    await db_session.flush()

    # Create first inspection: ENDLINE
    insp_endline = QualityInspection(
        id=str(uuid.uuid4()),
        production_run_id=run.id,
        inspection_type=InspectionType.ENDLINE,
        units_checked=100,
        defects_found=2,
        units_rejected=0,
        units_reworked=1,
        dhu=2.0,
        inspected_at=datetime.now(timezone.utc),
    )
    db_session.add(insp_endline)
    await db_session.commit()

    # Create second inspection: INLINE (different type) -> Should succeed
    insp_inline = QualityInspection(
        id=str(uuid.uuid4()),
        production_run_id=run.id,
        inspection_type=InspectionType.INLINE,  # Different type
        units_checked=50,
        defects_found=1,
        units_rejected=0,
        units_reworked=0,
        dhu=2.0,
        inspected_at=datetime.now(timezone.utc),
    )
    db_session.add(insp_inline)

    # This should NOT raise - different types are allowed
    await db_session.commit()

    # Verify both exist
    await db_session.refresh(run)
    assert len(run.quality_inspections) == 2


@pytest.mark.asyncio
async def test_quality_inspection_rejects_duplicate_type_per_run(
    db_session, test_factory
):
    """
    Verify that a ProductionRun CANNOT have multiple QualityInspections 
    of the SAME type (e.g., two ENDLINE inspections).
    
    This constraint prevents accidental data duplication and enables 
    atomic UPSERT operations.
    
    CRITICAL: If this test fails, the uq_quality_inspection_run_type 
    constraint may have been removed, which will break production ingestion.
    """
    # Setup: Create DataSource
    data_source = DataSource(
        id=str(uuid.uuid4()),
        factory_id=test_factory.id,
        name=f"Test Line {uuid.uuid4().hex[:6]}",
    )
    db_session.add(data_source)
    await db_session.flush()

    # Setup: Create Style -> Order -> ProductionRun
    style = Style(
        id=str(uuid.uuid4()),
        factory_id=test_factory.id,
        style_number=f"ST-{uuid.uuid4().hex[:6]}",
        base_sam=2.5,
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

    run = ProductionRun(
        id=str(uuid.uuid4()),
        factory_id=test_factory.id,
        data_source_id=data_source.id,
        order_id=order.id,
        actual_qty=100,
        operators_present=10,
        helpers_present=2,
        worked_minutes=480,
        shift="day",
    )
    db_session.add(run)
    await db_session.flush()

    # Create first ENDLINE inspection
    insp_first = QualityInspection(
        id=str(uuid.uuid4()),
        production_run_id=run.id,
        inspection_type=InspectionType.ENDLINE,
        units_checked=100,
        defects_found=2,
        units_rejected=0,
        units_reworked=1,
        dhu=2.0,
        inspected_at=datetime.now(timezone.utc),
    )
    db_session.add(insp_first)
    await db_session.commit()

    # Attempt to create second ENDLINE inspection (duplicate type)
    insp_duplicate = QualityInspection(
        id=str(uuid.uuid4()),
        production_run_id=run.id,
        inspection_type=InspectionType.ENDLINE,  # SAME type - should fail
        units_checked=50,
        defects_found=5,
        units_rejected=0,
        units_reworked=3,
        dhu=10.0,
        inspected_at=datetime.now(timezone.utc),
    )
    db_session.add(insp_duplicate)

    # This SHOULD raise IntegrityError - duplicate (run_id, type) pair
    with pytest.raises(IntegrityError) as exc_info:
        await db_session.commit()

    # Verify it's a unique constraint violation (works for SQLite + Postgres)
    error_msg = str(exc_info.value).lower()
    assert "unique" in error_msg or "duplicate" in error_msg

    # Clean up failed transaction
    await db_session.rollback()

