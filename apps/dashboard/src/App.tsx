import { useMemo, useState } from "react";
import { AiRecommender } from "./components/AiRecommender";
import { AsciiBackdrop } from "./components/AsciiBackdrop";
import { Charts } from "./components/Charts";
import { CompetitionTable } from "./components/CompetitionTable";
import { FilterBar } from "./components/FilterBar";
import { SourceStatus } from "./components/SourceStatus";
import { StatCards } from "./components/StatCards";
import { applyFilters, countdown, formatUSD, ONGOING_TYPES, platformColor, relativeTime } from "./lib/format";
import { useDataset, useNow } from "./lib/hooks";
import { DEFAULT_FILTERS, type Filters } from "./types";

const REPO_URL = "https://github.com/OogwaySeinse/ActiveMLCompetitions";

type Tab = "table" | "insights";

export default function App() {
  const state = useDataset();
  const now = useNow();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<Tab>("table");

  const all = state.status === "ready" ? state.data.competitions : [];
  const filtered = useMemo(() => applyFilters(all, filters, now), [all, filters, now]);
  const totalActive = useMemo(
    () => all.filter((c) => filters.includeOngoing || !(c.competition_type && ONGOING_TYPES.has(c.competition_type))).length,
    [all, filters.includeOngoing],
  );

  // Top 3 flagship prize competitions for the hero showcase strip
  const flagshipCompetitions = useMemo(() => {
    return [...all]
      .filter((c) => (c.prize_usd ?? 0) > 0)
      .sort((a, b) => (b.prize_usd ?? 0) - (a.prize_usd ?? 0))
      .slice(0, 3);
  }, [all]);

  const totalPrizePool = useMemo(
    () => all.reduce((sum, c) => sum + (c.prize_usd ?? 0), 0),
    [all],
  );

  const handleSelectCategoryFromAi = (category: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category) ? prev.categories : [category],
    }));
    document.getElementById("live-arena")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative min-h-[calc(100vh-22px)] overflow-hidden rounded-2xl border border-black/25 bg-[#0a100d] text-[#faf6e8] shadow-2xl">
      {/* Drifting ML math & ASCII canvas backdrop */}
      <AsciiBackdrop />

      {/* Main content container */}
      <div className="relative z-10 mx-auto max-w-[1600px] space-y-8 px-4 pb-24 pt-5 sm:px-7">
        {/* Top Floating Corner Pills (wundernn.io signature navigation) */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="#top"
              className="wunder-pill inline-flex items-center gap-2.5 rounded-xl px-3.5 py-2 font-mono text-xs font-semibold tracking-wider text-[#faf6e8]"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              <span>WUNDERCOMP // ML ARENA</span>
            </a>

            {state.status === "ready" && (
              <div className="wunder-pill hidden items-center gap-2 rounded-xl px-3 py-2 font-mono text-[11px] text-[#faf6e8]/70 sm:inline-flex">
                <span className="text-emerald-300">SYNC:</span>
                <span>{relativeTime(state.data.meta.generated_at, now)}</span>
                <span className="text-white/20">·</span>
                <span>06:00 UTC CRON</span>
              </div>
            )}
          </div>

          <nav aria-label="Primary navigation" className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <a
              href="#ai-matchmaker"
              className="wunder-pill rounded-xl px-3.5 py-2 text-emerald-300 transition hover:border-emerald-300/50 hover:bg-emerald-400/10"
            >
              ✦ AI Matchmaker
            </a>
            <a
              href="#live-arena"
              onClick={() => setTab("table")}
              className="wunder-pill rounded-xl px-3.5 py-2 text-[#faf6e8]/85 transition hover:border-white/30 hover:text-[#faf6e8]"
            >
              Arena ({totalActive || "…"})
            </a>
            <a
              href="#live-arena"
              onClick={() => setTab("insights")}
              className="wunder-pill rounded-xl px-3.5 py-2 text-[#faf6e8]/85 transition hover:border-white/30 hover:text-[#faf6e8]"
            >
              Telemetry
            </a>
            <a
              href="./data/competitions.csv"
              download
              className="wunder-pill rounded-xl px-3 py-2 text-[#faf6e8]/80 transition hover:border-white/30 hover:text-[#faf6e8]"
            >
              ⬇ CSV
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="wunder-pill rounded-xl px-3 py-2 text-[#faf6e8]/80 transition hover:border-white/30 hover:text-[#faf6e8]"
            >
              GitHub ↗
            </a>
          </nav>
        </header>

        {/* Hero Section (wundernn.io editorial serif + monospace telemetry + flagship cards) */}
        <section id="top" className="relative pt-4 sm:pt-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="wunder-pill mx-auto inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-[#faf6e8]/80">
              <span className="text-emerald-300">● LIVE INTELLIGENCE</span>
              <span className="text-white/25">|</span>
              <span>KAGGLE · DRIVENDATA · AICROWD · ZINDI · CODABENCH · HF · DEVPOST</span>
            </div>

            <h1 className="font-display mt-5 text-5xl leading-[0.98] tracking-tight text-[#faf6e8] sm:text-7xl lg:text-[82px]">
              Where Frontier Models Meet{" "}
              <span className="italic text-emerald-200">Live Competition.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl font-mono text-xs leading-relaxed text-[#faf6e8]/70 sm:text-sm">
              Every active machine learning bounty, academic workshop challenge, and grandmaster arena — continuously
              indexed every morning and paired with a Gemini 3.8 Flash competition strategist.
            </p>

            {/* Primary Hero CTAs */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 font-mono text-xs sm:text-sm">
              <a
                href="#ai-matchmaker"
                className="wunder-cta-glow inline-flex items-center gap-2.5 rounded-full bg-[#faf6e8] px-6 py-3.5 font-semibold text-[#111513] transition hover:bg-white"
              >
                <span>✦ Launch AI Competition Matchmaker</span>
                <span aria-hidden="true">→</span>
              </a>
              <a
                href="#live-arena"
                className="wunder-pill inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-[#faf6e8]/90 transition hover:border-white/35 hover:text-[#faf6e8]"
              >
                <span>Browse {all.length || 685} Active Challenges</span>
                <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>

          {/* Flagship Bounties Strip */}
          {flagshipCompetitions.length > 0 && (
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {flagshipCompetitions.map((c, i) => {
                const pColor = platformColor(c.platform);
                return (
                  <a
                    key={c.id}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wunder-glass group flex flex-col justify-between rounded-2xl border border-white/12 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300/45"
                  >
                    <div>
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-[#faf6e8]/50">FLAGSHIP // 0{i + 1}</span>
                        <span
                          className="rounded px-2 py-0.5 font-medium"
                          style={{ backgroundColor: `${pColor}24`, color: pColor }}
                        >
                          {c.platform}
                        </span>
                      </div>
                      <div className="mt-2 line-clamp-2 font-medium text-[#faf6e8] group-hover:text-emerald-300">
                        {c.name}
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-2.5 font-mono text-xs">
                      <span className="text-base font-bold text-emerald-300">{formatUSD(c.prize_usd)}</span>
                      <span className="text-[11px] text-[#faf6e8]/60">⏳ {countdown(c.end_date, now)}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {state.status === "loading" && (
          <div className="wunder-glass rounded-2xl border border-white/10 py-24 text-center font-mono text-sm text-[#faf6e8]/60">
            SYNCHRONIZING ACTIVE ML COMPETITIONS TELEMETRY…
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-6 font-mono text-sm text-rose-200">
            Couldn&apos;t load <code>data/competitions.json</code> ({state.error}). Run <code>python -m scraper</code>{" "}
            first.
          </div>
        )}

        {state.status === "ready" && (
          <>
            {/* LLM-Powered AI Competition Recommender Section */}
            <AiRecommender all={all} now={now} onSelectCategory={handleSelectCategoryFromAi} />

            {/* Live Arena Section */}
            <section id="live-arena" className="space-y-4 pt-2">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-emerald-300/90">
                    // GLOBAL COMPETITION INDEX
                  </div>
                  <h2 className="font-display mt-1 text-3xl tracking-tight text-[#faf6e8] sm:text-4xl">
                    Live Competition Arena ({formatUSD(totalPrizePool)} Total Bounty)
                  </h2>
                </div>

                {/* Tab switcher */}
                <div className="wunder-pill inline-flex rounded-xl p-1 font-mono text-xs" role="tablist">
                  {(
                    [
                      ["table", "📋 Arena Index"],
                      ["insights", "📊 Telemetry & Charts"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => setTab(id)}
                      className={`rounded-lg px-4 py-1.5 font-medium transition ${
                        tab === id
                          ? "bg-[#faf6e8] text-[#111513] shadow"
                          : "text-[#faf6e8]/65 hover:text-[#faf6e8]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <StatCards rows={filtered} totalActive={totalActive} now={now} />
              <FilterBar all={all} filters={filters} setFilters={setFilters} resultCount={filtered.length} />

              {tab === "table" ? (
                <CompetitionTable rows={filtered} now={now} />
              ) : (
                <Charts rows={filtered} now={now} />
              )}

              <SourceStatus meta={state.data.meta} now={now} />
            </section>
          </>
        )}
      </div>

      {/* Floating Bottom Glowing Cream Pill CTA (wundernn.io signature) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-black/15 bg-[#faf6e8] p-1.5 font-mono text-xs font-semibold text-[#111513] wunder-cta-glow">
          <a
            href="#ai-matchmaker"
            className="rounded-full bg-[#111513] px-4 py-2 text-[#faf6e8] transition hover:bg-emerald-950"
          >
            ✦ AI Matchmaker
          </a>
          <a
            href="#live-arena"
            className="rounded-full px-4 py-2 text-[#111513] transition hover:bg-black/10"
          >
            Live Arena ({totalActive || 685}) →
          </a>
        </div>
      </div>
    </div>
  );
}
