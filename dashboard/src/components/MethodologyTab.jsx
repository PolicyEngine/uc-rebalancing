function formatGbp(value) {
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function MethodologyTab({ data }) {
  const year = data.year;
  const fy = `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
  const policy = data.policies.uc_rebalancing;
  const health = policy.health_element_monthly;
  const schedule = policy.uplift_schedule;
  const finalUpliftPct = (
    Math.max(...Object.values(schedule).map(Number)) * 100
  ).toFixed(1);
  const newClaimantMonthly = formatGbp(health.new_claimant);
  const baselinePrimary = formatGbp(health.baseline_primary_year);
  const baselineBase = formatGbp(health.baseline_base_year);
  const newClaimantAnnual = formatGbp(health.new_claimant * 12).replace(
    /(\.\d{2})$/,
    "",
  );
  const baselinePrimaryAnnual = formatGbp(
    health.baseline_primary_year * 12,
  ).replace(/(\.\d{2})$/, "");
  return (
    <div className="space-y-8">
      <div className="section-card">
        <div className="eyebrow text-slate-500">Overview</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          What the dashboard estimates
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          This dashboard uses{" "}
          <a
            href="https://github.com/PolicyEngine/policyengine.py"
            target="_blank"
            rel="noreferrer"
          >
            policyengine.py v{data.model_versions.policyengine}
          </a>{" "}
          (policyengine-uk v{data.model_versions.policyengine_uk}), a static
          microsimulation model on the enhanced Family Resources
          Survey 2023/24, to quantify the household-level impact of the
          Universal Credit rebalancing package legislated by the{" "}
          <a
            href="https://www.legislation.gov.uk/ukpga/2025/22/pdfs/ukpga_20250022_en.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Universal Credit Act 2025
          </a>
          . The reported impact is the change in household_net_income in {fy},
          with FRS sample weights applied so all aggregates are
          population-weighted.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          The Act bundles two changes under a single parameter,{" "}
          <code>gov.dwp.universal_credit.rebalancing.active</code>:
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm leading-7 text-slate-600 space-y-1">
          <li>
            <strong>Standard allowance uplift</strong> (
            <code>rebalancing.standard_allowance_uplift</code>) — a cumulative
            above-CPI uplift that reaches {finalUpliftPct}% by {fy} and
            benefits roughly 5.9-6.7m UC households.
          </li>
          <li>
            <strong>New-claimant health element freeze</strong> (
            <code>rebalancing.new_claimant_health_element</code>) — fixes the
            monthly UC health element at{" "}
            <a
              href="https://bills.parliament.uk/publications/62123/documents/6889#page=16"
              target="_blank"
              rel="noreferrer"
            >
              {newClaimantMonthly}
            </a>{" "}
            for LCWRA claims started after April 2026, against the{" "}
            {baselineBase} CPI-indexed amount that pre-2026 claimants keep.
          </li>
        </ul>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          The two legs move together but pull in opposite directions, so the
          dashboard runs four simulations and reports the total package as
          well as each leg in isolation.
        </p>
      </div>

      <div className="section-card">
        <div className="eyebrow text-slate-500">Simulations</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          The four simulations
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          policyengine.py wires the two legs in differently — the standard
          allowance uplift sits inside a parameter formula, while the health
          element freeze is baked into the dataset&apos;s{" "}
          <code>uc_LCWRA_element</code> input column for 2026-2029. Isolating
          one leg therefore needs both a parameter override and a dataset
          edit. We build four sims so the dashboard can show the package and
          each leg cleanly:
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-medium">Sim</th>
                <th className="py-2 pr-4 font-medium">
                  <code>rebalancing.active</code>
                </th>
                <th className="py-2 pr-4 font-medium">
                  Cached <code>uc_LCWRA_element</code>
                </th>
                <th className="py-2 pr-0 font-medium">Effect</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-semibold">Counterfactual</td>
                <td className="py-2 pr-4">False</td>
                <td className="py-2 pr-4">Cleared (CPI-indexed)</td>
                <td className="py-2 pr-0">Both legs off</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-semibold">Reform</td>
                <td className="py-2 pr-4">True</td>
                <td className="py-2 pr-4">Kept (frozen for new claimants)</td>
                <td className="py-2 pr-0">Both legs on</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-semibold">SA-only</td>
                <td className="py-2 pr-4">True</td>
                <td className="py-2 pr-4">Cleared</td>
                <td className="py-2 pr-0">Standard allowance leg only</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-semibold">HE-only</td>
                <td className="py-2 pr-4">False</td>
                <td className="py-2 pr-4">Kept</td>
                <td className="py-2 pr-0">Health element leg only</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          The two legs operate on different UC components, so at the household
          level{" "}
          <code>diff(reform − counterfactual) ≈ diff(SA-only) + diff(HE-only)</code>
          . Small deviations come from UC tapers and benefit interactions.
        </p>
      </div>

      <div className="section-card">
        <div className="eyebrow text-slate-500">Mechanism</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          How each leg is wired in PolicyEngine UK
        </h2>

        <div className="mt-6 space-y-3">
          <details className="group rounded-lg border border-slate-200 bg-white">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50">
              <span>Standard allowance uplift — parameter formula</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                aria-hidden="true"
                className="text-slate-400 transition-transform group-open:rotate-180"
              >
                <path
                  d="M3 4.5l3 3 3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-sm leading-7 text-slate-600">
                The variable <code>uc_standard_allowance</code> reads the
                rebalancing parameter inside its own formula, so flipping the
                flag is enough:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-5 text-slate-100">
{`rebalancing = parameters(period).gov.dwp.universal_credit.rebalancing
if rebalancing.active:
    value = value * (1 + rebalancing.standard_allowance_uplift)`}
              </pre>
            </div>
          </details>

          <details className="group rounded-lg border border-slate-200 bg-white">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50">
              <span>
                Health element freeze — synthetic new-claimant cohort
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                aria-hidden="true"
                className="text-slate-400 transition-transform group-open:rotate-180"
              >
                <path
                  d="M3 4.5l3 3 3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-sm leading-7 text-slate-600">
                The {newClaimantMonthly} freeze is{" "}
                <strong>not exposed through a variable formula</strong>. The
                bundled scenario{" "}
                <code>universal_credit_july_2025_reform</code> instead
                carries a Python <code>simulation_modifier</code> that
                overwrites <code>uc_LCWRA_element</code> at construction
                time:
              </p>
              <ol className="mt-2 list-decimal pl-5 text-sm leading-7 text-slate-600 space-y-1">
                <li>
                  A fixed-seed random draw (seed 43, deterministic) assigns
                  every benunit a value <code>uc_seed</code> in [0, 1].
                </li>
                <li>
                  For each year a target share of the LCWRA stock is flagged
                  &quot;post-April-2026 new claimant&quot;: 11% in 2026, 13%
                  in 2027, 16% in 2028, 22% in 2029. The shares come from{" "}
                  <a
                    href="https://www.trusselltrust.org/news-and-blog/latest-stories/wpi-economics-uc-rebalancing/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    WPI Economics for the Trussell Trust
                  </a>{" "}
                  on PIP admin data.
                </li>
                <li>
                  A benunit enters the cohort if{" "}
                  <code>uc_seed &lt; share(year)</code>. The schedule is
                  monotonic, so a benunit that&apos;s &quot;new&quot; in
                  2026 stays &quot;new&quot; through 2029.
                </li>
                <li>
                  Pre-2025 protected claimants get a calibrated higher LCWRA
                  value so that{" "}
                  <em>
                    SA(reform) + LCWRA(protected) = combined CPI-indexed
                    amount
                  </em>
                  . Their total UC is unchanged.
                </li>
                <li>
                  Post-2025 new claimants are written down to{" "}
                  <code>
                    {newClaimantMonthly} × 12 = {newClaimantAnnual}/yr
                  </code>
                  , against an indexed counterfactual of roughly{" "}
                  <code>
                    {baselinePrimary} × 12 ≈ {baselinePrimaryAnnual}/yr
                  </code>{" "}
                  in {year}.
                </li>
                <li>
                  <code>
                    sim.set_input(&quot;uc_LCWRA_element&quot;, year, value)
                  </code>{" "}
                  commits the result to the simulation cache so downstream
                  UC variables read it directly.
                </li>
              </ol>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The &quot;new-claimant&quot; identity is therefore synthetic
                — the FRS has no claim-start dates, so the cohort is a
                calibrated random partition of the LCWRA stock. The
                aggregate share is grounded in admin data; the individual
                assignment is not.
              </p>
            </div>
          </details>

          <details className="group rounded-lg border border-slate-200 bg-white">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50">
              <span>Why the counterfactual needs to clear the LCWRA cache</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                aria-hidden="true"
                className="text-slate-400 transition-transform group-open:rotate-180"
              >
                <path
                  d="M3 4.5l3 3 3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-sm leading-7 text-slate-600">
                The shipped enhanced FRS dataset already stores{" "}
                <code>uc_LCWRA_element</code> for 2026-2029 with the
                modifier&apos;s output baked in. Setting{" "}
                <code>rebalancing.active = False</code> alone does not undo
                this, because no formula reads that flag for the LCWRA
                element. So for the counterfactual and SA-only sims we
                explicitly clear the cache:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-5 text-slate-100">
{`holder = sim.get_holder("uc_LCWRA_element")
for year in (2026, 2027, 2028, 2029):
    holder.delete_arrays(period=year)`}
              </pre>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                This forces the formula to recompute CPI-indexed
                pre-rebalancing amounts. Without it, the counterfactual and
                reform sims would share the same LCWRA values and the loser
                leg would silently fall out of the comparison.
              </p>
            </div>
          </details>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <div className="section-card">
          <div className="eyebrow text-slate-500">Included</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            What the model captures
          </h3>
          <ul className="mt-4 list-disc pl-5 text-sm leading-7 text-slate-600 space-y-1">
            <li>
              Net household impact of the rebalancing package in {fy},
              decomposable into the standard allowance and health element legs
            </li>
            <li>
              Pass-through to household net income via the full UK
              tax-benefit system
            </li>
            <li>
              Distributional impact by household income decile (HBAI
              convention)
            </li>
            <li>
              Static fiscal cost per leg, benchmarked against published DWP
              IA tables
            </li>
            <li>
              Per-claimant validation cards for both gainer (single 25+ no
              LCWRA) and loser (single 25+ new LCWRA from April 2026)
              archetypes
            </li>
          </ul>
        </div>

        <div className="section-card">
          <div className="eyebrow text-slate-500">Excluded</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            What the dashboard omits
          </h3>
          <ul className="mt-4 list-disc pl-5 text-sm leading-7 text-slate-600 space-y-1">
            <li>
              Behavioural responses (labour supply changes, take-up shifts,
              the IA&apos;s 8k extra UC take-up and 40k fewer WCAs)
            </li>
            <li>
              Indirect macroeconomic effects (consumption, demand, prices)
            </li>
            <li>
              Pathways to Work and other employment-support spending wrapped
              around the rebalancing
            </li>
            <li>
              Transitional protection for in-progress LCWRA assessments at
              the April 2026 cutover
            </li>
            <li>
              Confidence intervals on the underlying FRS sample
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
