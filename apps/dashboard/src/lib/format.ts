import type { Competition, Filters } from "../types";

const DAY_MS = 86_400_000;

/** Competitions close at the end of their deadline day (UTC). */
export function deadlineMs(end: string | null): number | null {
  if (!end) return null;
  return Date.parse(`${end}T23:59:59Z`);
}

export function msLeft(end: string | null, now: number): number | null {
  const d = deadlineMs(end);
  return d === null ? null : d - now;
}

export function daysLeft(end: string | null, now: number): number | null {
  const ms = msLeft(end, now);
  return ms === null ? null : ms / DAY_MS;
}

export type Urgency = "closed" | "critical" | "soon" | "normal" | "none";

export function urgency(end: string | null, now: number): Urgency {
  const d = daysLeft(end, now);
  if (d === null) return "none";
  if (d < 0) return "closed";
  if (d <= 7) return "critical";
  if (d <= 14) return "soon";
  return "normal";
}

export function countdown(end: string | null, now: number): string {
  const ms = msLeft(end, now);
  if (ms === null) return "Ongoing";
  if (ms <= 0) return "Closed";
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (days >= 60) return `${Math.round(days / 30)} months`;
  if (days >= 14) return `${days} days`;
  if (days >= 1) return `${days}d ${hours}h`;
  return `${hours}h ${mins}m`;
}

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const usdFull = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatUSD(v: number | null | undefined, compact = true): string {
  if (v === null || v === undefined) return "—";
  return compact ? usdCompact.format(v) : usdFull.format(v);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function relativeTime(iso: string, now: number): string {
  const diff = now - Date.parse(iso);
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export const TYPE_LABELS: Record<string, string> = {
  featured: "Featured",
  research: "Research",
  community: "Community",
  hackathon: "Hackathon",
  playground: "Playground",
  "getting-started": "Getting started",
  practice: "Practice",
  benchmark: "Benchmark",
  knowledge: "Knowledge",
  competition: "Competition",
  recruitment: "Recruitment",
  masters: "Masters",
  analytics: "Analytics",
};

export const ONGOING_TYPES = new Set(["benchmark", "practice", "getting-started"]);

export function typeLabel(t: string | null): string {
  if (!t) return "Competition";
  return TYPE_LABELS[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

export function applyFilters(rows: Competition[], f: Filters, now: number): Competition[] {
  const q = f.search.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  return rows.filter((c) => {
    if (!f.includeOngoing && c.competition_type && ONGOING_TYPES.has(c.competition_type)) return false;
    if (!f.includeCommunity && c.competition_type === "community") return false;
    if (f.platforms.length && !f.platforms.includes(c.platform)) return false;
    if (f.categories.length && !f.categories.includes(c.category ?? "Other")) return false;
    if (f.types.length && !f.types.includes(c.competition_type ?? "competition")) return false;
    if (f.minPrize > 0 && (c.prize_usd ?? 0) < f.minPrize) return false;
    if (f.researchOnly && !c.is_research) return false;
    if (f.newOnly && !c.is_new) return false;
    if (f.deadlineWithin !== null) {
      const d = daysLeft(c.end_date, now);
      if (d === null || d < 0 || d > f.deadlineWithin) return false;
    }
    if (terms.length) {
      const hay = [
        c.name,
        c.platform,
        c.category,
        c.organizer,
        c.co_authors,
        c.journal_venue,
        c.description,
        c.competition_type,
        ...c.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

/** Deterministic colour per platform for badges and charts. */
const PLATFORM_COLORS: Record<string, string> = {
  Kaggle: "#20beff",
  Zindi: "#f59e0b",
  DrivenData: "#22c55e",
  AIcrowd: "#ef4444",
  CodaLab: "#a855f7",
  Codabench: "#8b5cf6",
  "Hugging Face": "#facc15",
  Devpost: "#14b8a6",
  Tianchi: "#fb923c",
  SIGNATE: "#38bdf8",
  "ODS.ai": "#f472b6",
  "Yandex Cup": "#f43f5e",
  Independent: "#94a3b8",
};
const FALLBACK = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#2dd4bf", "#fb7185", "#a3e635"];

export function platformColor(p: string): string {
  if (PLATFORM_COLORS[p]) return PLATFORM_COLORS[p];
  let h = 0;
  for (const ch of p) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

