"""Source registry.

Each source module exposes ``NAME`` (str) and ``fetch() -> list[Competition]``.
Sources must raise on hard failure; the pipeline isolates them so that one
broken site never stops the run.
"""
from __future__ import annotations

from importlib import import_module

# Order = merge priority: earlier (direct platform) sources win over later
# aggregators when the same field is reported by several sources.
SOURCE_MODULES = [
    "kaggle",
    "zindi",
    "drivendata",
    "aicrowd",
    "codalab",
    "devpost",
    "tianchi",
    "spa_playwright",
    # Aggregator: lowest priority, fills gaps. Codabench (anti-bot decoy on its
    # API) and Hugging Face (no public listing of active competitions) are
    # covered through this feed rather than scraped directly.
    "mlcontests",
]


def load_sources(only: list[str] | None = None):
    mods = []
    for name in SOURCE_MODULES:
        if only and name not in only:
            continue
        mods.append(import_module(f"scraper.sources.{name}"))
    return mods


def priority(source_name: str) -> int:
    try:
        return SOURCE_MODULES.index(source_name)
    except ValueError:
        return len(SOURCE_MODULES)


class SkipSource(Exception):
    """Raised by a source that is intentionally disabled (not an error)."""
