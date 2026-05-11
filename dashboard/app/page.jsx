"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MethodologyTab from "../src/components/MethodologyTab";
import ReformTab from "../src/components/ReformTab";

const TAB_OPTIONS = [
  { id: "impact", label: "Impact" },
  { id: "methodology", label: "Methodology" },
];

function getInitialTab(tabParam) {
  if (TAB_OPTIONS.some((tab) => tab.id === tabParam)) {
    return tabParam;
  }
  return "impact";
}

function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(() =>
    getInitialTab(searchParams.get("tab")),
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    setActiveTab(getInitialTab(tabParam));
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/data/uc_rebalancing_results.json");
        if (!response.ok) {
          throw new Error("uc_rebalancing_results.json not found");
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === "impact") {
      router.replace("/", { scroll: false });
      return;
    }
    router.replace(`/?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="app-shell min-h-screen">
      <header className="title-row">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 md:px-8">
          <h1>UC rebalancing analysis</h1>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[1400px] px-6 py-10 md:px-8 md:py-12">
        <div className="animate-[fadeIn_0.4s_ease-out]">
          <p className="mb-3 text-[1.05rem] leading-relaxed text-slate-600">
            This dashboard uses PolicyEngine UK to validate the fiscal and
            distributional impact of the Universal Credit rebalancing
            package legislated by the{" "}
            <a
              href="https://www.legislation.gov.uk/ukpga/2025/22/pdfs/ukpga_20250022_en.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Universal Credit Act 2025
            </a>
            : an above-inflation{" "}
            <a
              href="https://www.msn.com/en-gb/money/other/dwp-confirms-first-time-ever-change-to-universal-credit-affecting-4-million-claimants/ar-AA22p7T8?ocid=finance-verthp-feeds"
              target="_blank"
              rel="noreferrer"
            >
              uplift
            </a>{" "}
            to the standard allowance and a{" "}
            <a
              href="https://bills.parliament.uk/publications/62123/documents/6889#page=16"
              target="_blank"
              rel="noreferrer"
            >
              fixed
            </a>{" "}
            monthly health element for new claimants from April 2026. The{" "}
            <strong>Impact</strong> tab
            shows aggregate cost, household-level gain, and distribution by
            income decile. The <strong>Methodology</strong> tab explains the
            model, the counterfactual, and what the static analysis omits.
          </p>
        </div>

        <div className="mb-8 mt-8 flex w-fit flex-wrap border-b-2 border-slate-200">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Error: {error}. Run{" "}
            <code>uc-rebalancing-build --sync-dashboard</code> to generate the
            data file.
          </p>
        )}
        {loading && !error && (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading data...
          </p>
        )}

        {!loading && !error && data && (
          <>
            {activeTab === "impact" && <ReformTab data={data} />}
            {activeTab === "methodology" && <MethodologyTab data={data} />}
          </>
        )}

        <footer className="mt-12 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
          <p>
            Replication code:{" "}
            <a
              href="https://github.com/PolicyEngine/uc-rebalancing"
              target="_blank"
              rel="noreferrer"
            >
              PolicyEngine/uc-rebalancing
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={<p className="p-12 text-center text-slate-500">Loading...</p>}
    >
      <Dashboard />
    </Suspense>
  );
}
