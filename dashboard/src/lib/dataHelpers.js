/**
 * Data helper functions for the UC uplift dashboard.
 */

const POLICY_META = {
  uc_rebalancing: {
    title: "UC rebalancing analysis",
    shortTitle: "UC rebalancing",
    description:
      "From April 2026 the Universal Credit Act 2025 introduces two changes under a single rebalancing flag: a cumulative above-inflation uplift to the standard allowance, reaching 4.8% by 2029/30, and a fixed monthly health element of £217.26 for new claimants. This dashboard toggles gov.dwp.universal_credit.rebalancing.active, so the reported impact is the net effect of both legs against a counterfactual where the rebalancing package is switched off.",
    fiscalDirection: "cost",
  },
};

function firstPolicyId(data) {
  if (!data?.policies) return null;
  return Object.keys(data.policies)[0] || null;
}

export function getPrimaryPolicyId(data) {
  return firstPolicyId(data);
}

export function getPolicyOptions(data) {
  if (!data?.policies) return [];
  return Object.entries(data.policies).map(([id, policy]) => ({
    id,
    ...POLICY_META[id],
    title: POLICY_META[id]?.title || policy.title || id,
    shortDescription: POLICY_META[id]?.description || policy.description || "",
    description: policy.description || POLICY_META[id]?.description || "",
  }));
}

export function getScenarioOptions(data, policyId) {
  if (!data?.policies?.[policyId]?.scenarios) return [];
  return Object.entries(data.policies[policyId].scenarios)
    .map(([id, scenario]) => ({
      id,
      label: scenario.label,
      year: scenario.year,
    }))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}

export function getScenarioData(data, policyId, scenarioId) {
  return data?.policies?.[policyId]?.scenarios?.[scenarioId] || null;
}

export function deriveImpactSummary(data, policyId, scenarioId) {
  const scenario = getScenarioData(data, policyId, scenarioId);
  if (!scenario) return null;
  return scenario.summary;
}

const DECILE_KEY_BY_LEG = {
  total: "by_decile",
  sa: "by_decile_sa",
  he: "by_decile_he",
};

const WINNERS_LOSERS_KEY_BY_LEG = {
  total: "winners_losers",
  sa: "winners_losers_sa",
  he: "winners_losers_he",
};

export function deriveDecileBreakdown(data, policyId, scenarioId, leg = "total") {
  const scenario = getScenarioData(data, policyId, scenarioId);
  if (!scenario) return [];
  const key = DECILE_KEY_BY_LEG[leg] || "by_decile";
  return scenario[key] || scenario.by_decile || [];
}

export function deriveWinnersLosers(data, policyId, scenarioId, leg = "total") {
  const scenario = getScenarioData(data, policyId, scenarioId);
  if (!scenario) return null;
  const key = WINNERS_LOSERS_KEY_BY_LEG[leg] || "winners_losers";
  return scenario[key] || scenario.winners_losers || null;
}

export function getPublishedComparison(data, policyId) {
  return data?.policies?.[policyId]?.published_comparison || null;
}

export function getPublishedByLeg(data, policyId, leg, metricNeedle) {
  const estimates =
    data?.policies?.[policyId]?.published_comparison?.estimates || [];
  return (
    estimates.find(
      (e) =>
        (leg ? e.leg === leg : true) &&
        (metricNeedle
          ? String(e.metric).toLowerCase().includes(metricNeedle.toLowerCase())
          : true),
    ) || null
  );
}

export function getPerClaimantTest(data, policyId) {
  return data?.policies?.[policyId]?.per_claimant_test || null;
}

export function getPerClaimantTests(data, policyId) {
  return data?.policies?.[policyId]?.per_claimant_tests || null;
}

export function getPolicyMeta(policyId) {
  return POLICY_META[policyId] || { title: policyId, shortTitle: policyId };
}

export function getPolicyDescription(data, policyId) {
  return (
    data?.policies?.[policyId]?.description ||
    POLICY_META[policyId]?.description ||
    ""
  );
}

export function getUpliftSchedule(data, policyId) {
  return data?.policies?.[policyId]?.uplift_schedule || {};
}
