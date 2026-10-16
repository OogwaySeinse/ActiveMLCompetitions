"""Devpost — open hackathons with the "Machine Learning/AI" theme (JSON API)."""
from __future__ import annotations

import logging
import re

from .. import http
from ..models import Competition
from ..normalize import parse_date, strip_html

NAME = "devpost"
log = logging.getLogger(__name__)
API = "https://devpost.com/api/hackathons"
MAX_PAGES = 10


def parse_period(period: str | None) -> tuple[str | None, str | None]:
    """Parse "Aug 31 - Oct 23, 2026" / "Oct 01 - 12, 2026" / "Dec 15, 2026 - Jan 10, 2027"."""
    if not period:
        return None, None
    parts = [p.strip() for p in period.split(" - ")]
    if len(parts) != 2:
        d = parse_date(period)
        return d, d
    left, right = parts
    year_m = re.search(r"(\d{4})\s*$", right)
    end_year = int(year_m.group(1)) if year_m else None
    if re.fullmatch(r"\d{1,2},\s*\d{4}", right):  # "Oct 01 - 12, 2026" -> same month
        month = left.split()[0]
        right = f"{month} {right}"
    end = parse_date(right, default_year=end_year)
    if re.search(r"\d{4}", left):
        start = parse_date(left)
    else:
        start = parse_date(f"{left}, {end_year}" if end_year else left, default_year=end_year)
        if start and end and start > end and end_year:  # range spans new year
            start = parse_date(f"{left}, {end_year - 1}")
    return start, end


def fetch() -> list[Competition]:
    out: list[Competition] = []
    seen: set[str] = set()
    for page in range(1, MAX_PAGES + 1):
        payload = http.get_json(
            API,
            params={"themes[]": "Machine Learning/AI", "status[]": "open", "page": page},
        )
        hackathons = payload.get("hackathons", [])
        if not hackathons:
            break
        for h in hackathons:
            url = h.get("url")
            if not url or url in seen or h.get("invite_only"):
                continue
            seen.add(url)
            start, end = parse_period(h.get("submission_period_dates"))
            themes = [t.get("name", "") for t in h.get("themes", []) if t.get("name")]
            location = (h.get("displayed_location") or {}).get("location")
            out.append(
                Competition(
                    name=(h.get("title") or "").strip(),
                    url=url,
                    platform="Devpost",
                    source=NAME,
                    start_date=start,
                    end_date=end,
                    prize_raw=strip_html(h.get("prize_amount")),
                    tags=themes + ([location.lower()] if location else []),
                    competition_type="hackathon",
                    organizer=h.get("organization_name"),
                    participants=h.get("registrations_count"),
                )
            )
        meta = payload.get("meta", {})
        if meta.get("total_count") is not None and page * meta.get("per_page", 9) >= meta["total_count"]:
            break
    return out

