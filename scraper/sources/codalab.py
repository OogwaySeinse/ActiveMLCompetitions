"""CodaLab (LISN instance) — HTML listing of public competitions."""
from __future__ import annotations

import logging
import re
from datetime import date, timedelta

from bs4 import BeautifulSoup

from .. import http
from ..models import Competition
from ..normalize import parse_date, today_iso

NAME = "codalab"
log = logging.getLogger(__name__)
URL = "https://codalab.lisn.upsaclay.fr/competitions/"
BASE = "https://codalab.lisn.upsaclay.fr"
# Competitions without an end date are only kept if they started recently
NO_END_MAX_AGE_DAYS = 120
_PERPETUAL = re.compile(r"(post[- ]challenge|evaluation server|on-?going|leaderboard server|benchmark)", re.I)


def parse(html: str) -> list[Competition]:
    soup = BeautifulSoup(html, "lxml")
    today = today_iso()
    recent_cutoff = (date.fromisoformat(today) - timedelta(days=NO_END_MAX_AGE_DAYS)).isoformat()
    out: list[Competition] = []
    for tile in soup.select("div.competition-tile"):
        id_el = tile.select_one("input#competitionID")
        comp_id = id_el.get("value") if id_el else None
        h3 = tile.select_one("h3")
        if not comp_id or not h3:
            continue
        name = h3.get_text(" ", strip=True)
        right = tile.select_one(".right-panel")
        right_text = right.get_text(" ", strip=True) if right else ""
        # e.g. "Jun 21, 2025- Aug 30, 2025 12 participants" or "Jan 19, 2026- No end date 4 participants"
        m = re.match(r"^(.*?\d{4})\s*-\s*(No end date|[A-Za-z]{3,9}\.? \d{1,2}, \d{4})", right_text)
        start = end = None
        if m:
            start = parse_date(m.group(1))
            end = None if m.group(2).lower().startswith("no end") else parse_date(m.group(2))
        if end:
            if end < today:
                continue
        else:
            if not start or start < recent_cutoff:
                continue
        pm = re.search(r"(\d[\d,]*)\s+participants", right_text)
        org_el = tile.select_one("p.organizer")
        organizer = org_el.get_text(" ", strip=True).replace("Organized by", "").strip() if org_el else None
        desc_el = org_el.find_next_sibling("p") if org_el else None

        # Long-running evaluation servers are benchmarks, not time-boxed competitions
        ctype = "research"
        far_future = (date.fromisoformat(today) + timedelta(days=3 * 365)).isoformat()
        old_start = (date.fromisoformat(today) - timedelta(days=365)).isoformat()
        if (
            (end and end > far_future)
            or (start and start < old_start)
            or _PERPETUAL.search(name)
        ):
            ctype = "benchmark"
            if end and end > far_future:
                end = None
        out.append(
            Competition(
                name=name,
                url=f"{BASE}/competitions/{comp_id}",
                platform="CodaLab",
                source=NAME,
                start_date=start,
                end_date=end,
                competition_type=ctype,
                organizer=organizer,
                description=desc_el.get_text(" ", strip=True)[:500] if desc_el else None,
                participants=int(pm.group(1).replace(",", "")) if pm else None,
            )
        )
    return out


def fetch() -> list[Competition]:
    return parse(http.get_text(URL, timeout=60))
