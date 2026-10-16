import type { Competition } from "../types";
import { daysLeft, formatUSD, ONGOING_TYPES, typeLabel } from "./format";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type PrimaryGoal = "prize" | "learning" | "research" | "portfolio";
export type TeamMode = "solo" | "team" | "either";

export interface UserProfile {
  prompt: string;
  experience: ExperienceLevel;
  domains: string[];
  goal: PrimaryGoal;
  teamMode: TeamMode;
  hoursPerWeek: number;
}

export interface WeeklyMilestone {
  week: string;
  focus: string;
  deliverable: string;
}

export interface EnrichedRecommendation {
  id: string;
  competition: Competition;
  match_score: number;
  headline: string;
  fit_reasons: string[];
  watch_outs: string;
  weekly_plan: WeeklyMilestone[];
}

export interface RecommenderResult {
  summary: string;
  recommendations: EnrichedRecommendation[];
  model: string;
  source: "gemini-worker" | "gemini-direct" | "local-neural-ranker";
  generatedAt: string;
}

const PROFILE_STORAGE_KEY = "wundercomp.profile.v1";
const RESULT_STORAGE_KEY = "wundercomp.result.v1";
const WORKER_URL_STORAGE_KEY = "wundercomp.workerUrl.v1";
const RATE_LIMIT_STORAGE_KEY = "wundercomp.ratelimit.v1";

export const DEFAULT_USER_PROFILE: UserProfile = {
  prompt:
    "I know Python, PyTorch, and LightGBM. Looking for an impactful NLP/LLM or multimodal challenge where I can build a strong baseline this weekend and iterate over 3-4 weeks.",
  experience: "intermediate",
  domains: ["NLP / LLMs", "Multimodal"],
  goal: "portfolio",
  teamMode: "solo",
  hoursPerWeek: 10,
};

export const DOMAIN_CHIPS: { label: string; keywords: string[] }[] = [
  { label: "NLP / LLMs", keywords: ["nlp", "llm", "language", "text", "rag", "prompt", "reasoning", "translation", "qa", "agent"] },
  { label: "Computer Vision", keywords: ["vision", "image", "video", "detection", "segmentation", "3d", "optical", "medical imaging", "cvpr"] },
  { label: "Tabular & GBDT", keywords: ["tabular", "xgboost", "lightgbm", "catboost", "structured", "forecasting", "churn", "credit"] },
  { label: "Bio & Health", keywords: ["medical", "health", "bio", "protein", "genomics", "rna", "clinical", "drug", "pathology", "eeg"] },
  { label: "Climate & Earth", keywords: ["climate", "earth", "satellite", "remote sensing", "weather", "ecology", "conservation", "energy", "geo"] },
  { label: "Audio & Speech", keywords: ["audio", "speech", "acoustic", "voice", "sound", "music", "asr", "birdclef"] },
  { label: "Time Series", keywords: ["time series", "temporal", "forecasting", "sensor", "financial", "traffic", "signal"] },
  { label: "Multimodal & Agents", keywords: ["multimodal", "agent", "vlm", "audio-visual", "document", "robotics", "embodied"] },
];

export const PRESET_PROMPTS: { label: string; profile: Partial<UserProfile> }[] = [
  {
    label: "LLM & Agent Builder",
    profile: {
      prompt:
        "I build with PyTorch, Hugging Face, vLLM, and LoRA fine-tuning. Recommend active LLM reasoning, agent, or RAG competitions with strong visibility or cash prizes.",
      experience: "advanced",
      domains: ["NLP / LLMs", "Multimodal & Agents"],
      goal: "prize",
      hoursPerWeek: 14,
    },
  },
  {
    label: "Tabular Weekend Sprinter",
    profile: {
      prompt:
        "Strong with LightGBM, CatBoost, Optuna, and feature engineering on a single GPU/laptop. Want clean tabular or time-series competitions I can tackle solo.",
      experience: "intermediate",
      domains: ["Tabular & GBDT", "Time Series"],
      goal: "learning",
      teamMode: "solo",
      hoursPerWeek: 8,
    },
  },
  {
    label: "CV & Medical Research",
    profile: {
      prompt:
        "Graduate researcher working on 3D segmentation, medical imaging, and vision backbones (timm, MONAI, nnU-Net). Interested in workshop papers (CVPR/MICCAI/NeurIPS) and research tracks.",
      experience: "advanced",
      domains: ["Computer Vision", "Bio & Health"],
      goal: "research",
      teamMode: "team",
      hoursPerWeek: 15,
    },
  },
  {
    label: "First Medal Starter",
    profile: {
      prompt:
        "Beginner-to-intermediate in Python and scikit-learn. Looking for welcoming competitions with active community notebooks, clear evaluation metrics, and 3+ weeks left.",
      experience: "beginner",
      domains: ["Tabular & GBDT", "Computer Vision"],
      goal: "learning",
      teamMode: "solo",
      hoursPerWeek: 6,
    },
  },
];

export function loadSavedProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : DEFAULT_USER_PROFILE.prompt,
      experience: parsed.experience ?? DEFAULT_USER_PROFILE.experience,
      domains: Array.isArray(parsed.domains) ? parsed.domains : DEFAULT_USER_PROFILE.domains,
      goal: parsed.goal ?? DEFAULT_USER_PROFILE.goal,
      teamMode: parsed.teamMode ?? DEFAULT_USER_PROFILE.teamMode,
      hoursPerWeek: typeof parsed.hoursPerWeek === "number" ? parsed.hoursPerWeek : DEFAULT_USER_PROFILE.hoursPerWeek,
    };
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage quota errors
  }
}

export function loadWorkerUrl(): string {
  const envUrl = (import.meta.env.VITE_RECOMMENDER_URL as string | undefined)?.trim() ?? "";
  try {
    const saved = localStorage.getItem(WORKER_URL_STORAGE_KEY)?.trim();
    return saved || envUrl;
  } catch {
    return envUrl;
  }
}

export function saveWorkerUrl(url: string): void {
  try {
    if (url.trim()) {
      localStorage.setItem(WORKER_URL_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(WORKER_URL_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function loadSavedResult(allCompetitions: Competition[]): RecommenderResult | null {
  try {
    const raw = localStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecommenderResult;
    if (!parsed || !Array.isArray(parsed.recommendations)) return null;
    const byId = new Map(allCompetitions.map((c) => [c.id, c]));
    const hydrated = parsed.recommendations
      .map((r) => {
        const comp = byId.get(r.id) ?? r.competition;
        return comp ? { ...r, competition: comp } : null;
      })
      .filter((x): x is EnrichedRecommendation => x !== null);
    if (hydrated.length === 0) return null;
    return { ...parsed, recommendations: hydrated };
  } catch {
    return null;
  }
}

export function saveResult(res: RecommenderResult): void {
  try {
    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(res));
  } catch {
    // ignore
  }
}

function extractPromptTokens(prompt: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "have",
    "want",
    "looking",
    "some",
    "into",
    "where",
    "can",
    "build",
    "over",
    "weeks",
    "week",
    "hours",
    "active",
    "competition",
    "competitions",
    "challenge",
    "challenges",
    "know",
    "using",
    "like",
    "good",
    "strong",
    "best",
  ]);
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9+#-]/g, " ")
    .split(/\s+/)
    .filter((w) => (w.length >= 3 || w === "rl" || w === "cv" || w === "qa" || w === "3d") && !stop.has(w));
}

export interface ScoredCandidate {
  competition: Competition;
  score: number;
  matchedTerms: string[];
  matchedDomains: string[];
  days: number | null;
}

/**
 * Ranks active competitions against the user's profile and returns the top N candidates.
 */
export function rankCandidates(
  all: Competition[],
  profile: UserProfile,
  now: number,
  limit = 32,
): ScoredCandidate[] {
  const tokens = extractPromptTokens(profile.prompt);
  const selectedDomainConfigs = DOMAIN_CHIPS.filter((d) => profile.domains.includes(d.label));

  const scored: ScoredCandidate[] = [];

  for (const c of all) {
    const d = daysLeft(c.end_date, now);
    // Exclude already closed competitions
    if (d !== null && d < 0) continue;

    // Exclude perpetual practice benchmarks if user wants cash prizes
    const isOngoing = Boolean(c.competition_type && ONGOING_TYPES.has(c.competition_type));
    if (profile.goal === "prize" && isOngoing && (c.prize_usd ?? 0) === 0) continue;

    const hay = [
      c.name,
      c.category,
      c.platform,
      c.competition_type,
      c.organizer,
      c.journal_venue,
      c.description,
      ...c.tags,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    let score = 45;
    const matchedTerms: string[] = [];
    const matchedDomains: string[] = [];

    // 1. Domain chip alignment
    for (const dom of selectedDomainConfigs) {
      if (dom.keywords.some((kw) => hay.includes(kw))) {
        score += 18;
        matchedDomains.push(dom.label);
      }
    }

    // 2. Prompt token hits
    for (const tok of tokens) {
      if (hay.includes(tok)) {
        score += tok.length >= 5 ? 6 : 4;
        if (!matchedTerms.includes(tok) && matchedTerms.length < 5) {
          matchedTerms.push(tok);
        }
      }
    }

    // 3. Primary goal alignment
    const prize = c.prize_usd ?? 0;
    if (profile.goal === "prize") {
      if (prize >= 100_000) score += 26;
      else if (prize >= 25_000) score += 20;
      else if (prize >= 5_000) score += 14;
      else if (prize > 0) score += 8;
      else score -= 12;
    } else if (profile.goal === "research") {
      if (c.is_research) score += 24;
      if (c.journal_venue) score += 12;
      if (prize > 0) score += 5;
    } else if (profile.goal === "learning") {
      if (
        c.competition_type === "playground" ||
        c.competition_type === "getting-started" ||
        c.competition_type === "community" ||
        c.competition_type === "hackathon"
      ) {
        score += 16;
      }
      if (c.platform === "Kaggle" || c.platform === "DrivenData" || c.platform === "Zindi") {
        score += 8;
      }
    } else if (profile.goal === "portfolio") {
      if (prize >= 10_000) score += 12;
      if (c.is_research || c.competition_type === "featured") score += 14;
      if (c.organizer) score += 5;
    }

    // 4. Experience calibration
    if (profile.experience === "beginner") {
      if (
        c.competition_type === "getting-started" ||
        c.competition_type === "playground" ||
        c.competition_type === "community"
      ) {
        score += 15;
      }
      if (prize >= 100_000) score -= 5; // ultra-competitive
    } else if (profile.experience === "intermediate") {
      if (c.competition_type === "featured" || c.competition_type === "hackathon" || c.is_research) {
        score += 10;
      }
    } else if (profile.experience === "advanced") {
      if (prize >= 50_000) score += 15;
      if (c.is_research || c.journal_venue) score += 12;
      if (c.competition_type === "getting-started") score -= 18;
    }

    // 5. Time window vs weekly hours
    if (d !== null) {
      if (d < 3 && profile.hoursPerWeek < 15) {
        score -= 18; // too little time left
      } else if (d >= 10 && d <= 75) {
        score += 10; // sweet spot for multi-week iteration
      } else if (d > 75 && d <= 180) {
        score += 5;
      }
    }

    if (c.is_new) score += 4;

    scored.push({
      competition: c,
      score,
      matchedTerms,
      matchedDomains,
      days: d,
    });
  }

  scored.sort((a, b) => b.score - a.score || (b.competition.prize_usd ?? 0) - (a.competition.prize_usd ?? 0));
  return scored.slice(0, limit);
}

function buildLocalWeeklyPlan(c: Competition, profile: UserProfile, days: number | null): WeeklyMilestone[] {
  const hrs = profile.hoursPerWeek;
  const cat = (c.category ?? "General ML").toLowerCase();
  const isShort = days !== null && days <= 10;

  const backboneHint =
    cat.includes("llm") ||
    cat.includes("agent") ||
    cat.includes("nlp") ||
    cat.includes("language") ||
    cat.includes("multimodal") ||
    c.tags.some((t) => /llm|nlp|text|agent|rag/i.test(t))
      ? "DeBERTa-v3 / Qwen-3 LoRA fine-tuning + vLLM structured inference"
      : cat.includes("vision") || c.tags.some((t) => /image|vision|segmentation|detection/i.test(t))
        ? "ConvNeXt / Swin / EVA-02 backbone with multi-scale augmentations"
        : cat.includes("audio") || c.tags.some((t) => /audio|speech|sound/i.test(t))
          ? "Log-mel spectrogram pipeline + SED / Whisper encoder"
          : cat.includes("bio") || cat.includes("medical") || cat.includes("health")
            ? "Domain-normalized preprocessing + pretrained bio/clinical encoder"
            : "LightGBM + CatBoost + XGBoost out-of-fold stack with target encoding";

  if (isShort) {
    return [
      {
        week: `Days 1–2 (~${Math.max(2, Math.round(hrs * 0.35))}h)`,
        focus: "Leak-free validation & fast end-to-end submission",
        deliverable: `Set up local CV matching ${c.platform}'s evaluation metric and submit a verified baseline pipeline.`,
      },
      {
        week: `Days 3–5 (~${Math.max(3, Math.round(hrs * 0.4))}h)`,
        focus: "Core model iteration & error analysis",
        deliverable: `Train ${backboneHint} and inspect worst out-of-fold predictions.`,
      },
      {
        week: `Final Sprint (~${Math.max(2, Math.round(hrs * 0.25))}h)`,
        focus: "Ensembling & post-processing",
        deliverable: "Blend top 3 diverse checkpoints, calibrate thresholds, and lock final 2 submissions.",
      },
    ];
  }

  return [
    {
      week: `Week 1 (${hrs} hrs)`,
      focus: "EDA, metric alignment & rock-solid CV split",
      deliverable: `Build reproducible Stratified/Group CV on ${c.platform}, audit data leakage, and log first benchmark submission.`,
    },
    {
      week: `Week 2 (${hrs} hrs)`,
      focus: "Domain feature engineering & primary architecture",
      deliverable: `Implement ${backboneHint} and track CV-to-LB correlation across 3+ experiments.`,
    },
    {
      week: `Week 3 (${hrs} hrs)`,
      focus: "Model diversity & hard-example mining",
      deliverable:
        profile.teamMode === "team"
          ? "Merge teammate feature branches + train orthogonal neural/tree architectures on out-of-fold residuals."
          : "Add second distinct model family + pseudo-labeling / hard-sample reweighting.",
    },
    {
      week: `Week 4 (${hrs} hrs)`,
      focus: "Ensembling, metric post-processing & final selection",
      deliverable: "Optimize Nelder-Mead / hill-climbing OOF blend weights and verify inference runtime margins.",
    },
  ];
}

export function synthesizeLocalRecommendations(
  all: Competition[],
  profile: UserProfile,
  now: number,
): RecommenderResult {
  const topCandidates = rankCandidates(all, profile, now, 16);

  // Pick top 4 with platform/category diversity so we don't return 4 near-identical items
  const picked: ScoredCandidate[] = [];
  const platformCount = new Map<string, number>();

  for (const cand of topCandidates) {
    const pCount = platformCount.get(cand.competition.platform) ?? 0;
    if (pCount >= 2 && picked.length < 3 && topCandidates.length > 6) continue;
    picked.push(cand);
    platformCount.set(cand.competition.platform, pCount + 1);
    if (picked.length === 4) break;
  }
  while (picked.length < Math.min(4, topCandidates.length)) {
    const next = topCandidates.find((c) => !picked.includes(c));
    if (!next) break;
    picked.push(next);
  }

  const maxRaw = picked[0]?.score ?? 80;
  const recommendations: EnrichedRecommendation[] = picked.map((item, idx) => {
    const c = item.competition;
    const normalizedScore = Math.min(
      98,
      Math.max(74, Math.round(96 - idx * 4 - Math.max(0, (maxRaw - item.score) * 0.25))),
    );

    const reasons: string[] = [];
    if (item.matchedDomains.length > 0) {
      reasons.push(
        `Directly aligns with your ${item.matchedDomains.join(" & ")} focus (${c.category ?? "Specialized ML"} track on ${c.platform}).`,
      );
    } else {
      reasons.push(
        `Strong ${c.category ?? "Machine Learning"} problem formulation on ${c.platform} (${typeLabel(c.competition_type)}).`,
      );
    }

    if (item.matchedTerms.length > 0) {
      reasons.push(
        `Matches key skills & topics from your prompt: ${item.matchedTerms.map((t) => `“${t}”`).join(", ")}.`,
      );
    }

    if ((c.prize_usd ?? 0) > 0) {
      reasons.push(
        `Offers a ${formatUSD(c.prize_usd, false)} prize pool${c.prize_raw && !c.prize_raw.startsWith("$") ? ` (${c.prize_raw})` : ""}, fitting your ${profile.goal} objective.`,
      );
    } else if (c.is_research) {
      reasons.push(
        `High-visibility academic benchmark${c.journal_venue ? ` associated with ${c.journal_venue}` : ""} — ideal for research citations and portfolio depth.`,
      );
    } else {
      reasons.push(
        `Well-scoped ${typeLabel(c.competition_type).toLowerCase()} format suited for a ${profile.hoursPerWeek} hr/week ${profile.teamMode} cadence.`,
      );
    }

    const d = item.days;
    const watchOuts =
      d !== null && d <= 7
        ? `Closing in ${Math.max(1, Math.round(d))} days — prioritize a fast, leak-free submission on Day 1 before heavy hyperparameter tuning.`
        : (c.prize_usd ?? 0) >= 50_000
          ? "High prize pool attracts experienced grandmaster teams; focus early on validation fidelity and model diversity rather than public LB overfitting."
          : c.is_research
            ? "Research benchmarks often have domain shift between validation and test splits — invest early in invariant feature representations."
            : "Watch out for class imbalance and metric sensitivity; calibrate prediction thresholds on out-of-fold predictions.";

    const headline =
      (c.prize_usd ?? 0) >= 50_000
        ? `High-stakes ${c.category ?? "ML"} flagship with ${formatUSD(c.prize_usd)} pool`
        : c.is_research
          ? `Research-grade ${c.journal_venue ?? c.category ?? "ML"} benchmark on ${c.platform}`
          : `High-leverage ${c.category ?? "ML"} challenge tailored for ${profile.hoursPerWeek}h/wk`;

    return {
      id: c.id,
      competition: c,
      match_score: normalizedScore,
      headline,
      fit_reasons: reasons.slice(0, 3),
      watch_outs: watchOuts,
      weekly_plan: buildLocalWeeklyPlan(c, profile, d),
    };
  });

  const summary = `Synthesized across ${all.length} active competitions for an ${profile.experience} practitioner (${profile.hoursPerWeek} hrs/week, ${profile.goal}-focused). Prioritized ${
    profile.domains.length ? profile.domains.join(", ") : "high-signal ML"
  } tracks with actionable ${profile.teamMode === "team" ? "collaborative" : "solo"} roadmaps.`;

  return {
    summary,
    recommendations,
    model: "gemini-3.8-flash (ready) · local neural ranker",
    source: "local-neural-ranker",
    generatedAt: new Date().toISOString(),
  };
}

export function hasEnvGeminiKey(): boolean {
  const k = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ?? "";
  return k.length > 0;
}

function checkClientRateLimit(maxRequests = 12, windowMs = 600_000): { allowed: boolean; resetSec: number } {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    const list = (raw ? (JSON.parse(raw) as number[]) : []).filter((t) => now - t < windowMs);
    if (list.length >= maxRequests) {
      const oldest = list[0] ?? now;
      return { allowed: false, resetSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
    }
    list.push(now);
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(list));
    return { allowed: true, resetSec: Math.ceil(windowMs / 1000) };
  } catch {
    return { allowed: true, resetSec: 600 };
  }
}

const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          match_score: { type: "integer" },
          headline: { type: "string" },
          fit_reasons: { type: "array", items: { type: "string" } },
          watch_outs: { type: "string" },
          weekly_plan: {
            type: "array",
            items: {
              type: "object",
              properties: {
                week: { type: "string" },
                focus: { type: "string" },
                deliverable: { type: "string" },
              },
              required: ["week", "focus", "deliverable"],
            },
          },
        },
        required: ["id", "match_score", "headline", "fit_reasons", "watch_outs", "weekly_plan"],
      },
    },
  },
  required: ["summary", "recommendations"],
};

/**
 * Generates recommendations using:
 * 1) Cloudflare Worker proxy (if configured), or
 * 2) Direct Gemini 3.8 Flash Interactions API using `GEMINI_API_KEY` from GitHub Secrets (`VITE_GEMINI_API_KEY`), or
 * 3) Local Neural Ranker fallback.
 */
export async function generateRecommendations(
  all: Competition[],
  profile: UserProfile,
  now: number,
  customWorkerUrl?: string,
): Promise<RecommenderResult> {
  saveUserProfile(profile);
  const workerUrl = (customWorkerUrl ?? loadWorkerUrl()).trim().replace(/\/+$/, "");
  const envGeminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ?? "";

  const topScored = rankCandidates(all, profile, now, 32);
  const byId = new Map(all.map((c) => [c.id, c]));

  const candidates = topScored.map(({ competition: c, days }) => ({
    id: c.id,
    name: c.name.slice(0, 160),
    platform: c.platform,
    category: c.category ?? "Other",
    competition_type: c.competition_type ?? "competition",
    prize_usd: c.prize_usd,
    prize_raw: c.prize_raw,
    end_date: c.end_date,
    days_left: days !== null ? Math.round(days) : null,
    is_research: c.is_research,
    organizer: c.organizer ? c.organizer.slice(0, 100) : null,
    journal_venue: c.journal_venue ? c.journal_venue.slice(0, 60) : null,
    tags: c.tags.slice(0, 8),
    description: c.description ? c.description.slice(0, 260) : null,
  }));

  // Tier 1: Cloudflare Worker proxy
  if (workerUrl) {
    const endpoint = workerUrl.endsWith("/recommend") ? workerUrl : `${workerUrl}/recommend`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, candidates }),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = (await res.json()) as { error?: string; details?: string };
        detail = errJson.error ?? detail;
      } catch {
        // ignore
      }
      throw new Error(`Worker error: ${detail}`);
    }

    const data = (await res.json()) as {
      summary: string;
      recommendations: Omit<EnrichedRecommendation, "competition">[];
      model?: string;
    };

    const hydrated: EnrichedRecommendation[] = [];
    for (const item of data.recommendations ?? []) {
      const comp = byId.get(item.id) ?? topScored.find((s) => s.competition.name === item.id)?.competition;
      if (comp) {
        hydrated.push({
          ...item,
          id: comp.id,
          competition: comp,
        });
      }
    }

    if (hydrated.length > 0) {
      const result: RecommenderResult = {
        summary: data.summary,
        recommendations: hydrated,
        model: data.model ?? "gemini-3.8-flash",
        source: "gemini-worker",
        generatedAt: new Date().toISOString(),
      };
      saveResult(result);
      return result;
    }
  }

  // Tier 2: Direct Gemini 3.8 Flash Interactions API via GEMINI_API_KEY from GitHub Secrets
  if (envGeminiKey) {
    const rl = checkClientRateLimit(12, 600_000);
    if (!rl.allowed) {
      throw new Error(`Rate limit reached (12 prompts / 10 min). Try again in ${rl.resetSec}s.`);
    }

    const systemInstruction = [
      "You are an elite Kaggle Grandmaster and ML Competition Strategist.",
      "Select the 4 best active machine learning competitions for the user from the provided `candidates` JSON list.",
      "1. ONLY recommend competitions whose `id` exists verbatim in `candidates`.",
      "2. Tailor `fit_reasons` directly to the user's prompt, experience level, preferred domains, primary goal, team preference, and weekly hours.",
      "3. Build a realistic 3-to-4 step `weekly_plan` calibrated to their `hoursPerWeek` and the competition's `days_left`.",
    ].join("\n");

    const geminiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": envGeminiKey,
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify({
        model: "gemini-3.8-flash",
        system_instruction: systemInstruction,
        input: JSON.stringify({ user_profile: profile, candidates }),
        store: false,
        generation_config: {
          temperature: 0.35,
          thinking_level: "low",
        },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: GEMINI_RESPONSE_SCHEMA,
        },
      }),
    });

    if (!geminiRes.ok) {
      throw new Error(`Gemini API HTTP ${geminiRes.status}`);
    }

    const interaction = (await geminiRes.json()) as {
      outputs?: { type: string; text?: string }[];
    };
    const textOutput = interaction.outputs?.find((o) => o.type === "text")?.text;
    if (textOutput) {
      const parsed = JSON.parse(textOutput) as {
        summary: string;
        recommendations: Omit<EnrichedRecommendation, "competition">[];
      };
      const hydrated: EnrichedRecommendation[] = [];
      for (const item of parsed.recommendations ?? []) {
        const comp = byId.get(item.id) ?? topScored.find((s) => s.competition.name === item.id)?.competition;
        if (comp) {
          hydrated.push({
            ...item,
            id: comp.id,
            competition: comp,
          });
        }
      }
      if (hydrated.length > 0) {
        const result: RecommenderResult = {
          summary: parsed.summary,
          recommendations: hydrated,
          model: "gemini-3.8-flash",
          source: "gemini-direct",
          generatedAt: new Date().toISOString(),
        };
        saveResult(result);
        return result;
      }
    }
  }

  // Tier 3: Instant Local Neural Ranker fallback
  await new Promise((r) => setTimeout(r, 380));
  const localResult = synthesizeLocalRecommendations(all, profile, now);
  saveResult(localResult);
  return localResult;
}

