# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Unit tests for AnalyticsService async methods using mocked database.
"""

from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.analytics_service import AnalyticsService


@pytest.mark.asyncio
async def test_get_aggregated_stats_with_line_id():
    """Test aggregated stats with line_id filter."""
    mock_db = AsyncMock(spec=AsyncSession)
    service = AnalyticsService(db=mock_db)

    # Mock ProductionRun objects
    mock_run1 = MagicMock()
    mock_run1.actual_qty = 100
    mock_run1.sam = 2.5
    mock_run1.operators_present = 10
    mock_run1.helpers_present = 2
    mock_run1.worked_minutes = 480
    mock_run1.data_source_id = "line-123"

    mock_run2 = MagicMock()
    mock_run2.actual_qty = 200
    mock_run2.sam = 3.0
    mock_run2.operators_present = 12
    mock_run2.helpers_present = 3
    mock_run2.worked_minutes = 480
    mock_run2.data_source_id = "line-123"

    # Mock execute and scalars
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_run1, mock_run2]
    mock_db.execute.return_value = mock_result

    stats = await service.get_aggregated_stats(
        line_id="line-123", start_date=date(2026, 1, 1), end_date=date(2026, 1, 31)
    )

    # Verify query construction
    mock_db.execute.assert_called_once()
    call_args = mock_db.execute.call_args[0][0]
    # Should have line_id filter
    assert "production_runs.data_source_id" in str(call_args)

    # Verify stats
    assert stats["total_produced"] == 300
    # total_earned_minutes rounded to 2 decimal places
    expected_earned = 100 * 2.5 + 200 * 3.0  # 250 + 600 = 850
    assert stats["total_earned_minutes"] == pytest.approx(expected_earned, abs=0.01)
    # total_available_minutes calculated via service formula
    expected_available = (10 + 2) * 480 + (12 + 3) * 480  # 5760 + 7200 = 12960
    assert stats["total_available_minutes"] == pytest.approx(
        expected_available, abs=0.01
    )
    # Weighted efficiency = (850 / 12960) * 100 ≈ 6.56
    assert stats["weighted_efficiency"] == pytest.approx(6.56, abs=0.01)
    assert "is_suspicious" in stats


@pytest.mark.asyncio
async def test_get_aggregated_stats_without_line_id():
    """Test aggregated stats without line_id filter (all lines)."""
    mock_db = AsyncMock(spec=AsyncSession)
    service = AnalyticsService(db=mock_db)

    mock_run = MagicMock()
    mock_run.actual_qty = 50
    mock_run.sam = 2.0
    mock_run.operators_present = 5
    mock_run.helpers_present = 1
    mock_run.worked_minutes = 480
    mock_run.data_source_id = "line-456"

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_run]
    mock_db.execute.return_value = mock_result

    stats = await service.get_aggregated_stats(
        line_id=None, start_date=date(2026, 2, 1), end_date=date(2026, 2, 28)
    )

    # Should not have line_id filter
    call_args = mock_db.execute.call_args[0][0]
    query_str = str(call_args)
    # Column may appear in SELECT, but should not have WHERE clause filtering by data_source_id
    assert "WHERE production_runs.data_source_id =" not in query_str

    assert stats["total_produced"] == 50
    assert stats["total_earned_minutes"] == 100.0
    assert stats["total_available_minutes"] == (5 + 1) * 480  # 2880
    assert stats["weighted_efficiency"] == pytest.approx(100.0 / 2880 * 100, abs=0.01)


@pytest.mark.asyncio
async def test_get_aggregated_stats_no_db_raises():
    """Should raise ValueError if db session not provided."""
    service = AnalyticsService(db=None)
    with pytest.raises(ValueError, match="Database session required"):
        await service.get_aggregated_stats(
            line_id="line-123", start_date=date(2026, 1, 1), end_date=date(2026, 1, 31)
        )


@pytest.mark.asyncio
async def test_get_target_realization():
    """Test target realization stats."""
    mock_db = AsyncMock(spec=AsyncSession)
    service = AnalyticsService(db=mock_db)

    # Mock execute to return a row with sum values
    mock_row = MagicMock()
    mock_row.actual = 150
    mock_row.target = 200
    mock_result = MagicMock()
    mock_result.one.return_value = mock_row
    mock_db.execute.return_value = mock_result

    stats = await service.get_target_realization(
        line_id="line-123", reference_date=date(2026, 1, 15)
    )

    assert stats["actual"] == 150
    assert stats["target"] == 200
    assert stats["percentage"] == 75.0  # (150/200)*100
    assert stats["delta"] == -50
    assert stats["variance"] == -50
    assert stats["is_mock"] is False


@pytest.mark.asyncio
async def test_get_target_realization_no_target():
    """Target realization with zero target."""
    mock_db = AsyncMock(spec=AsyncSession)
    service = AnalyticsService(db=mock_db)

    mock_row = MagicMock()
    mock_row.actual = 0
    mock_row.target = 0
    mock_result = MagicMock()
    mock_result.one.return_value = mock_row
    mock_db.execute.return_value = mock_result

    stats = await service.get_target_realization(line_id=None)

    assert stats["percentage"] == 0.0
    assert stats["delta"] == 0


@pytest.mark.asyncio
async def test_get_target_realization_default_date():
    """Uses today's date if reference_date not provided."""
    mock_db = AsyncMock(spec=AsyncSession)
    service = AnalyticsService(db=mock_db)

    mock_row = MagicMock()
    mock_row.actual = 100
    mock_row.target = 100
    mock_result = MagicMock()
    mock_result.one.return_value = mock_row
    mock_db.execute.return_value = mock_result

    with patch("app.services.analytics_service.date") as mock_date:
        mock_date.today.return_value = date(2026, 3, 3)
        stats = await service.get_target_realization()

    # Verify query uses today's date (parameterized)
    call_args = mock_db.execute.call_args[0][0]
    query_str = str(call_args)
    assert "date(production_runs.production_date) =" in query_str
    mock_date.today.assert_called_once()
    assert stats["actual"] == 100


@pytest.mark.asyncio
async def test_get_complexity_analysis():
    """Test complexity analysis correlation."""
    mock_db = AsyncMock(spec=AsyncSession)
    service = AnalyticsService(db=mock_db)

    # Mock ProductionRun with order and style relationships
    mock_style = MagicMock()
    mock_style.style_name = "Test Style"
    mock_style.style_number = "ST-001"
    mock_style.base_sam = 2.5

    mock_order = MagicMock()
    mock_order.style = mock_style

    mock_run = MagicMock()
    mock_run.order = mock_order
    mock_run.actual_qty = 100
    mock_run.sam = 2.5
    mock_run.operators_present = 10
    mock_run.helpers_present = 2
    mock_run.worked_minutes = 480

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_run]
    mock_db.execute.return_value = mock_result

    results = await service.get_complexity_analysis(
        start_time=datetime(2026, 1, 1),
        end_time=datetime(2026, 1, 31),
        line_id="line-123",
    )

    assert len(results) == 1
    item = results[0]
    assert item["name"] == "Test Style"
    assert item["sam"] == 2.5
    assert item["efficiency"] == pytest.approx(
        (100 * 2.5) / ((10 + 2) * 480) * 100, abs=0.1
    )
    assert item["volume"] == 100


@pytest.mark.asyncio
async def test_get_complexity_analysis_no_db():
    """Returns empty list if db not provided."""
    service = AnalyticsService(db=None)
    results = await service.get_complexity_analysis()
    assert results == []


@pytest.mark.asyncio
async def test_get_complexity_analysis_exception_handling():
    """Exception in query should be caught and return empty list."""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_db.execute.side_effect = Exception("DB error")
    service = AnalyticsService(db=mock_db)

    results = await service.get_complexity_analysis()
    assert results == []


@pytest.mark.asyncio
async def test_get_sam_performance_metrics():
    """Test SAM performance metrics with breakdown."""
    mock_db = AsyncMock(spec=AsyncSession)
    service = AnalyticsService(db=mock_db)

    # Mock get_aggregated_stats calls
    with patch.object(service, "get_aggregated_stats") as mock_agg:
        mock_agg.return_value = {
            "weighted_efficiency": 85.5,
            "total_earned_minutes": 8550.0,
            "total_available_minutes": 10000.0,
            "is_suspicious": False,
        }

        # Mock internal query for breakdown
        mock_style = MagicMock()
        mock_style.style_number = "ST-001"
        mock_style.style_name = "Style 1"
        mock_style.base_sam = 2.5

        mock_order = MagicMock()
        mock_order.style = mock_style

        mock_run = MagicMock()
        mock_run.order = mock_order
        mock_run.actual_qty = 100
        mock_run.sam = 2.5
        mock_run.operators_present = 10
        mock_run.helpers_present = 2
        mock_run.worked_minutes = 480

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_run]
        mock_db.execute.return_value = mock_result

        metrics = await service.get_sam_performance_metrics(
            line_id="line-123", start_date=date(2026, 1, 1), end_date=date(2026, 1, 31)
        )

    assert metrics["efficiency"] == 85.5
    assert metrics["efficiency_change"] == pytest.approx(
        0.0, abs=0.01
    )  # prev same as current
    assert metrics["avg_sam_per_hour"] == pytest.approx(
        8550.0 / (10000.0 / 60), abs=0.1
    )
    assert metrics["total_sam"] == 8550
    assert metrics["is_suspicious"] is False
    assert metrics["is_mock"] is False
    assert len(metrics["breakdown"]) == 1
    assert metrics["breakdown"][0]["name"] == "ST-001"


@pytest.mark.asyncio
async def test_get_sam_performance_metrics_no_db_breakdown():
    """Breakdown should be empty if db not available."""
    service = AnalyticsService(db=None)
    with patch.object(service, "get_aggregated_stats") as mock_agg:
        mock_agg.return_value = {
            "weighted_efficiency": 0.0,
            "total_earned_minutes": 0.0,
            "total_available_minutes": 0.0,
            "is_suspicious": False,
        }
        metrics = await service.get_sam_performance_metrics(line_id=None)

    assert metrics["breakdown"] == []
