"""DrivenData — HTML listing (cards carry machine-readable data attributes)."""
from __future__ import annotations

import logging
import re

from bs4 import BeautifulSoup

from .. import http
from ..models import Competition
from ..normalize import parse_date, today_iso

NAME = "drivendata"
log = logging.getLogger(__name__)
URL = "https://www.drivendata.org/competitions/"
BASE = "https://www.drivendata.org"

_SECTION_TYPES = {
    "prize": "featured",
    "benchmark": "benchmark",
    "practice": "practice",
}


def _section_type(card) -> str | None:
    h2 = card.find_previous("h2")
    title = h2.get_text(" ", strip=True).lower() if h2 else ""
    if "completed" in title or "past" in title:
        return None
    for key, ctype in _SECTION_TYPES.items():
        if key in title:
            return ctype
    return "featured"


def parse(html: str) -> list[Competition]:
    soup = BeautifulSoup(html, "lxml")
    today = today_iso()
    out: list[Competition] = []
    seen: set[str] = set()
    for card in soup.select("div.panel-container"):
        ctype = _section_type(card)
        if ctype is None:
            continue
        link = card.select_one("h3 a[href*='/competitions/']") or card.select_one("a[href*='/competitions/']")
        if not link:
            continue
        href = link["href"]
        if href in seen:
            continue
        seen.add(href)
        name = link.get_text(" ", strip=True) or link.get("title") or ""

        start = None
        if card.get("data-start_date"):
            start = parse_date(card["data-start_date"])
        end = None
        end_el = card.select_one(".end-date")
        if end_el is not None and end_el.get("title"):
            end = parse_date(end_el["title"].replace("p.m.", "PM").replace("a.m.", "AM"))
        if end is None:
            m = re.match(r"^-?1?(\d{8})$", card.get("data-deadline", ""))
            if m:
                end = parse_date(m.group(1))
        if end and end < today:
            continue

        prize_raw = None
        prize_el = card.select_one(".prize")
        if prize_el:
            prize_raw = prize_el.get_text(" ", strip=True)
        elif card.get("data-total_prize_purse"):
            try:
                purse = float(card["data-total_prize_purse"])
                prize_raw = f"${purse:,.0f}" if purse > 0 else None
            except ValueError:
                pass

        tags = [k.replace("data-category_", "") for k in card.attrs if k.startswith("data-category_")]
        host_img = card.select_one("img[alt^='Hosted by']")
        organizer = host_img["alt"].replace("Hosted by", "").strip() if host_img else None
        desc_el = card.select_one(".row-description p")
        joined = card.get("data-joined")

        out.append(
            Competition(
                name=name,
                url=href if href.startswith("http") else BASE + href,
                platform="DrivenData",
                source=NAME,
                start_date=start,
                end_date=end,
                prize_raw=prize_raw,
                tags=tags,
                competition_type=ctype,
                organizer=organizer,
                description=desc_el.get_text(" ", strip=True).split("#")[0].strip() if desc_el else None,
                participants=int(joined) if joined and joined.isdigit() else None,
            )
        )
    return out


def fetch() -> list[Competition]:
    return parse(http.get_text(URL))

