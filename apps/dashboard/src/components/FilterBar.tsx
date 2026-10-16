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
      className={`h-9 rounded-lg border px-3 font-mono text-xs transition ${
        on
          ? "border-[#faf6e8] bg-[#faf6e8] font-semibold text-[#111513]"
          : "border-white/12 bg-black/35 text-[#faf6e8]/75 hover:border-white/30 hover:text-[#faf6e8]"
      }`}
    >
      {children}
    </button>
  );
}

const selectCls =
  "h-9 rounded-lg border border-white/12 bg-black/45 px-2.5 font-mono text-xs text-[#faf6e8]/85 outline-none focus:border-emerald-300/60";

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
    <div className="wunder-glass space-y-3 rounded-2xl border border-white/12 p-4">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#faf6e8]/45"
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
          placeholder="Filter arena by title, organiser, tags, or venue (e.g. “NeurIPS”, “LLM”, “medical”, “audio”)…"
          aria-label="Search competitions"
          className="h-10 w-full rounded-xl border border-white/14 bg-black/45 pl-10 pr-3 font-mono text-xs text-[#faf6e8] placeholder-[#faf6e8]/40 outline-none transition focus:border-emerald-300/60 focus:ring-1 focus:ring-emerald-300/30"
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
            <option key={o.value} value={o.value} className="bg-[#0e1512] text-[#faf6e8]">
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
            <option key={o.value} value={o.value} className="bg-[#0e1512] text-[#faf6e8]">
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
          👥 Community ({communityCount})
        </Toggle>
        <Toggle on={filters.includeOngoing} onClick={() => set("includeOngoing", !filters.includeOngoing)}>
          ♾️ Ongoing ({ongoingCount})
        </Toggle>
        <div className="ml-auto flex items-center gap-3 font-mono text-xs text-[#faf6e8]/55">
          <span>
            <strong className="text-[#faf6e8]">{resultCount}</strong> live matches
          </span>
          {isDirty && (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-emerald-300 hover:underline"
            >
              [Reset]
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
