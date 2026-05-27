"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
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
    label: "Both changes",
    description: "Net effect of standard allowance uplift and new-claimant health element.",
  },
  {
    id: "sa",
    label: "Standard allowance",
    description: "Above-inflation uplift only.",
  },
  {
    id: "he",
    label: "Health element",
    description: "New-claimant health element freeze only.",
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

function ArchetypeSelect({ label, value, options, onChange }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium uppercase tracking-[0.08em] text-slate-400">
        {label}
      </span>
      <select
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const match = options.find((o) => String(o.value) === raw);
          onChange(match.value);
        }}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 hover:border-slate-300 focus:border-primary-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function findGridRow(rows, query) {
  return rows.find((row) =>
    Object.entries(query).every(([key, value]) => row[key] === value),
  );
}

function isCanonical(archetype, canonical) {
  return Object.entries(canonical).every(
    ([key, value]) => archetype[key] === value,
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

  const grid = data.policies[policyId].per_claimant_grid;
  const [archetype, setArchetype] = useState(
    grid ? grid.canonical_archetype : null,
  );
  const [claimTiming, setClaimTiming] = useState("new");
  const saRow = useMemo(
    () => (grid && archetype ? findGridRow(grid.sa, archetype) : null),
    [grid, archetype],
  );
  const heRow = useMemo(
    () =>
      grid && archetype
        ? findGridRow(grid.he, { ...archetype, claim_timing: claimTiming })
        : null,
    [grid, archetype, claimTiming],
  );
  const saIsCanonical =
    grid && archetype
      ? isCanonical(archetype, grid.canonical_archetype)
      : false;
  const heIsCanonical = saIsCanonical && claimTiming === "new";

  const saSeries = useMemo(() => {
    if (!grid || !archetype) return [];
    const q = {
      family_type: archetype.family_type,
      num_children: archetype.num_children,
      age_band: archetype.age_band,
    };
    return grid.input_options.employment_income
      .map((opt) => {
        const row = findGridRow(grid.sa, {
          ...q,
          employment_income: opt.value,
        });
        return row
          ? {
              employment_income: opt.value,
              value: row.above_inflation_uplift,
            }
          : null;
      })
      .filter(Boolean);
  }, [grid, archetype]);

  const heSeries = useMemo(() => {
    if (!grid || !archetype) return [];
    const q = {
      family_type: archetype.family_type,
      num_children: archetype.num_children,
      age_band: archetype.age_band,
      claim_timing: claimTiming,
    };
    return grid.input_options.employment_income
      .map((opt) => {
        const row = findGridRow(grid.he, {
          ...q,
          employment_income: opt.value,
        });
        return row
          ? {
              employment_income: opt.value,
              value: row.rebalancing_impact,
            }
          : null;
      })
      .filter(Boolean);
  }, [grid, archetype, claimTiming]);

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
  const health = data.policies[policyId].health_element_monthly;
  const sa = data.policies[policyId].standard_allowance_monthly;
  const gbp = (v) =>
    `£${v.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const newClaimantMonthly = gbp(health.new_claimant);
  const baselineBaseYearMonthly = gbp(health.baseline_base_year);
  const baselinePrimaryYearMonthly = gbp(health.baseline_primary_year);
  const reformStartYear = Math.min(
    ...Object.keys(schedule).map((y) => Number(y)),
  );
  const scheduleRows = Object.keys(schedule)
    .map((y) => Number(y))
    .sort((a, b) => a - b)
    .map((y) => ({
      year: y,
      pct: schedule[String(y)] * 100,
    }));
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
              Act 2025
            </a>{" "}
            bundles two changes under one rebalancing flag, both effective
            1 April {reformStartYear}: an above-CPI uplift to the standard
            allowance, and a freeze of the monthly UC health element for new
            LCWRA claims. LCWRA stands for{" "}
            <em>limited capability for work and work-related activity</em> —
            the UC health element paid to claimants assessed as unable to
            work or prepare for work because of a health condition. The two
            changes work in opposite directions for the Exchequer
            (cost vs saving) and for affected households (uplift vs cut), and
            partly offset at the package level. This page quantifies the
            household-level impact across {fyLabel(reformStartYear)}–
            {fyLabel(finalYear)}: the per-change fiscal effect, the
            distribution by income decile, the share of winners and losers,
            and a representative single-25+ claimant, alongside published
            DWP Impact Assessment and IFS estimates.
          </>
        }
      />

      {/* What's changing — at-a-glance table of parameter values before/after */}
      <div className="section-card">
        <h3 className="text-lg font-semibold text-slate-900">
          What is changing
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          The two parameters governed by the rebalancing flag, with their
          values before and after the reform.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-medium">Parameter</th>
                <th className="py-2 pr-4 font-medium">
                  Before ({fyLabel(reformStartYear - 1)})
                </th>
                <th className="py-2 pr-4 font-medium">
                  After ({fyLabel(finalYear)})
                </th>
                <th className="py-2 pr-0 font-medium">Effective from</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b border-slate-100 align-top">
                <td className="py-3 pr-4">
                  <div className="font-semibold">
                    Standard allowance, above-CPI uplift
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Applies to all UC households; the SA itself continues to
                    rise with CPI each April on top of this above-CPI step.
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <span className="font-medium">CPI uprating only</span>
                  <div className="mt-1 text-xs text-slate-500">
                    Single 25+: £{sa.base_year.single_25_plus.toFixed(2)}/mo;
                    couple 25+: £{sa.base_year.couple_25_plus.toFixed(2)}/mo
                    ({fyLabel(reformStartYear - 1)}).
                  </div>
                </td>
                <td className="py-3 pr-4 tabular-nums">
                  <a
                    href="https://assets.publishing.service.gov.uk/media/689ca49e1c63de6de5bb1298/withdrawn-universal-credit-bill-uc-rebalancing-impact-assessment.pdf#page=3"
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-slate-300 hover:decoration-slate-500"
                  >
                    +{cumulativePct}% above CPI, cumulative
                  </a>
                  <div className="mt-1 text-xs text-slate-500">
                    Single 25+: £{sa.primary_year.single_25_plus.toFixed(2)}/mo;
                    couple 25+: £{sa.primary_year.couple_25_plus.toFixed(2)}/mo
                    ({fyLabel(finalYear)}, CPI + uplift).
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Year on year:{" "}
                    {scheduleRows.map((r, i) => (
                      <span key={r.year} className="tabular-nums">
                        {fyLabel(r.year)} +{r.pct.toFixed(1)}%
                        {i < scheduleRows.length - 1 ? " · " : ""}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-0">1 April {reformStartYear}</td>
              </tr>
              <tr className="align-top">
                <td className="py-3 pr-4">
                  <div className="font-semibold">
                    UC health element, new LCWRA claims (monthly)
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Affects only new claims from April {reformStartYear};
                    pre-2026 claims keep the CPI-indexed amount.
                  </div>
                </td>
                <td className="py-3 pr-4 tabular-nums">
                  <a
                    href="https://assets.publishing.service.gov.uk/media/689ca49e1c63de6de5bb1298/withdrawn-universal-credit-bill-uc-rebalancing-impact-assessment.pdf#page=1"
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-slate-300 hover:decoration-slate-500"
                  >
                    {baselineBaseYearMonthly}/mo
                  </a>
                  <div className="mt-1 text-xs text-slate-500">
                    CPI-indexed; would reach {baselinePrimaryYearMonthly}/mo
                    by {fyLabel(finalYear)}.
                  </div>
                </td>
                <td className="py-3 pr-4 tabular-nums">
                  <a
                    href="https://bills.parliament.uk/publications/62123/documents/6889#page=16"
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-slate-300 hover:decoration-slate-500"
                  >
                    {newClaimantMonthly}/mo
                  </a>
                  <div className="mt-1 text-xs text-slate-500">
                    Fixed in cash terms; no CPI uprating.
                  </div>
                </td>
                <td className="py-3 pr-0">1 April {reformStartYear}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-change comparison vs DWP Impact Assessment */}
      {summary && summarySa && summaryHe && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">
            Per-change comparison vs DWP IA ({fyLabel(finalYear)})
          </h3>
          <p className="mb-4 text-sm text-slate-500">
            The rebalancing flag bundles two changes that move in opposite
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

      {/* Per-claimant archetypes — interactive grid */}
      {grid && archetype && (
        <div className="section-card">
          <SectionHeading
            title={`Per-claimant impact (${fyLabel(finalYear)})`}
            description={
              <>
                Pick the household profile to see how each change in the
                package affects a representative claimant. The IFS and DWP IA
                benchmarks are shown when the inputs match their canonical
                archetype (single, 25 or over, no children, no employment
                income, new LCWRA claim).
              </>
            }
          />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ArchetypeSelect
              label="Family"
              value={archetype.family_type}
              options={grid.input_options.family_type}
              onChange={(v) => setArchetype({ ...archetype, family_type: v })}
            />
            <ArchetypeSelect
              label="Children"
              value={archetype.num_children}
              options={grid.input_options.num_children}
              onChange={(v) => setArchetype({ ...archetype, num_children: v })}
            />
            <ArchetypeSelect
              label="Age"
              value={archetype.age_band}
              options={grid.input_options.age_band}
              onChange={(v) => setArchetype({ ...archetype, age_band: v })}
            />
            <ArchetypeSelect
              label="LCWRA claim"
              value={claimTiming}
              options={grid.input_options.claim_timing}
              onChange={setClaimTiming}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="metric-card">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Standard allowance uplift — annual UC gain vs earnings
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                Above-inflation slice ({fyLabel(finalYear)} only)
              </div>
              <div className="mt-3 h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={saSeries}
                    margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                    <XAxis
                      dataKey="employment_income"
                      type="number"
                      domain={[0, 100000]}
                      ticks={[0, 20000, 40000, 60000, 80000, 100000]}
                      tickFormatter={(v) => `£${v / 1000}k`}
                      tick={AXIS_STYLE}
                      tickLine={false}
                    />
                    <YAxis
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <ReferenceLine y={0} stroke={colors.gray[400]} strokeWidth={1} />
                    <Tooltip
                      content={
                        <CustomTooltip
                          formatter={(v) => `${formatCurrency(v)}/yr`}
                          labelFormatter={(v) =>
                            `Earnings £${Number(v).toLocaleString("en-GB")}`
                          }
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={PALETTE.gain}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: PALETTE.gain }}
                      activeDot={{ r: 5 }}
                      name="SA uplift"
                    />
                    {saIsCanonical && ifsClaimant && (
                      <ReferenceLine
                        y={Number(ifsClaimant.value.replace(/[^0-9-]/g, ""))}
                        stroke={colors.gray[500]}
                        strokeDasharray="4 4"
                        label={{
                          value: `IFS ${ifsClaimant.value.replace("/yr", "")}`,
                          position: "insideTopRight",
                          fill: colors.gray[500],
                          fontSize: 11,
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-500">
                UC at {fyLabel(finalYear)} with the above-CPI uplift minus
                UC with the rebalancing flag off, plotted against employment
                income for the selected archetype. The LCWRA-claim setting
                does not affect this card.
                {saIsCanonical && (
                  <>
                    {" "}
                    Dashed line shows the{" "}
                    <a
                      href={ifsClaimant.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-slate-300 hover:decoration-slate-500"
                    >
                      IFS
                    </a>{" "}
                    benchmark of {ifsClaimant.value.replace("/yr", "")} for
                    this canonical archetype.
                  </>
                )}
              </div>
            </div>

            <div className="metric-card">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Health element freeze — annual UC change vs earnings
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                LCWRA claim impact ({fyLabel(finalYear)})
              </div>
              <div className="mt-3 h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={heSeries}
                    margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                    <XAxis
                      dataKey="employment_income"
                      type="number"
                      domain={[0, 100000]}
                      ticks={[0, 20000, 40000, 60000, 80000, 100000]}
                      tickFormatter={(v) => `£${v / 1000}k`}
                      tick={AXIS_STYLE}
                      tickLine={false}
                    />
                    <YAxis
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <ReferenceLine y={0} stroke={colors.gray[400]} strokeWidth={1} />
                    <Tooltip
                      content={
                        <CustomTooltip
                          formatter={(v) => `${formatCurrency(v)}/yr`}
                          labelFormatter={(v) =>
                            `Earnings £${Number(v).toLocaleString("en-GB")}`
                          }
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={
                        claimTiming === "new" ? PALETTE.loss : PALETTE.gain
                      }
                      strokeWidth={2.5}
                      dot={{
                        r: 3,
                        fill:
                          claimTiming === "new" ? PALETTE.loss : PALETTE.gain,
                      }}
                      activeDot={{ r: 5 }}
                      name="UC change"
                    />
                    {heIsCanonical && dwpHeRateCut && (
                      <ReferenceLine
                        y={Number(
                          dwpHeRateCut.value.replace(/[^0-9-]/g, ""),
                        )}
                        stroke={colors.gray[500]}
                        strokeDasharray="4 4"
                        label={{
                          value: `DWP ${dwpHeRateCut.value.replace("/yr", "")}`,
                          position: "insideTopRight",
                          fill: colors.gray[500],
                          fontSize: 11,
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-500">
                {claimTiming === "new"
                  ? `New LCWRA claim from April ${reformStartYear} — health element fixed at ${newClaimantMonthly}/month against the CPI-indexed amount. The plotted figure includes the offsetting standard allowance uplift.`
                  : `Pre-${reformStartYear} LCWRA claim — protected on the CPI-indexed health element, so the only UC change shown is the standard allowance uplift.`}
                {heIsCanonical && dwpHeRateCut && (
                  <>
                    {" "}
                    Dashed line shows the{" "}
                    <a
                      href={dwpHeRateCut.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-slate-300 hover:decoration-slate-500"
                    >
                      DWP IA
                    </a>{" "}
                    rate-cut headline of {dwpHeRateCut.value.replace("/yr", "")}
                    .
                  </>
                )}
              </div>
            </div>
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
