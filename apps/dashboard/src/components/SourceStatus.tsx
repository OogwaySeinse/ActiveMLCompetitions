import type { Meta } from "../types";
import { relativeTime } from "../lib/format";

const DOT: Record<string, string> = {
  ok: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
  stale: "bg-amber-400",
  cached: "bg-sky-400",
  error: "bg-rose-400",
  skipped: "bg-white/30",
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
    <footer className="wunder-glass rounded-2xl border border-white/12 p-5 font-mono text-xs text-[#faf6e8]/80">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-emerald-300">// INGESTION TELEMETRY</span>
          <h3 className="font-semibold text-[#faf6e8]">Live Scraper Feeds</h3>
        </div>
        <span className="text-[11px] text-[#faf6e8]/50">
          {meta.raw_records} raw records → {meta.total} deduplicated ({meta.duplicates_merged} merged) · FX: {meta.fx_source}
        </span>
      </div>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(meta.sources).map(([name, s]) => (
          <li
            key={name}
            className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-black/35 px-3.5 py-2.5"
            title={s.error ?? undefined}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[s.status] ?? "bg-white/30"}`} />
            <div className="min-w-0">
              <div className="truncate font-medium text-[#faf6e8]">{LABEL[name] ?? name}</div>
              <div className="mt-0.5 text-[11px] text-[#faf6e8]/50">
                {s.status === "ok" && `${s.count} active challenges · ${s.seconds.toFixed(1)}s`}
                {s.status === "stale" && `${s.count} cached (since ${s.stale_since ? relativeTime(s.stale_since, now) : "?"})`}
                {s.status === "cached" && `${s.count} from cache`}
                {s.status === "error" && "failed this run"}
                {s.status === "skipped" && "skipped"}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed text-[#faf6e8]/45">
        Prize money is normalized to USD for ranking while preserving original currency labels. Research metadata (co-authors &
        conference/journal venues) is automatically extracted for academic tracks. Automated GitHub Actions pipeline refreshes daily at
        06:00 UTC.
      </p>
    </footer>
  );
}
