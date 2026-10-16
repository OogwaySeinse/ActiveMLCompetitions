"""Tianchi (Alibaba Cloud) — public JSON API behind the "active competitions" page."""
from __future__ import annotations

import logging

from .. import http
from ..models import Competition
from ..normalize import parse_date, today_iso

NAME = "tianchi"
log = logging.getLogger(__name__)
API = "https://tianchi.aliyun.com/v3/proxy/competition/api/race/page"
REFERER = "https://tianchi.aliyun.com/competition/gameList/activeList"
PAGE_SIZE = 50
MAX_PAGES = 5


def _url(item: dict) -> str:
    refer = (item.get("referUrl") or "").strip()
    if refer.startswith("http"):
        return refer
    if item.get("isSeries"):
        return f"https://tianchi.aliyun.com/series/{item.get('raceId')}"
    return f"https://tianchi.aliyun.com/competition/entrance/{item.get('raceId')}"


def _prize(item: dict) -> str | None:
    bonus = item.get("bonus")
    if not bonus:
        return None
    cur_raw = item.get("currency")
    # the API returns a numeric currency code; Tianchi prizes are in CNY unless a USD string is given
    cur = cur_raw.upper() if isinstance(cur_raw, str) and cur_raw.strip() else "CNY"
    symbol = {"CNY": "¥", "RMB": "¥", "USD": "$"}.get(cur, "")
    return f"{symbol}{bonus:,} {cur}" if symbol != "$" else f"${bonus:,}"


def fetch() -> list[Competition]:
    today = today_iso()
    out: list[Competition] = []
    seen: set[str] = set()
    for page in range(1, MAX_PAGES + 1):
        payload = http.get_json(
            API,
            params={"visualTab": "", "raceName": "", "pageNum": page, "pageSize": PAGE_SIZE, "isActive": 1},
            headers={"Referer": REFERER},
        )
        data = payload.get("data") or {}
        items = data.get("list") or []
        if not items:
            break
        for it in items:
            url = _url(it)
            if url in seen:
                continue
            seen.add(url)
            end = parse_date(it.get("raceEndTime"))
            if end and end < today:
                continue
            tags = []
            for t in it.get("tagsList") or []:
                tags.append(t.get("name") if isinstance(t, dict) else str(t))
            out.append(
                Competition(
                    name=(it.get("name") or f"Tianchi race {it.get('raceId')}").strip(),
                    url=url,
                    platform="Tianchi",
                    source=NAME,
                    start_date=parse_date(it.get("raceStartTime")),
                    end_date=end,
                    prize_raw=_prize(it),
                    tags=[t for t in tags if t],
                    competition_type="featured",
                    description=(it.get("highlightEn") or it.get("highlight") or it.get("introduction") or None),
                    participants=it.get("teamCount"),
                )
            )
        total = data.get("total")
        if total is not None and len(seen) >= total:
            break
    return out

