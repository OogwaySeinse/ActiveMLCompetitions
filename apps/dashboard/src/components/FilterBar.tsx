import { useMemo, type ReactNode } from "react";
import type { Competition, Filters } from "../types";
import { DEFAULT_FILTERS } from "../types";
import { ONGOING_TYPES, typeLabel } from "../lib/format";
import { MultiSelect } from "./MultiSelect";

interface Props {
  all: Competition[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  resultCount: number;
}

function counts<T extends string>(rows: Competition[], key: (c: Competition) => T) {
  const m = new Map<T, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const PRIZE_OPTIONS = [
  { value: 0, label: "Any prize" },
  { value: 1, label: "Cash prize" },
  { value: 1_000, label: "≥ $1k" },
  { value: 10_000, label: "≥ $10k" },
  { value: 50_000, label: "≥ $50k" },
  { value: 100_000, label: "≥ $100k" },
];
const DEADLINE_OPTIONS = [
  { value: "", label: "Any deadline" },
  { value: "3", label: "Closing in 3 days" },
  { value: "7", label: "Closing in 7 days" },
  { value: "14", label: "Closing in 14 days" },
  { value: "30", label: "Closing in 30 days" },
  { value: "90", label: "Closing in 90 days" },
];

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-9 rounded-lg border px-3 text-sm transition ${
        on
          ? "border-indigo-500 bg-indigo-600 text-white"
          : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
      }`}
    >
      {children}
    </button>
  );
}

const selectCls =
  "h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900";

export function FilterBar({ all, filters, setFilters, resultCount }: Props) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters({ ...filters, [k]: v });

  const platformOpts = useMemo(
    () => counts(all, (c) => c.platform).map(([v, n]) => ({ value: v, label: v, count: n })),
    [all],
  );
  const categoryOpts = useMemo(
    () => counts(all, (c) => c.category ?? "Other").map(([v, n]) => ({ value: v, label: v, count: n })),
    [all],
  );
  const typeOpts = useMemo(
    () =>
      counts(all, (c) => c.competition_type ?? "competition")
        .filter(([v]) => filters.includeOngoing || !ONGOING_TYPES.has(v))
        .map(([v, n]) => ({ value: v, label: typeLabel(v), count: n })),
    [all, filters.includeOngoing],
  );
  const ongoingCount = useMemo(
    () => all.filter((c) => c.competition_type && ONGOING_TYPES.has(c.competition_type)).length,
    [all],
  );
  const communityCount = useMemo(() => all.filter((c) => c.competition_type === "community").length, [all]);
  const isDirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a.75.75 0 11-1.06 1.06l-3.08-3.08A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search name, organiser, tags, venue (e.g. “NeurIPS”, “LLM”, “medical”)…"
          aria-label="Search competitions"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect label="Platform" options={platformOpts} selected={filters.platforms} onChange={(v) => set("platforms", v)} />
        <MultiSelect label="Category" options={categoryOpts} selected={filters.categories} onChange={(v) => set("categories", v)} />
        <MultiSelect label="Type" options={typeOpts} selected={filters.types} onChange={(v) => set("types", v)} />
        <select
          aria-label="Minimum prize"
          className={selectCls}
          value={filters.minPrize}
          onChange={(e) => set("minPrize", Number(e.target.value))}
        >
          {PRIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Deadline window"
          className={selectCls}
          value={filters.deadlineWithin ?? ""}
          onChange={(e) => set("deadlineWithin", e.target.value ? Number(e.target.value) : null)}
        >
          {DEADLINE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Toggle on={filters.researchOnly} onClick={() => set("researchOnly", !filters.researchOnly)}>
          🎓 Research only
        </Toggle>
        <Toggle on={filters.newOnly} onClick={() => set("newOnly", !filters.newOnly)}>
          ✨ New today
        </Toggle>
        <Toggle on={filters.includeCommunity} onClick={() => set("includeCommunity", !filters.includeCommunity)}>
          👥 Kaggle community ({communityCount})
        </Toggle>
        <Toggle on={filters.includeOngoing} onClick={() => set("includeOngoing", !filters.includeOngoing)}>
          ♾️ Benchmarks & practice ({ongoingCount})
        </Toggle>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
          <span>
            <strong className="text-slate-900 dark:text-slate-100">{resultCount}</strong> results
          </span>
          {isDirty && (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
