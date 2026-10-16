"""Kaggle — official API (general + community competitions).

Credentials are read from ``KAGGLE_USERNAME``/``KAGGLE_KEY`` env vars, from
``~/.kaggle/kaggle.json`` or from a ``kaggle.json`` in the repository root
(git-ignored).
"""
from __future__ import annotations

import logging
import os
from datetime import date, timedelta
from pathlib import Path

from ..models import Competition
from ..normalize import parse_date, today_iso

NAME = "kaggle"
log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
GROUPS = ("general", "community")
# The API returns at most 20 per page. Community lists start with hundreds of
# "perpetual" class sandboxes (deadlines in 2030-2222), so allow many pages.
MAX_PAGES = 80
PAGE_SIZE = 20
# Community competitions with deadlines further away than this are treated as
# perpetual class/sandbox competitions and skipped.
COMMUNITY_HORIZON_DAYS = 400

_TYPE_MAP = {
    "featured": "featured",
    "research": "research",
    "playground": "playground",
    "getting started": "getting-started",
    "gettingstarted": "getting-started",
    "recruitment": "recruitment",
    "masters": "masters",
    "community": "community",
    "analytics": "analytics",
}


def _configure_credentials() -> bool:
    if os.environ.get("KAGGLE_USERNAME") and os.environ.get("KAGGLE_KEY"):
        return True
    if os.environ.get("KAGGLE_API_TOKEN"):
        return True
    if (Path.home() / ".kaggle" / "kaggle.json").exists():
        return True
    if (REPO_ROOT / "kaggle.json").exists():
        os.environ.setdefault("KAGGLE_CONFIG_DIR", str(REPO_ROOT))
        return True
    return False


def _get(obj, *names, default=None):
    for n in names:
        v = getattr(obj, n, None)
        if v is None and isinstance(obj, dict):
            v = obj.get(n)
        if v not in (None, ""):
            return v
    return default


def _list_competitions(api, group: str):
    """Yield competitions sorted by latest deadline until deadlines are in the past.

    The list endpoint is page-number based and the server caps page size at 20,
    so we walk pages until a page is empty, repeats itself, or only contains
    competitions whose deadline has passed.
    """
    today = today_iso()
    seen: set[str] = set()
    for page in range(1, MAX_PAGES + 1):
        resp = api.competitions_list(group=group, sort_by="latestDeadline", page=page, page_size=PAGE_SIZE)
        if resp is None:
            break
        comps = list(_get(resp, "competitions", default=[]) or [])
        fresh = [c for c in comps if _get(c, "url", "ref") not in seen]
        if not fresh:
            break
        for c in fresh:
            seen.add(_get(c, "url", "ref"))
        yield from fresh
        deadlines = [d for d in (parse_date(_get(c, "deadline")) for c in fresh) if d]
        if deadlines and max(deadlines) < today:
            break


def fetch() -> list[Competition]:
    if not _configure_credentials():
        raise RuntimeError("Kaggle credentials not configured (set KAGGLE_USERNAME/KAGGLE_KEY)")

    from kaggle.api.kaggle_api_extended import KaggleApi  # imported lazily: authenticates on import in some versions

    api = KaggleApi()
    api.authenticate()
    today = today_iso()
    horizon = (date.fromisoformat(today) + timedelta(days=COMMUNITY_HORIZON_DAYS)).isoformat()
    out: dict[str, Competition] = {}

    for group in GROUPS:
        n = 0
        for c in _list_competitions(api, group):
            deadline = parse_date(_get(c, "deadline"))
            if deadline and deadline < today:
                continue
            if group == "community" and (deadline is None or deadline > horizon):
                continue
            url = _get(c, "url", "ref", default="")
            if url and not url.startswith("http"):
                url = f"https://www.kaggle.com/competitions/{url}"
            if not url or url in out:
                continue
            category = str(_get(c, "category", default="") or "").strip()
            ctype = "community" if group == "community" else _TYPE_MAP.get(category.lower(), category.lower() or None)
            tags = []
            for t in _get(c, "tags", default=[]) or []:
                name = _get(t, "name", "ref")
                if name and name not in ("custom metric",):
                    tags.append(str(name))
            organizer = _get(c, "organization_name", "organizationName", "host_name", "hostName")
            out[url] = Competition(
                name=str(_get(c, "title", default=url)).strip(),
                url=url,
                platform="Kaggle",
                source=NAME,
                start_date=parse_date(_get(c, "enabled_date", "enabledDate")),
                end_date=deadline,
                prize_raw=str(_get(c, "reward", default="") or "").strip() or None,
                tags=tags,
                competition_type=ctype,
                organizer=organizer,
                description=_get(c, "description"),
                participants=_get(c, "team_count", "teamCount"),
            )
            n += 1
        log.info("Kaggle group=%s -> %d active", group, n)
    return list(out.values())
