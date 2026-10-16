"""Zindi — public JSON API."""
from __future__ import annotations

import logging

from .. import http
from ..models import Competition
from ..normalize import parse_date, today_iso

NAME = "zindi"
log = logging.getLogger(__name__)
API = "https://api.zindi.africa/v1/competitions"
PER_PAGE = 100
MAX_PAGES = 15


def fetch() -> list[Competition]:
    today = today_iso()
    out: list[Competition] = []
    seen: set[str] = set()
    for page in range(0, MAX_PAGES):
        payload = http.get_json(API, params={"page": page, "per_page": PER_PAGE})
        data = payload.get("data", [])
        if not data:
            break
        new_on_page = 0
        for c in data:
            slug = c.get("id") or c.get("slug")
            if not slug or slug in seen:
                continue
            seen.add(slug)
            new_on_page += 1
            end = parse_date(c.get("end_time"))
            is_open = bool(c.get("open"))
            if not is_open and not (end and end >= today):
                continue
            if end and end < today:
                continue
            if c.get("secret_code_required"):
                continue
            kind = (c.get("kind") or "competition").lower()
            out.append(
                Competition(
                    name=(c.get("title") or slug).strip(),
                    url=f"https://zindi.africa/competitions/{slug}",
                    platform="Zindi",
                    source=NAME,
                    start_date=parse_date(c.get("start_time")),
                    end_date=end,
                    prize_raw=(c.get("reward") or None),
                    tags=[t for t in [kind, "beginner" if c.get("is_beginner_friendly") else None] if t],
                    competition_type="hackathon" if kind == "hackathon" else ("knowledge" if kind == "knowledge" else "featured"),
                    organizer=c.get("organization"),
                    participants=c.get("participations_count"),
                )
            )
        total = payload.get("meta", {}).get("total_count")
        if new_on_page == 0 or (total is not None and len(seen) >= total):
            break
    return out
