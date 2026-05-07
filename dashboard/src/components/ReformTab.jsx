"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors } from "../lib/colors";
import {
  deriveDecileBreakdown,
  deriveImpactSummary,
  getPerClaimantTest,
  getPolicyDescription,
  getPrimaryPolicyId,
  getScenarioOptions,
} from "../lib/dataHelpers";
import {
  formatBn,
  formatCount,
  formatCurrency,
} from "../lib/formatters";
import { getNiceTicks, getTickDomain } from "../lib/chartUtils";
import ChartLogo from "./ChartLogo";
import SectionHeading from "./SectionHeading";

const PALETTE = {
  grid: colors.border.light,
  text: colors.gray[700],
  muted: colors.gray[500],
  gain: colors.primary[700],
  gainSoft: colors.primary[500],
  loss: colors.error,
  unchanged: colors.gray[300],
};

const AXIS_STYLE = {
  fontSize: 12,
  fill: colors.gray[500],
};

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg">
      {label !== undefined ? (
        <div className="mb-2 font-semibold text-slate-800">{label}</div>
      ) : null}
      {payload.map((entry) => (
        <div
          className="flex items-center justify-between gap-4"
          key={entry.name}
        >
          <span className="flex items-center gap-2 text-slate-600">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-medium text-slate-800">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function fyLabel(year) {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

function publishedByMetric(data, policyId, needle) {
  const estimates =
    data.policies[policyId].published_comparison.estimates;
  return estimates.find((e) => e.metric.includes(needle));
}

export default function ReformTab({ data }) {
  const policyId = useMemo(() => getPrimaryPolicyId(data), [data]);
  const primaryYear = data.year;
  const scenarioOptions = useMemo(
    () =>
      getScenarioOptions(data, policyId).filter(
        (opt) => opt.year === primaryYear,
      ),
    [data, policyId, primaryYear],
  );
  const primaryScenarioId = data.policies[policyId].primary_scenario;

  const [selectedScenario, setSelectedScenario] = useState(primaryScenarioId);
  const [impactMode, setImpactMode] = useState("abs");

  useEffect(() => {
    if (!scenarioOptions.find((opt) => opt.id === selectedScenario)) {
      setSelectedScenario(primaryScenarioId);
    }
  }, [scenarioOptions, primaryScenarioId, selectedScenario]);

  const summary = useMemo(
    () => deriveImpactSummary(data, policyId, selectedScenario),
    [data, policyId, selectedScenario],
  );
  const decileData = useMemo(
    () => deriveDecileBreakdown(data, policyId, selectedScenario),
    [data, policyId, selectedScenario],
  );
  const claimant = useMemo(
    () => getPerClaimantTest(data, policyId),
    [data, policyId],
  );
  const inequality = useMemo(
    () =>
      data.policies[policyId].scenarios[selectedScenario].inequality_poverty,
    [data, policyId, selectedScenario],
  );
  const policyDescription = useMemo(
    () => getPolicyDescription(data, policyId),
    [data, policyId],
  );
  const schedule = data.policies[policyId].uplift_schedule;
  const cumulativePct = (
    Math.max(...Object.values(schedule).map(Number)) * 100
  ).toFixed(1);
  const reformStartYear = Math.min(
    ...Object.keys(schedule).map((y) => Number(y)),
  );
  const dwpAggregate = publishedByMetric(data, policyId, "Aggregate static cost");
  const dwpHouseholds = publishedByMetric(data, policyId, "Households gaining");
  const dwpClaimant = publishedByMetric(data, policyId, "nominal increase");
  const ifsClaimant = publishedByMetric(data, policyId, "above-inflation");

  const decileGainKey = "mean_gain";
  const decilePctKey = "pct_of_income";

  const decileTicks = useMemo(() => {
    if (!decileData.length) return [0];
    const allValues = decileData.map((row) => row[decileGainKey] || 0);
    return getNiceTicks([Math.min(0, ...allValues), Math.max(0, ...allValues)]);
  }, [decileData]);

  if (!policyId) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No policy data available.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Who gains from the UC standard allowance uplift?"
        description={
          <>
            The{" "}
            <a
              href="https://www.legislation.gov.uk/ukpga/2025/22/pdfs/ukpga_20250022_en.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Universal Credit Act 2025
            </a>{" "}
            raises the standard allowance above CPI each April from 2026 to
            2029, reaching a{" "}
            <a
              href="https://assets.publishing.service.gov.uk/media/689ca49e1c63de6de5bb1298/withdrawn-universal-credit-bill-uc-rebalancing-impact-assessment.pdf"
              target="_blank"
              rel="noreferrer"
            >
              {cumulativePct}% cumulative real-terms
            </a>{" "}
            increase by {fyLabel(primaryYear)}. This section quantifies the
            static impact in {fyLabel(primaryYear)}: how much it costs the
            Exchequer,
            how many households gain and by how much, how the gain is
            distributed across the income distribution, and how a
            representative single-25+ claimant fares. Headline numbers are
            shown alongside the published DWP Impact Assessment and IFS
            estimates so the PolicyEngine UK results can be checked directly
            against them.
          </>
        }
      />

      {/* Scenario (year) selector — hidden when only one option */}
      {scenarioOptions.length > 1 && (
        <div className="section-card">
          <SectionHeading
            title="Choose a financial year"
            description={policyDescription}
          />
          <div className="flex flex-wrap gap-3">
            {scenarioOptions.map((option) => (
              <button
                key={option.id}
                className={`toggle-button ${
                  selectedScenario === option.id ? "active" : ""
                }`}
                onClick={() => setSelectedScenario(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Headline metric cards — 4 in a row */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Aggregate static cost ({fyLabel(primaryYear)})
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatBn(summary.total_cost_bn)}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              Total annual fiscal cost to the Exchequer in {fyLabel(primaryYear)}.
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Published (
              <a href={dwpAggregate.url} target="_blank" rel="noreferrer">
                {dwpAggregate.source.split(" ")[0]}
              </a>
              ): {dwpAggregate.value} ({dwpAggregate.year})
            </div>
          </div>
          <div className="metric-card">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Households gaining ({fyLabel(primaryYear)})
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatCount(summary.n_gaining)}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              Number of UK households whose net income rises in{" "}
              {fyLabel(primaryYear)} because of the uplift.
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Published (
              <a href={dwpHouseholds.url} target="_blank" rel="noreferrer">
                {dwpHouseholds.source.split(" ")[0]}
              </a>
              ): {dwpHouseholds.value} ({dwpHouseholds.year})
            </div>
          </div>
          {claimant && (
            <div className="metric-card">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Single 25+ claimant: UC uplift
              </div>
              <div className="mt-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  Above-inflation slice ({fyLabel(claimant.target_year)} only)
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {formatCurrency(claimant.above_inflation_uplift)}/yr
                  </span>
                  <span className="text-xs text-slate-400">
                    vs (
                    <a href={ifsClaimant.url} target="_blank" rel="noreferrer">
                      {ifsClaimant.source}
                    </a>
                    ): {ifsClaimant.value.replace("/yr", "")}
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  Total cash increase {fyLabel(reformStartYear)} to{" "}
                  {fyLabel(claimant.target_year)}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {formatCurrency(claimant.nominal_increase)}
                  </span>
                  <span className="text-xs text-slate-400">
                    vs (
                    <a href={dwpClaimant.url} target="_blank" rel="noreferrer">
                      {dwpClaimant.source.split(" ")[0]}
                    </a>
                    ): {dwpClaimant.value.replace("/yr", "")}
                  </span>
                </div>
              </div>
              <div className="mt-3 text-xs leading-5 text-slate-500">
                Single claimant 25+, no employment income.
              </div>
            </div>
          )}
          {inequality && (
            <div className="metric-card">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Poverty rate change
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {inequality.poverty_rate_change_pp >= 0 ? "+" : ""}
                {inequality.poverty_rate_change_pp.toFixed(2)} pp
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Headline (BHC, absolute) poverty rate
                {typeof inequality.people_lifted_out_of_poverty === "number"
                  ? `, about ${formatCount(
                      inequality.people_lifted_out_of_poverty,
                    )} fewer people in poverty.`
                  : "."}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Decile chart + Winners and losers — side by side */}
      {decileData.length > 0 && (
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="section-card">
            <div className="flex items-start justify-between">
              <SectionHeading
                title="Average gain by income decile"
                description={
                  impactMode === "abs"
                    ? "Mean annual gain across all households in each income decile."
                    : "Mean annual gain as a share of net income."
                }
              />
              <div className="flex rounded-md border border-slate-200 text-xs font-medium overflow-hidden shrink-0 ml-4">
                <button
                  className={`px-3 py-1.5 ${
                    impactMode === "abs"
                      ? "bg-primary-600 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setImpactMode("abs")}
                >
                  £
                </button>
                <button
                  className={`px-3 py-1.5 ${
                    impactMode === "pct"
                      ? "bg-primary-600 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setImpactMode("pct")}
                >
                  %
                </button>
              </div>
            </div>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={decileData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                  <XAxis
                    dataKey="decile"
                    tick={AXIS_STYLE}
                    tickLine={false}
                  />
                  <YAxis
                    ticks={impactMode === "abs" ? decileTicks : undefined}
                    domain={
                      impactMode === "abs" ? getTickDomain(decileTicks) : undefined
                    }
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={
                      impactMode === "abs"
                        ? (v) => formatCurrency(v)
                        : (v) => `${Number(v).toFixed(2)}%`
                    }
                  />
                  <ReferenceLine y={0} stroke={colors.gray[400]} strokeWidth={1} />
                  <Tooltip
                    content={
                      <CustomTooltip
                        formatter={
                          impactMode === "abs"
                            ? (value) => `${formatCurrency(value)}/yr`
                            : (value) => `${Number(value).toFixed(2)}%`
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey={
                      impactMode === "abs" ? decileGainKey : decilePctKey
                    }
                    name="Mean gain"
                    radius={[6, 6, 0, 0]}
                  >
                    {decileData.map((row, i) => (
                      <Cell
                        key={`g-${i}`}
                        fill={
                          (impactMode === "abs"
                            ? row[decileGainKey]
                            : row[decilePctKey]) >= 0
                            ? PALETTE.gain
                            : PALETTE.loss
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLogo />
          </div>

          <div className="section-card">
            <SectionHeading
              title="Winners, no change, and losers"
              description="Share of households that are better off, unaffected, or worse off in each income decile."
            />
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={decileData}
                  margin={{ top: 10, right: 12, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                  <XAxis
                    dataKey="decile"
                    tick={AXIS_STYLE}
                    tickLine={false}
                  />
                  <YAxis
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                    ticks={[0, 25, 50, 75, 100]}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        formatter={(value) => `${Number(value).toFixed(1)}%`}
                      />
                    }
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    iconSize={10}
                    verticalAlign="bottom"
                  />
                  <Bar
                    dataKey="pct_winners"
                    name="Better off"
                    stackId="wl"
                    fill={PALETTE.gain}
                  />
                  <Bar
                    dataKey="pct_unchanged"
                    name="No change"
                    stackId="wl"
                    fill={PALETTE.unchanged}
                  />
                  <Bar
                    dataKey="pct_losers"
                    name="Worse off"
                    stackId="wl"
                    fill={PALETTE.loss}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLogo />
          </div>
        </div>
      )}
    </div>
  );
}
