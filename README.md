# UC Rebalancing Analysis dashboard

policyengine.py-based validation of the Universal Credit rebalancing package
legislated by the Universal Credit Act 2025: an above-CPI uplift to the
standard allowance and a fixed monthly health element of £217.26 for new
claimants from April 2026, both toggled together via
`gov.dwp.universal_credit.rebalancing.active`. Static, first-round net
fiscal and distributional impact for 2026-27 → 2029-30, plus a per-claimant
grid (220 SA + 440 HE archetypes) covering family type × children × age ×
employment income × LCWRA claim timing.

## Repository layout

```
src/uc_rebalancing/        Python package (analysis + pipeline + CLI)
tests/                Pytest suite for the analysis functions
dashboard/            Next.js dashboard (Reform + Methodology tabs)
data/                 Pipeline output (uc_rebalancing_results.json)
docs/                 Additional documentation
uc_rebalancing_analysis.ipynb   Original notebook
```

## Quick start

```bash
conda activate python313
pip install -e '.[simulation,dev]'
pytest
uc-rebalancing-build --sync-dashboard
cd dashboard && npm install && npm run dev
```

`uc-rebalancing-build` runs the enhanced-FRS Microsimulations
(counterfactual = rebalancing OFF, reform = current law, plus single-leg
sims for decomposition), evaluates each financial year 2026-27 → 2029-30,
builds the per-claimant grid via batched single-Simulation packing, and
writes `data/uc_rebalancing_results.json`. Adding `--sync-dashboard` also
copies the JSON to `dashboard/public/data/uc_rebalancing_results.json` so
the dashboard picks it up. Full build time is around 2–3 minutes.

## Validation

### Per-claimant chart

| Check | Expected | policyengine.py | Verdict |
| --- | --- | --- | --- |
| Single 25+, £0 income, SA gain | ≈ £247 (IFS) | £254 | ✅ +3% (CPI denominator difference) |
| Couple 25+, £0 income, SA gain | ≈ 1.57 × single (SA ratio) | £398 | ✅ matches couple SA ratio |
| Single under-25, £0 income, SA gain | ≈ 0.79 × single 25+ | £201 | ✅ matches under-25 SA ratio |
| Single 25+, £10k, SA gain | partial (UC near zero) | £47 | ✅ SA £5,538 − taper £5,491 = £47 |
| Single 25+, £20k, SA gain | £0 (UC zeroed) | £0 | ✅ taper exceeds SA |
| Single 2 kids, SA stays positive longer | yes (bigger UC envelope) | £254 to £40k | ✅ child element widens taper window |
| Single 4 kids, £0, SA gain | £0 (benefit cap binding) | £0 | ✅ cap reduction +£253.64 absorbs uplift |
| HE new claim, single 25+, £0 | −£2,983 cut + £254 SA = −£2,729 | −£2,729 | ✅ exact |
| HE new claim, single under-25 | −£2,983 + £201 = −£2,782 | −£2,782 | ✅ |
| HE new claim, couple 25+ | −£2,983 + £398 = −£2,585 | −£2,584 | ✅ (£1 rounding) |
| HE pre-2026 = SA-only positive | matches SA leg values | matches | ✅ |
| Sign convention (gain +, loss −) | consistent | consistent | ✅ |
| Monotonic in income (no kinks) | gradual taper-driven fade | yes | ✅ |

### Aggregate 2029-30

| Metric | policyengine.py | Published | Gap | Source |
| --- | --- | --- | --- | --- |
| SA leg cost | £1.67bn | £1.85bn | −9.6% | DWP IA Table 4 |
| HE leg saving | −£2.33bn | −£2.10bn | −10.7% | DWP IA Table 9 |
| Net package | −£0.66bn | −£0.21bn | legs amplify | DWP IA Tables 4+9 |
| SA gainers | 5.99m | 6.69m | −10.5% | DWP IA Table 2 |
| Single 25+ nominal increase 2025-26 → 2029-30 | £736 | £725 | +1.5% | DWP IA evidence base |

Aggregate gaps of ≈10% are expected: the pipeline is static while the DWP
IA tables include behavioural responses (≈8k extra UC take-up, ≈40k fewer
WCAs). The CPI denominator the DWP IA uses also differs slightly from PE-UK's
parameter-driven uprating, which shows up as a 3% gap on the IFS comparison.

### Edge cases verified as real policy interactions

1. **4-kids single, £0 income → £0 SA gain.** Benefit cap binding. The
   reform increases UC by the SA uplift; the cap reduction increases by the
   same amount, so household net income is unchanged. Confirmed against the
   `is_benefit_cap_binding` and `benefit_cap_reduction` variables.
2. **Single 25+, £10k → £47 (not £254).** Counterfactual UC fully tapered
   to zero; reform retains a £47 residual. Most of the £254 uplift is
   absorbed by the taper at that earnings level.
3. **4-kids single transition £0→£32→£254 across £0/£10k/£20k.** Cap stops
   binding once earnings reduce raw UC entitlement below the cap, then the
   full uplift comes through. Real UC × benefit-cap interaction.
4. **HE leg loser count ≈ 2.06m vs DWP 750k.** Different metrics. DWP's 750k
   is the new-claim flow cohort through 2029-30. The pipeline's `n_losing`
   counts every LCWRA benunit whose UC moves when the HE leg is toggled
   (≈full LCWRA stock). Both are legitimate; the DWP figure is the policy
   count, the pipeline figure is the simulation footprint.

### External sources cross-referenced

- [Universal Credit Act 2025 (legislation.gov.uk)](https://www.legislation.gov.uk/ukpga/2025/22/pdfs/ukpga_20250022_en.pdf) — schedule of cumulative SA uplifts (2.3% / 3.1% / 4.0% / 4.8%) and the £217.26 new-claimant LCWRA freeze.
- [DWP UC rebalancing Impact Assessment, August 2025 (withdrawn)](https://assets.publishing.service.gov.uk/media/689ca49e1c63de6de5bb1298/withdrawn-universal-credit-bill-uc-rebalancing-impact-assessment.pdf) — aggregate fiscal cost, gainers and losers counts, single 25+ £725 nominal increase.
- [IFS: April's universal credit changes mean giveaways now, takeaways later](https://ifs.org.uk/articles/aprils-universal-credit-changes-mean-giveaways-now-takeaways-later) — £247/year above-inflation slice for single 25+.
- [UC and PIP Bill (parliament.uk)](https://bills.parliament.uk/publications/62123/documents/6889#page=16) — page 16 confirms the £217.26 freeze.
- DWP UC standard allowance rates 2025-26 — match `gov.dwp.universal_credit.standard_allowance.amount` (Single 25+ £400.14/mo, Couple 25+ £628.10/mo, Single under-25 £316.98/mo).
- DWP UC taper rate (55%) and work allowance (single no kids no LCWRA → £0; with LCWRA → ~£404/mo) — match PE-UK behaviour.
- DWP benefit cap 2024-25 (£22,019.92/yr single outside London) — CPI-indexed to ~£25,323 in 2029-30 — matches the cap binding observed in the 4-children archetype.
