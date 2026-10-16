import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { Competition } from "../types";
import { countdown, daysLeft, formatDate, formatUSD, platformColor, typeLabel, urgency } from "../lib/format";

const col = createColumnHelper<Competition>();

const URGENCY_CLS: Record<string, string> = {
  critical: "bg-rose-500/20 text-rose-200 ring-rose-400/50",
  soon: "bg-amber-500/20 text-amber-200 ring-amber-400/45",
  normal: "bg-white/8 text-[#faf6e8]/80 ring-white/15",
  none: "bg-white/5 text-[#faf6e8]/45 ring-white/10",
  closed: "bg-white/5 text-[#faf6e8]/30 line-through ring-white/10",
};

function DeadlineTicks({ end, now }: { end: string | null; now: number }) {
  const d = daysLeft(end, now);
  const total = 10;
  if (d === null) {
    return (
      <span className="inline-flex gap-[2px] opacity-35" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className="inline-block h-2.5 w-[2px] bg-[#faf6e8]/40" />
        ))}
      </span>
    );
  }
  // Remaining ratio relative to a 60-day window
  const ratio = Math.max(0.1, Math.min(1, d / 60));
  const filled = Math.round(ratio * total);
  const color = d <= 7 ? "bg-rose-400" : d <= 14 ? "bg-amber-300" : "bg-emerald-300";

  return (
    <span className="inline-flex items-center gap-[2px]" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`inline-block h-2.5 w-[2px] rounded-[0.5px] ${i < filled ? color : "bg-white/12"}`}
        />
      ))}
    </span>
  );
}

function PlatformBadge({ p }: { p: string }) {
  const c = platformColor(p);
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-xs font-medium"
      style={{ backgroundColor: `${c}22`, color: c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
      {p}
    </span>
  );
}

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  return (
    <span className={`ml-1 inline-block text-[10px] ${dir ? "opacity-100 text-emerald-300" : "opacity-30"}`} aria-hidden>
      {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "▲▼"}
    </span>
  );
}

interface Props {
  rows: Competition[];
  now: number;
}

export function CompetitionTable({ rows, now }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "prize", desc: true }]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const columns = useMemo(
    () => [
      col.display({
        id: "expand",
        header: () => <span className="sr-only">Details</span>,
        cell: ({ row }) => (
          <button
            type="button"
            aria-label={expanded[row.id] ? "Hide details" : "Show details"}
            aria-expanded={!!expanded[row.id]}
            onClick={() => setExpanded((e) => ({ ...e, [row.id]: !e[row.id] }))}
            className="flex h-6 w-6 items-center justify-center rounded text-[#faf6e8]/45 hover:bg-white/10 hover:text-[#faf6e8]"
          >
            <span className={`text-xs transition-transform ${expanded[row.id] ? "rotate-90 text-emerald-300" : ""}`}>▶</span>
          </button>
        ),
        size: 32,
      }),
      col.accessor("name", {
        header: "Challenge",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="min-w-[260px] max-w-[460px]">
              <div className="flex items-start gap-2">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#faf6e8] transition hover:text-emerald-300 hover:underline"
                  title={c.description ?? c.name}
                >
                  {c.name}
                </a>
                {c.is_new && (
                  <span className="animate-pulse-soft mt-0.5 shrink-0 rounded bg-amber-300 px-1.5 py-0.2 font-mono text-[10px] font-bold uppercase text-[#111513]">
                    New
                  </span>
                )}
              </div>
              {c.organizer && <div className="mt-0.5 truncate font-mono text-[11px] text-[#faf6e8]/50">{c.organizer}</div>}
            </div>
          );
        },
        sortingFn: "alphanumeric",
      }),
      col.accessor("platform", {
        header: "Platform",
        cell: (i) => <PlatformBadge p={i.getValue()} />,
      }),
      col.accessor((c) => c.category ?? "Other", {
        id: "category",
        header: "Domain",
        cell: (i) => (
          <span className="whitespace-nowrap rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-[#faf6e8]/85">
            {i.getValue()}
          </span>
        ),
      }),
      col.accessor((c) => c.competition_type ?? "competition", {
        id: "type",
        header: "Track",
        cell: (i) => (
          <span className="whitespace-nowrap font-mono text-xs text-[#faf6e8]/65">
            {i.row.original.is_research && "🎓 "}
            {typeLabel(i.getValue())}
          </span>
        ),
      }),
      col.accessor((c) => c.prize_usd ?? undefined, {
        id: "prize",
        header: "Prize Pool",
        sortUndefined: "last",
        cell: ({ row }) => {
          const c = row.original;
          const raw = c.prize_raw;
          const showRaw = raw && (c.prize_usd === null || !/^\$|usd/i.test(raw));
          return (
            <div className="whitespace-nowrap text-right font-mono tabular-nums">
              <div className={c.prize_usd ? "font-semibold text-emerald-300" : "text-[#faf6e8]/35"}>
                {c.prize_usd ? formatUSD(c.prize_usd) : "—"}
              </div>
              {showRaw && <div className="text-[10px] text-[#faf6e8]/50">{raw}</div>}
            </div>
          );
        },
      }),
      col.accessor((c) => c.end_date ?? undefined, {
        id: "deadline",
        header: "Timeline",
        sortUndefined: "last",
        cell: ({ row }) => {
          const c = row.original;
          const u = urgency(c.end_date, now);
          return (
            <div className="whitespace-nowrap font-mono">
              <div className="flex items-center gap-2 text-xs text-[#faf6e8]/85">
                <DeadlineTicks end={c.end_date} now={now} />
                <span>{formatDate(c.end_date)}</span>
              </div>
              <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${URGENCY_CLS[u]}`}>
                {u === "critical" && "⏰ "}
                {countdown(c.end_date, now)}
              </span>
            </div>
          );
        },
      }),
      col.accessor((c) => c.co_authors ?? undefined, {
        id: "co_authors",
        header: "Co-authors",
        sortUndefined: "last",
        cell: (i) =>
          i.getValue() ? (
            <div className="max-w-[190px] truncate font-mono text-xs text-[#faf6e8]/75" title={i.getValue()}>
              {i.getValue()}
            </div>
          ) : (
            <span className="font-mono text-[#faf6e8]/25">—</span>
          ),
      }),
      col.accessor((c) => c.journal_venue ?? undefined, {
        id: "venue",
        header: "Venue",
        sortUndefined: "last",
        cell: (i) =>
          i.getValue() ? (
            <span className="whitespace-nowrap rounded border border-sky-400/30 bg-sky-400/15 px-1.5 py-0.5 font-mono text-[11px] font-medium text-sky-200">
              {i.getValue()}
            </span>
          ) : (
            <span className="font-mono text-[#faf6e8]/25">—</span>
          ),
      }),
    ],
    [expanded, now],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
    autoResetPageIndex: true,
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const from = rows.length ? pageIndex * pageSize + 1 : 0;
  const to = Math.min(rows.length, (pageIndex + 1) * pageSize);

  return (
    <div className="wunder-glass overflow-hidden rounded-2xl border border-white/12">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[#0b120f]/95 text-left font-mono text-[11px] uppercase tracking-wider text-[#faf6e8]/55">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    scope="col"
                    className={`border-b border-white/12 px-3 py-3 font-semibold ${
                      h.id === "prize" ? "text-right" : ""
                    }`}
                    aria-sort={
                      h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : undefined
                    }
                  >
                    {h.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="inline-flex items-center hover:text-[#faf6e8]"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <SortIcon dir={h.column.getIsSorted()} />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const c = row.original;
              const u = urgency(c.end_date, now);
              return (
                <Fragment key={row.id}>
                  <tr
                    className={`border-b border-white/8 align-top transition hover:bg-white/[0.04] ${
                      u === "critical" ? "bg-rose-500/[0.06]" : ""
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {expanded[row.id] && (
                    <tr className="border-b border-white/10 bg-black/45">
                      <td />
                      <td colSpan={row.getVisibleCells().length - 1} className="px-3 py-4">
                        <Details c={c} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-16 text-center font-mono text-xs text-[#faf6e8]/50">
                  No competitions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 font-mono text-xs text-[#faf6e8]/60">
        <span>
          SHOWING {from}–{to} OF {rows.length}
        </span>
        <div className="flex items-center gap-2">
          <select
            aria-label="Rows per page"
            className="h-8 rounded-lg border border-white/15 bg-black/50 px-2 text-[#faf6e8]"
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[25, 50, 100, 250].map((n) => (
              <option key={n} value={n} className="bg-[#0e1512]">
                {n} / page
              </option>
            ))}
          </select>
          <button
            type="button"
            className="h-8 rounded-lg border border-white/15 bg-white/5 px-3 text-[#faf6e8] hover:bg-white/10 disabled:opacity-35"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            ← Prev
          </button>
          <span>
            {pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <button
            type="button"
            className="h-8 rounded-lg border border-white/15 bg-white/5 px-3 text-[#faf6e8] hover:bg-white/10 disabled:opacity-35"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#faf6e8]/45">{label}</dt>
      <dd className="mt-0.5 font-mono text-xs text-[#faf6e8]/90">{children}</dd>
    </div>
  );
}

function Details({ c }: { c: Competition }) {
  return (
    <div className="space-y-3">
      {c.description && <p className="max-w-4xl text-sm leading-relaxed text-[#faf6e8]/80">{c.description}</p>}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 md:grid-cols-4">
        <Field label="Start date">{formatDate(c.start_date)}</Field>
        <Field label="Deadline">{formatDate(c.end_date)}</Field>
        <Field label="Prize (as listed)">{c.prize_raw ?? "—"}</Field>
        <Field label="Prize (USD equiv.)">{formatUSD(c.prize_usd, false)}</Field>
        <Field label="Organiser">{c.organizer ?? "—"}</Field>
        <Field label="Participants">{c.participants?.toLocaleString() ?? "—"}</Field>
        {c.is_research && <Field label="Co-authors">{c.co_authors ?? "—"}</Field>}
        {c.is_research && <Field label="Journal / venue">{c.journal_venue ?? "—"}</Field>}
        <Field label="First seen">{formatDate(c.first_seen)}</Field>
        <Field label="Reported by">{c.sources.join(", ")}</Field>
      </dl>
      {c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {c.tags.slice(0, 20).map((t) => (
            <span
              key={t}
              className="rounded border border-white/12 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-[#faf6e8]/75"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
