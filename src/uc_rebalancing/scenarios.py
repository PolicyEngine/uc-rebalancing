"""Scenario configuration for the UC rebalancing impact.

The Universal Credit Act 2025 packages two changes under a single
``gov.dwp.universal_credit.rebalancing.active`` flag in policyengine.py:

* ``rebalancing.standard_allowance_uplift`` — a cumulative above-inflation
  uplift to the UC standard allowance from April 2026.
* ``rebalancing.new_claimant_health_element`` — fixes the monthly UC
  health element for new claimants from April 2026, the loser leg of the
  bill.

This dashboard toggles the parent flag, so the reported impact is the
net effect of both legs against a counterfactual where the entire
rebalancing package is switched off. The internal POLICY_ID is kept as
``uc_rebalancing`` for backwards compatibility with the dashboard payload
schema.
"""

from __future__ import annotations

POLICY_ID = "uc_rebalancing"
POLICY_TITLE = "UC rebalancing analysis"

REBALANCING_PARAMETER = "gov.dwp.universal_credit.rebalancing.active"
UPLIFT_PARAMETER = (
    "gov.dwp.universal_credit.rebalancing.standard_allowance_uplift"
)

# Reform takes effect on the start of the UK financial year (1 April).
REFORM_MONTH_DAY = "04-01"


def _resolve(node, dotted_path: str):
    out = node
    for part in dotted_path.split("."):
        out = getattr(out, part)
    return out


def read_uplift_schedule(parameters) -> dict[int, float]:
    """Return the {year: cumulative_uplift} step schedule from PE UK.

    Only years where the cumulative uplift increases are kept; the permanent
    plateau after the reform reaches its final level is collapsed away.
    """
    node = _resolve(parameters, UPLIFT_PARAMETER)
    by_year: dict[int, float] = {}
    for v in node.values_list:
        year = int(v.instant_str[:4])
        if year not in by_year:
            by_year[year] = float(v.value)
    schedule: dict[int, float] = {}
    last_value = 0.0
    for year in sorted(by_year):
        value = by_year[year]
        if value > last_value:
            schedule[year] = value
            last_value = value
    return schedule


def reform_start_for_schedule(schedule: dict[int, float]) -> str:
    """``YYYY-04-01`` for the first year of the uplift schedule."""
    return f"{min(schedule)}-{REFORM_MONTH_DAY}"


def reform_end_for_parameters(parameters) -> str:
    """End instant for the reform window, derived from the parameter's own
    values_list. Uses the latest defined instant of the ``rebalancing.active``
    parameter so the reform dict covers the parameter's full domain.
    """
    node = _resolve(parameters, REBALANCING_PARAMETER)
    return max(v.instant_str for v in node.values_list)


def policy_description(
    schedule: dict[int, float],
    new_claimant_monthly: float,
) -> str:
    final_year = max(schedule)
    final_pct = schedule[final_year] * 100
    return (
        f"From April {min(schedule)} the Universal Credit Act 2025 introduces "
        "two changes under a single rebalancing flag: an above-inflation uplift "
        f"to the standard allowance, reaching {final_pct:.1f}% cumulatively by "
        f"{final_year}/{(final_year + 1) % 100:02d}, and a fixed monthly health "
        f"element of £{new_claimant_monthly:,.2f} for new claimants. This "
        "dashboard toggles gov.dwp.universal_credit.rebalancing.active, so the "
        "reported impact is the net effect of both legs against a counterfactual "
        "where the rebalancing package is switched off."
    )


def scenario_id(year: int) -> str:
    return f"fy_{year}_{(year + 1) % 100:02d}"


def scenario_label(year: int, schedule: dict[int, float]) -> str:
    pct = schedule[year]
    return f"{year}/{(year + 1) % 100:02d} ({pct * 100:.1f}%)"


_DWP_IA_URL = (
    "https://assets.publishing.service.gov.uk/media/689ca49e1c63de6de5bb1298/"
    "withdrawn-universal-credit-bill-uc-rebalancing-impact-assessment.pdf"
)

PUBLISHED_ESTIMATES = [
    {
        "source": "DWP Impact Assessment",
        "leg": "sa",
        "metric": "SA leg cost (post-behavioural)",
        "value": "£1.85bn",
        "value_bn": 1.85,
        "year": "2029/30",
        "table": "Table 4",
        "url": _DWP_IA_URL,
    },
    {
        "source": "DWP Impact Assessment",
        "leg": "sa",
        "metric": "Households gaining from SA uplift",
        "value": "6.69m",
        "value_count": 6_690_000,
        "year": "2029/30",
        "table": "Table 2",
        "url": _DWP_IA_URL,
    },
    {
        "source": "DWP Impact Assessment",
        "leg": "he",
        "metric": "Net UCHE saving (after SCC/SREL protection)",
        "value": "£2.10bn",
        "value_bn": -2.10,
        "year": "2029/30",
        "table": "Table 9",
        "url": _DWP_IA_URL,
    },
    {
        "source": "DWP Impact Assessment",
        "leg": "he",
        "metric": "New LCWRA claimants on lower rate",
        "value": "750,000",
        "value_count": 750_000,
        "year": "2029/30",
        "table": "Table 9",
        "url": _DWP_IA_URL,
    },
    {
        "source": "DWP Impact Assessment",
        "leg": "total",
        "metric": "Net package cost to households (SA cost less UCHE saving)",
        "value": "-£0.21bn",
        "value_bn": -0.21,
        "year": "2029/30",
        "table": "Tables 4 + 9",
        "url": _DWP_IA_URL,
    },
    {
        "source": "DWP Impact Assessment",
        "leg": "sa",
        "metric": "Single 25+ nominal increase 2025/26 to 2029/30",
        "value": "£725/yr",
        "year": "2029/30",
        "url": _DWP_IA_URL,
    },
    {
        "source": "DWP Impact Assessment",
        "leg": "he",
        "metric": "New LCWRA monthly rate cut to new-claimant rate",
        "value": "-£2,472/yr",
        "year": "2026/27",
        "url": _DWP_IA_URL,
    },
    {
        "source": "IFS",
        "leg": "sa",
        "metric": "Single 25+ above-inflation slice only",
        "value": "£247/yr",
        "year": "2029/30",
        "url": (
            "https://ifs.org.uk/articles/"
            "aprils-universal-credit-changes-mean-giveaways-now-takeaways-later"
        ),
    },
]
