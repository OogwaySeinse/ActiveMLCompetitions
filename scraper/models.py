"""Data model shared by all sources and the pipeline."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Competition:
    """A single competition as reported by one source.

    Sources fill in what they know; the pipeline derives the remaining fields
    (``id``, ``prize_usd``, ``category``, ``is_research`` ...) and merges
    duplicates reported by several sources.
    """

    name: str
    url: str
    platform: str
    source: str  # which scraper module produced this record

    start_date: str | None = None  # ISO YYYY-MM-DD, None = unknown / ongoing
    end_date: str | None = None
    prize_raw: str | None = None  # as displayed by the source, e.g. "€25,000"
    tags: list[str] = field(default_factory=list)
    competition_type: str | None = None  # featured / research / playground / community / hackathon / ...
    organizer: str | None = None
    co_authors: str | None = None  # research only: organisers / authors
    journal_venue: str | None = None  # research only: conference / journal (+ year)
    description: str | None = None
    participants: int | None = None

    # ---- derived by the pipeline ----
    id: str | None = None
    canonical_url: str | None = None
    prize_usd: float | None = None
    category: str | None = None
    is_research: bool = False
    sources: list[str] = field(default_factory=list)
    first_seen: str | None = None
    is_new: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Competition":
        known = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        return cls(**{k: v for k, v in d.items() if k in known})

