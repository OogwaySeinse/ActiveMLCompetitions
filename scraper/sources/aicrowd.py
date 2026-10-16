"""AIcrowd — HTML listing of active challenges (no public API)."""
from __future__ import annotations

import logging
import re

from bs4 import BeautifulSoup

from .. import http
from ..models import Competition
from ..normalize import parse_date, today_iso

NAME = "aicrowd"
log = logging.getLogger(__name__)
URL = "https://www.aicrowd.com/challenges"
BASE = "https://www.aicrowd.com"
MAX_PAGES = 5

_SKIP_STATUS = re.compile(r"(completed|post[- ]challenge|post challenge)", re.I)
_JUNK_NAMES = re.compile(r"^(test\b|demo\b|sandbox)", re.I)


def parse(html: str) -> list[Competition]:
    soup = BeautifulSoup(html, "lxml")
    today = today_iso()
    out: list[Competition] = []
    for card in soup.select("div.card-challenge"):
        title_a = card.select_one(".card-title a")
        if not title_a:
            continue
        name = title_a.get_text(" ", strip=True)
        if _JUNK_NAMES.search(name):
            continue
        badge = card.select_one(".badge-primary")
        status = badge.get_text(" ", strip=True) if badge else ""
        if _SKIP_STATUS.search(status):
            continue
        end = parse_date(badge.get("title")) if badge is not None and badge.get("title") else None
        ctype = "featured"
        if end and end >= "2090-01-01":  # perpetual benchmark
            end, ctype = None, "benchmark"
        if "benchmark" in status.lower():
            ctype = "benchmark"
        if end and end < today:
            continue
        prizes = [p.get_text(" ", strip=True) for p in card.select(".prizes-breakdown .prize-item")]
        cash = [p.get_text(" ", strip=True) for p in card.select(".prizes-breakdown .prize-item-cash")]
        tags = [b.get_text(strip=True).lstrip("#").replace("_", " ") for b in card.select(".category-group .badge")]
        org = card.select_one(".card-footer span[title]")
        desc = card.select_one(".card-text")
        href = title_a["href"]
        out.append(
            Competition(
                name=name,
                url=href if href.startswith("http") else BASE + href,
                platform="AIcrowd",
                source=NAME,
                end_date=end,
                prize_raw=(cash[0] if cash else (prizes[0] if prizes else None)),
                tags=tags,
                competition_type=ctype,
                organizer=org["title"].strip() if org else None,
                description=desc.get_text(" ", strip=True) if desc else None,
            )
        )
    return out


def fetch() -> list[Competition]:
    out: list[Competition] = []
    seen: set[str] = set()
    for page in range(1, MAX_PAGES + 1):
        html = http.get_text(URL, params={"challenge_filter": "active", "page": page})
        items = parse(html)
        new = [c for c in items if c.url not in seen]
        if not new:
            break
        for c in new:
            seen.add(c.url)
        out.extend(new)
    return out

