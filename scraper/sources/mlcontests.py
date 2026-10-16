"""MLContests.com — community-curated feed covering many platforms.

Used as a low-priority aggregator: fills in competitions from platforms we
can't scrape directly (Codabench, Hugging Face, EvalAI, independents...) and
contributes prize / sponsor / conference metadata to merged records.
"""
from __future__ import annotations

import logging

from .. import http
from ..models import Competition
from ..normalize import normalize_platform, parse_date, today_iso

NAME = "mlcontests"
log = logging.getLogger(__name__)
FEED = "https://raw.githubusercontent.com/mlcontests/mlcontests.github.io/master/competitions.json"


def _venue(c: dict) -> str | None:
    conf = (c.get("conference") or "").strip()
    if not conf or conf.startswith("http"):
        return None
    year = c.get("conference-year")
    return f"{conf} {year}".strip() if year and str(year) not in conf else conf


def fetch() -> list[Competition]:
    payload = http.get_json(FEED)
    items = payload.get("data", payload) if isinstance(payload, dict) else payload
    today = today_iso()
    out: list[Competition] = []
    for c in items:
        end = parse_date(c.get("deadline"))
        if end and end < today:
            continue
        if end is None and not c.get("deadline"):
            # no deadline at all: only keep if added recently-ish (rolling competitions)
            pass
        url = c.get("url") or ""
        if not url:
            continue
        venue = _venue(c)
        tags = list(c.get("tags") or [])
        out.append(
            Competition(
                name=(c.get("name") or "").strip(),
                url=url,
                platform=normalize_platform(c.get("platform"), url),
                source=NAME,
                start_date=parse_date(c.get("launched")),
                end_date=end,
                prize_raw=(str(c["prize"]).strip() if c.get("prize") else None),
                tags=tags,
                competition_type="research" if venue else None,
                organizer=(c.get("sponsor") or None),
                journal_venue=venue,
                description=c.get("note"),
            )
        )
    return out

