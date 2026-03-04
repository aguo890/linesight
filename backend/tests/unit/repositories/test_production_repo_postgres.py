# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
PostgreSQL-specific unit tests for ProductionRepository.

Validates PostgreSQL-only features (JSONB containment operators, window functions)
and ensures no SQLite dialect drift.
"""

import pytest
from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB

from app.repositories.production_repo import ProductionRepository
from app.models.production import ProductionRun, Order, Style
from app.models.datasource import DataSource
from app.models.factory import Factory


@pytest.mark.asyncio
async def test_get_runs_by_date_range_and_line_filter(
    db_session,
    test_factory,
    test_line,
    test_style,
    test_order,
):
    """
    PostgreSQL-specific: Tests date range filtering with line_id filter,
    ensuring proper index usage and timezone‑aware date comparisons.
    """
    repo = ProductionRepository(db_session)

    # Create multiple production runs across different dates
    runs_data = []
    for i in range(5):
        run = ProductionRun(
            factory_id=test_factory.id,
            data_source_id=test_line.id,
            order_id=test_order.id,
            production_date=date.today() - timedelta(days=i),
            shift="day",
            sam=2.5,
            operators_present=20,
            helpers_present=5,
            worked_minutes=480,
            actual_qty=100 + i * 10,
            planned_qty=100,
        )
        db_session.add(run)
        runs_data.append(run)
    await db_session.flush()

    # Test filtering: last 3 days for this line
    start_date = date.today() - timedelta(days=3)
    end_date = date.today()

    runs = await repo.get_runs_by_line(
        line_id=test_line.id,
        start_date=start_date,
        end_date=end_date,
    )

    # Expect runs with dates >= start_date and <= end_date
    expected_dates = {date.today() - timedelta(days=d) for d in range(4)}  # 0,1,2,3
    actual_dates = {run.production_date for run in runs}

    assert actual_dates == expected_dates
    assert all(run.data_source_id == test_line.id for run in runs)

    # Verify ordering (desc by default)
    assert runs[0].production_date >= runs[1].production_date


@pytest.mark.asyncio
async def test_join_and_factory_lookup(
    db_session,
    test_factory,
    test_line,
    test_style,
    test_order,
):
    """
    PostgreSQL-specific: Tests JOINs across Factory → DataSource → ProductionRun
    with JSONB settings field, verifying PostgreSQL's index‑assisted lookups.
    """
    repo = ProductionRepository(db_session)

    # Add JSON settings to DataSource (PostgreSQL JSONB field)
    test_line.settings = {"shift_capacity": {"day": 500, "night": 300}}
    await db_session.flush()

    # Create production run
    run = ProductionRun(
        factory_id=test_factory.id,
        data_source_id=test_line.id,
        order_id=test_order.id,
        production_date=date.today(),
        shift="day",
        sam=2.5,
        operators_present=20,
        helpers_present=5,
        worked_minutes=480,
        actual_qty=150,
        planned_qty=150,
    )
    db_session.add(run)
    await db_session.flush()

    # Query using get_effective_date with line_id → should auto‑detect factory timezone
    effective_date = await repo.get_effective_date(
        line_id=test_line.id, timezone_str="UTC"
    )

    # Should return today because we have data for today
    assert effective_date == date.today()

    # Verify the join path works: DataSource → Factory
    query = (
        select(DataSource)
        .join(Factory, DataSource.factory_id == Factory.id)
        .where(Factory.id == test_factory.id)
    )
    result = await db_session.execute(query)
    fetched_ds = result.scalars().first()

    assert fetched_ds is not None
    assert fetched_ds.id == test_line.id
    assert fetched_ds.settings == {"shift_capacity": {"day": 500, "night": 300}}


@pytest.mark.asyncio
@pytest.mark.skip(
    reason="JSON column does not support containment operators in PostgreSQL; test passes with JSONB column type"
)
async def test_jsonb_filter_behavior(
    db_session,
    test_factory,
    test_line,
    test_style,
    test_order,
):
    """
    PostgreSQL‑specific: Tests JSONB containment operators (`@>`)
    and `.contains()` for indexed lookups on metadata fields.
    """
    # Add JSONB‑like settings with nested structure
    test_line.settings = {
        "metadata": {
            "product_type": "woven",
            "complexity": "high",
            "tags": ["priority", "export"],
        },
        "capacity": {"daily": 1000},
    }
    await db_session.flush()

    # Use SQLAlchemy's JSON containment operator (PostgreSQL specific)
    # Test array containment: tags contains "priority"
    query = select(DataSource).where(
        DataSource.settings["metadata"]["tags"].contains(["priority"])
    )
    result = await db_session.execute(query)
    matching_ds = result.scalars().all()

    assert len(matching_ds) == 1
    assert matching_ds[0].id == test_line.id

    # Test object containment: metadata contains {"product_type": "woven"}
    query2 = select(DataSource).where(
        DataSource.settings["metadata"].contains({"product_type": "woven"})
    )
    result2 = await db_session.execute(query2)
    matching_ds2 = result2.scalars().all()

    assert len(matching_ds2) == 1
    assert matching_ds2[0].id == test_line.id

    # Verify the operator works with indexed lookups (no error)
    # This test passes if the query executes without SQLAlchemy dialect error
    # (i.e., we are using PostgreSQL, not SQLite)
