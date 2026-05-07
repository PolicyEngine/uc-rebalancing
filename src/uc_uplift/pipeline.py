"""Orchestrate PolicyEngine UK runs for the UC uplift dashboard.

Builds the JSON consumed by the dashboard. Two simulations are constructed
once (counterfactual = rebalancing OFF, reform = current law); each financial
year is then evaluated by re-calculating ``household_net_income`` for that
period.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from .analysis import (
    compute_decile_breakdown,
    compute_inequality_poverty,
    compute_summary,
    compute_winners_losers,
)
from .scenarios import (
    POLICY_ID,
    POLICY_TITLE,
    PUBLISHED_ESTIMATES,
    REBALANCING_PARAMETER,
    REFORM_END,
    policy_description,
    read_uplift_schedule,
    reform_start_for_schedule,
    scenario_id,
    scenario_label,
)

DEFAULT_DATASET = "hf://policyengine/policyengine-uk-data/enhanced_frs_2023_24.h5"
DEFAULT_OUTPUT_PATH = Path("data/uc_uplift_results.json")
DEFAULT_DASHBOARD_OUTPUT_PATH = Path(
    "dashboard/public/data/uc_uplift_results.json"
)


def _policyengine_classes():
    from policyengine_uk import Microsimulation, Scenario, Simulation

    return Microsimulation, Scenario, Simulation


def _financial_years(schedule: dict[int, float]) -> list[int]:
    """PE UK reads parameters as of 1 January each year, but the rebalancing
    schedule takes effect on 1 April. Calling ``calculate(..., period=Y)``
    for Y == reform_start_year therefore returns pre-reform amounts and a
    zero-gain scenario, so the first year of the schedule is dropped from
    the dashboard output.
    """
    return sorted(schedule)[1:]


def build_simulations(schedule: dict[int, float], dataset: str = DEFAULT_DATASET):
    """Construct the counterfactual (no uplift) and reform (current law) sims."""
    Microsimulation, Scenario, _Simulation = _policyengine_classes()
    reform_start = reform_start_for_schedule(schedule)
    counterfactual_scenario = Scenario.from_reform(
        {REBALANCING_PARAMETER: {f"{reform_start}.{REFORM_END}": False}}
    )
    counterfactual = Microsimulation(
        dataset=dataset, scenario=counterfactual_scenario
    )
    reform = Microsimulation(dataset=dataset)
    return counterfactual, reform, counterfactual_scenario


def per_claimant_test(
    base_year: int,
    target_year: int,
    counterfactual_scenario,
    dataset: str = DEFAULT_DATASET,
) -> dict[str, Any]:
    """Reproduce the single 25+ no-income £725/£247 validation."""
    _Microsimulation, _Scenario, Simulation = _policyengine_classes()
    situation = {
        "people": {
            "you": {
                "age": {str(base_year): 30, str(target_year): 30},
                "employment_income": {str(base_year): 0, str(target_year): 0},
            }
        },
        "benunits": {"your benunit": {"members": ["you"]}},
        "households": {
            "your household": {
                "members": ["you"],
                "region": {str(base_year): "LONDON", str(target_year): "LONDON"},
                "brma": {str(base_year): "MAIDSTONE", str(target_year): "MAIDSTONE"},
                "local_authority": {
                    str(base_year): "MAIDSTONE",
                    str(target_year): "MAIDSTONE",
                },
            }
        },
    }
    sim_rf = Simulation(dataset=dataset, situation=situation)
    sim_cf = Simulation(
        dataset=dataset, scenario=counterfactual_scenario, situation=situation
    )
    uc_base = float(sim_rf.calculate("universal_credit", base_year)[0])
    uc_no_uplift = float(sim_cf.calculate("universal_credit", target_year)[0])
    uc_with_uplift = float(sim_rf.calculate("universal_credit", target_year)[0])
    return {
        "base_year": base_year,
        "target_year": target_year,
        "uc_base_year": round(uc_base, 2),
        "uc_target_no_uplift": round(uc_no_uplift, 2),
        "uc_target_with_uplift": round(uc_with_uplift, 2),
        "above_inflation_uplift": round(uc_with_uplift - uc_no_uplift, 2),
        "nominal_increase": round(uc_with_uplift - uc_base, 2),
    }


def build_scenario(
    counterfactual,
    reform,
    year: int,
    schedule: dict[int, float],
) -> dict[str, Any]:
    """Build the scenario block for a single financial year."""
    income_cf = counterfactual.calculate("household_net_income", period=year)
    income_rf = reform.calculate("household_net_income", period=year)
    gain = income_rf - income_cf
    deciles = counterfactual.calculate("household_income_decile", period=year)

    equiv_cf = counterfactual.calculate(
        "equiv_household_net_income", period=year, map_to="person"
    )
    equiv_rf = reform.calculate(
        "equiv_household_net_income", period=year, map_to="person"
    )
    poverty_cf = counterfactual.calculate(
        "in_poverty", period=year, map_to="person"
    )
    poverty_rf = reform.calculate("in_poverty", period=year, map_to="person")

    return {
        "id": scenario_id(year),
        "label": scenario_label(year, schedule),
        "year": year,
        "uplift_pct": schedule[year],
        "summary": compute_summary(gain, income_cf),
        "inequality_poverty": compute_inequality_poverty(
            equiv_cf, equiv_rf, poverty_cf, poverty_rf
        ),
        "by_decile": compute_decile_breakdown(gain, income_cf, deciles),
        "winners_losers": compute_winners_losers(gain),
    }


def build_results(dataset: str = DEFAULT_DATASET) -> dict[str, Any]:
    """Run the simulations and assemble the dashboard payload."""
    Microsimulation, _Scenario, _Simulation = _policyengine_classes()
    parameter_probe = Microsimulation(dataset=dataset)
    schedule = read_uplift_schedule(parameter_probe.tax_benefit_system.parameters)

    counterfactual, reform, counterfactual_scenario = build_simulations(
        schedule, dataset=dataset
    )

    years = _financial_years(schedule)
    scenarios: dict[str, Any] = {}
    for y in years:
        block = build_scenario(counterfactual, reform, y, schedule)
        scenarios[block["id"]] = block

    primary_year = max(years)
    primary_id = scenario_id(primary_year)
    primary = scenarios[primary_id]
    base_year = min(schedule) - 1

    claimant = per_claimant_test(
        base_year, primary_year, counterfactual_scenario, dataset=dataset
    )
    reform_start = reform_start_for_schedule(schedule)

    return {
        "year": primary_year,
        "base_year": base_year,
        "primary_scenario": primary_id,
        "policies": {
            POLICY_ID: {
                "id": POLICY_ID,
                "title": POLICY_TITLE,
                "description": policy_description(schedule),
                "uplift_schedule": {str(y): v for y, v in schedule.items()},
                "reform_window": {"start": reform_start, "end": REFORM_END},
                "scenarios": scenarios,
                "primary_scenario": primary_id,
                "primary_summary": primary["summary"],
                "per_claimant_test": claimant,
                "published_comparison": {"estimates": PUBLISHED_ESTIMATES},
            }
        },
    }


def generate_results_file(
    output_path: Path = DEFAULT_OUTPUT_PATH,
    sync_dashboard: bool = False,
    dashboard_output_path: Path = DEFAULT_DASHBOARD_OUTPUT_PATH,
    dataset: str = DEFAULT_DATASET,
) -> dict[str, Any]:
    """Compute results and persist them to disk."""
    results = build_results(dataset=dataset)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, indent=2))
    if sync_dashboard:
        dashboard_output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(output_path, dashboard_output_path)
    return results
