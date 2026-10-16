import type { Competition } from "../types";
import { daysLeft, formatUSD } from "../lib/format";

interface Props {
  rows: Competition[];
  totalActive: number;
  now: number;
}

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function StatCards({ rows, totalActive, now }: Props) {
  const prizePool = rows.reduce((s, c) => s + (c.prize_usd ?? 0), 0);
  const withCash = rows.filter((c) => (c.prize_usd ?? 0) > 0).length;
  const closingWeek = rows.filter((c) => {
    const d = daysLeft(c.end_date, now);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  const newToday = rows.filter((c) => c.is_new).length;
  const research = rows.filter((c) => c.is_research).length;
  const platforms = new Set(rows.map((c) => c.platform)).size;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Card
        label="Active competitions"
        value={rows.length.toLocaleString()}
        sub={rows.length === totalActive ? `across ${platforms} platforms` : `of ${totalActive} · ${platforms} platforms`}
        accent="bg-indigo-500"
      />
      <Card label="Total prize pool" value={formatUSD(prizePool)} sub={`${withCash} with cash prizes (USD equiv.)`} accent="bg-emerald-500" />
      <Card label="Closing this week" value={String(closingWeek)} sub="deadline ≤ 7 days" accent="bg-rose-500" />
      <Card label="New today" value={String(newToday)} sub="first seen in latest refresh" accent="bg-amber-500" />
      <Card label="Research" value={String(research)} sub="with venue / co-authors" accent="bg-sky-500" />
    </div>
  );
}

