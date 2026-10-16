import type { Meta } from "../types";
import { relativeTime } from "../lib/format";

const DOT: Record<string, string> = {
  ok: "bg-emerald-500",
  stale: "bg-amber-500",
  cached: "bg-sky-500",
  error: "bg-rose-500",
  skipped: "bg-slate-400",
};
const LABEL: Record<string, string> = {
  kaggle: "Kaggle (incl. community)",
  zindi: "Zindi",
  drivendata: "DrivenData",
  aicrowd: "AIcrowd",
  codalab: "CodaLab",
  devpost: "Devpost",
  tianchi: "Tianchi (Alibaba)",
  spa_playwright: "SIGNATE · ODS.ai · Yandex Cup",
  mlcontests: "MLContests (Codabench, Hugging Face, independents…)",
};

export function SourceStatus({ meta, now }: { meta: Meta; now: number }) {
  return (
    <footer className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Data sources</h3>
        <span className="text-xs text-slate-500">
          {meta.raw_records} raw records → {meta.total} unique ({meta.duplicates_merged} duplicates merged) · FX: {meta.fx_source}
        </span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(meta.sources).map(([name, s]) => (
          <li
            key={name}
            className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50"
            title={s.error ?? undefined}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[s.status] ?? "bg-slate-400"}`} />
            <div className="min-w-0">
              <div className="truncate font-medium">{LABEL[name] ?? name}</div>
              <div className="text-xs text-slate-500">
                {s.status === "ok" && `${s.count} competitions`}
                {s.status === "stale" && `${s.count} cached (since ${s.stale_since ? relativeTime(s.stale_since, now) : "?"})`}
                {s.status === "cached" && `${s.count} from cache`}
                {s.status === "error" && "failed this run"}
                {s.status === "skipped" && "skipped"}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Prize money is shown as listed and converted to USD for sorting and totals. Co-authors and journal/venue are only populated for
        research competitions (organisers/host team and associated conference or journal). Codabench and Hugging Face are covered via
        the MLContests feed.
      </p>
    </footer>
  );
}

