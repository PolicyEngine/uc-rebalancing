"""Unit tests for the pure analysis functions.

These tests build synthetic ``MicroSeries`` objects so they don't need
PolicyEngine UK or its dataset.
"""

from __future__ import annotations

import microdf as mdf
import pytest

from uc_uplift.analysis import (
    compute_decile_breakdown,
    compute_summary,
    compute_winners_losers,
)


@pytest.fixture
def fake_population():
    weights = [1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000]
    gain = mdf.MicroSeries([200.0, 100.0, 50.0, 0.0, -5.0], weights=weights)
    income = mdf.MicroSeries(
        [10_000.0, 20_000.0, 30_000.0, 40_000.0, 50_000.0], weights=weights
    )
    deciles = mdf.MicroSeries([1, 2, 3, 4, 5], weights=weights)
    return gain, income, deciles


def test_summary_aggregates_match_hand_calculation(fake_population):
    gain, income, _ = fake_population
    summary = compute_summary(gain, income)
    # 1m * (200 + 100 + 50 + 0 - 5) = 345_000_000
    assert summary["total_cost_mn"] == pytest.approx(345.0, abs=0.1)
    assert summary["n_gaining"] == 3_000_000
    # mean of [200, 100, 50] equally weighted = 116.67
    assert summary["avg_gain_per_hh"] == pytest.approx(117, abs=1)


def test_winners_losers_counts_each_bucket(fake_population):
    gain, _, _ = fake_population
    counts = compute_winners_losers(gain)
    assert counts["n_winners"] == 3_000_000
    assert counts["n_losers"] == 1_000_000
    assert counts["n_unchanged"] == 1_000_000
    assert counts["pct_winners"] + counts["pct_losers"] + counts["pct_unchanged"] == pytest.approx(
        100.0, abs=0.1
    )


def test_decile_breakdown_returns_one_row_per_observed_decile(fake_population):
    gain, income, deciles = fake_population
    rows = compute_decile_breakdown(gain, income, deciles)
    assert [r["decile"] for r in rows] == [1, 2, 3, 4, 5]
    # Decile 1 has the only £200 gainer; share of decile-1 income = 200/10_000 = 2%
    assert rows[0]["pct_of_income"] == pytest.approx(2.0, abs=0.01)
    assert rows[0]["pct_winners"] == pytest.approx(100.0)
