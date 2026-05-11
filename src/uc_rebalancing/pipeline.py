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
DEFAULT_OUTPUT_PATH = Path("data/uc_rebalancing_results.json")
DEFAULT_DASHBOARD_OUTPUT_PATH = Path(
    "dashboard/public/data/uc_rebalancing_results.json"
)


def _policyengine_classes():
    from policyengine_uk import Microsimulation, Scenario, Simulation

    return Microsimulation, Scenario, Simulation


REBALANCING_LCWRA_YEARS = (2026, 2027, 2028, 2029)


def _strip_rebalanced_lcwra(sim) -> None:
    """Drop the rebalanced ``uc_LCWRA_element`` values cached in the dataset.

    The enhanced FRS 2023/24 dataset shipped by PolicyEngine UK already has
    ``uc_LCWRA_element`` baked in for 2026-2029 with the bundled
    ``universal_credit_july_2025_reform`` scenario applied (post-2025 new
    claimants set to £217.26/month, pre-2025 claimants on a protected
    indexed amount). We need a counterfactual where the rebalancing is
    switched off entirely, so we clear those cached inputs and let the
    parameter formula recompute the CPI-indexed amounts.
    """
    holder = sim.get_holder("uc_LCWRA_element")
    for year in REBALANCING_LCWRA_YEARS:
        holder.delete_arrays(period=year)


def _financial_years(schedule: dict[int, float]) -> list[int]:
    """PE UK reads parameters as of 1 January each year, but the rebalancing
    schedule takes effect on 1 April. Calling ``calculate(..., period=Y)``
    for Y == reform_start_year therefore returns pre-reform amounts and a
    zero-gain scenario, so the first year of the schedule is dropped from
    the dashboard output.
    """
    return sorted(schedule)[1:]


def build_simulations(schedule: dict[int, float], dataset: str = DEFAULT_DATASET):
    """Construct the four simulations needed for per-leg decomposition.

    The bundled rebalancing reform has two legs that are wired into
    PolicyEngine UK in different ways: the standard allowance uplift is
    gated by a parameter formula, while the health element fix is baked
    into the ``uc_LCWRA_element`` input column of the enhanced FRS
    dataset. To decompose them we build four sims:

    * ``counterfactual`` — both legs off. Override ``rebalancing.active``
      to False AND clear the cached LCWRA inputs so the formula
      recomputes CPI-indexed amounts.
    * ``reform`` — both legs on. Plain dataset.
    * ``reform_sa_only`` — standard allowance leg on, health element leg
      off. Plain dataset (so SA formula uplifts) but clear LCWRA cache so
      health element reverts to CPI.
    * ``reform_he_only`` — standard allowance leg off, health element leg
      on. Override ``rebalancing.active`` to False (disables SA uplift)
      and keep the dataset's baked-in LCWRA values (the rebalanced ones).

    Linearity: the two legs operate on different UC components, so
    diff(reform - counterfactual) ≈ diff(SA-only - counterfactual) +
    diff(HE-only - counterfactual) at the household level. Small
    deviations may arise from UC tapers and benefit interactions.
    """
    Microsimulation, Scenario, _Simulation = _policyengine_classes()
    reform_start = reform_start_for_schedule(schedule)
    rebalancing_off = Scenario.from_reform(
        {REBALANCING_PARAMETER: {f"{reform_start}.{REFORM_END}": False}}
    )

    counterfactual = Microsimulation(dataset=dataset, scenario=rebalancing_off)
    _strip_rebalanced_lcwra(counterfactual)

    reform = Microsimulation(dataset=dataset)

    reform_sa_only = Microsimulation(dataset=dataset)
    _strip_rebalanced_lcwra(reform_sa_only)

    reform_he_only = Microsimulation(dataset=dataset, scenario=rebalancing_off)

    return (
        counterfactual,
        reform,
        rebalancing_off,
        reform_sa_only,
        reform_he_only,
    )


def _household(base_year: int, target_year: int) -> dict[str, Any]:
    return {
        "your household": {
            "members": ["you"],
            "region": {str(base_year): "LONDON", str(target_year): "LONDON"},
            "brma": {str(base_year): "MAIDSTONE", str(target_year): "MAIDSTONE"},
            "local_authority": {
                str(base_year): "MAIDSTONE",
                str(target_year): "MAIDSTONE",
            },
        }
    }


def per_claimant_test(
    base_year: int,
    target_year: int,
    counterfactual_scenario,
    dataset: str = DEFAULT_DATASET,
) -> dict[str, Any]:
    """Standard allowance leg: single 25+, no employment income, no LCWRA.

    Validates against the published £725 (DWP) total cash uplift and £247
    (IFS) above-inflation slice for the same archetype.
    """
    _Microsimulation, _Scenario, Simulation = _policyengine_classes()
    situation = {
        "people": {
            "you": {
                "age": {str(base_year): 30, str(target_year): 30},
                "employment_income": {str(base_year): 0, str(target_year): 0},
            }
        },
        "benunits": {"your benunit": {"members": ["you"]}},
        "households": _household(base_year, target_year),
    }
    sim_rf = Simulation(dataset=dataset, situation=situation)
    sim_cf = Simulation(
        dataset=dataset, scenario=counterfactual_scenario, situation=situation
    )
    uc_base = float(sim_rf.calculate("universal_credit", base_year)[0])
    uc_no_uplift = float(sim_cf.calculate("universal_credit", target_year)[0])
    uc_with_uplift = float(sim_rf.calculate("universal_credit", target_year)[0])
    return {
        "archetype": "single_25_plus_no_lcwra",
        "label": "Single 25+, no LCWRA",
        "base_year": base_year,
        "target_year": target_year,
        "uc_base_year": round(uc_base, 2),
        "uc_target_no_uplift": round(uc_no_uplift, 2),
        "uc_target_with_uplift": round(uc_with_uplift, 2),
        "above_inflation_uplift": round(uc_with_uplift - uc_no_uplift, 2),
        "nominal_increase": round(uc_with_uplift - uc_base, 2),
    }


def per_claimant_test_lcwra(
    base_year: int,
    target_year: int,
    counterfactual_scenario,
    dataset: str = DEFAULT_DATASET,
) -> dict[str, Any]:
    """Health element leg: single 25+, new LCWRA claimant from April 2026.

    The bundled rebalancing scenario applies the £217.26/month new-claimant
    health element via a Microsimulation modifier that uses stochastic
    cohort sampling. That modifier doesn't run on a single-person
    Simulation, so we override ``uc_LCWRA_element`` directly using the
    parameter value to capture the new-claimant amount cleanly.
    """
    import numpy as np

    _Microsimulation, _Scenario, Simulation = _policyengine_classes()
    situation = {
        "people": {
            "you": {
                "age": {str(base_year): 30, str(target_year): 30},
                "employment_income": {str(base_year): 0, str(target_year): 0},
                "uc_limited_capability_for_WRA": {
                    str(base_year): True,
                    str(target_year): True,
                },
            }
        },
        "benunits": {"your benunit": {"members": ["you"]}},
        "households": _household(base_year, target_year),
    }
    sim_rf = Simulation(dataset=dataset, situation=situation)
    sim_cf = Simulation(
        dataset=dataset, scenario=counterfactual_scenario, situation=situation
    )
    new_claimant_monthly = float(
        sim_rf.tax_benefit_system.parameters(
            str(target_year)
        ).gov.dwp.universal_credit.rebalancing.new_claimant_health_element
    )
    new_claimant_annual = new_claimant_monthly * 12
    sim_rf.set_input(
        "uc_LCWRA_element", target_year, np.array([new_claimant_annual])
    )
    uc_base = float(sim_rf.calculate("universal_credit", base_year)[0])
    uc_no_rebalancing = float(sim_cf.calculate("universal_credit", target_year)[0])
    uc_with_rebalancing = float(sim_rf.calculate("universal_credit", target_year)[0])
    return {
        "archetype": "single_25_plus_new_lcwra_claimant",
        "label": "Single 25+ LCWRA, new claimant from April 2026",
        "base_year": base_year,
        "target_year": target_year,
        "uc_base_year": round(uc_base, 2),
        "uc_target_no_rebalancing": round(uc_no_rebalancing, 2),
        "uc_target_with_rebalancing": round(uc_with_rebalancing, 2),
        "rebalancing_impact": round(
            uc_with_rebalancing - uc_no_rebalancing, 2
        ),
        "nominal_change": round(uc_with_rebalancing - uc_base, 2),
        "new_claimant_health_element_monthly": round(new_claimant_monthly, 2),
    }


def build_scenario(
    counterfactual,
    reform,
    reform_sa_only,
    reform_he_only,
    year: int,
    schedule: dict[int, float],
) -> dict[str, Any]:
    """Build the scenario block for a single financial year.

    Computes three gain series (total, SA leg, HE leg) and emits sibling
    decile and winners/losers breakdowns for each, so the dashboard can
    toggle between the aggregate and either single leg.
    """
    income_cf = counterfactual.calculate("household_net_income", period=year)
    income_rf = reform.calculate("household_net_income", period=year)
    income_sa = reform_sa_only.calculate("household_net_income", period=year)
    income_he = reform_he_only.calculate("household_net_income", period=year)

    gain_total = income_rf - income_cf
    gain_sa = income_sa - income_cf
    gain_he = income_he - income_cf

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
        "summary": compute_summary(gain_total, income_cf),
        "summary_sa": compute_summary(gain_sa, income_cf),
        "summary_he": compute_summary(gain_he, income_cf),
        "inequality_poverty": compute_inequality_poverty(
            equiv_cf, equiv_rf, poverty_cf, poverty_rf
        ),
        "by_decile": compute_decile_breakdown(gain_total, income_cf, deciles),
        "by_decile_sa": compute_decile_breakdown(gain_sa, income_cf, deciles),
        "by_decile_he": compute_decile_breakdown(gain_he, income_cf, deciles),
        "winners_losers": compute_winners_losers(gain_total),
        "winners_losers_sa": compute_winners_losers(gain_sa),
        "winners_losers_he": compute_winners_losers(gain_he),
    }


def build_results(dataset: str = DEFAULT_DATASET) -> dict[str, Any]:
    """Run the simulations and assemble the dashboard payload."""
    Microsimulation, _Scenario, _Simulation = _policyengine_classes()
    parameter_probe = Microsimulation(dataset=dataset)
    schedule = read_uplift_schedule(parameter_probe.tax_benefit_system.parameters)

    (
        counterfactual,
        reform,
        counterfactual_scenario,
        reform_sa_only,
        reform_he_only,
    ) = build_simulations(schedule, dataset=dataset)

    years = _financial_years(schedule)
    scenarios: dict[str, Any] = {}
    for y in years:
        block = build_scenario(
            counterfactual,
            reform,
            reform_sa_only,
            reform_he_only,
            y,
            schedule,
        )
        scenarios[block["id"]] = block

    primary_year = max(years)
    primary_id = scenario_id(primary_year)
    primary = scenarios[primary_id]
    base_year = min(schedule) - 1

    gainer = per_claimant_test(
        base_year, primary_year, counterfactual_scenario, dataset=dataset
    )
    loser_lcwra = per_claimant_test_lcwra(
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
                "per_claimant_test": gainer,
                "per_claimant_tests": {
                    "gainer_standard_allowance": gainer,
                    "loser_new_lcwra": loser_lcwra,
                },
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
