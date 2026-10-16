from scraper.dedupe import dedupe
from scraper.models import Competition
from scraper.research import enrich, extract_venue


def C(**kw) -> Competition:
    base = dict(name="x", url="https://example.com/x", platform="Kaggle", source="kaggle")
    base.update(kw)
    return Competition(**base)


def test_same_url_different_sources_merge_and_keep_direct_fields():
    recs = [
        C(name="ARC Prize 2026 - ARC-AGI-2", url="https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-2",
          prize_raw="700,000 Usd", end_date="2026-11-02", organizer="Abstraction and Reasoning Corpus"),
        C(name="ARC Prize 2026 ARC-AGI-2", url="https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-2?ref=mlcontests",
          source="mlcontests", prize_raw="$700,000", end_date="2026-11-03", organizer="ARC Prize", journal_venue="NeurIPS 2026"),
    ]
    out = dedupe(recs)
    assert len(out) == 1
    m = out[0]
    assert m.sources == ["kaggle", "mlcontests"]
    assert m.end_date == "2026-11-02"  # direct source wins
    assert m.journal_venue == "NeurIPS 2026"  # gap filled by aggregator
    assert m.co_authors == "Abstraction and Reasoning Corpus; ARC Prize"  # no split on "and"


def test_numbered_tracks_are_not_merged():
    recs = [
        C(name="ARC Prize 2026 - ARC-AGI-2", url="https://www.kaggle.com/competitions/arc-agi-2"),
        C(name="ARC Prize 2026 - ARC-AGI-3", url="https://www.kaggle.com/competitions/arc-agi-3"),
    ]
    assert len(dedupe(recs)) == 2


def test_same_host_different_paths_not_fuzzy_merged():
    recs = [
        C(name="Playground Series Tabular", url="https://www.kaggle.com/competitions/a"),
        C(name="Playground Series Tabular", url="https://www.kaggle.com/competitions/b"),
    ]
    assert len(dedupe(recs)) == 2


def test_fuzzy_merge_aggregator_with_different_url():
    recs = [
        C(name="Build Speech Recognition Systems for Caribbean Voices", platform="Zindi", source="zindi",
          url="https://zindi.africa/competitions/caribbean-voices-hackathon", end_date="2026-12-07"),
        C(name="Build speech recognition systems for Caribbean voices", platform="Zindi", source="mlcontests",
          url="https://caribbeanvoices.org/challenge", end_date="2026-12-07"),
    ]
    out = dedupe(recs)
    assert len(out) == 1
    assert out[0].url.startswith("https://zindi.africa")


def test_fuzzy_merge_respects_deadline_mismatch():
    recs = [
        C(name="Some Great Vision Challenge", platform="Codabench", source="mlcontests", url="https://a.org", end_date="2026-11-01"),
        C(name="Some Great Vision Challenge", platform="Codabench", source="mlcontests", url="https://b.org", end_date="2027-06-01"),
    ]
    assert len(dedupe(recs)) == 2


def test_extract_venue():
    assert extract_venue("[HANDS@ECCV 2026] SHOW3D Challenge") == "ECCV 2026"
    assert extract_venue("TRIPLET Challenge @ ESWC2026") == "ESWC 2026"
    assert extract_venue("MPDD'25 Model Evaluation@ACM Multimedia2025") == "ACM Multimedia 2025"
    assert extract_venue("Plain competition title") is None


def test_enrich_research_only_columns():
    r = C(name="Track @ CVPR 2026", organizer="Lab A", competition_type="competition")
    enrich(r)
    assert r.is_research and r.journal_venue == "CVPR 2026" and r.co_authors == "Lab A"
    assert r.competition_type == "research"

    n = C(name="Predict house prices", organizer="Acme", competition_type="featured")
    enrich(n)
    assert not n.is_research and n.co_authors is None and n.journal_venue is None

