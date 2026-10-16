"""Exchange rates for prize conversion (live with offline fallback)."""
from __future__ import annotations

import logging

from . import http
from .normalize import FALLBACK_FX_PER_USD

log = logging.getLogger(__name__)
FX_URL = "https://open.er-api.com/v6/latest/USD"


def load_rates() -> tuple[dict[str, float], str]:
    """Return (rates per 1 USD, label describing the source/date)."""
    try:
        data = http.get_json(FX_URL, timeout=15)
        rates = data.get("rates") or {}
        if data.get("result") == "success" and rates.get("EUR"):
            merged = {**FALLBACK_FX_PER_USD, **{k: float(v) for k, v in rates.items() if v}}
            return merged, f"open.er-api.com ({data.get('time_last_update_utc', 'live')})"
    except Exception as e:  # network issues must never break the run
        log.warning("Live FX rates unavailable, using fallback: %s", e)
    return dict(FALLBACK_FX_PER_USD), "static fallback rates"

