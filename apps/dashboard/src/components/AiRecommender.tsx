import { useEffect, useState } from "react";
import type { Competition } from "../types";
import { countdown, formatDate, formatUSD, platformColor, typeLabel } from "../lib/format";
import {
  DEFAULT_USER_PROFILE,
  DOMAIN_CHIPS,
  generateRecommendations,
  loadSavedProfile,
  loadSavedResult,
  loadWorkerUrl,
  PRESET_PROMPTS,
  saveUserProfile,
  saveWorkerUrl,
  synthesizeLocalRecommendations,
  type EnrichedRecommendation,
  type ExperienceLevel,
  type PrimaryGoal,
  type RecommenderResult,
  type TeamMode,
  type UserProfile,
} from "../lib/recommender";

interface Props {
  all: Competition[];
  now: number;
  onSelectCategory?: (category: string) => void;
}

function MatchTickBar({ score }: { score: number }) {
  const totalTicks = 18;
  const filled = Math.round((score / 100) * totalTicks);
  return (
    <div className="inline-flex items-center gap-[2px]" aria-hidden="true">
      {Array.from({ length: totalTicks }).map((_, i) => (
        <span
          key={i}
          className={`inline-block h-3 w-[2.5px] rounded-[1px] ${
            i < filled
              ? score >= 90
                ? "bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.7)]"
                : "bg-[#faf6e8]"
              : "bg-white/15"
          }`}
        />
      ))}
    </div>
  );
}

export function AiRecommender({ all, now, onSelectCategory }: Props) {
  const [profile, setProfile] = useState<UserProfile>(() => loadSavedProfile());
  const [workerUrl, setWorkerUrl] = useState<string>(() => loadWorkerUrl());
  const [showWorkerConfig, setShowWorkerConfig] = useState(false);
  const [result, setResult] = useState<RecommenderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [profileSavedToast, setProfileSavedToast] = useState(false);

  // Hydrate or synthesize initial recommendations once dataset is ready
  useEffect(() => {
    if (all.length === 0) return;
    const cached = loadSavedResult(all);
    if (cached && cached.recommendations.length > 0) {
      setResult(cached);
      setOpenPlanId(cached.recommendations[0]?.id ?? null);
    } else {
      const initial = synthesizeLocalRecommendations(all, profile, now);
      setResult(initial);
      setOpenPlanId(initial.recommendations[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.length]);

  const updateProfile = (patch: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveUserProfile(next);
      setProfileSavedToast(true);
      window.setTimeout(() => setProfileSavedToast(false), 1800);
      return next;
    });
  };

  const toggleDomain = (domainLabel: string) => {
    const exists = profile.domains.includes(domainLabel);
    const nextDomains = exists
      ? profile.domains.filter((d) => d !== domainLabel)
      : [...profile.domains, domainLabel];
    updateProfile({ domains: nextDomains });
  };

  const handleRunRecommender = async (overrideProfile?: UserProfile) => {
    const activeProfile = overrideProfile ?? profile;
    setLoading(true);
    setError(null);
    try {
      const res = await generateRecommendations(all, activeProfile, now, workerUrl);
      setResult(res);
      if (res.recommendations[0]) {
        setOpenPlanId(res.recommendations[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`${msg} — Showing Local Neural Ranker results instead.`);
      const fallback = synthesizeLocalRecommendations(all, activeProfile, now);
      setResult(fallback);
      if (fallback.recommendations[0]) {
        setOpenPlanId(fallback.recommendations[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (preset: { label: string; profile: Partial<UserProfile> }) => {
    const merged: UserProfile = {
      ...profile,
      ...preset.profile,
    };
    setProfile(merged);
    saveUserProfile(merged);
    void handleRunRecommender(merged);
  };

  const handleResetProfile = () => {
    setProfile(DEFAULT_USER_PROFILE);
    saveUserProfile(DEFAULT_USER_PROFILE);
    void handleRunRecommender(DEFAULT_USER_PROFILE);
  };

  return (
    <section
      id="ai-matchmaker"
      aria-label="AI Competition Matchmaker"
      className="wunder-glass relative overflow-hidden rounded-2xl border border-white/12 p-5 sm:p-7"
    >
      {/* Subtle top ambient glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[75%] -translate-x-1/2 rounded-full opacity-35 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(110,231,183,0.45) 0%, rgba(250,246,232,0.18) 55%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* Header bar */}
      <div className="relative flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest text-emerald-300/90">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span>NEURAL MATCHMAKER // GEMINI 3.8 FLASH</span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-[#faf6e8]/75">
              {profileSavedToast ? "✓ PROFILE SAVED IN BROWSER" : "MEMORY: LOCALSTORAGE ACTIVE"}
            </span>
          </div>
          <h2 className="font-display mt-2 text-3xl tracking-tight text-[#faf6e8] sm:text-4xl">
            Prompt-to-Podium Competition Strategist
          </h2>
          <p className="mt-1 max-w-3xl font-mono text-xs leading-relaxed text-[#faf6e8]/65">
            Describe your stack, research interests, or hardware constraints. Our synthesis engine ranks all{" "}
            <span className="text-[#faf6e8]">{all.length}</span> live competitions, explains{" "}
            <span className="text-emerald-300">why each fits</span>, and generates a week-by-week execution plan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setShowWorkerConfig((s) => !s)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[#faf6e8]/80 transition hover:border-white/30 hover:bg-white/10"
          >
            {workerUrl ? "⚡ Proxy: Connected" : "⚙ Configure Gemini Worker"}
          </button>
          <button
            type="button"
            onClick={handleResetProfile}
            className="rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-[#faf6e8]/55 transition hover:border-white/25 hover:text-[#faf6e8]"
          >
            Reset Profile
          </button>
        </div>
      </div>

      {/* Optional Cloudflare Worker URL configuration drawer */}
      {showWorkerConfig && (
        <div className="mt-4 rounded-xl border border-emerald-400/25 bg-[#0c1310]/90 p-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-emerald-300">
              Cloudflare Worker Endpoint (Gemini 3.8 Flash Proxy)
            </span>
            <span className="text-[11px] text-[#faf6e8]/55">
              Source code in <code>workers/recommender/</code> · Rate-limited per IP
            </span>
          </div>
          <p className="mt-1 text-[#faf6e8]/65">
            Paste your deployed Cloudflare Worker URL (e.g.{" "}
            <code>https://active-ml-competitions-recommender.&lt;subdomain&gt;.workers.dev</code>). When blank, the
            dashboard uses its instant client-side Neural Ranker + Roadmap Synthesizer so it works out of the box.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="url"
              value={workerUrl}
              onChange={(e) => {
                setWorkerUrl(e.target.value);
                saveWorkerUrl(e.target.value);
              }}
              placeholder="https://active-ml-competitions-recommender.your-name.workers.dev"
              aria-label="Cloudflare Worker URL"
              className="h-9 flex-1 rounded-lg border border-white/15 bg-black/50 px-3 font-mono text-xs text-[#faf6e8] outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={() => {
                setShowWorkerConfig(false);
                void handleRunRecommender();
              }}
              className="h-9 rounded-lg bg-emerald-400/20 px-4 font-mono text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-400/30"
            >
              Save & Test
            </button>
          </div>
        </div>
      )}

      {/* Main interactive grid: Left = Prompt & Preference Chips, Right = Recommendations */}
      <div className="mt-6 grid gap-6 xl:grid-cols-12">
        {/* Left column: Prompt + Quick Preference Chips */}
        <div className="space-y-5 xl:col-span-5">
          {/* Archetype quick-load pills */}
          <div>
            <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-[#faf6e8]/55">
              <span>01 // Quick Archetypes</span>
              <span>Click to load</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PROMPTS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 font-mono text-xs text-[#faf6e8]/85 transition hover:border-emerald-300/50 hover:bg-emerald-400/10 hover:text-[#faf6e8]"
                >
                  ✦ {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Free-text prompt */}
          <div>
            <label
              htmlFor="recommender-prompt"
              className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-[#faf6e8]/55"
            >
              02 // Your Skills, Stack & Mission Prompt
            </label>
            <textarea
              id="recommender-prompt"
              rows={4}
              value={profile.prompt}
              onChange={(e) => updateProfile({ prompt: e.target.value })}
              placeholder="e.g., I have 10 hrs/week, a single RTX 4090, and strong PyTorch + tabular experience. Recommend competitions where feature engineering or LoRA fine-tuning can win a medal..."
              className="w-full rounded-xl border border-white/15 bg-black/45 p-3.5 font-mono text-xs leading-relaxed text-[#faf6e8] placeholder-[#faf6e8]/35 outline-none transition focus:border-emerald-300/60 focus:ring-1 focus:ring-emerald-300/40"
            />
          </div>

          {/* Domain preference chips */}
          <div>
            <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-[#faf6e8]/55">
              <span>03 // Preferred Domains</span>
              <span>{profile.domains.length} selected</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DOMAIN_CHIPS.map((d) => {
                const active = profile.domains.includes(d.label);
                return (
                  <button
                    key={d.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDomain(d.label)}
                    className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition ${
                      active
                        ? "border-emerald-300/70 bg-emerald-400/20 text-emerald-200 shadow-[0_0_15px_rgba(52,211,153,0.2)]"
                        : "border-white/10 bg-white/[0.03] text-[#faf6e8]/65 hover:border-white/25 hover:text-[#faf6e8]"
                    }`}
                  >
                    {active ? "● " : "○ "}
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Experience, Goal, Team Mode & Weekly Hours */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Experience */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#faf6e8]/50">Experience Level</div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {(["beginner", "intermediate", "advanced"] as ExperienceLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => updateProfile({ experience: lvl })}
                    className={`rounded-md py-1.5 font-mono text-[11px] capitalize transition ${
                      profile.experience === lvl
                        ? "bg-[#faf6e8] font-semibold text-[#111513]"
                        : "bg-white/5 text-[#faf6e8]/65 hover:bg-white/10"
                    }`}
                  >
                    {lvl === "intermediate" ? "Interm." : lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Goal */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#faf6e8]/50">Primary Objective</div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {(
                  [
                    ["prize", "💰 Prize"],
                    ["learning", "📈 Learn"],
                    ["research", "🎓 Paper"],
                    ["portfolio", "🚀 Portfolio"],
                  ] as [PrimaryGoal, string][]
                ).map(([g, label]) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => updateProfile({ goal: g })}
                    className={`rounded-md py-1 font-mono text-[11px] transition ${
                      profile.goal === g
                        ? "bg-[#faf6e8] font-semibold text-[#111513]"
                        : "bg-white/5 text-[#faf6e8]/65 hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Team Mode */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#faf6e8]/50">Squad Mode</div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {(
                  [
                    ["solo", "Solo"],
                    ["team", "Team"],
                    ["either", "Either"],
                  ] as [TeamMode, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateProfile({ teamMode: mode })}
                    className={`rounded-md py-1.5 font-mono text-[11px] transition ${
                      profile.teamMode === mode
                        ? "bg-[#faf6e8] font-semibold text-[#111513]"
                        : "bg-white/5 text-[#faf6e8]/65 hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hours / Week */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[#faf6e8]/50">
                <span>Time Budget</span>
                <span className="font-bold text-emerald-300">{profile.hoursPerWeek} hrs / wk</span>
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1">
                {[4, 8, 10, 15, 25].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => updateProfile({ hoursPerWeek: hrs })}
                    className={`rounded-md py-1.5 font-mono text-[11px] transition ${
                      profile.hoursPerWeek === hrs
                        ? "bg-[#faf6e8] font-semibold text-[#111513]"
                        : "bg-white/5 text-[#faf6e8]/65 hover:bg-white/10"
                    }`}
                  >
                    {hrs}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Glowing Cream CTA Button (wundernn.io signature style) */}
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleRunRecommender()}
            className="wunder-cta-glow flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#faf6e8] px-5 py-3.5 font-mono text-sm font-semibold text-[#111513] transition hover:bg-white disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#111513] border-t-transparent" />
                <span>Synthesizing Competition Matches & Roadmaps…</span>
              </>
            ) : (
              <>
                <span>Synthesize My Competition Portfolio</span>
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>

          {error && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-mono text-xs text-amber-200">
              {error}
            </div>
          )}
        </div>

        {/* Right column: Synthesized Recommendations + Weekly Plans */}
        <div className="space-y-4 xl:col-span-7">
          {result && (
            <>
              {/* Strategic summary banner */}
              <div className="rounded-xl border border-white/12 bg-black/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-wider text-emerald-300">
                  <span>// STRATEGIC BRIEFING</span>
                  <span className="text-[#faf6e8]/55">ENGINE: {result.model.toUpperCase()}</span>
                </div>
                <p className="mt-1.5 font-mono text-xs leading-relaxed text-[#faf6e8]/85">{result.summary}</p>
              </div>

              {/* Recommendation cards */}
              <div className="space-y-3.5">
                {result.recommendations.map((rec, index) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    rank={index + 1}
                    now={now}
                    isOpenPlan={openPlanId === rec.id}
                    onTogglePlan={() => setOpenPlanId(openPlanId === rec.id ? null : rec.id)}
                    onSelectCategory={onSelectCategory}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function RecommendationCard({
  rec,
  rank,
  now,
  isOpenPlan,
  onTogglePlan,
  onSelectCategory,
}: {
  rec: EnrichedRecommendation;
  rank: number;
  now: number;
  isOpenPlan: boolean;
  onTogglePlan: () => void;
  onSelectCategory?: (category: string) => void;
}) {
  const c = rec.competition;
  const pColor = platformColor(c.platform);

  return (
    <article className="rounded-xl border border-white/12 bg-[#0d1411]/90 p-4 transition hover:border-white/25 sm:p-5">
      {/* Top row: Rank, Title, Platform, Match Score */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="rounded bg-[#faf6e8] px-1.5 py-0.5 font-bold text-[#111513]">0{rank}</span>
            <span
              className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: `${pColor}24`, color: pColor }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pColor }} />
              {c.platform}
            </span>
            {c.category && (
              <button
                type="button"
                onClick={() => onSelectCategory?.(c.category!)}
                className="rounded border border-white/12 bg-white/5 px-2 py-0.5 text-[11px] text-[#faf6e8]/75 hover:border-white/30 hover:text-[#faf6e8]"
                title="Filter table by this category"
              >
                {c.category}
              </button>
            )}
            <span className="text-[11px] text-[#faf6e8]/50">· {typeLabel(c.competition_type)}</span>
            {c.is_research && (
              <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] text-sky-300">
                🎓 {c.journal_venue ?? "Research"}
              </span>
            )}
          </div>

          <h3 className="mt-2 text-lg font-semibold leading-snug text-[#faf6e8]">
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-300 hover:underline"
            >
              {c.name}
            </a>
          </h3>
          <p className="mt-0.5 font-mono text-xs text-emerald-300/90">{rec.headline}</p>
        </div>

        {/* Right metrics: Match Score + Prize + Deadline */}
        <div className="flex flex-col items-end gap-1.5 font-mono">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1">
            <MatchTickBar score={rec.match_score} />
            <span className="text-xs font-bold text-emerald-300">{rec.match_score}% FIT</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className={c.prize_usd ? "font-semibold text-[#faf6e8]" : "text-[#faf6e8]/50"}>
              {c.prize_usd ? formatUSD(c.prize_usd) : c.prize_raw ?? "Knowledge / Medal"}
            </span>
            <span className="text-[#faf6e8]/30">|</span>
            <span className="text-[#faf6e8]/75" title={formatDate(c.end_date)}>
              ⏳ {countdown(c.end_date, now)}
            </span>
          </div>
        </div>
      </div>

      {/* WHY IT FITS bullets */}
      <div className="mt-3.5 rounded-lg border border-white/8 bg-black/35 p-3">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#faf6e8]/55">
          WHY THIS FITS YOUR PROFILE
        </div>
        <ul className="mt-1.5 space-y-1 font-mono text-xs text-[#faf6e8]/85">
          {rec.fit_reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-400">▸</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2.5 flex items-start gap-2 border-t border-white/8 pt-2 font-mono text-[11px] text-amber-200/85">
          <span className="shrink-0 uppercase text-amber-400">[Watch Out]</span>
          <span>{rec.watch_outs}</span>
        </div>
      </div>

      {/* Action bar + Weekly Plan Toggle */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
        <button
          type="button"
          onClick={onTogglePlan}
          aria-expanded={isOpenPlan}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[#faf6e8]/85 transition hover:border-emerald-300/40 hover:bg-white/10"
        >
          <span>{isOpenPlan ? "▾ Hide" : "▸ View"} Suggested Weekly Plan</span>
          <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] text-emerald-300">
            {rec.weekly_plan.length} phases
          </span>
        </button>

        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#faf6e8]/10 px-3 py-1.5 font-medium text-[#faf6e8] ring-1 ring-white/15 transition hover:bg-[#faf6e8] hover:text-[#111513]"
        >
          <span>Launch Competition</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>

      {/* Collapsible Weekly Execution Plan */}
      {isOpenPlan && (
        <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {rec.weekly_plan.map((step, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-white/10 bg-black/50 p-2.5 font-mono text-xs"
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-emerald-300">
                <span>{step.week}</span>
                <span className="text-[#faf6e8]/35">0{idx + 1}</span>
              </div>
              <div className="mt-1 font-semibold text-[#faf6e8]">{step.focus}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#faf6e8]/65">{step.deliverable}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

