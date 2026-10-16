/**
 * Cloudflare Worker: Active ML Competitions AI Matchmaker Proxy
 *
 * Holds the user's GEMINI_API_KEY in Cloudflare secrets, enforces per-IP
 * sliding-window rate limiting, and calls Gemini 3.8 Flash via the May 2026
 * Interactions API (`/v1beta/interactions`) with structured JSON output.
 */

export interface Env {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGIN?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
}

export interface UserProfilePayload {
  prompt: string;
  experience: "beginner" | "intermediate" | "advanced";
  domains: string[];
  goal: "prize" | "learning" | "research" | "portfolio";
  teamMode: "solo" | "team" | "either";
  hoursPerWeek: number;
}

export interface CandidateCompetition {
  id: string;
  name: string;
  platform: string;
  category: string | null;
  competition_type: string | null;
  prize_usd: number | null;
  prize_raw: string | null;
  end_date: string | null;
  days_left: number | null;
  is_research: boolean;
  organizer: string | null;
  journal_venue: string | null;
  tags: string[];
  description: string | null;
}

export interface RecommendRequestBody {
  profile: UserProfilePayload;
  candidates: CandidateCompetition[];
}

export interface WeeklyMilestone {
  week: string;
  focus: string;
  deliverable: string;
}

export interface RecommendationItem {
  id: string;
  match_score: number;
  headline: string;
  fit_reasons: string[];
  watch_outs: string;
  weekly_plan: WeeklyMilestone[];
}

export interface RecommendationResponse {
  summary: string;
  recommendations: RecommendationItem[];
  model: string;
  source: "gemini-worker";
}

interface InteractionOutputBlock {
  type: string;
  text?: string;
}

interface InteractionResponse {
  id?: string;
  outputs?: InteractionOutputBlock[];
  error?: { message?: string; code?: number };
}

// In-memory sliding-window rate limiter per isolate
const ipBuckets = new Map<string, number[]>();

function checkRateLimit(
  ip: string,
  maxRequests: number,
  windowSeconds: number,
): { allowed: boolean; remaining: number; resetSeconds: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const timestamps = (ipBuckets.get(ip) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] ?? now;
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    ipBuckets.set(ip, timestamps);
    return { allowed: false, remaining: 0, resetSeconds };
  }

  timestamps.push(now);
  ipBuckets.set(ip, timestamps);

  // Periodic cleanup if map grows large
  if (ipBuckets.size > 2000) {
    for (const [k, v] of ipBuckets.entries()) {
      const active = v.filter((t) => now - t < windowMs);
      if (active.length === 0) ipBuckets.delete(k);
      else ipBuckets.set(k, active);
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - timestamps.length),
    resetSeconds: windowSeconds,
  };
}

function corsHeaders(origin: string | null, allowedOriginConfig = "*"): Record<string, string> {
  const allowed =
    allowedOriginConfig === "*"
      ? "*"
      : allowedOriginConfig
          .split(",")
          .map((s) => s.trim())
          .includes(origin ?? "")
        ? (origin ?? "*")
        : allowedOriginConfig.split(",")[0].trim();

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "A concise 2-sentence strategic synthesis addressed directly to the user explaining how their skills, weekly time budget, and goals map to the current active competition landscape.",
    },
    recommendations: {
      type: "array",
      description: "Top 3 to 5 recommended active ML competitions ordered by best overall fit.",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Exact competition id from the provided candidate list.",
          },
          match_score: {
            type: "integer",
            description: "Match percentage from 65 to 99 reflecting alignment with skills, domain, goal, and time budget.",
          },
          headline: {
            type: "string",
            description: "Short punchy 5-10 word tagline for why this is a standout pick for the user.",
          },
          fit_reasons: {
            type: "array",
            items: { type: "string" },
            description: "3 specific bullet points explaining WHY this competition fits the user's prompt, skills, and constraints.",
          },
          watch_outs: {
            type: "string",
            description: "1 honest caveat or key technical bottleneck to watch out for (e.g. compute requirements, tight deadline, noisy metric).",
          },
          weekly_plan: {
            type: "array",
            description: "A concrete 3-to-4 step weekly execution roadmap tailored to the user's hoursPerWeek and the competition's remaining time.",
            items: {
              type: "object",
              properties: {
                week: { type: "string", description: "e.g. 'Week 1 (8 hrs)' or 'Days 1-3'" },
                focus: { type: "string", description: "Core technical focus for this phase" },
                deliverable: { type: "string", description: "Concrete milestone / pipeline artifact to complete" },
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const baseCors = corsHeaders(origin, env.ALLOWED_ORIGIN ?? "*");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: baseCors });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return Response.json(
        {
          ok: true,
          service: "active-ml-competitions-recommender",
          model: "gemini-3.8-flash",
          api: "interactions-2026-05-20",
          configured: Boolean(env.GEMINI_API_KEY),
        },
        { headers: baseCors },
      );
    }

    if (request.method !== "POST" || (url.pathname !== "/recommend" && url.pathname !== "/")) {
      return Response.json(
        { error: "Not found. Send POST /recommend with { profile, candidates }." },
        { status: 404, headers: baseCors },
      );
    }

    if (!env.GEMINI_API_KEY) {
      return Response.json(
        {
          error:
            "GEMINI_API_KEY is not configured on the Cloudflare Worker. Run `npx wrangler secret put GEMINI_API_KEY`.",
        },
        { status: 503, headers: baseCors },
      );
    }

    const clientIp =
      request.headers.get("CF-Connecting-IP") ??
      request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
      "anonymous";
    const maxReq = Number.parseInt(env.RATE_LIMIT_MAX_REQUESTS ?? "12", 10) || 12;
    const windowSec = Number.parseInt(env.RATE_LIMIT_WINDOW_SECONDS ?? "600", 10) || 600;
    const rate = checkRateLimit(clientIp, maxReq, windowSec);

    const rateHeaders = {
      ...baseCors,
      "X-RateLimit-Limit": String(maxReq),
      "X-RateLimit-Remaining": String(rate.remaining),
      "X-RateLimit-Reset": String(rate.resetSeconds),
    };

    if (!rate.allowed) {
      return Response.json(
        {
          error: `Rate limit exceeded (${maxReq} requests per ${Math.round(windowSec / 60)} minutes). Try again in ${rate.resetSeconds}s.`,
        },
        { status: 429, headers: rateHeaders },
      );
    }

    let body: RecommendRequestBody;
    try {
      body = (await request.json()) as RecommendRequestBody;
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400, headers: rateHeaders });
    }

    if (!body?.profile || !Array.isArray(body?.candidates) || body.candidates.length === 0) {
      return Response.json(
        { error: "Request must include `profile` and a non-empty `candidates` array." },
        { status: 400, headers: rateHeaders },
      );
    }

    const candidates = body.candidates.slice(0, 40).map((c) => ({
      id: String(c.id),
      name: String(c.name).slice(0, 160),
      platform: String(c.platform),
      category: c.category ?? "Other",
      type: c.competition_type ?? "competition",
      prize_usd: c.prize_usd,
      prize_raw: c.prize_raw,
      end_date: c.end_date,
      days_left: c.days_left !== null && c.days_left !== undefined ? Math.round(c.days_left) : null,
      is_research: Boolean(c.is_research),
      organizer: c.organizer ? String(c.organizer).slice(0, 100) : null,
      venue: c.journal_venue ? String(c.journal_venue).slice(0, 60) : null,
      tags: Array.isArray(c.tags) ? c.tags.slice(0, 8) : [],
      description: c.description ? String(c.description).slice(0, 260) : null,
    }));

    const systemInstruction = [
      "You are an elite Kaggle Grandmaster and ML Competition Strategist.",
      "Your task is to select the 4 best active machine learning competitions for the user from the provided `candidates` JSON list.",
      "Rules:",
      "1. ONLY recommend competitions whose `id` exists verbatim in the `candidates` list.",
      "2. Tailor `fit_reasons` directly to the user's free-text prompt, experience level, preferred domains, primary goal, team preference, and weekly hours.",
      "3. Build a realistic, high-leverage `weekly_plan` (3 or 4 phases) calibrated to their `hoursPerWeek` and the competition's `days_left` (e.g., validation strategy + baseline first, then domain-specific feature engineering / model backbone, then ensembling / post-processing).",
      "4. Be specific about model architectures, validation schemes (e.g., StratifiedGroupKFold, time-split), or tooling relevant to each competition's domain.",
    ].join("\n");

    const userInput = JSON.stringify(
      {
        user_profile: {
          prompt: String(body.profile.prompt ?? "").slice(0, 1200),
          experience: body.profile.experience,
          domains: body.profile.domains,
          goal: body.profile.goal,
          teamMode: body.profile.teamMode,
          hoursPerWeek: body.profile.hoursPerWeek,
        },
        candidates,
      },
      null,
      2,
    );

    const geminiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify({
        model: "gemini-3.8-flash",
        system_instruction: systemInstruction,
        input: userInput,
        store: false,
        generation_config: {
          temperature: 0.35,
          thinking_level: "low",
        },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return Response.json(
        {
          error: `Gemini Interactions API error (HTTP ${geminiRes.status})`,
          details: errText.slice(0, 500),
        },
        { status: 502, headers: rateHeaders },
      );
    }

    const interaction = (await geminiRes.json()) as InteractionResponse;
    const textOutput = interaction.outputs?.find((o) => o.type === "text")?.text;

    if (!textOutput) {
      return Response.json(
        { error: "Gemini returned an empty interaction output." },
        { status: 502, headers: rateHeaders },
      );
    }

    let parsed: { summary: string; recommendations: RecommendationItem[] };
    try {
      parsed = JSON.parse(textOutput) as { summary: string; recommendations: RecommendationItem[] };
    } catch {
      return Response.json(
        { error: "Failed to parse structured JSON from Gemini output.", raw: textOutput.slice(0, 400) },
        { status: 502, headers: rateHeaders },
      );
    }

    const payload: RecommendationResponse = {
      summary: parsed.summary,
      recommendations: parsed.recommendations,
      model: "gemini-3.8-flash",
      source: "gemini-worker",
    };

    return Response.json(payload, { status: 200, headers: rateHeaders });
  },
};

