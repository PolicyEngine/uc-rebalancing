"""Scenario configuration for the UC standard allowance uplift.

The Universal Credit Act 2025 raises the UC standard allowance above
inflation each year from 2026/27 to 2029/30. The schedule itself lives in
PolicyEngine UK at
``gov.dwp.universal_credit.rebalancing.standard_allowance_uplift`` and is
read from there at run time, not duplicated in this package.
"""

from __future__ import annotations

POLICY_ID = "uc_standard_allowance_uplift"
POLICY_TITLE = "UC standard allowance uplift"

REBALANCING_PARAMETER = "gov.dwp.universal_credit.rebalancing.active"
UPLIFT_PARAMETER = (
    "gov.dwp.universal_credit.rebalancing.standard_allowance_uplift"
)

# Reform takes effect on the start of the UK financial year (1 April).
REFORM_MONTH_DAY = "04-01"
REFORM_END = "2100-12-31"


def read_uplift_schedule(parameters) -> dict[int, float]:
    """Return the {year: cumulative_uplift} step schedule from PE UK.

    Only years where the cumulative uplift increases are kept; the permanent
    plateau after the reform reaches its final level is collapsed away.
    """
    node = parameters
    for part in UPLIFT_PARAMETER.split("."):
        node = getattr(node, part)
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


def policy_description(schedule: dict[int, float]) -> str:
    final_year = max(schedule)
    final_pct = schedule[final_year] * 100
    return (
        f"From April {min(schedule)} the Universal Credit standard allowance "
        f"rises by more than CPI each year, reaching a {final_pct:.1f}% "
        f"cumulative above-inflation uplift by {final_year}/"
        f"{(final_year + 1) % 100:02d}. This dashboard compares current law "
        "(uplift active) with a counterfactual where the rebalancing "
        "parameter is switched off."
    )


def scenario_id(year: int) -> str:
    return f"fy_{year}_{(year + 1) % 100:02d}"


def scenario_label(year: int, schedule: dict[int, float]) -> str:
    pct = schedule[year]
    return f"{year}/{(year + 1) % 100:02d} ({pct * 100:.1f}%)"


PUBLISHED_ESTIMATES = [
    {
        "source": "DWP Impact Assessment",
        "metric": "Households gaining (2029/30)",
        "value": "6,690,000",
        "year": "2029/30",
        "url": (
            "https://assets.publishing.service.gov.uk/media/689ca49e1c63de6de5bb1298/"
            "withdrawn-universal-credit-bill-uc-rebalancing-impact-assessment.pdf"
        ),
    },
    {
        "source": "DWP Impact Assessment",
        "metric": "Aggregate static cost",
        "value": "£1.85bn",
        "year": "2029/30",
        "url": (
            "https://assets.publishing.service.gov.uk/media/689ca49e1c63de6de5bb1298/"
            "withdrawn-universal-credit-bill-uc-rebalancing-impact-assessment.pdf"
        ),
    },
    {
        "source": "DWP Impact Assessment",
        "metric": "Single 25+ nominal increase 2025/26 to 2029/30",
        "value": "£725/yr",
        "year": "2029/30",
        "url": (
            "https://assets.publishing.service.gov.uk/media/689ca49e1c63de6de5bb1298/"
            "withdrawn-universal-credit-bill-uc-rebalancing-impact-assessment.pdf"
        ),
    },
    {
        "source": "IFS",
        "metric": "Single 25+ above-inflation slice only",
        "value": "£247/yr",
        "year": "2029/30",
        "url": (
            "https://ifs.org.uk/articles/"
            "aprils-universal-credit-changes-mean-giveaways-now-takeaways-later"
        ),
    },
]
