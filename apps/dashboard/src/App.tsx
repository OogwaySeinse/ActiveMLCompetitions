import { useMemo, useState } from "react";
import { CompetitionTable } from "./components/CompetitionTable";
import { Charts } from "./components/Charts";
import { FilterBar } from "./components/FilterBar";
import { SourceStatus } from "./components/SourceStatus";
import { StatCards } from "./components/StatCards";
import { applyFilters, ONGOING_TYPES, relativeTime } from "./lib/format";
import { useDataset, useNow, useTheme } from "./lib/hooks";
import { DEFAULT_FILTERS, type Filters } from "./types";

const REPO_URL = "https://github.com/OogwaySeinse/ActiveMLCompetitions";

type Tab = "table" | "insights";

export default function App() {
  const state = useDataset();
  const now = useNow();
  const [dark, toggleTheme] = useTheme();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<Tab>("table");

  const all = state.status === "ready" ? state.data.competitions : [];
  const filtered = useMemo(() => applyFilters(all, filters, now), [all, filters, now]);
  const totalActive = useMemo(
    () => all.filter((c) => filters.includeOngoing || !(c.competition_type && ONGOING_TYPES.has(c.competition_type))).length,
    [all, filters.includeOngoing],
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span aria-hidden>🏆 </span>Active ML Competitions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kaggle · DrivenData · AIcrowd · Zindi · CodaLab · Codabench · Hugging Face · Devpost & more — refreshed every morning
            {state.status === "ready" && (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  updated {relativeTime(state.data.meta.generated_at, now)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="./data/competitions.csv"
            download
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm leading-9 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
          >
            ⬇ CSV
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm leading-9 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
          >
            GitHub
          </a>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-base hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
          >
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {state.status === "loading" && (
        <div className="py-24 text-center text-slate-500">Loading competitions…</div>
      )}
      {state.status === "error" && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          Couldn't load <code>data/competitions.json</code> ({state.error}). Run <code>python -m scraper</code> first.
        </div>
      )}

      {state.status === "ready" && (
        <>
          <StatCards rows={filtered} totalActive={totalActive} now={now} />
          <FilterBar all={all} filters={filters} setFilters={setFilters} resultCount={filtered.length} />

          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
            {(
              [
                ["table", "📋 Competitions"],
                ["insights", "📊 Insights"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                  tab === id
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "table" ? <CompetitionTable rows={filtered} now={now} /> : <Charts rows={filtered} now={now} dark={dark} />}

          <SourceStatus meta={state.data.meta} now={now} />
        </>
      )}
    </div>
  );
}

