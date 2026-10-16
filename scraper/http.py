"""Shared HTTP session with retries and polite defaults."""
from __future__ import annotations

import logging

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

log = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36 ActiveMLCompetitionsBot/2.0 (+https://github.com/OogwaySeinse/ActiveMLCompetitions)"
)
DEFAULT_TIMEOUT = 30

_session: requests.Session | None = None


def session() -> requests.Session:
    global _session
    if _session is None:
        s = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=1.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            respect_retry_after_header=True,
        )
        s.mount("https://", HTTPAdapter(max_retries=retry))
        s.mount("http://", HTTPAdapter(max_retries=retry))
        s.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"})
        _session = s
    return _session


def get(url: str, *, params=None, headers=None, timeout: int = DEFAULT_TIMEOUT) -> requests.Response:
    resp = session().get(url, params=params, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp


def get_json(url: str, **kwargs):
    headers = {"Accept": "application/json", **(kwargs.pop("headers", None) or {})}
    return get(url, headers=headers, **kwargs).json()


def get_text(url: str, **kwargs) -> str:
    headers = {"Accept": "text/html,application/xhtml+xml", **(kwargs.pop("headers", None) or {})}
    resp = get(url, headers=headers, **kwargs)
    resp.encoding = resp.encoding or "utf-8"
    return resp.text

