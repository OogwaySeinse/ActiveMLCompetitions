"""Research-competition enrichment: venue (conference/journal) and co-authors."""
from __future__ import annotations

import re

from .models import Competition

_CONFERENCES = (
    r"NeurIPS|NIPS|ICML|ICLR|CVPR|ICCV|ECCV|WACV|BMVC|MICCAI|ISBI|MIDL|ACL|EMNLP|NAACL|EACL|COLING|"
    r"SemEval|LifeCLEF|ImageCLEF|CLEF|KDD|WSDM|SIGIR|RecSys|AAAI|IJCAI(?:-ECAI)?|ICRA|IROS|CoRL|ICASSP|"
    r"Interspeech|ACM\s?MM|ACM Multimedia|ISWC|ESWC|ECML[- ]PKDD|GECCO|IEEE SaTML|SaTML|AutoML|ICDM|CIKM|"
    r"ICPR|ICIP|ICDAR|MLSys|ECAI|AICAS|IJCNN|ICME|ACCV|3DV|ICDE|DCASE|BraTS"
)
_CONF_RX = re.compile(rf"(?<![A-Za-z])({_CONFERENCES})\s*['’]?\s*(20\d{{2}}|\d{{2}})?(?![A-Za-z])")
_JOURNAL_RX = re.compile(
    r"\b(Journal of [A-Z][\w&\- ]{3,60}|IEEE Transactions on [\w&\- ]{3,60}|Nature [A-Z]\w+|Scientific Data|"
    r"PMLR|JMLR|DMLR|Medical Image Analysis|Machine Learning for Health)\b"
)
_RESEARCH_TAG = re.compile(r"\b(research|paper track|academic|workshop)\b", re.I)


def _norm_year(y: str | None) -> str:
    if not y:
        return ""
    return y if len(y) == 4 else f"20{y}"


def extract_venue(*texts: str | None) -> str | None:
    for text in texts:
        if not text:
            continue
        m = _CONF_RX.search(text)
        if m:
            conf = re.sub(r"\s+", " ", m.group(1)).replace("NIPS", "NeurIPS")
            if conf.upper().startswith("ACM") and "MULTIMEDIA" not in conf.upper():
                conf = "ACM MM"
            year = _norm_year(m.group(2))
            return f"{conf} {year}".strip()
        j = _JOURNAL_RX.search(text)
        if j:
            return j.group(1).strip()
    return None


def enrich(c: Competition) -> None:
    """Fill ``is_research``, ``journal_venue`` and ``co_authors`` in place."""
    venue = c.journal_venue or extract_venue(c.name, c.description, " ".join(c.tags))
    is_research = (
        c.competition_type == "research"
        or venue is not None
        or any(_RESEARCH_TAG.search(t) for t in c.tags)
        or bool(re.search(r"\b(paper track|research track|workshop)\b", c.name, re.I))
    )
    c.is_research = bool(is_research)
    if c.is_research:
        c.journal_venue = venue
        c.co_authors = c.co_authors or c.organizer
        if c.competition_type in (None, "featured", "competition"):
            c.competition_type = "research"
    else:
        c.journal_venue = None
        c.co_authors = None
