"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  getPerClaimantTests,
  getPolicyDescription,
  getPrimaryPolicyId,
  getPublishedByLeg,
  getScenarioOptions,
} from "../lib/dataHelpers";
import {
  formatBn,
  formatCount,
  formatCurrency,
  formatSignedBn,
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
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

const LEG_OPTIONS = [
  {
    id: "total",
    label: "Both legs",
    description: "Net effect of standard allowance uplift and new-claimant health element.",
  },
  {
    id: "sa",
    label: "Standard allowance",
    description: "Above-inflation uplift only — gainer leg.",
  },
  {
    id: "he",
    label: "Health element",
    description: "New-claimant health element freeze only — loser leg.",
  },
];

function LegDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const current = LEG_OPTIONS.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    function handleKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-slate-400">Showing:</span>
        <span>{current.label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 4l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {LEG_OPTIONS.map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                role="option"
                aria-selected={active}
                type="button"
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs ${
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                <span className="font-semibold">{opt.label}</span>
                <span
                  className={
                    active ? "text-primary-600/80" : "text-slate-500"
                  }
                >
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function YearDropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const current = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    function handleKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-slate-400">Year:</span>
        <span>{current.label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 4l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {options.map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                role="option"
                aria-selected={active}
                type="button"
                className={`flex w-full px-3 py-2 text-left text-xs ${
                  active
                    ? "bg-primary-50 font-semibold text-primary-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function publishedByMetric(data, policyId, needle) {
  const estimates =
    data.policies[policyId].published_comparison.estimates;
  return estimates.find((e) => e.metric.includes(needle));
}

export default function ReformTab({ data }) {
  const policyId = useMemo(() => getPrimaryPolicyId(data), [data]);
  const scenarioOptions = useMemo(
    () => getScenarioOptions(data, policyId),
    [data, policyId],
  );
  const primaryScenarioId = data.policies[policyId].primary_scenario;
  const finalYear = data.year;

  const [decileScenario, setDecileScenario] = useState(primaryScenarioId);
  const [wlScenario, setWlScenario] = useState(primaryScenarioId);
  const decileYear = data.policies[policyId].scenarios[decileScenario].year;
  const wlYear = data.policies[policyId].scenarios[wlScenario].year;
  const [impactMode, setImpactMode] = useState("abs");
  const [decileLeg, setDecileLeg] = useState("total");
  const [wlLeg, setWlLeg] = useState("total");

  useEffect(() => {
    if (!scenarioOptions.find((opt) => opt.id === decileScenario)) {
      setDecileScenario(primaryScenarioId);
    }
    if (!scenarioOptions.find((opt) => opt.id === wlScenario)) {
      setWlScenario(primaryScenarioId);
    }
  }, [scenarioOptions, primaryScenarioId, decileScenario, wlScenario]);

  const summary = useMemo(
    () => deriveImpactSummary(data, policyId, primaryScenarioId),
    [data, policyId, primaryScenarioId],
  );
  const summarySa = useMemo(
    () => data.policies[policyId].scenarios[primaryScenarioId].summary_sa,
    [data, policyId, primaryScenarioId],
  );
  const summaryHe = useMemo(
    () => data.policies[policyId].scenarios[primaryScenarioId].summary_he,
    [data, policyId, primaryScenarioId],
  );
  const decileData = useMemo(
    () => deriveDecileBreakdown(data, policyId, decileScenario, decileLeg),
    [data, policyId, decileScenario, decileLeg],
  );
  const wlData = useMemo(
    () => deriveDecileBreakdown(data, policyId, wlScenario, wlLeg),
    [data, policyId, wlScenario, wlLeg],
  );
  const claimant = useMemo(
    () => getPerClaimantTest(data, policyId),
    [data, policyId],
  );
  const claimants = useMemo(
    () => getPerClaimantTests(data, policyId),
    [data, policyId],
  );
  const inequality = useMemo(
    () =>
      data.policies[policyId].scenarios[primaryScenarioId].inequality_poverty,
    [data, policyId, primaryScenarioId],
  );
  const policyDescription = useMemo(
    () => getPolicyDescription(data, policyId),
    [data, policyId],
  );
  const schedule = data.policies[policyId].uplift_schedule;
  const cumulativePct = (
    Math.max(...Object.values(schedule).map(Number)) * 100
  ).toFixed(1);
  const newClaimantMonthly = `£${data.policies[
    policyId
  ].health_element_monthly.new_claimant.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const reformStartYear = Math.min(
    ...Object.keys(schedule).map((y) => Number(y)),
  );
  const dwpSaCost = getPublishedByLeg(data, policyId, "sa", "SA leg cost");
  const dwpSaGainers = getPublishedByLeg(data, policyId, "sa", "Households gaining");
  const dwpHeSaving = getPublishedByLeg(data, policyId, "he", "UCHE saving");
  const dwpHeLosers = getPublishedByLeg(data, policyId, "he", "lower rate");
  const dwpNet = getPublishedByLeg(data, policyId, "total", "Net package");
  const dwpClaimant = publishedByMetric(data, policyId, "nominal increase");
  const ifsClaimant = publishedByMetric(data, policyId, "above-inflation");
  const dwpHeRateCut = publishedByMetric(data, policyId, "monthly rate cut");

  const decileGainKey = "mean_gain";
  const decilePctKey = "pct_of_income";

  const decileTicks = useMemo(() => {
    const allValues = decileData.map((row) => row[decileGainKey]);
    return getNiceTicks([Math.min(0, ...allValues), Math.max(0, ...allValues)]);
  }, [decileData]);

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Who is affected by UC rebalancing?"
        description={
          <>
            The Universal Credit{" "}
            <a
              href="https://www.legislation.gov.uk/ukpga/2025/22/pdfs/ukpga_20250022_en.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Act
            </a>{" "}
            2025 packages two changes under a single rebalancing flag: it
            raises the standard allowance above CPI each April from 2026 to
            2029, reaching a{" "}
            <a
              href="https://assets.publishing.service.gov.uk/media/689ca49e1c63de6de5bb1298/withdrawn-universal-credit-bill-uc-rebalancing-impact-assessment.pdf"
              target="_blank"
              rel="noreferrer"
            >
              {cumulativePct}%
            </a>{" "}
            cumulative real-terms{" "}
            increase by {fyLabel(finalYear)}, and fixes the monthly UC
            health element at{" "}
            <a
              href="https://bills.parliament.uk/publications/62123/documents/6889#page=16"
              target="_blank"
              rel="noreferrer"
            >
              {newClaimantMonthly}
            </a>{" "}
            for new claimants from April 2026. This
            section quantifies the static net impact in {fyLabel(finalYear)}:
            how much it costs the Exchequer, how many households gain and lose
            and by how much, how the impact is distributed across the income
            distribution, and how a representative single-25+ claimant fares.
            Headline numbers are shown alongside the published DWP Impact
            Assessment and IFS estimates so the policyengine.py results can
            be checked directly against them.
          </>
        }
      />

      {/* Per-leg comparison vs DWP Impact Assessment — three boxes */}
      {summary && summarySa && summaryHe && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">
            Per-leg comparison vs DWP IA ({fyLabel(finalYear)})
          </h3>
          <p className="mb-4 text-sm text-slate-500">
            The rebalancing flag bundles two legs that move in opposite
            directions. The DWP IA publishes them separately, so each box
            below compares our static estimate against the matching DWP
            figure. Positive values are gains to households (a cost to the
            Exchequer); negative values are losses (a saving).
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* SA leg */}
            <div className="metric-card">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Standard allowance uplift
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatSignedBn(summarySa.total_cost_bn)}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {formatCount(summarySa.n_gaining)} households gain
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                <div>
                  DWP IA:{" "}
                  <span className="font-medium text-slate-500">
                    +{dwpSaCost?.value}
                  </span>{" "}
                  (
                  <a
                    href={dwpSaCost?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {dwpSaCost?.table}
                  </a>
                  )
                </div>
                <div>
                  DWP gainers:{" "}
                  <span className="font-medium text-slate-500">
                    {dwpSaGainers?.value}
                  </span>{" "}
                  (
                  <a
                    href={dwpSaGainers?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {dwpSaGainers?.table}
                  </a>
                  )
                </div>
              </div>
            </div>

            {/* HE leg */}
            <div className="metric-card">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                New-claimant health element freeze
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatSignedBn(summaryHe.total_cost_bn)}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {formatCount(summaryHe.n_losing)} households lose
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                <div>
                  DWP IA:{" "}
                  <span className="font-medium text-slate-500">
                    -{dwpHeSaving?.value}
                  </span>{" "}
                  (
                  <a
                    href={dwpHeSaving?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {dwpHeSaving?.table}
                  </a>
                  )
                </div>
              </div>
            </div>

            {/* Net package */}
            <div className="metric-card">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Net package
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatSignedBn(summary.total_cost_bn)}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {formatCount(summary.n_gaining)} gain ·{" "}
                {formatCount(summary.n_losing)} lose
              </div>
            </div>

            {/* Poverty rate change */}
            <div className="metric-card">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Poverty rate change
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {inequality.poverty_rate_change_pp >= 0 ? "+" : ""}
                {inequality.poverty_rate_change_pp.toFixed(2)} pp
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Net change in headline (BHC, absolute) poverty rate from the
                rebalancing package, about{" "}
                {formatCount(
                  Math.abs(inequality.people_lifted_out_of_poverty),
                )}{" "}
                {inequality.people_lifted_out_of_poverty >= 0
                  ? "fewer"
                  : "more"}{" "}
                people in poverty.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-claimant archetypes — gainer + LCWRA loser */}
      {(claimants || claimant) && (
        <div className="section-card">
          <SectionHeading
            title={`Per-claimant validation (${fyLabel(finalYear)})`}
            description={
              <>
                Two single 25+ archetypes, each isolating one leg of the
                package and benchmarked against the matching published
                per-claimant figure.
              </>
            }
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(claimants?.gainer_standard_allowance || claimant) && (
              <div className="metric-card">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  Single 25+, no LCWRA: UC uplift
                </div>
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Above-inflation slice (
                    {fyLabel(
                      (claimants?.gainer_standard_allowance || claimant)
                        .target_year,
                    )}{" "}
                    only)
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                      {formatCurrency(
                        (claimants?.gainer_standard_allowance || claimant)
                          .above_inflation_uplift,
                      )}
                      /yr
                    </span>
                    <span className="text-xs text-slate-400">
                      vs (
                      <a
                        href={ifsClaimant.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {ifsClaimant.source}
                      </a>
                      ): {ifsClaimant.value.replace("/yr", "")}
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-xs leading-5 text-slate-500">
                  Single 25+, no employment income, no LCWRA — isolates the
                  standard allowance uplift. The 4.8% above-CPI slice in
                  2029/30 is benchmarked against the IFS estimate.
                </div>
              </div>
            )}
            {claimants?.loser_new_lcwra && (
              <div className="metric-card">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  Single 25+ LCWRA, new claim: UC cut
                </div>
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Above-inflation cut (
                    {fyLabel(claimants.loser_new_lcwra.target_year)} only)
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                      {formatCurrency(
                        claimants.loser_new_lcwra.rebalancing_impact,
                      )}
                      /yr
                    </span>
                    {dwpHeRateCut && (
                      <span className="text-xs text-slate-400">
                        vs (
                        <a
                          href={dwpHeRateCut.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {dwpHeRateCut.source.split(" ")[0]}
                        </a>
                        ): {dwpHeRateCut.value.replace("/yr", "")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-xs leading-5 text-slate-500">
                  Single 25+, no employment income, makes a new LCWRA claim
                  from April 2026 — isolates the health element freeze. The
                  health element is fixed at £
                  {claimants.loser_new_lcwra.new_claimant_health_element_monthly}
                  /month against the CPI-indexed £423.27, and the annual cut
                  is benchmarked against the per-claimant rate change in the
                  DWP IA.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decile chart + Winners and losers — side by side */}
      {decileData.length > 0 && (
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="section-card">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <SectionHeading
                title={`Average gain by income decile (${fyLabel(decileYear)})`}
                description={
                  impactMode === "abs"
                    ? "Mean annual gain across all households in each income decile."
                    : "Mean annual gain as a share of net income."
                }
              />
              <div className="flex flex-shrink-0 items-center gap-2">
                <div className="flex overflow-hidden rounded-md border border-slate-200 bg-white text-xs font-medium">
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
                <YearDropdown
                  value={decileScenario}
                  options={scenarioOptions}
                  onChange={setDecileScenario}
                />
                <LegDropdown value={decileLeg} onChange={setDecileLeg} />
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
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <SectionHeading
                title={`Winners, no change, and losers (${fyLabel(wlYear)})`}
                description="Share of households that are better off, unaffected, or worse off in each income decile."
              />
              <div className="flex flex-shrink-0 items-center gap-2">
                <YearDropdown
                  value={wlScenario}
                  options={scenarioOptions}
                  onChange={setWlScenario}
                />
                <LegDropdown value={wlLeg} onChange={setWlLeg} />
              </div>
            </div>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={wlData}
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
