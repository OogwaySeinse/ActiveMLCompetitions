import { useMemo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Competition } from "../types";
import { daysLeft, formatUSD, platformColor } from "../lib/format";

interface Props {
  rows: Competition[];
  now: number;
  dark: boolean;
}

function Panel({
  title,
  subtitle,
  children,
  height = 288,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-3" style={{ height }}>
        {children}
      </div>
    </section>
  );
}

const CATEGORY_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16", "#14b8a6", "#f97316", "#3b82f6", "#eab308", "#64748b", "#d946ef", "#10b981", "#0ea5e9"];

export function Charts({ rows, now, dark }: Props) {
  const axis = dark ? "#94a3b8" : "#64748b";
  const grid = dark ? "#1e293b" : "#e2e8f0";
  const tooltipStyle = {
    backgroundColor: dark ? "#0f172a" : "#ffffff",
    border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
    borderRadius: 8,
    fontSize: 12,
    color: dark ? "#e2e8f0" : "#0f172a",
  };

  const byPlatform = useMemo(() => {
    const m = new Map<string, { platform: string; count: number; prize: number }>();
    for (const c of rows) {
      const e = m.get(c.platform) ?? { platform: c.platform, count: 0, prize: 0 };
      e.count += 1;
      e.prize += c.prize_usd ?? 0;
      m.set(c.platform, e);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [rows]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of rows) m.set(c.category ?? "Other", (m.get(c.category ?? "Other") ?? 0) + 1);
    return [...m.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  }, [rows]);

  const prizeBuckets = useMemo(() => {
    const buckets = [
      { label: "No cash", min: -1, max: 0 },
      { label: "< $1k", min: 0, max: 1_000 },
      { label: "$1k–10k", min: 1_000, max: 10_000 },
      { label: "$10k–50k", min: 10_000, max: 50_000 },
      { label: "$50k–100k", min: 50_000, max: 100_000 },
      { label: "$100k–500k", min: 100_000, max: 500_000 },
      { label: "≥ $500k", min: 500_000, max: Infinity },
    ];
    return buckets.map((b) => ({
      label: b.label,
      count: rows.filter((c) => {
        const p = c.prize_usd ?? 0;
        return b.min < 0 ? p <= 0 : p > b.min && p <= b.max;
      }).length,
    }));
  }, [rows]);

  const timeline = useMemo(() => {
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const start = new Date(now + i * 7 * 86_400_000);
      return {
        label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        count: 0,
        prize: 0,
      };
    });
    for (const c of rows) {
      const d = daysLeft(c.end_date, now);
      if (d === null || d < 0) continue;
      const w = Math.floor(d / 7);
      if (w < weeks.length) {
        weeks[w].count += 1;
        weeks[w].prize += c.prize_usd ?? 0;
      }
    }
    return weeks;
  }, [rows, now]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Competitions by platform" subtitle="Number of active competitions">
        <ResponsiveContainer>
          <BarChart data={byPlatform} layout="vertical" margin={{ left: 20, right: 16 }}>
            <CartesianGrid stroke={grid} horizontal={false} />
            <XAxis type="number" stroke={axis} fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="platform" stroke={axis} fontSize={11} width={95} interval={0} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: grid }} />
            <Bar dataKey="count" name="Competitions" radius={[0, 4, 4, 0]}>
              {byPlatform.map((d) => (
                <Cell key={d.platform} fill={platformColor(d.platform)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Prize pool by platform" subtitle="Sum of cash prizes (USD equivalent)">
        <ResponsiveContainer>
          <BarChart data={byPlatform.filter((d) => d.prize > 0).sort((a, b) => b.prize - a.prize)} layout="vertical" margin={{ left: 20, right: 16 }}>
            <CartesianGrid stroke={grid} horizontal={false} />
            <XAxis type="number" stroke={axis} fontSize={11} tickFormatter={(v: number) => formatUSD(v)} />
            <YAxis type="category" dataKey="platform" stroke={axis} fontSize={11} width={95} interval={0} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: grid }} formatter={(v) => formatUSD(Number(v), false)} />
            <Bar dataKey="prize" name="Prize pool" radius={[0, 4, 4, 0]}>
              {byPlatform.map((d) => (
                <Cell key={d.platform} fill={platformColor(d.platform)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Competitions by category" subtitle="Unified taxonomy inferred from tags & titles" height={460}>
        <ResponsiveContainer>
          <BarChart data={byCategory} layout="vertical" margin={{ left: 40, right: 16 }}>
            <CartesianGrid stroke={grid} horizontal={false} />
            <XAxis type="number" stroke={axis} fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="category" stroke={axis} fontSize={11} width={150} interval={0} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: grid }} />
            <Bar dataKey="count" name="Competitions" radius={[0, 4, 4, 0]}>
              {byCategory.map((d, i) => (
                <Cell key={d.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Prize distribution" subtitle="Competitions per prize bracket" height={460}>
        <ResponsiveContainer>
          <BarChart data={prizeBuckets} margin={{ right: 8 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="label" stroke={axis} fontSize={11} interval={0} />
            <YAxis stroke={axis} fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: grid }} />
            <Bar dataKey="count" name="Competitions" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <div className="lg:col-span-2">
        <Panel title="Upcoming deadlines" subtitle="Competitions closing per week over the next 12 weeks">
          <ResponsiveContainer>
            <BarChart data={timeline} margin={{ right: 8 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="label" stroke={axis} fontSize={11} />
              <YAxis stroke={axis} fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: grid }}
                formatter={(v, name) => (name === "Prize pool" ? formatUSD(Number(v), false) : v)}
                labelFormatter={(l) => `Week of ${l}`}
              />
              <Bar dataKey="count" name="Closing" radius={[4, 4, 0, 0]}>
                {timeline.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "#f43f5e" : i === 1 ? "#f59e0b" : "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}
