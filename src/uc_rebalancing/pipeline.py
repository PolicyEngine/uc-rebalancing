"""Orchestrate policyengine.py UK runs for the UC rebalancing dashboard.

Builds the JSON consumed by the dashboard. Two simulations are constructed
once (counterfactual = rebalancing OFF, reform = current law); each financial
year is then evaluated by re-calculating ``household_net_income`` for that
period.
"""

from __future__ import annotations

import json
import shutil
from importlib.metadata import version as _pkg_version
from pathlib import Path
from typing import Any

import numpy as np
from policyengine.tax_benefit_models.uk import (
    calculate_household,
    managed_microsimulation,
)

# Single-household Simulation is reached through the country sub-package
# because policyengine.py exposes ``calculate_household`` as the
# situation-based entry point, and that helper builds a fresh Simulation per
# call. The LCWRA per-claimant test must bypass the ``uc_LCWRA_element``
# formula via ``set_input``, which requires holding a Simulation instance,
# so it goes through the lower-level class.
from policyengine_uk import Simulation as _UKSimulation

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
    policy_description,
    read_uplift_schedule,
    reform_end_for_parameters,
    reform_start_for_schedule,
    scenario_id,
    scenario_label,
)

DEFAULT_DATASET = "hf://policyengine/policyengine-uk-data/enhanced_frs_2023_24.h5"
DEFAULT_OUTPUT_PATH = Path("data/uc_rebalancing_results.json")
DEFAULT_DASHBOARD_OUTPUT_PATH = Path(
    "dashboard/public/data/uc_rebalancing_results.json"
)


def _strip_rebalanced_lcwra(sim, years: tuple[int, ...]) -> None:
    """Drop the rebalanced ``uc_LCWRA_element`` values cached in the dataset.

    The enhanced FRS 2023/24 dataset shipped by policyengine.py already has
    ``uc_LCWRA_element`` baked in for the uplift schedule years with the
    bundled ``universal_credit_july_2025_reform`` scenario applied (post-2025
    new claimants set to the new-claimant rate, pre-2025 claimants on a
    protected indexed amount). We need a counterfactual where the rebalancing
    is switched off entirely, so we clear those cached inputs and let the
    parameter formula recompute the CPI-indexed amounts.
    """
    holder = sim.get_holder("uc_LCWRA_element")
    for year in years:
        holder.delete_arrays(period=year)


def _financial_years(schedule: dict[int, float]) -> list[int]:
    """Calendar years to evaluate, one per row of the uplift schedule.

    PE UK's rebalancing parameter is keyed at 1 January each year (the
    schedule values change in lockstep with the financial year start in
    April), so ``period=Y`` already returns the post-reform amount for the
    full schedule including the first year.
    """
    return sorted(schedule)


def _rebalancing_off_reform(reform_start: str, reform_end: str) -> dict:
    """Reform dict that turns the rebalancing flag off for the policy window.

    PE-UK reads parameters at the start of the requested period (1 January
    for a year period). The reform takes effect 1 April but if we anchor the
    override at 1 April, calling ``calculate(..., period=Y)`` for the reform
    start year reads at 1 January, before the override fires, and the
    counterfactual collapses onto the reform. Anchor at 1 January of the
    same year so every year-period evaluation captures the override.
    """
    override_start = f"{reform_start[:4]}-01-01"
    return {REBALANCING_PARAMETER: {f"{override_start}.{reform_end}": False}}


def build_simulations(
    schedule: dict[int, float],
    reform_end: str,
    dataset: str = DEFAULT_DATASET,
):
    """Construct the four simulations needed for per-leg decomposition.

    The bundled rebalancing reform has two legs that are wired into
    policyengine.py UK in different ways: the standard allowance uplift is
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
    reform_start = reform_start_for_schedule(schedule)
    lcwra_years = tuple(sorted(schedule))
    rebalancing_off = _rebalancing_off_reform(reform_start, reform_end)

    counterfactual = managed_microsimulation(
        dataset=dataset, allow_unmanaged=True, reform=rebalancing_off
    )
    _strip_rebalanced_lcwra(counterfactual, lcwra_years)

    reform = managed_microsimulation(dataset=dataset, allow_unmanaged=True)

    reform_sa_only = managed_microsimulation(
        dataset=dataset, allow_unmanaged=True
    )
    _strip_rebalanced_lcwra(reform_sa_only, lcwra_years)

    reform_he_only = managed_microsimulation(
        dataset=dataset, allow_unmanaged=True, reform=rebalancing_off
    )

    return (
        counterfactual,
        reform,
        rebalancing_off,
        reform_sa_only,
        reform_he_only,
    )


def per_claimant_test(
    base_year: int,
    target_year: int,
    counterfactual_reform: dict,
) -> dict[str, Any]:
    """Standard allowance leg: single 25+, no employment income, no LCWRA.

    Validates against the published £725 (DWP) total cash uplift and £247
    (IFS) above-inflation slice for the same archetype.
    """
    person = {"age": 30, "employment_income": 0}
    base = calculate_household(
        people=[person], year=base_year, extra_variables=["universal_credit"]
    )
    rf = calculate_household(
        people=[person], year=target_year, extra_variables=["universal_credit"]
    )
    cf = calculate_household(
        people=[person],
        year=target_year,
        reform=counterfactual_reform,
        extra_variables=["universal_credit"],
    )
    uc_base = float(base.person[0]["universal_credit"])
    uc_with_uplift = float(rf.person[0]["universal_credit"])
    uc_no_uplift = float(cf.person[0]["universal_credit"])
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


GRID_FAMILY_TYPES = ("single", "couple")
# Children counts modelled: 0, 1, 2, 3, and 4 (which the UI labels as "More than 3").
GRID_NUM_CHILDREN = (0, 1, 2, 3, 4)
GRID_EMPLOYMENT_INCOME = tuple(range(0, 100_001, 10_000))
GRID_AGE_BANDS = ("25_plus", "under_25")
GRID_CLAIM_TIMING = ("new", "pre_2026")

_AGE_BY_BAND = {"25_plus": 30, "under_25": 22}


def _build_situation(
    *,
    family_type: str,
    num_children: int,
    employment_income: float,
    age_band: str,
    base_year: int,
    target_year: int,
    head_has_lcwra: bool = False,
) -> dict[str, Any]:
    """Return a per-claimant situation dict for the chosen archetype."""
    age = _AGE_BY_BAND[age_band]
    by, ty = str(base_year), str(target_year)
    people: dict[str, Any] = {
        "head": {
            "age": {by: age, ty: age},
            "employment_income": {by: employment_income, ty: employment_income},
        }
    }
    if head_has_lcwra:
        people["head"]["uc_limited_capability_for_WRA"] = {by: True, ty: True}
    benunit_members = ["head"]
    if family_type == "couple":
        people["partner"] = {
            "age": {by: age, ty: age},
            "employment_income": {by: 0, ty: 0},
        }
        benunit_members.append("partner")
    for i in range(num_children):
        child_id = f"child_{i}"
        child_age = max(2, 4 + i * 3)
        people[child_id] = {"age": {by: child_age, ty: child_age}}
        benunit_members.append(child_id)
    return {
        "people": people,
        "benunits": {"benunit": {"members": benunit_members}},
        "households": {"household": {"members": benunit_members}},
    }


def _enumerate_sa_archetypes() -> list[dict[str, Any]]:
    return [
        {
            "family_type": ft,
            "num_children": kids,
            "employment_income": inc,
            "age_band": age,
        }
        for ft in GRID_FAMILY_TYPES
        for kids in GRID_NUM_CHILDREN
        for inc in GRID_EMPLOYMENT_INCOME
        for age in GRID_AGE_BANDS
    ]


def _enumerate_he_archetypes() -> list[dict[str, Any]]:
    return [
        {
            "family_type": ft,
            "num_children": kids,
            "employment_income": inc,
            "age_band": age,
            "claim_timing": timing,
        }
        for ft in GRID_FAMILY_TYPES
        for kids in GRID_NUM_CHILDREN
        for inc in GRID_EMPLOYMENT_INCOME
        for age in GRID_AGE_BANDS
        for timing in GRID_CLAIM_TIMING
    ]


def _merged_situation(
    archetypes: list[dict[str, Any]],
    *,
    base_year: int,
    target_year: int,
    head_has_lcwra: bool,
) -> tuple[dict[str, Any], list[str]]:
    """Pack many archetype households into a single situation dict.

    Returns the situation and a parallel list of benunit ids in archetype
    order, so the calculated array can be mapped back to archetypes.
    """
    people: dict[str, Any] = {}
    benunits: dict[str, Any] = {}
    households: dict[str, Any] = {}
    benunit_order: list[str] = []
    by, ty = str(base_year), str(target_year)
    for i, arch in enumerate(archetypes):
        age = _AGE_BY_BAND[arch["age_band"]]
        head_id = f"head_{i}"
        people[head_id] = {
            "age": {by: age, ty: age},
            "employment_income": {
                by: arch["employment_income"],
                ty: arch["employment_income"],
            },
        }
        if head_has_lcwra:
            people[head_id]["uc_limited_capability_for_WRA"] = {
                by: True,
                ty: True,
            }
        members = [head_id]
        if arch["family_type"] == "couple":
            partner_id = f"partner_{i}"
            people[partner_id] = {
                "age": {by: age, ty: age},
                "employment_income": {by: 0, ty: 0},
            }
            members.append(partner_id)
        for c in range(arch["num_children"]):
            child_id = f"child_{i}_{c}"
            child_age = max(2, 4 + c * 3)
            people[child_id] = {"age": {by: child_age, ty: child_age}}
            members.append(child_id)
        benunit_id = f"benunit_{i}"
        benunits[benunit_id] = {"members": members}
        households[f"household_{i}"] = {"members": members}
        benunit_order.append(benunit_id)
    return (
        {"people": people, "benunits": benunits, "households": households},
        benunit_order,
    )


def _calculate_uc_array(sim, period: int) -> np.ndarray:
    """``universal_credit`` is a benunit-level variable; the array is one
    value per benunit in declared order.
    """
    return np.asarray(sim.calculate("universal_credit", period))


def build_per_claimant_grid(
    base_year: int,
    target_year: int,
    counterfactual_reform: dict,
    new_claimant_monthly: float,
    baseline_indexed_monthly: float,
) -> dict[str, Any]:
    """Pre-compute per-claimant impact across the archetype grid.

    All SA archetypes are packed into one Simulation per (reform vs
    counterfactual), and the same trick is used for HE archetypes (with the
    LCWRA element overridden per benunit). Total cost: 4 Simulation builds
    plus a handful of calculate() calls — not per-archetype.
    """
    sa_archetypes = _enumerate_sa_archetypes()
    sa_situation, _ = _merged_situation(
        sa_archetypes,
        base_year=base_year,
        target_year=target_year,
        head_has_lcwra=False,
    )
    sim_sa_rf = _UKSimulation(situation=sa_situation)
    sim_sa_cf = _UKSimulation(
        situation=sa_situation, reform=counterfactual_reform
    )
    sa_uc_base = _calculate_uc_array(sim_sa_rf, base_year)
    sa_uc_with = _calculate_uc_array(sim_sa_rf, target_year)
    sa_uc_no = _calculate_uc_array(sim_sa_cf, target_year)
    sa_rows = [
        {
            **arch,
            "uc_base_year": round(float(sa_uc_base[i]), 2),
            "uc_target_with_uplift": round(float(sa_uc_with[i]), 2),
            "uc_target_no_uplift": round(float(sa_uc_no[i]), 2),
            "above_inflation_uplift": round(
                float(sa_uc_with[i] - sa_uc_no[i]), 2
            ),
            "nominal_increase": round(
                float(sa_uc_with[i] - sa_uc_base[i]), 2
            ),
        }
        for i, arch in enumerate(sa_archetypes)
    ]

    he_archetypes = _enumerate_he_archetypes()
    he_situation, _ = _merged_situation(
        he_archetypes,
        base_year=base_year,
        target_year=target_year,
        head_has_lcwra=True,
    )
    sim_he_rf = _UKSimulation(situation=he_situation)
    sim_he_cf = _UKSimulation(
        situation=he_situation, reform=counterfactual_reform
    )
    rf_lcwra_monthly = np.array(
        [
            new_claimant_monthly
            if a["claim_timing"] == "new"
            else baseline_indexed_monthly
            for a in he_archetypes
        ]
    )
    cf_lcwra_monthly = np.full(len(he_archetypes), baseline_indexed_monthly)
    sim_he_rf.set_input(
        "uc_LCWRA_element", target_year, rf_lcwra_monthly * 12
    )
    sim_he_cf.set_input(
        "uc_LCWRA_element", target_year, cf_lcwra_monthly * 12
    )
    he_uc_base = _calculate_uc_array(sim_he_rf, base_year)
    he_uc_with = _calculate_uc_array(sim_he_rf, target_year)
    he_uc_no = _calculate_uc_array(sim_he_cf, target_year)
    lcwra_monthly_per_archetype = rf_lcwra_monthly
    he_rows = [
        {
            **arch,
            "uc_base_year": round(float(he_uc_base[i]), 2),
            "uc_target_with_rebalancing": round(float(he_uc_with[i]), 2),
            "uc_target_no_rebalancing": round(float(he_uc_no[i]), 2),
            "rebalancing_impact": round(
                float(he_uc_with[i] - he_uc_no[i]), 2
            ),
            "lcwra_element_monthly": round(
                float(lcwra_monthly_per_archetype[i]), 2
            ),
        }
        for i, arch in enumerate(he_archetypes)
    ]
    return {
        "input_options": {
            "family_type": [
                {"value": "single", "label": "Single"},
                {"value": "couple", "label": "Couple"},
            ],
            "num_children": [
                {
                    "value": n,
                    "label": (
                        "No children"
                        if n == 0
                        else "More than 3 children"
                        if n >= 4
                        else f"{n} child{'ren' if n > 1 else ''}"
                    ),
                }
                for n in GRID_NUM_CHILDREN
            ],
            "employment_income": [
                {"value": v, "label": f"£{v:,}"} for v in GRID_EMPLOYMENT_INCOME
            ],
            "age_band": [
                {
                    "value": "25_plus",
                    "label": f"25 or over (April {target_year - 3})",
                },
                {
                    "value": "under_25",
                    "label": f"Under 25 (April {target_year - 3})",
                },
            ],
            "claim_timing": [
                {
                    "value": "new",
                    "label": f"New claim (April {target_year - 3}+)",
                },
                {
                    "value": "pre_2026",
                    "label": f"Pre-{target_year - 3} claim (protected)",
                },
            ],
        },
        "sa": sa_rows,
        "he": he_rows,
        "canonical_archetype": {
            "family_type": "single",
            "num_children": 0,
            "employment_income": 0,
            "age_band": "25_plus",
        },
    }


def per_claimant_test_lcwra(
    base_year: int,
    target_year: int,
    counterfactual_reform: dict,
    new_claimant_monthly: float,
    baseline_indexed_monthly: float,
) -> dict[str, Any]:
    """Health element leg: single 25+, new LCWRA claimant from April 2026.

    The bundled rebalancing scenario applies the new-claimant health element
    via a Microsimulation modifier that uses stochastic cohort sampling. That
    modifier doesn't run on a single-household simulation, so we override
    ``uc_LCWRA_element`` directly with ``set_input`` on both sims — the
    reform sim gets the new-claimant freeze, and the counterfactual gets the
    CPI-indexed amount that pre-reform protection would have produced. Without
    setting it on both, the counterfactual formula returns a different value
    than the parameter table and the impact is understated by the SA offset.
    """
    situation = {
        "people": {
            "you": {
                "age": {str(base_year): 30, str(target_year): 30},
                "employment_income": {
                    str(base_year): 0,
                    str(target_year): 0,
                },
                "uc_limited_capability_for_WRA": {
                    str(base_year): True,
                    str(target_year): True,
                },
            }
        },
        "benunits": {"your benunit": {"members": ["you"]}},
        "households": {"your household": {"members": ["you"]}},
    }
    sim_rf = _UKSimulation(situation=situation)
    sim_cf = _UKSimulation(situation=situation, reform=counterfactual_reform)
    sim_rf.set_input(
        "uc_LCWRA_element",
        target_year,
        np.array([new_claimant_monthly * 12]),
    )
    sim_cf.set_input(
        "uc_LCWRA_element",
        target_year,
        np.array([baseline_indexed_monthly * 12]),
    )
    uc_base = float(sim_rf.calculate("universal_credit", base_year)[0])
    uc_with_rebalancing = float(
        sim_rf.calculate("universal_credit", target_year)[0]
    )
    uc_no_rebalancing = float(
        sim_cf.calculate("universal_credit", target_year)[0]
    )
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
    parameter_probe = managed_microsimulation(
        dataset=dataset, allow_unmanaged=True
    )
    parameters = parameter_probe.tax_benefit_system.parameters
    schedule = read_uplift_schedule(parameters)
    reform_end = reform_end_for_parameters(parameters)

    (
        counterfactual,
        reform,
        counterfactual_reform,
        reform_sa_only,
        reform_he_only,
    ) = build_simulations(schedule, reform_end, dataset=dataset)

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

    rebalancing_node = parameters.gov.dwp.universal_credit.rebalancing
    new_claimant_monthly = float(
        rebalancing_node.new_claimant_health_element(f"{primary_year}-04-01")
    )
    health_element_node = (
        parameters.gov.dwp.universal_credit.elements.disabled.amount
    )
    health_element_monthly_base_year = float(
        health_element_node(f"{base_year}-04-01")
    )
    health_element_monthly_primary_year = float(
        health_element_node(f"{primary_year}-04-01")
    )
    sa_node = parameters.gov.dwp.universal_credit.standard_allowance.amount
    standard_allowance_monthly_base_year = {
        "single_25_plus": round(float(sa_node.SINGLE_OLD(f"{base_year}-04-01")), 2),
        "couple_25_plus": round(float(sa_node.COUPLE_OLD(f"{base_year}-04-01")), 2),
        "single_under_25": round(float(sa_node.SINGLE_YOUNG(f"{base_year}-04-01")), 2),
        "couple_under_25": round(float(sa_node.COUPLE_YOUNG(f"{base_year}-04-01")), 2),
    }
    standard_allowance_monthly_primary_year = {
        "single_25_plus": round(float(sa_node.SINGLE_OLD(f"{primary_year}-04-01")), 2),
        "couple_25_plus": round(float(sa_node.COUPLE_OLD(f"{primary_year}-04-01")), 2),
        "single_under_25": round(float(sa_node.SINGLE_YOUNG(f"{primary_year}-04-01")), 2),
        "couple_under_25": round(float(sa_node.COUPLE_YOUNG(f"{primary_year}-04-01")), 2),
    }

    cpi_node = parameters.gov.benefit_uprating_cpi
    cpi_base = float(cpi_node(f"{base_year}-04-01"))
    sa_keys = (
        ("single_25_plus", "SINGLE_OLD"),
        ("couple_25_plus", "COUPLE_OLD"),
        ("single_under_25", "SINGLE_YOUNG"),
        ("couple_under_25", "COUPLE_YOUNG"),
    )
    parameter_path_by_year = []
    for y in years:
        cpi_ratio = float(cpi_node(f"{y}-04-01")) / cpi_base
        sa_with = {
            key: round(float(getattr(sa_node, attr)(f"{y}-04-01")), 2)
            for key, attr in sa_keys
        }
        sa_cpi_only = {
            key: round(
                standard_allowance_monthly_base_year[key] * cpi_ratio, 2
            )
            for key, _ in sa_keys
        }
        # PE-UK's disabled.amount parameter has been re-pinned to the £217.26
        # post-reform value from 2026-04-01 onwards, so we cannot read the
        # CPI-only counterfactual rate off the parameter directly. Derive it
        # from the 2025-04-01 (pre-reform) value uprated by CPI instead.
        he_cpi_only = round(health_element_monthly_base_year * cpi_ratio, 2)
        he_new_claimant = round(
            float(rebalancing_node.new_claimant_health_element(f"{y}-04-01")),
            2,
        )
        parameter_path_by_year.append(
            {
                "year": y,
                "label": scenario_label(y, schedule),
                "uplift_pct": schedule[y],
                "cpi_ratio_from_base": round(cpi_ratio, 4),
                "standard_allowance_monthly": {
                    "cpi_only": sa_cpi_only,
                    "with_reform": sa_with,
                },
                "health_element_monthly": {
                    "cpi_only": he_cpi_only,
                    "new_claimant_with_reform": he_new_claimant,
                },
            }
        )

    gainer = per_claimant_test(
        base_year, primary_year, counterfactual_reform
    )
    loser_lcwra = per_claimant_test_lcwra(
        base_year,
        primary_year,
        counterfactual_reform,
        new_claimant_monthly,
        health_element_monthly_primary_year,
    )
    per_claimant_grid = build_per_claimant_grid(
        base_year=base_year,
        target_year=primary_year,
        counterfactual_reform=counterfactual_reform,
        new_claimant_monthly=new_claimant_monthly,
        baseline_indexed_monthly=health_element_monthly_primary_year,
    )
    reform_start = reform_start_for_schedule(schedule)

    return {
        "year": primary_year,
        "base_year": base_year,
        "primary_scenario": primary_id,
        "model_versions": {
            "policyengine": _pkg_version("policyengine"),
            "policyengine_uk": _pkg_version("policyengine-uk"),
        },
        "policies": {
            POLICY_ID: {
                "id": POLICY_ID,
                "title": POLICY_TITLE,
                "description": policy_description(
                    schedule, new_claimant_monthly
                ),
                "uplift_schedule": {str(y): v for y, v in schedule.items()},
                "reform_window": {"start": reform_start, "end": reform_end},
                "health_element_monthly": {
                    "new_claimant": round(new_claimant_monthly, 2),
                    "baseline_base_year": round(
                        health_element_monthly_base_year, 2
                    ),
                    "baseline_primary_year": round(
                        health_element_monthly_primary_year, 2
                    ),
                },
                "standard_allowance_monthly": {
                    "base_year": standard_allowance_monthly_base_year,
                    "primary_year": standard_allowance_monthly_primary_year,
                },
                "parameter_path_by_year": parameter_path_by_year,
                "scenarios": scenarios,
                "primary_scenario": primary_id,
                "primary_summary": primary["summary"],
                "per_claimant_test": gainer,
                "per_claimant_tests": {
                    "gainer_standard_allowance": gainer,
                    "loser_new_lcwra": loser_lcwra,
                },
                "per_claimant_grid": per_claimant_grid,
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
