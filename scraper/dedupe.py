"""Duplicate detection and field-level merging across sources."""
from __future__ import annotations

import logging
import re
from collections import defaultdict
from urllib.parse import urlsplit

from rapidfuzz import fuzz

from .models import Competition
from .normalize import canonical_url, normalize_title
from .sources import priority

log = logging.getLogger(__name__)

FUZZY_THRESHOLD = 90
AGGREGATORS = {"mlcontests"}
# Hosts where different URL paths always mean different competitions
PLATFORM_HOSTS = {
    "kaggle.com", "zindi.africa", "drivendata.org", "aicrowd.com", "codabench.org",
    "codalab.lisn.upsaclay.fr", "huggingface.co", "tianchi.aliyun.com", "eval.ai",
}


class _UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[max(ra, rb)] = min(ra, rb)


def _numbers(title: str) -> frozenset[str]:
    return frozenset(re.findall(r"\d+", title))


def _host(canon: str) -> str:
    return urlsplit(canon).netloc


def _dates_compatible(a: Competition, b: Competition, tolerance_days: int = 7) -> bool:
    if not a.end_date or not b.end_date:
        return True
    from datetime import date

    da, db = date.fromisoformat(a.end_date), date.fromisoformat(b.end_date)
    return abs((da - db).days) <= tolerance_days


def _fuzzy_same(a: Competition, b: Competition, ta: str, tb: str) -> bool:
    if not ta or not tb:
        return False
    # different numbered tracks/editions are different competitions
    if _numbers(a.name) != _numbers(b.name):
        return False
    # two direct-platform URLs on the same host but different paths are different competitions
    ha, hb = _host(a.canonical_url or ""), _host(b.canonical_url or "")
    if ha == hb and ha in PLATFORM_HOSTS and a.canonical_url != b.canonical_url:
        return False
    # need at least one aggregator, or matching platforms, to consider a fuzzy match
    if not (a.source in AGGREGATORS or b.source in AGGREGATORS or a.platform == b.platform):
        return False
    if not _dates_compatible(a, b):
        return False
    score = fuzz.token_sort_ratio(ta, tb)
    if score >= FUZZY_THRESHOLD:
        return True
    # one title fully contained in the other (e.g. sponsor suffix added by aggregator)
    short, long_ = sorted((ta, tb), key=len)
    return len(short.split()) >= 3 and fuzz.partial_ratio(short, long_) >= 97 and a.platform == b.platform


def _first(values):
    for v in values:
        if v not in (None, "", []):
            return v
    return None


def _merge_group(group: list[Competition]) -> Competition:
    # direct sources first, then by registry priority
    group = sorted(group, key=lambda c: (c.source in AGGREGATORS, priority(c.source)))
    primary = group[0]
    merged = Competition(
        name=primary.name,
        url=primary.url,
        platform=_first(c.platform for c in group if c.platform not in ("Independent", "")) or primary.platform,
        source=primary.source,
    )
    for field in ("start_date", "end_date", "competition_type", "organizer", "journal_venue", "description", "participants"):
        setattr(merged, field, _first(getattr(c, field) for c in group))

    # Prize: prefer a source whose raw prize parses as cash
    from .normalize import parse_prize

    cash = [c.prize_raw for c in group if c.prize_raw and parse_prize(c.prize_raw, platform=c.platform)]
    merged.prize_raw = _first(cash) or _first(c.prize_raw for c in group)

    # Research type from any source wins over generic types
    if any(c.competition_type == "research" for c in group) and merged.competition_type in (None, "featured", "competition"):
        merged.competition_type = "research"

    tags: list[str] = []
    for c in group:
        for t in c.tags:
            if t not in tags:
                tags.append(t)
    merged.tags = tags

    organizers: list[str] = []
    for c in group:
        for o in re.split(r"\s*[;,]\s*|\s+&\s+", c.organizer or ""):
            o = o.strip()
            if o and o.lower() not in (x.lower() for x in organizers):
                organizers.append(o)
    merged.co_authors = "; ".join(organizers) or None

    merged.sources = sorted({c.source for c in group}, key=priority)
    merged.canonical_url = primary.canonical_url
    return merged


def dedupe(records: list[Competition]) -> list[Competition]:
    """Group records referring to the same competition and merge them."""
    n = len(records)
    for r in records:
        r.canonical_url = canonical_url(r.url)
    titles = [normalize_title(r.name) for r in records]
    uf = _UnionFind(n)

    by_url: dict[str, list[int]] = defaultdict(list)
    for i, r in enumerate(records):
        by_url[r.canonical_url].append(i)
    for idxs in by_url.values():
        for j in idxs[1:]:
            uf.union(idxs[0], j)

    # exact normalised-title + platform match
    by_title: dict[tuple[str, str], list[int]] = defaultdict(list)
    for i, r in enumerate(records):
        if titles[i]:
            by_title[(titles[i], r.platform)].append(i)
    for idxs in by_title.values():
        for j in idxs[1:]:
            if _fuzzy_same(records[idxs[0]], records[j], titles[idxs[0]], titles[j]) or records[idxs[0]].canonical_url == records[j].canonical_url:
                uf.union(idxs[0], j)

    # fuzzy pass (n is a few hundred, O(n^2) is fine)
    for i in range(n):
        for j in range(i + 1, n):
            if uf.find(i) == uf.find(j):
                continue
            if _fuzzy_same(records[i], records[j], titles[i], titles[j]):
                uf.union(i, j)

    groups: dict[int, list[Competition]] = defaultdict(list)
    for i, r in enumerate(records):
        groups[uf.find(i)].append(r)
    merged = [_merge_group(g) for g in groups.values()]
    log.info("Dedupe: %d raw records -> %d unique competitions (%d merged)", n, len(merged), n - len(merged))
    return merged
