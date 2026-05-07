export default function MethodologyTab({ data }) {
  const year = data.year;
  return (
    <div className="space-y-8">
      <div className="section-card">
        <div className="eyebrow text-slate-500">Overview</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          How the model works
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          This dashboard uses{" "}
          <a
            href="https://github.com/PolicyEngine/policyengine-uk"
            target="_blank"
            rel="noreferrer"
          >
            PolicyEngine UK
          </a>{" "}
          , a static microsimulation model built on the enhanced Family
          Resources Survey 2023/24, to estimate the impact of
          the Universal Credit standard allowance uplift legislated by the{" "}
          <a
            href="https://www.legislation.gov.uk/ukpga/2025/22/pdfs/ukpga_20250022_en.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Universal Credit Act 2025
          </a>
          . Two simulations are run: a counterfactual where{" "}
          <code>gov.dwp.universal_credit.rebalancing.active</code> is forced
          to <code>False</code> from April 2026 onwards, and current law where
          the rebalancing schedule is on. The reported impact is the
          difference in <code>household_net_income</code> in {year}/
          {(year + 1) % 100}, with weights baked into PolicyEngine&apos;s
          MicroSeries so all aggregates are population-weighted.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="section-card">
          <div className="eyebrow text-slate-500">Included</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            What the model captures
          </h3>
          <ul className="mt-4 list-disc pl-5 text-sm leading-7 text-slate-600 space-y-1">
            <li>
              Household-level UC standard allowance change for {year}/
              {(year + 1) % 100}
            </li>
            <li>
              Pass-through to household net income via the full UK tax-benefit
              system
            </li>
            <li>
              Distributional impact by equivalised household income decile
              (HBAI convention)
            </li>
            <li>
              Aggregate fiscal cost of the above-inflation slice
            </li>
            <li>
              Per-claimant validation for a single 25+ household with no
              employment income
            </li>
          </ul>
        </div>

        <div className="section-card">
          <div className="eyebrow text-slate-500">Excluded</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            What the dashboard omits
          </h3>
          <ul className="mt-4 list-disc pl-5 text-sm leading-7 text-slate-600 space-y-1">
            <li>Behavioural responses (labour supply, take-up)</li>
            <li>
              Indirect macroeconomic effects (consumption, demand, prices)
            </li>
            <li>Rounding of administrative weekly UC rates</li>
            <li>Interactions with future, not-yet-legislated reforms</li>
            <li>Confidence intervals on the underlying FRS sample</li>
          </ul>
        </div>

        <div className="section-card">
          <div className="eyebrow text-slate-500">Sources</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            Data and references
          </h3>
          <ul className="mt-4 list-disc pl-5 text-sm leading-7 text-slate-600 space-y-1">
            <li>
              Enhanced Family Resources Survey 2023-24 via PolicyEngine UK
            </li>
            <li>
              <a
                href="https://www.legislation.gov.uk/ukpga/2025/22/pdfs/ukpga_20250022_en.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Universal Credit Act 2025
              </a>
            </li>
            <li>
              <a
                href="https://assets.publishing.service.gov.uk/media/689ca49e1c63de6de5bb1298/withdrawn-universal-credit-bill-uc-rebalancing-impact-assessment.pdf"
                target="_blank"
                rel="noreferrer"
              >
                DWP Universal Credit rebalancing Impact Assessment (July 2025)
              </a>
            </li>
            <li>
              <a
                href="https://ifs.org.uk/articles/aprils-universal-credit-changes-mean-giveaways-now-takeaways-later"
                target="_blank"
                rel="noreferrer"
              >
                IFS: April&apos;s Universal Credit changes
              </a>
            </li>
            <li>
              <a
                href="https://commonslibrary.parliament.uk/research-briefings/cbp-10358/"
                target="_blank"
                rel="noreferrer"
              >
                House of Commons Library: Changes to UC rates from April 2026
                (CBP-10358)
              </a>
            </li>
            <li>
              <a
                href="https://www.resolutionfoundation.org/app/uploads/2025/10/Benefit-uprating-spotlight-sept-2025-final.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Resolution Foundation: Catching Up. Benefit uprating policy
                for April 2026
              </a>
            </li>
          </ul>
        </div>
      </div>

    </div>
  );
}
