# UC Rebalancing Analysis dashboard

PolicyEngine UK validation of the Universal Credit rebalancing package
legislated by the Universal Credit Act 2025: an above-inflation uplift
to the standard allowance and a fixed monthly health element of £217.26
for new claimants from April 2026, both toggled together via
`gov.dwp.universal_credit.rebalancing.active`. Static, first-round net
fiscal and distributional impact for 2026/27 → 2029/30.

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

`uc-rebalancing-build` runs both PolicyEngine UK simulations (counterfactual =
rebalancing OFF, reform = current law), evaluates each financial year
2026/27 → 2029/30, and writes `data/uc_rebalancing_results.json`. Adding
`--sync-dashboard` also copies the JSON to
`dashboard/public/data/uc_rebalancing_results.json` so the dashboard picks it
up.

## Validation targets

| Published claim | PolicyEngine UK |
| --- | --- |
| £725/year for single 25+ (DWP IA) | £736 |
| £247/year above-inflation slice (IFS) | £254 |
| 6.7M households gain (DWP IA) | 5.91M |
| £1.85bn cost in 2029/30 (DWP IA) | £1.65bn |
