import type { Competition } from "../types";
import { daysLeft, formatUSD } from "../lib/format";

interface Props {
  rows: Competition[];
  totalActive: number;
  now: number;
}

function TickMeter({ ratio, colorClass }: { ratio: number; colorClass: string }) {
  const total = 16;
  const filled = Math.max(1, Math.min(total, Math.round(ratio * total)));
  return (
    <div className="mt-2.5 flex items-center gap-[2.5px]" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-2.5 w-[2.5px] rounded-[1px] ${i < filled ? colorClass : "bg-white/12"}`}
        />
      ))}
    </div>
  );
}

function Card({
  index,
  label,
  value,
  sub,
  ratio,
  tickColor,
}: {
  index: string;
  label: string;
  value: string;
  sub?: string;
  ratio: number;
  tickColor: string;
}) {
  return (
    <div className="wunder-glass relative overflow-hidden rounded-2xl border border-white/10 p-4 transition hover:border-white/25">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[#faf6e8]/50">
        <span>{index}</span>
        <span>{label}</span>
      </div>
      <div className="font-display mt-1.5 text-3xl tracking-tight text-[#faf6e8] tabular-nums sm:text-4xl">
        {value}
      </div>
      <TickMeter ratio={ratio} colorClass={tickColor} />
      {sub && <div className="mt-1.5 font-mono text-[11px] text-[#faf6e8]/55">{sub}</div>}
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

  const denom = Math.max(1, rows.length);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Card
        index="01 // ARENA"
        label="Active Challenges"
        value={rows.length.toLocaleString()}
        sub={rows.length === totalActive ? `across ${platforms} platforms` : `of ${totalActive} · ${platforms} platforms`}
        ratio={rows.length / Math.max(1, totalActive)}
        tickColor="bg-[#faf6e8]"
      />
      <Card
        index="02 // BOUNTY"
        label="Total Prize Pool"
        value={formatUSD(prizePool)}
        sub={`${withCash} with cash prizes (USD)`}
        ratio={Math.min(1, withCash / denom + 0.35)}
        tickColor="bg-emerald-300"
      />
      <Card
        index="03 // URGENT"
        label="Closing ≤ 7 Days"
        value={String(closingWeek)}
        sub="final submission sprint"
        ratio={Math.min(1, Math.max(0.12, (closingWeek / denom) * 4))}
        tickColor="bg-rose-400"
      />
      <Card
        index="04 // SIGNAL"
        label="New Today"
        value={String(newToday)}
        sub="detected in morning sync"
        ratio={Math.min(1, Math.max(0.15, newToday / 25))}
        tickColor="bg-amber-300"
      />
      <Card
        index="05 // ACADEMIC"
        label="Research Tracks"
        value={String(research)}
        sub="with venue / co-authors"
        ratio={Math.min(1, Math.max(0.18, research / denom))}
        tickColor="bg-sky-300"
      />
    </div>
  );
}
