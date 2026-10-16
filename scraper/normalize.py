"""Normalisation helpers: dates, prizes, URLs, titles, platforms and categories."""
from __future__ import annotations

import hashlib
import html
import logging
import re
from datetime import date, datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dateutil import parser as dateparser

log = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# Dates
# --------------------------------------------------------------------------
_ONGOING_WORDS = {"ongoing", "active", "tbd", "tba", "rolling", "n/a", "none", "null", "", "active season"}


def parse_date(value, *, default_year: int | None = None) -> str | None:
    """Parse almost any date representation into ISO ``YYYY-MM-DD`` (or ``None``).

    Handles ISO timestamps, ``"15 Oct 2026"``, ``"Oct 15, 2026"``, datetime
    objects and malformed strings such as ``"11 May 2026 Apr 2026"`` (the first
    date wins).
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    s = str(value).strip()
    if s.lower() in _ONGOING_WORDS or s.lower().startswith("ongoing"):
        return None
    # ISO timestamp fast path
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", s)
    if m:
        return m.group(1)
    # Malformed "11 May 2026 Apr 2026" -> keep first "d Mon yyyy" chunk
    m = re.match(r"^(\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4})", s)
    if m:
        s = m.group(1)
    try:
        default = datetime(default_year or datetime.now().year, 1, 1)
        return dateparser.parse(s, default=default, fuzzy=True).date().isoformat()
    except (ValueError, OverflowError, TypeError):
        log.debug("Unparseable date: %r", value)
        return None


def today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


# --------------------------------------------------------------------------
# Prizes
# --------------------------------------------------------------------------
# Approximate fallback FX rates (units of currency per 1 USD). Live rates are
# fetched by ``fx.load_rates`` when available; these are only used offline.
FALLBACK_FX_PER_USD = {
    "USD": 1.0, "EUR": 0.92, "GBP": 0.78, "CHF": 0.88, "CAD": 1.37, "AUD": 1.52,
    "JPY": 150.0, "CNY": 7.2, "INR": 84.0, "RUB": 95.0, "SGD": 1.34, "KRW": 1380.0,
    "BRL": 5.5, "ZAR": 18.5, "NGN": 1550.0, "KES": 129.0, "HKD": 7.8, "SEK": 10.6,
    "NOK": 10.8, "DKK": 6.9, "PLN": 4.0, "AED": 3.67, "SAR": 3.75, "TRY": 34.0,
}

_SYMBOLS = [
    ("US$", "USD"), ("CA$", "CAD"), ("C$", "CAD"), ("A$", "AUD"), ("AU$", "AUD"), ("S$", "SGD"),
    ("HK$", "HKD"), ("R$", "BRL"), ("€", "EUR"), ("£", "GBP"), ("₹", "INR"), ("₽", "RUB"),
    ("₩", "KRW"), ("₦", "NGN"), ("元", "CNY"), ("円", "JPY"), ("$", "USD"),
]
_CODE_WORDS = {
    "usd": "USD", "dollars": "USD", "eur": "EUR", "euro": "EUR", "euros": "EUR", "gbp": "GBP",
    "chf": "CHF", "cad": "CAD", "aud": "AUD", "jpy": "JPY", "yen": "JPY", "cny": "CNY", "rmb": "CNY",
    "yuan": "CNY", "inr": "INR", "rub": "RUB", "rubles": "RUB", "roubles": "RUB", "sgd": "SGD",
    "krw": "KRW", "brl": "BRL", "zar": "ZAR", "ngn": "NGN", "kes": "KES", "hkd": "HKD", "sek": "SEK",
    "nok": "NOK", "dkk": "DKK", "pln": "PLN", "aed": "AED", "sar": "SAR", "try": "TRY",
}
# Platforms where a bare "¥" means a particular currency
_YEN_PLATFORM = {"signate": "JPY", "tianchi": "CNY", "tianchi alibaba": "CNY"}

_NON_CASH = re.compile(
    r"\b(points?|kudos|knowledge|swag|medals?|qualifier|certificate|jobs?|recruitment|"
    r"glory|prizes? tbd|none|n/a|no prize|credits only|internship)\b",
    re.I,
)
_NUM = re.compile(r"(\d+(?:[ ,\u00a0\u202f]\d{3})*(?:\.\d+)?)\s*([kKmM](?:illion)?\b|万|億|亿)?")
_MULTIPLIERS = {"k": 1_000, "m": 1_000_000, "万": 10_000, "億": 100_000_000, "亿": 100_000_000}


def strip_html(s: str | None) -> str | None:
    if s is None:
        return None
    s = re.sub(r"<[^>]+>", "", str(s))
    return html.unescape(s).strip() or None


def detect_currency(raw: str, platform: str | None = None) -> str | None:
    low = raw.lower()
    for word, code in _CODE_WORDS.items():
        if re.search(rf"\b{word}\b", low):
            return code
    if "¥" in raw or "￥" in raw:
        return _YEN_PLATFORM.get((platform or "").lower(), "CNY")
    for sym, code in _SYMBOLS:
        if sym in raw:
            return code
    return None


def parse_prize(raw, *, platform: str | None = None, fx_per_usd: dict[str, float] | None = None) -> float | None:
    """Convert a free-text prize into a USD amount.

    Returns ``None`` for non-cash rewards (points, kudos, swag, knowledge...) or
    when no amount can be found. Picks the *largest* amount mentioned, which
    corresponds to the total pool in strings such as ``"$50,000 ($25k 1st)"``.
    """
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw) if raw > 0 else None
    text = strip_html(str(raw)) or ""
    if not text:
        return None
    currency = detect_currency(text, platform)
    if currency is None and _NON_CASH.search(text):
        return None
    if "point" in text.lower() and currency is None:
        return None

    amounts = []
    for num, suffix in _NUM.findall(text):
        cleaned = re.sub(r"[ ,\u00a0\u202f]", "", num)
        try:
            val = float(cleaned)
        except ValueError:
            continue
        if suffix:
            val *= _MULTIPLIERS.get(suffix[0].lower(), 1)
        amounts.append(val)
    # ignore obvious years / ranks
    amounts = [a for a in amounts if not (1900 <= a <= 2100 and len(amounts) > 1)]
    if not amounts:
        return None
    amount = max(amounts)
    if amount <= 0:
        return None
    if currency is None:
        # bare number with no currency/cash hint: assume USD only if it looks like money
        if amount < 50:
            return None
        currency = "USD"
    rates = fx_per_usd or FALLBACK_FX_PER_USD
    rate = rates.get(currency) or FALLBACK_FX_PER_USD.get(currency)
    if not rate:
        return None
    return round(amount / rate, 2)


# --------------------------------------------------------------------------
# URLs & titles
# --------------------------------------------------------------------------
_TRACKING_PARAMS = re.compile(r"^(utm_.*|ref|ref_src|source|fbclid|gclid|mc_cid|mc_eid|via|s)$", re.I)
_KAGGLE_SUBPAGES = re.compile(r"/(overview|data|code|discussion|leaderboard|rules|team|submissions|models)(/.*)?$")


def canonical_url(url: str | None) -> str:
    """Normalise a URL so the same competition from different sources matches."""
    if not url:
        return ""
    url = url.strip()
    if url.startswith("//"):
        url = "https:" + url
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    parts = urlsplit(url)
    host = parts.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = re.sub(r"/{2,}", "/", parts.path).rstrip("/")
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=False) if not _TRACKING_PARAMS.match(k)]

    if host == "kaggle.com":
        path = re.sub(r"^/c/", "/competitions/", path)
        path = _KAGGLE_SUBPAGES.sub("", path)
        query = []
        path = path.lower()
    elif host in ("drivendata.org",):
        # /competitions/253/slug/page/xyz -> /competitions/253
        m = re.match(r"^(/competitions/\d+)", path)
        if m:
            path = m.group(1)
        query = []
    elif host in ("zindi.africa", "aicrowd.com"):
        path = re.sub(r"^(/(?:competitions|challenges)/[^/]+).*$", r"\1", path).lower()
        query = []
    elif host.endswith("codabench.org") or "codalab" in host:
        m = re.search(r"/competitions/(\d+)", path)
        if m:
            path = f"/competitions/{m.group(1)}"
        query = [(k, v) for k, v in query if k in ("id",)]
    elif host == "huggingface.co":
        path = path.lower()
        query = []
    elif host.endswith("devpost.com"):
        query = []

    return urlunsplit(("https", host, path, urlencode(sorted(query)), ""))


def strip_tracking(url: str | None) -> str:
    """Remove tracking query params (``?ref=mlcontests``, ``utm_*``) from a display URL."""
    if not url:
        return ""
    parts = urlsplit(url.strip())
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not _TRACKING_PARAMS.match(k)]
    return urlunsplit((parts.scheme or "https", parts.netloc, parts.path, urlencode(query), parts.fragment))


def url_id(canon: str) -> str:
    return hashlib.sha1(canon.encode("utf-8")).hexdigest()[:12]


_STOP = {"the", "a", "an", "of", "for", "and", "in", "on", "with", "to", "challenge", "competition", "2024", "2025", "2026", "2027"}


def normalize_title(name: str) -> str:
    s = html.unescape(name or "").lower()
    s = re.sub(r"[\u2010-\u2015]", "-", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(w for w in s.split() if w not in _STOP)


def clean_name(name: str | None) -> str:
    s = html.unescape(name or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s


# --------------------------------------------------------------------------
# Platforms
# --------------------------------------------------------------------------
_PLATFORM_ALIASES = {
    "kaggle": "Kaggle", "zindi": "Zindi", "drivendata": "DrivenData", "aicrowd": "AIcrowd",
    "codabench": "Codabench", "codalab": "CodaLab", "hugging face": "Hugging Face", "huggingface": "Hugging Face",
    "devpost": "Devpost", "tianchi": "Tianchi", "tianchi alibaba": "Tianchi", "signate": "SIGNATE",
    "ods.ai": "ODS.ai", "ods": "ODS.ai", "yandex": "Yandex Cup", "yandex cup": "Yandex Cup",
    "trustii.io": "Trustii", "trustii": "Trustii", "evalai": "EvalAI", "crunchdao": "CrunchDAO",
    "thinkonward": "ThinkOnward", "onward": "ThinkOnward", "grand challenge": "Grand Challenge",
}


def normalize_platform(name: str | None, url: str | None = None) -> str:
    key = (name or "").strip().lower()
    if key in _PLATFORM_ALIASES:
        return _PLATFORM_ALIASES[key]
    host = urlsplit(url or "").netloc.lower()
    for needle, plat in (
        ("kaggle.com", "Kaggle"), ("zindi.africa", "Zindi"), ("drivendata.org", "DrivenData"),
        ("aicrowd.com", "AIcrowd"), ("codabench.org", "Codabench"), ("codalab", "CodaLab"),
        ("huggingface.co", "Hugging Face"), ("devpost.com", "Devpost"), ("tianchi.aliyun.com", "Tianchi"),
        ("signate.jp", "SIGNATE"), ("ods.ai", "ODS.ai"), ("eval.ai", "EvalAI"), ("crunchdao", "CrunchDAO"),
        ("grand-challenge.org", "Grand Challenge"), ("thinkonward.com", "ThinkOnward"),
    ):
        if needle in host:
            return plat
    return (name or "Independent").strip() or "Independent"


# --------------------------------------------------------------------------
# Categories (unified taxonomy)
# --------------------------------------------------------------------------
# Order matters: the first matching category becomes the primary one.
CATEGORY_RULES: list[tuple[str, re.Pattern]] = [
    ("LLMs & Agents", re.compile(r"\b(llms?|large language|gpt|gemma|agents?|agentic|reasoning|prompt|rag|chatbot|arc-agi|math olympiad|aimo)\b", re.I)),
    ("Generative AI", re.compile(r"\b(generative|genai|diffusion|text-to-image|image generation|synthetic data|gan)\b", re.I)),
    ("Healthcare & Biology", re.compile(r"\b(medical|medicine|health\w*|clinical|biolog\w*|biomedical|genom\w*|protein\w*|molecul\w*|drugs?|chemistry|chemical|mri|ct scan|radiolog\w*|patholog\w*|cancer|brain signals?|neuroscien\w*|neurolog\w*|rsna|miccai|disease\w*|alzheimer\w*|dementia|cells?|cellular|patients?|embryo\w*|mass spectr\w*)\b", re.I)),
    ("Computer Vision", re.compile(r"\b(vision|image|video|cv|detection|segmentation|object|3d|pose|ocr|satellite imagery|camera|visual)\w*", re.I)),
    ("NLP", re.compile(r"\b(nlp|language|text|translation|summari[sz]ation|question answering|sentiment|named entity)\w*", re.I)),
    ("Audio & Speech", re.compile(r"\b(audio|speech|asr|sound|music|acoustic|voice)\w*", re.I)),
    ("Time Series & Forecasting", re.compile(r"\b(time ?series|forecast\w*|temporal|sensor|timeseries)\b", re.I)),
    ("Finance & Trading", re.compile(r"\b(financ\w*|trading|stock|equity|crypto|market|hedge|order book|quant\w*)\b", re.I)),
    ("Reinforcement Learning", re.compile(r"\b(reinforcement|rl|simulation|game|environment|control)\b", re.I)),
    ("Robotics & Autonomy", re.compile(r"\b(robot\w*|autonomous|driving|navigation|drone|waymo|lidar)\b", re.I)),
    ("Earth & Climate", re.compile(r"\b(climate|weather|earth|satellite|geospatial|remote sensing|agricultur\w*|energy|ocean|wildfire|flood|carbon)\b", re.I)),
    ("Science & Physics", re.compile(r"\b(physics|scientific|fusion|pde|astronom\w*|particle|materials?|quantum)\b", re.I)),
    ("Optimization & Systems", re.compile(r"\b(optimi[sz]ation|kernel|gpu|inference|compiler|hardware|efficien\w*|compression)\b", re.I)),
    ("Security & Privacy", re.compile(r"\b(security|privacy|adversarial|cyber|fraud|malware|differential privacy)\b", re.I)),
    ("Tabular", re.compile(r"\b(tabular|regression|classification|structured data|playground)\b", re.I)),
    # broad fallback for generic AI/ML hackathons & challenges
    ("General ML & AI", re.compile(r"(machine learning|artificial intelligence|data science|deep learning|\bai\b|\bml\b)", re.I)),
]


def infer_category(name: str, tags: list[str], description: str | None = None) -> str:
    haystack_tags = " ".join(tags or [])
    for text in (haystack_tags, name or "", description or ""):
        if not text:
            continue
        for cat, rx in CATEGORY_RULES:
            if rx.search(text):
                return cat
    return "Other"


def normalize_tags(tags) -> list[str]:
    out: list[str] = []
    for t in tags or []:
        if isinstance(t, dict):
            t = t.get("name") or t.get("ref") or ""
        t = str(t).strip().lower()
        if t and t not in out and t not in ("measurable",):
            out.append(t)
    return out

