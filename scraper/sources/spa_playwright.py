"""JavaScript-rendered platforms via headless Chromium (Playwright).

Covers SIGNATE (structured card parsing), ODS.ai and Yandex Cup. These pages
expose no public API, so records are best-effort. Tianchi has its own
API-based module. Disable with ``SCRAPER_DISABLE_PLAYWRIGHT=1``.
"""
from __future__ import annotations

import logging
import os
import re

from ..http import USER_AGENT
from ..models import Competition

NAME = "spa_playwright"
log = logging.getLogger(__name__)

SIGNATE_URL = "https://user.competition.signate.jp/en/competition/list/"
SIGNATE_BASE = "https://user.competition.signate.jp"
ODS_URL = "https://ods.ai/competitions"
YANDEX_URL = "https://yandex.com/cup/ml"

_JUNK = re.compile(r"^(learn more|details|more|join|register|view|see all|participate|submit|\d+)$", re.I)
_SIGNATE_PRACTICE = re.compile(r"(練習問題|復刻版|revival|\bSOTA\b|beginner)", re.I)

# Extract structured fields from SIGNATE's MUI cards in the browser
_SIGNATE_JS = """
() => [...document.querySelectorAll("a[href*='/competition/detail/']")].map(a => {
  const txt = (sel) => [...a.querySelectorAll(sel)].map(e => (e.innerText || '').trim()).filter(Boolean);
  return {
    href: a.getAttribute('href'),
    h3: txt('.MuiTypography-h3'),
    h6: txt('.MuiTypography-h6'),
    body: txt('.MuiTypography-body2'),
  };
})
"""


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()[:160]


def parse_signate_cards(cards: list[dict]) -> list[Competition]:
    out: list[Competition] = []
    seen: set[str] = set()
    for c in cards:
        href = c.get("href") or ""
        h3, h6 = c.get("h3") or [], c.get("h6") or []
        if not href or not h3:
            continue
        status = (h6[-1] if h6 else "").lower()
        # keep only open competitions ("Open"); skip "Closed" and "N days until open"
        if status != "open":
            continue
        url = href if href.startswith("http") else SIGNATE_BASE + href
        if url in seen:
            continue
        seen.add(url)
        name = _clean(h3[0])
        prize = h3[-1] if len(h3) > 1 and re.search(r"\d", h3[-1]) else None
        organizer = h6[0] if len(h6) > 1 else None
        ctype = "practice" if _SIGNATE_PRACTICE.search(name) else "featured"
        out.append(
            Competition(
                name=name,
                url=url,
                platform="SIGNATE",
                source=NAME,
                prize_raw=prize,
                organizer=organizer,
                description=_clean(" ".join(c.get("body") or [])) or None,
                competition_type=ctype,
            )
        )
    return out


def fetch() -> list[Competition]:
    if os.environ.get("SCRAPER_DISABLE_PLAYWRIGHT"):
        from . import SkipSource

        raise SkipSource("disabled via SCRAPER_DISABLE_PLAYWRIGHT")
    from playwright.sync_api import sync_playwright  # lazy import

    out: list[Competition] = []
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=USER_AGENT, locale="en-US")
        page = ctx.new_page()

        # --- SIGNATE ---
        try:
            page.goto(SIGNATE_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(2000)
            items = parse_signate_cards(page.evaluate(_SIGNATE_JS))
            out.extend(items)
            log.info("  SIGNATE -> %d open", len(items))
        except Exception as e:
            errors.append(f"SIGNATE: {e}")
            log.warning("SIGNATE failed: %s", e)

        # --- ODS.ai (often slow / geo-restricted) ---
        try:
            page.goto(ODS_URL, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(4000)
            seen: set[str] = set()
            for el in page.query_selector_all("a[href*='/competitions/'], a[href*='/tracks/']"):
                href = el.get_attribute("href") or ""
                text = _clean(el.inner_text())
                if not href or len(text) < 8 or _JUNK.match(text) or re.search(r"/competitions/?$", href):
                    continue
                full = href if href.startswith("http") else "https://ods.ai" + href
                if full in seen:
                    continue
                seen.add(full)
                out.append(Competition(name=text, url=full, platform="ODS.ai", source=NAME, competition_type="featured"))
            log.info("  ODS.ai -> %d", len(seen))
        except Exception as e:
            errors.append(f"ODS.ai: {e}")
            log.warning("ODS.ai failed: %s", e)

        # --- Yandex Cup: single seasonal competition, only the page title is reliable ---
        try:
            page.goto(YANDEX_URL, wait_until="domcontentloaded", timeout=45000)
            title = _clean(page.title())
            if title and "cup" in title.lower():
                out.append(Competition(name=title, url=YANDEX_URL, platform="Yandex Cup", source=NAME, competition_type="featured"))
        except Exception as e:
            errors.append(f"Yandex: {e}")
        browser.close()

    if not out and errors:
        raise RuntimeError("; ".join(errors))
    return out
