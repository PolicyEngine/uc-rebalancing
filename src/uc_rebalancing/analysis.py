"""Analysis functions for the UC rebalancing impact.

The functions here take pre-computed ``MicroSeries`` (gain, baseline income,
income deciles, equivalised income, in_poverty) and return plain Python
dictionaries / lists ready for JSON serialisation. They contain no
PolicyEngine imports so they can be unit tested with synthetic
``MicroSeries`` objects.
"""

from __future__ import annotations

import math
from typing import Any

import microdf as mdf

GAIN_THRESHOLD = 1.0


def _round_or_none(value: float, ndigits: int) -> float | None:
    if math.isnan(value):
        return None
    return round(float(value), ndigits)


def compute_summary(
    gain: mdf.MicroSeries,
    income_baseline: mdf.MicroSeries,
) -> dict[str, Any]:
    """Aggregate fiscal cost and gainers count for one year."""
    gainers_mask = gain > GAIN_THRESHOLD
    losers_mask = gain < -GAIN_THRESHOLD

    n_gaining = float(gainers_mask.sum())
    n_losing = float(losers_mask.sum())
    total_cost = float(gain.sum())
    avg_gain = float(gain[gainers_mask].mean())
    baseline_total = float(income_baseline.sum())
    cost_pct = total_cost / baseline_total * 100

    return {
        "total_cost_bn": round(total_cost / 1e9, 3),
        "total_cost_mn": round(total_cost / 1e6, 1),
        "n_gaining": int(round(n_gaining)),
        "n_losing": int(round(n_losing)),
        "avg_gain_per_hh": _round_or_none(avg_gain, 0),
        "baseline_net_income_bn": round(baseline_total / 1e9, 1),
        "cost_pct_of_income": round(cost_pct, 3),
    }


def compute_decile_breakdown(
    gain: mdf.MicroSeries,
    income_baseline: mdf.MicroSeries,
    deciles: mdf.MicroSeries,
) -> list[dict[str, Any]]:
    """Mean gain and gain-as-share-of-income per income decile.

    Deciles with no gainers emit ``None`` for the gainers-only fields so the
    "no data" case is explicit rather than masquerading as a zero gain.
    """
    mean_gain_all = gain.groupby(deciles).mean()
    pct_income_all = (
        gain.groupby(deciles).sum() / income_baseline.groupby(deciles).sum()
    ) * 100

    gainers_mask = gain > GAIN_THRESHOLD
    gain_g = gain[gainers_mask]
    income_g = income_baseline[gainers_mask]
    deciles_g = deciles[gainers_mask]
    mean_gain_gainers = gain_g.groupby(deciles_g).mean()
    pct_income_gainers = (
        gain_g.groupby(deciles_g).sum() / income_g.groupby(deciles_g).sum()
    ) * 100

    ones = mdf.MicroSeries([1.0] * len(gain), weights=gain.weights)
    hh_by_decile = ones.groupby(deciles).sum()
    winners_pct = (
        (gain > GAIN_THRESHOLD).groupby(deciles).sum() / hh_by_decile * 100
    )
    losers_pct = (
        (gain < -GAIN_THRESHOLD).groupby(deciles).sum() / hh_by_decile * 100
    )

    rows: list[dict[str, Any]] = []
    for d in sorted(d for d in mean_gain_all.index if 1 <= int(d) <= 10):
        w_pct = float(winners_pct.loc[d])
        l_pct = float(losers_pct.loc[d])
        has_gainers = d in mean_gain_gainers.index
        rows.append(
            {
                "decile": int(d),
                "mean_gain": round(float(mean_gain_all.loc[d]), 0),
                "pct_of_income": round(float(pct_income_all.loc[d]), 3),
                "mean_gain_gainers": (
                    round(float(mean_gain_gainers.loc[d]), 0)
                    if has_gainers
                    else None
                ),
                "pct_of_income_gainers": (
                    round(float(pct_income_gainers.loc[d]), 3)
                    if has_gainers
                    else None
                ),
                "pct_winners": round(w_pct, 2),
                "pct_losers": round(l_pct, 2),
                "pct_unchanged": round(100.0 - w_pct - l_pct, 2),
            }
        )
    return rows


def compute_inequality_poverty(
    equiv_income_cf: mdf.MicroSeries,
    equiv_income_rf: mdf.MicroSeries,
    in_poverty_cf: mdf.MicroSeries,
    in_poverty_rf: mdf.MicroSeries,
) -> dict[str, Any]:
    """Gini and headline poverty rate, baseline vs reform.

    All four inputs must be person-level ``MicroSeries`` (use
    ``sim.calculate(var, period=year, map_to='person')``).
    """
    gini_cf = float(equiv_income_cf.gini(negatives="zero"))
    gini_rf = float(equiv_income_rf.gini(negatives="zero"))

    rate_cf = float(in_poverty_cf.mean()) * 100
    rate_rf = float(in_poverty_rf.mean()) * 100
    poor_cf = float(in_poverty_cf.sum())
    poor_rf = float(in_poverty_rf.sum())

    return {
        "gini_baseline": round(gini_cf, 6),
        "gini_reform": round(gini_rf, 6),
        "gini_change_pp": round((gini_rf - gini_cf) * 100, 5),
        "poverty_rate_baseline": round(rate_cf, 3),
        "poverty_rate_reform": round(rate_rf, 3),
        "poverty_rate_change_pp": round(rate_rf - rate_cf, 3),
        "people_lifted_out_of_poverty": int(round(poor_cf - poor_rf)),
    }


def compute_winners_losers(gain: mdf.MicroSeries) -> dict[str, Any]:
    """Aggregate counts of winners, losers and unchanged households."""
    n_winners = float((gain > GAIN_THRESHOLD).sum())
    n_losers = float((gain < -GAIN_THRESHOLD).sum())
    n_unchanged = float(
        ((gain >= -GAIN_THRESHOLD) & (gain <= GAIN_THRESHOLD)).sum()
    )
    total = n_winners + n_losers + n_unchanged
    return {
        "n_winners": int(round(n_winners)),
        "n_losers": int(round(n_losers)),
        "n_unchanged": int(round(n_unchanged)),
        "pct_winners": round(100 * n_winners / total, 2),
        "pct_losers": round(100 * n_losers / total, 4),
        "pct_unchanged": round(100 * n_unchanged / total, 2),
    }
