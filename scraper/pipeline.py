"""Main extraction pipeline: fetch → clean → dedupe → enrich → history → write."""
from __future__ import annotations

import csv
import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import fx
from .dedupe import dedupe
from .history import History
from .models import Competition
from .normalize import (
    clean_name,
    infer_category,
    normalize_platform,
    normalize_tags,
    parse_prize,
    strip_tracking,
    today_iso,
    url_id,
)
from .research import enrich
from .sources import SkipSource, load_sources

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
CACHE_MAX_AGE_DAYS = 7

CSV_COLUMNS = [
    "name", "platform", "category", "competition_type", "start_date", "end_date",
    "prize_raw", "prize_usd", "is_research", "co_authors", "journal_venue", "organizer",
    "tags", "participants", "url", "sources", "first_seen", "is_new", "id",
]
_JUNK_NAME = re.compile(r"^(test|demo|sandbox|untitled)\b", re.I)


# --------------------------------------------------------------------------
# Source execution with cache fallback
# --------------------------------------------------------------------------
def _cache_path(data_dir: Path, name: str) -> Path:
    # ".records.json" suffix: avoids "kaggle.json", which is git-ignored as a credential file
    return data_dir / "cache" / f"{name}.records.json"


def _save_cache(data_dir: Path, name: str, records: list[Competition]) -> None:
    p = _cache_path(data_dir, name)
    p.parent.mkdir(parents=True, exist_ok=True)
    payload = {"fetched_at": datetime.now(timezone.utc).isoformat(), "records": [r.to_dict() for r in records]}
    p.write_text(json.dumps(payload, ensure_ascii=False, indent=0), encoding="utf-8")


def _load_cache(data_dir: Path, name: str) -> tuple[list[Competition], str] | None:
    p = _cache_path(data_dir, name)
    if not p.exists():
        return None
    payload = json.loads(p.read_text(encoding="utf-8"))
    fetched = datetime.fromisoformat(payload["fetched_at"])
    if datetime.now(timezone.utc) - fetched > timedelta(days=CACHE_MAX_AGE_DAYS):
        return None
    return [Competition.from_dict(r) for r in payload["records"]], payload["fetched_at"]


def run_sources(data_dir: Path, only: list[str] | None = None) -> tuple[list[Competition], dict]:
    """Run every source. With ``only``, non-selected sources reuse their cache
    so a partial run never wipes the rest of the dataset."""
    records: list[Competition] = []
    status: dict[str, dict] = {}
    for mod in load_sources():
        name = mod.NAME
        t0 = time.time()
        entry = {"status": "ok", "count": 0, "error": None, "stale_since": None, "seconds": 0.0}
        if only and name not in only:
            cached = _load_cache(data_dir, name)
            if cached:
                recs, fetched_at = cached
                entry.update(status="cached", count=len(recs), stale_since=fetched_at)
                records.extend(recs)
            else:
                entry.update(status="skipped", error="not selected (no cache)")
            status[name] = entry
            continue
        try:
            log.info("Fetching %s ...", name)
            got = mod.fetch()
            if not got:
                raise RuntimeError("returned 0 competitions")
            entry["count"] = len(got)
            records.extend(got)
            _save_cache(data_dir, name, got)
        except SkipSource as e:
            entry.update(status="skipped", error=str(e))
        except Exception as e:
            log.warning("Source %s failed: %s", name, e)
            entry.update(status="error", error=str(e)[:300])
            cached = _load_cache(data_dir, name)
            if cached:
                recs, fetched_at = cached
                entry.update(status="stale", count=len(recs), stale_since=fetched_at)
                records.extend(recs)
                log.info("  -> using %d cached %s records from %s", len(recs), name, fetched_at)
        entry["seconds"] = round(time.time() - t0, 1)
        status[name] = entry
        log.info("  %s: %s (%d records, %.1fs)", name, entry["status"], entry["count"], entry["seconds"])
    return records, status


# --------------------------------------------------------------------------
# Cleaning / enrichment
# --------------------------------------------------------------------------
def clean(records: list[Competition], today: str) -> list[Competition]:
    out = []
    for r in records:
        r.name = clean_name(r.name)
        if len(r.name) < 4 or _JUNK_NAME.search(r.name):
            continue
        if r.end_date and r.end_date < today:
            continue
        r.platform = normalize_platform(r.platform, r.url)
        r.url = strip_tracking(r.url)
        r.tags = normalize_tags(r.tags)
        r.competition_type = r.competition_type or "competition"
        if r.description:
            r.description = re.sub(r"\s+", " ", r.description).strip()[:400]
        out.append(r)
    return out


def derive(comps: list[Competition], fx_rates: dict[str, float]) -> None:
    for c in comps:
        c.id = url_id(c.canonical_url or c.url)
        c.prize_usd = parse_prize(c.prize_raw, platform=c.platform, fx_per_usd=fx_rates)
        c.category = infer_category(c.name, c.tags, c.description)
        enrich(c)


# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------
def _sort_key(c: Competition):
    return (c.end_date is None, c.end_date or "", -(c.prize_usd or 0), c.name.lower())


def write_outputs(comps: list[Competition], meta: dict, data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    comps = sorted(comps, key=_sort_key)
    rows = []
    for c in comps:
        d = c.to_dict()
        d.pop("canonical_url", None)
        d.pop("source", None)
        rows.append(d)
    payload = {"meta": meta, "competitions": rows}
    (data_dir / "competitions.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    with open(data_dir / "competitions.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for d in rows:
            d = dict(d)
            d["tags"] = ", ".join(d.get("tags") or [])
            d["sources"] = ", ".join(d.get("sources") or [])
            w.writerow(d)


def run(only: list[str] | None = None, data_dir: Path = DATA_DIR) -> dict:
    started = datetime.now(timezone.utc)
    today = today_iso()
    log.info("=== Active ML competitions pipeline (%s) ===", today)

    fx_rates, fx_label = fx.load_rates()
    raw, source_status = run_sources(data_dir, only)
    if not raw:
        raise SystemExit("No competitions fetched from any source — aborting without overwriting data.")

    cleaned = clean(raw, today)
    comps = dedupe(cleaned)
    derive(comps, fx_rates)

    history = History(data_dir)
    previous_run = history.apply(comps, today)
    history.save(comps, today)

    by_platform: dict[str, int] = {}
    for c in comps:
        by_platform[c.platform] = by_platform.get(c.platform, 0) + 1
    meta = {
        "generated_at": started.isoformat(timespec="seconds"),
        "run_date": today,
        "previous_run_date": previous_run,
        "total": len(comps),
        "raw_records": len(raw),
        "duplicates_merged": len(cleaned) - len(comps),
        "new_today": sum(c.is_new for c in comps),
        "total_prize_usd": round(sum(c.prize_usd or 0 for c in comps), 2),
        "by_platform": dict(sorted(by_platform.items(), key=lambda kv: -kv[1])),
        "fx_source": fx_label,
        "sources": source_status,
    }
    write_outputs(comps, meta, data_dir)
    log.info(
        "Saved %d competitions (%d raw, %d merged, %d new). Prize pool ≈ $%s",
        meta["total"], meta["raw_records"], meta["duplicates_merged"], meta["new_today"], f"{meta['total_prize_usd']:,.0f}",
    )
    return meta
