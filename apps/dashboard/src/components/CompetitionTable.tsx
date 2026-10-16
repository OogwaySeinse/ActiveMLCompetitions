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
import { countdown, formatDate, formatUSD, platformColor, typeLabel, urgency } from "../lib/format";

const col = createColumnHelper<Competition>();

const URGENCY_CLS: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/40",
  soon: "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/40",
  normal: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  none: "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:ring-slate-700",
  closed: "bg-slate-100 text-slate-400 line-through ring-slate-200 dark:bg-slate-800 dark:ring-slate-700",
};

function PlatformBadge({ p }: { p: string }) {
  const c = platformColor(p);
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${c}22`, color: c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
      {p}
    </span>
  );
}

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  return (
    <span className={`ml-1 inline-block text-[10px] ${dir ? "opacity-100" : "opacity-30"}`} aria-hidden>
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
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <span className={`transition-transform ${expanded[row.id] ? "rotate-90" : ""}`}>▶</span>
          </button>
        ),
        size: 32,
      }),
      col.accessor("name", {
        header: "Competition",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="min-w-[260px] max-w-[440px]">
              <div className="flex items-start gap-2">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-slate-900 hover:text-indigo-600 hover:underline dark:text-slate-100 dark:hover:text-indigo-400"
                  title={c.description ?? c.name}
                >
                  {c.name}
                </a>
                {c.is_new && (
                  <span className="animate-pulse-soft mt-0.5 shrink-0 rounded bg-amber-400 px-1.5 text-[10px] font-bold uppercase text-amber-950">
                    New
                  </span>
                )}
              </div>
              {c.organizer && <div className="mt-0.5 truncate text-xs text-slate-500">{c.organizer}</div>}
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
        header: "Category",
        cell: (i) => <span className="whitespace-nowrap text-sm">{i.getValue()}</span>,
      }),
      col.accessor((c) => c.competition_type ?? "competition", {
        id: "type",
        header: "Type",
        cell: (i) => (
          <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
            {i.row.original.is_research && "🎓 "}
            {typeLabel(i.getValue())}
          </span>
        ),
      }),
      col.accessor((c) => c.prize_usd ?? undefined, {
        id: "prize",
        header: "Prize money",
        sortUndefined: "last",
        cell: ({ row }) => {
          const c = row.original;
          const raw = c.prize_raw;
          const showRaw = raw && (c.prize_usd === null || !/^\$|usd/i.test(raw));
          return (
            <div className="whitespace-nowrap text-right tabular-nums">
              <div className={c.prize_usd ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
                {c.prize_usd ? formatUSD(c.prize_usd) : "—"}
              </div>
              {showRaw && <div className="text-[11px] text-slate-500">{raw}</div>}
            </div>
          );
        },
      }),
      col.accessor((c) => c.end_date ?? undefined, {
        id: "deadline",
        header: "Deadline",
        sortUndefined: "last",
        cell: ({ row }) => {
          const c = row.original;
          const u = urgency(c.end_date, now);
          return (
            <div className="whitespace-nowrap">
              <div className="text-sm">{formatDate(c.end_date)}</div>
              <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${URGENCY_CLS[u]}`}>
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
            <div className="max-w-[200px] truncate text-xs" title={i.getValue()}>
              {i.getValue()}
            </div>
          ) : (
            <span className="text-slate-300 dark:text-slate-700">—</span>
          ),
      }),
      col.accessor((c) => c.journal_venue ?? undefined, {
        id: "venue",
        header: "Journal / venue",
        sortUndefined: "last",
        cell: (i) =>
          i.getValue() ? (
            <span className="whitespace-nowrap rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
              {i.getValue()}
            </span>
          ) : (
            <span className="text-slate-300 dark:text-slate-700">—</span>
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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    scope="col"
                    className={`border-b border-slate-200 px-3 py-2.5 font-semibold dark:border-slate-800 ${
                      h.id === "prize" ? "text-right" : ""
                    }`}
                    aria-sort={
                      h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : undefined
                    }
                  >
                    {h.column.getCanSort() ? (
                      <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center hover:text-slate-900 dark:hover:text-slate-100">
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
                    className={`border-b border-slate-100 align-top transition hover:bg-slate-50 dark:border-slate-800/70 dark:hover:bg-slate-800/40 ${
                      u === "critical" ? "bg-rose-50/60 dark:bg-rose-500/5" : ""
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {expanded[row.id] && (
                    <tr className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800/70 dark:bg-slate-900">
                      <td />
                      <td colSpan={row.getVisibleCells().length - 1} className="px-3 py-3">
                        <Details c={c} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-16 text-center text-slate-500">
                  No competitions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 text-sm text-slate-500 dark:border-slate-800">
        <span>
          {from}–{to} of {rows.length}
        </span>
        <div className="flex items-center gap-2">
          <select
            aria-label="Rows per page"
            className="h-8 rounded border border-slate-300 bg-white px-1 dark:border-slate-700 dark:bg-slate-900"
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[25, 50, 100, 250].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <button
            type="button"
            className="h-8 rounded border border-slate-300 px-3 disabled:opacity-40 dark:border-slate-700"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </button>
          <span>
            {pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <button
            type="button"
            className="h-8 rounded border border-slate-300 px-3 disabled:opacity-40 dark:border-slate-700"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function Details({ c }: { c: Competition }) {
  return (
    <div className="space-y-3">
      {c.description && <p className="max-w-4xl text-sm text-slate-700 dark:text-slate-300">{c.description}</p>}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
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
        <div className="flex flex-wrap gap-1">
          {c.tags.slice(0, 20).map((t) => (
            <span key={t} className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
