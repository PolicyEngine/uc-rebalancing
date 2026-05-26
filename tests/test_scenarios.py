"""Unit tests for the scenario helpers.

The schedule itself is read from PolicyEngine UK at run time, so the tests
here exercise the helpers with a synthetic schedule rather than asserting
specific percentages.
"""

from __future__ import annotations

from uc_rebalancing.scenarios import (
    policy_description,
    reform_start_for_schedule,
    scenario_id,
    scenario_label,
)


SAMPLE_SCHEDULE = {2026: 0.023, 2027: 0.031, 2028: 0.040, 2029: 0.048}


def test_scenario_id_format():
    assert scenario_id(2029) == "fy_2029_30"
    assert scenario_id(2027) == "fy_2027_28"


def test_scenario_label_uses_schedule_pct():
    assert scenario_label(2029, SAMPLE_SCHEDULE) == "2029/30 (4.8%)"
    assert scenario_label(2027, SAMPLE_SCHEDULE) == "2027/28 (3.1%)"


def test_reform_start_uses_first_year_april_first():
    assert reform_start_for_schedule(SAMPLE_SCHEDULE) == "2026-04-01"


def test_policy_description_contains_first_and_last_year():
    text = policy_description(SAMPLE_SCHEDULE, new_claimant_monthly=217.26)
    assert "April 2026" in text
    assert "2029/30" in text
    assert "4.8%" in text
    assert "£217.26" in text
