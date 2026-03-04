# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Property-based tests for AnalyticsService using Hypothesis.
Ensures mathematical correctness and edge-case resilience.
"""

import math
from typing import Any

import pytest
from hypothesis import given, strategies as st, assume, settings
from hypothesis import HealthCheck

from app.services.analytics_service import AnalyticsService


# =============================================================================
# Core Formula Property Tests
# =============================================================================


@given(
    produced_qty=st.integers(min_value=0, max_value=10_000),
    sam=st.floats(
        min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False
    ),
)
def test_calculate_earned_minutes_property(produced_qty: int, sam: float):
    """Earned minutes = units * SAM, must be non-negative and monotonic."""
    earned = AnalyticsService.calculate_earned_minutes(produced_qty, sam)
    # Non-negativity
    assert earned >= 0.0
    # Linearity in quantity
    if produced_qty > 0:
        earned_per_unit = earned / produced_qty
        assert math.isclose(earned_per_unit, sam, rel_tol=1e-9)
    # Scaling property
    if produced_qty > 0 and sam > 0:
        doubled_qty = AnalyticsService.calculate_earned_minutes(produced_qty * 2, sam)
        assert math.isclose(doubled_qty, earned * 2, rel_tol=1e-9)


@given(
    operators=st.integers(min_value=0, max_value=100),
    helpers=st.integers(min_value=0, max_value=100),
    minutes_worked=st.integers(min_value=0, max_value=1440),  # up to 24h
)
def test_calculate_available_minutes_property(
    operators: int, helpers: int, minutes_worked: int
):
    """Available minutes = (ops + helpers) * minutes_worked."""
    available = AnalyticsService.calculate_available_minutes(
        operators, helpers, minutes_worked
    )
    assert available >= 0.0
    # Formula correctness
    expected = float(operators + helpers) * float(minutes_worked)
    assert math.isclose(available, expected, rel_tol=1e-9)
    # Monotonic in each variable
    if operators > 0:
        avail_plus_one = AnalyticsService.calculate_available_minutes(
            operators + 1, helpers, minutes_worked
        )
        assert avail_plus_one >= available
    if helpers > 0:
        avail_plus_one = AnalyticsService.calculate_available_minutes(
            operators, helpers + 1, minutes_worked
        )
        assert avail_plus_one >= available
    if minutes_worked > 0:
        avail_plus_one = AnalyticsService.calculate_available_minutes(
            operators, helpers, minutes_worked + 1
        )
        assert avail_plus_one >= available


@given(
    earned=st.floats(
        min_value=0.0, max_value=1_000_000, allow_nan=False, allow_infinity=False
    ),
    available=st.floats(
        min_value=0.0, max_value=1_000_000, allow_nan=False, allow_infinity=False
    ),
)
@settings(suppress_health_check=[HealthCheck.too_slow])
def test_calculate_efficiency_property(earned: float, available: float):
    """Efficiency = earned / available * 100, clamped to [0, 150]."""
    eff = AnalyticsService.calculate_efficiency(earned, available)
    if available <= 0:
        assert eff == 0.0
    else:
        raw = (earned / available) * 100
        # Apply physics clamp (0‑150%)
        expected = max(0.0, min(raw, 150.0))
        assert math.isclose(eff, round(expected, 2), rel_tol=1e-9)
        # Efficiency should be between 0% and 150%
        assert 0.0 <= eff <= 150.0
        # If earned <= available, efficiency <= 100% (unless clamp overrides)
        if earned <= available:
            assert eff <= 100.0


# =============================================================================
# Aggregate Stats Property Tests
# =============================================================================

# Strategy for a single production log dict
log_strategy = st.fixed_dictionaries(
    {
        "actual_qty": st.integers(min_value=0, max_value=10_000),
        "sam": st.floats(
            min_value=0.1, max_value=50.0, allow_nan=False, allow_infinity=False
        ),
        "operators_present": st.integers(min_value=0, max_value=50),
        "helpers_present": st.integers(min_value=0, max_value=20),
        "worked_minutes": st.integers(min_value=0, max_value=1440),
    }
)


@given(logs=st.lists(log_strategy, min_size=0, max_size=100))
@settings(suppress_health_check=[HealthCheck.too_slow])
def test_aggregate_production_stats_property(logs: list[dict[str, Any]]):
    """Aggregate stats must satisfy weighted efficiency invariant."""
    stats = AnalyticsService.aggregate_production_stats(logs)
    # Required keys
    assert "total_produced" in stats
    assert "total_earned_minutes" in stats
    assert "total_available_minutes" in stats
    assert "weighted_efficiency" in stats

    # Non-negative totals
    assert stats["total_produced"] >= 0
    assert stats["total_earned_minutes"] >= 0.0
    assert stats["total_available_minutes"] >= 0.0

    # Compute raw totals directly from logs (without rounding)
    raw_total_earned = 0.0
    raw_total_available = 0.0
    raw_total_qty = 0
    for log in logs:
        qty = log["actual_qty"]
        sam = log["sam"]
        ops = log["operators_present"]
        helpers = log["helpers_present"]
        worked = log["worked_minutes"]
        raw_total_earned += float(qty) * float(sam)
        raw_total_available += float(ops + helpers) * float(worked)
        raw_total_qty += qty

    # Rounded totals should be within rounding error of raw totals
    # (rounded to 2 decimal places)
    assert abs(stats["total_earned_minutes"] - round(raw_total_earned, 2)) <= 0.005
    assert (
        abs(stats["total_available_minutes"] - round(raw_total_available, 2)) <= 0.005
    )
    assert stats["total_produced"] == raw_total_qty  # integer, no rounding

    # Efficiency matches recomputed from raw totals (using calculate_efficiency)
    if raw_total_available > 0:
        expected_eff = AnalyticsService.calculate_efficiency(
            raw_total_earned, raw_total_available
        )
        # weighted_efficiency already rounded to 2 decimal places
        assert abs(stats["weighted_efficiency"] - expected_eff) <= 0.005
    else:
        assert stats["weighted_efficiency"] == 0.0

    # Idempotency: aggregating the same list twice yields same result
    stats2 = AnalyticsService.aggregate_production_stats(logs)
    assert stats == stats2

    # Additive property: splitting logs into two groups and aggregating separately
    # should yield same totals as aggregating combined (allow rounding differences)
    if len(logs) > 1:
        split = len(logs) // 2
        stats_a = AnalyticsService.aggregate_production_stats(logs[:split])
        stats_b = AnalyticsService.aggregate_production_stats(logs[split:])
        # Sum of rounded totals may differ due to rounding per group
        # Allow tolerance of 0.01 (max rounding error per group)
        combined_earned = (
            stats_a["total_earned_minutes"] + stats_b["total_earned_minutes"]
        )
        combined_available = (
            stats_a["total_available_minutes"] + stats_b["total_available_minutes"]
        )
        assert abs(stats["total_earned_minutes"] - combined_earned) <= 0.02
        assert abs(stats["total_available_minutes"] - combined_available) <= 0.02


# =============================================================================
# Physics Validation Property Tests
# =============================================================================


@given(log_data=log_strategy)
def test_validate_production_physics_property(log_data: dict[str, Any]):
    """Physics validation should detect anomalies and never crash."""
    warnings = AnalyticsService.validate_production_physics(log_data)
    assert isinstance(warnings, list)
    for w in warnings:
        assert isinstance(w, str)

    # If quantity negative, must warn
    if log_data["actual_qty"] < 0:
        assert any("negative" in w.lower() for w in warnings)

    # Compute efficiency manually
    earned = float(log_data["actual_qty"]) * float(log_data["sam"])
    available = float(
        log_data["operators_present"] + log_data["helpers_present"]
    ) * float(log_data["worked_minutes"])
    if available > 0:
        eff = (earned / available) * 100
        if eff > 150:
            assert any("suspiciously high" in w.lower() for w in warnings)
        if eff > 1000:
            assert any("critical" in w.lower() for w in warnings)


def test_validate_production_physics_negative_quantity():
    """Negative quantity should trigger warning."""
    log_data = {
        "actual_qty": -5,
        "sam": 2.5,
        "operators_present": 10,
        "helpers_present": 2,
        "worked_minutes": 480,
    }
    warnings = AnalyticsService.validate_production_physics(log_data)
    assert any("negative" in w.lower() for w in warnings)


# =============================================================================
# Edge Cases & Special Values
# =============================================================================


def test_calculate_efficiency_zero_available():
    """Zero available minutes => 0% efficiency."""
    assert AnalyticsService.calculate_efficiency(100.0, 0.0) == 0.0
    assert AnalyticsService.calculate_efficiency(0.0, 0.0) == 0.0


def test_calculate_efficiency_negative_earned():
    """Negative earned minutes clamped to 0% efficiency (physical impossibility)."""
    # The formula uses float multiplication, negative values possible
    # but physics clamp ensures efficiency cannot be negative
    eff = AnalyticsService.calculate_efficiency(-50.0, 100.0)
    assert eff == 0.0  # Clamped to min 0%


def test_aggregate_production_stats_empty_list():
    """Empty logs should return zero totals."""
    stats = AnalyticsService.aggregate_production_stats([])
    assert stats["total_produced"] == 0
    assert stats["total_earned_minutes"] == 0.0
    assert stats["total_available_minutes"] == 0.0
    assert stats["weighted_efficiency"] == 0.0


def test_validate_production_physics_extreme_values():
    """Extreme values should not cause exceptions."""
    extreme = {
        "actual_qty": 10_000_000,
        "sam": 1000.0,
        "operators_present": 1,
        "helpers_present": 0,
        "worked_minutes": 1,
    }
    warnings = AnalyticsService.validate_production_physics(extreme)
    assert isinstance(warnings, list)
    # Should flag critical anomaly
    assert any("CRITICAL" in w for w in warnings)
