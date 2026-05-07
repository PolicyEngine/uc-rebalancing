from __future__ import annotations

import argparse
from pathlib import Path

from .pipeline import (
    DEFAULT_DASHBOARD_OUTPUT_PATH,
    DEFAULT_DATASET,
    DEFAULT_OUTPUT_PATH,
    generate_results_file,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Generate dashboard-ready UC standard allowance uplift results. "
            "Years and uplift percentages are read from PolicyEngine UK "
            "parameters at run time."
        ),
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument(
        "--sync-dashboard",
        action="store_true",
        help="Copy the generated JSON into dashboard/public/data/ as well.",
    )
    parser.add_argument(
        "--dashboard-output",
        type=Path,
        default=DEFAULT_DASHBOARD_OUTPUT_PATH,
    )
    parser.add_argument("--dataset", type=str, default=DEFAULT_DATASET)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    results = generate_results_file(
        output_path=args.output,
        sync_dashboard=args.sync_dashboard,
        dashboard_output_path=args.dashboard_output,
        dataset=args.dataset,
    )
    primary_year = results["year"]
    n_scenarios = sum(
        len(p["scenarios"]) for p in results["policies"].values()
    )
    print(f"Results saved to {args.output}")
    if args.sync_dashboard:
        print(f"Dashboard data synced to {args.dashboard_output}")
    print(
        f"Summary: {n_scenarios} scenarios, primary year "
        f"{primary_year}/{(primary_year + 1) % 100:02d}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
