/**
 * Data helper functions for the UC rebalancing dashboard.
 *
 * These helpers assume the dashboard JSON has been loaded — callers must
 * guard the loading state above. No silent fallbacks: accessing a missing
 * key surfaces as a real error rather than masquerading as empty data.
 */

const POLICY_META = {
  uc_rebalancing: {
    title: "UC rebalancing analysis",
    shortTitle: "UC rebalancing",
    fiscalDirection: "cost",
  },
};

export function getPrimaryPolicyId(data) {
  const ids = Object.keys(data.policies);
  return ids[0];
}

export function getPolicyOptions(data) {
  return Object.entries(data.policies).map(([id, policy]) => ({
    id,
    ...POLICY_META[id],
    title: policy.title,
    shortDescription: policy.description,
    description: policy.description,
  }));
}

export function getScenarioOptions(data, policyId) {
  return Object.entries(data.policies[policyId].scenarios)
    .map(([id, scenario]) => ({
      id,
      label: scenario.label,
      year: scenario.year,
    }))
    .sort((a, b) => a.year - b.year);
}

export function getScenarioData(data, policyId, scenarioId) {
  return data.policies[policyId].scenarios[scenarioId];
}

export function deriveImpactSummary(data, policyId, scenarioId) {
  return getScenarioData(data, policyId, scenarioId).summary;
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

export function deriveDecileBreakdown(data, policyId, scenarioId, leg) {
  const scenario = getScenarioData(data, policyId, scenarioId);
  return scenario[DECILE_KEY_BY_LEG[leg]];
}

export function deriveWinnersLosers(data, policyId, scenarioId, leg) {
  const scenario = getScenarioData(data, policyId, scenarioId);
  return scenario[WINNERS_LOSERS_KEY_BY_LEG[leg]];
}

export function getPublishedComparison(data, policyId) {
  return data.policies[policyId].published_comparison;
}

export function getPublishedByLeg(data, policyId, leg, metricNeedle) {
  const estimates = data.policies[policyId].published_comparison.estimates;
  const needle = metricNeedle.toLowerCase();
  return estimates.find(
    (e) => e.leg === leg && String(e.metric).toLowerCase().includes(needle),
  );
}

export function getPerClaimantTest(data, policyId) {
  return data.policies[policyId].per_claimant_test;
}

export function getPerClaimantTests(data, policyId) {
  return data.policies[policyId].per_claimant_tests;
}

export function getPolicyMeta(policyId) {
  return POLICY_META[policyId];
}

export function getPolicyDescription(data, policyId) {
  return data.policies[policyId].description;
}

export function getUpliftSchedule(data, policyId) {
  return data.policies[policyId].uplift_schedule;
}
