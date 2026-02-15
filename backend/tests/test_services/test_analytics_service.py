# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from app.services.analytics_service import AnalyticsService

# MOCK DATA: Simple dictionaries to simulate SQLAlchemy models
# [2026-01-03] Mock data indicated for backend testing


def test_get_aggregated_stats_standard():
    """
    Verifies that efficiency is calculated as Sum(Earned)/Sum(Available)
    and NOT the average of daily efficiencies.
    """
    # Using actual field names from our project (actual_qty, operators_present, etc.)
    mock_logs = [
        # Day 1: High efficiency (100 earned / 100 available) = 100%
        {
            "actual_qty": 100,
            "sam": 1.0,
            "operators_present": 1,
            "helpers_present": 0,
            "worked_minutes": 100,
        },
        # Day 2: Low efficiency (50 earned / 100 available) = 50%
        {
            "actual_qty": 50,
            "sam": 1.0,
            "operators_present": 1,
            "helpers_present": 0,
            "worked_minutes": 100,
        },
    ]

    stats = AnalyticsService.aggregate_production_stats(mock_logs)

    # Math: Total Earned = 150, Total Available = 200. Efficiency = 75%.
    assert stats["weighted_efficiency"] == 75.0
    assert stats["total_earned_minutes"] == 150.0


def test_get_aggregated_stats_weighted_check():
    """
    Verifies weighted average.
    Day 1: 10 mins worked, 10 mins earned (100% eff)
    Day 2: 1000 mins worked, 500 mins earned (50% eff)

    Naive Average: (100 + 50) / 2 = 75% (WRONG)
    Weighted: (10 + 500) / (10 + 1000) = 510 / 1010 ≈ 50.5% (CORRECT)
    """
    mock_logs = [
        {
            "actual_qty": 10,
            "sam": 1.0,
            "operators_present": 1,
            "helpers_present": 0,
            "worked_minutes": 10,
        },
        {
            "actual_qty": 500,
            "sam": 1.0,
            "operators_present": 1,
            "helpers_present": 0,
            "worked_minutes": 1000,
        },
    ]

    stats = AnalyticsService.aggregate_production_stats(mock_logs)
    assert stats["weighted_efficiency"] == 50.5  # Rounded from 50.495...


def test_validate_production_physics_rules():
    """
    Tests that the 1700% bug (or any efficiency > 150%) is flagged.
    """
    # Case: User uploads cumulative data by mistake
    # 1000 units * 5 SAM = 5000 Earned Minutes
    # 1 Operator * 60 Minutes = 60 Available Minutes
    # Efficiency = 8333%
    suspicious_log = {
        "actual_qty": 1000,
        "sam": 5.0,
        "operators_present": 1,
        "helpers_present": 0,
        "worked_minutes": 60,
    }

    warnings = AnalyticsService.validate_production_physics(suspicious_log)

    assert len(warnings) > 0
    assert "Efficiency Suspiciously High" in warnings[0]
    assert "CRITICAL" in warnings[1]
