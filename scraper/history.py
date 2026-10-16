"""History tracking: first-seen dates, daily snapshots and "new" detection."""
from __future__ import annotations

import json
import logging
from datetime import date, timedelta
from pathlib import Path

from .models import Competition

log = logging.getLogger(__name__)
SNAPSHOT_RETENTION_DAYS = 120


class History:
    def __init__(self, data_dir: Path):
        self.dir = data_dir / "history"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.first_seen_path = self.dir / "first_seen.json"
        self.first_seen: dict[str, str] = {}
        if self.first_seen_path.exists():
            self.first_seen = json.loads(self.first_seen_path.read_text(encoding="utf-8"))

    @property
    def is_bootstrap(self) -> bool:
        return not self.first_seen

    def previous_run_date(self, run_date: str) -> str | None:
        dates = sorted(p.stem for p in self.dir.glob("20??-??-??.json") if p.stem < run_date)
        return dates[-1] if dates else None

    def apply(self, comps: list[Competition], run_date: str) -> str | None:
        """Set ``first_seen`` / ``is_new`` on competitions. Returns previous run date.

        A competition is "new" when it was first seen today *and* there is a
        snapshot from an earlier day to compare against (so the very first day,
        including same-day reruns, flags nothing).
        """
        prev = self.previous_run_date(run_date)
        for c in comps:
            assert c.id
            seen = self.first_seen.get(c.id)
            if seen is None or seen > run_date:
                seen = run_date
                self.first_seen[c.id] = seen
            c.first_seen = seen
            c.is_new = prev is not None and seen == run_date
        return prev

    def save(self, comps: list[Competition], run_date: str) -> None:
        self.first_seen_path.write_text(json.dumps(self.first_seen, indent=0, sort_keys=True), encoding="utf-8")
        snapshot = [{"id": c.id, "name": c.name, "platform": c.platform, "end_date": c.end_date} for c in comps]
        (self.dir / f"{run_date}.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=0), encoding="utf-8")
        cutoff = (date.fromisoformat(run_date) - timedelta(days=SNAPSHOT_RETENTION_DAYS)).isoformat()
        for p in self.dir.glob("20??-??-??.json"):
            if p.stem < cutoff:
                p.unlink()

