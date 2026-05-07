/**
 * Data helper functions for the UC uplift dashboard.
 */

const POLICY_META = {
  uc_standard_allowance_uplift: {
    title: "UC standard allowance uplift",
    shortTitle: "UC uplift",
    description:
      "From April 2026 the Universal Credit standard allowance rises faster than CPI, reaching a 4.8% cumulative above-inflation uplift by 2029/30. This dashboard compares current law (uplift active) with a counterfactual where the rebalancing parameter is switched off.",
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

export function deriveDecileBreakdown(data, policyId, scenarioId) {
  const scenario = getScenarioData(data, policyId, scenarioId);
  if (!scenario) return [];
  return scenario.by_decile || [];
}

export function deriveWinnersLosers(data, policyId, scenarioId) {
  const scenario = getScenarioData(data, policyId, scenarioId);
  if (!scenario) return null;
  return scenario.winners_losers || null;
}

export function getPublishedComparison(data, policyId) {
  return data?.policies?.[policyId]?.published_comparison || null;
}

export function getPerClaimantTest(data, policyId) {
  return data?.policies?.[policyId]?.per_claimant_test || null;
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
