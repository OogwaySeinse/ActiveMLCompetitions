import pytest

from scraper.normalize import (
    canonical_url,
    infer_category,
    normalize_platform,
    normalize_title,
    parse_date,
    parse_prize,
    strip_tracking,
)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("2026-11-02T23:59:00.000Z", "2026-11-02"),
        ("15 Oct 2026", "2026-10-15"),
        ("Oct 15, 2026", "2026-10-15"),
        ("11 May 2026 Apr 2026", "2026-05-11"),
        ("Dec. 3, 2026, 11:59 PM UTC", "2026-12-03"),
        ("20260910", "2026-09-10"),
        ("Ongoing", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_date(raw, expected):
    assert parse_date(raw) == expected


FX = {"USD": 1.0, "EUR": 0.5, "GBP": 0.8, "CHF": 0.8, "INR": 100.0, "CNY": 7.0, "JPY": 150.0}


@pytest.mark.parametrize(
    "raw,platform,expected",
    [
        ("$1,000", None, 1000.0),
        ("850,000 Usd", "Kaggle", 850000.0),
        ("$1 000 USD", "Zindi", 1000.0),
        ("8 000 CHF", "Zindi", 10000.0),
        ("€10,680", None, 21360.0),
        ("₹ 50,000", "Devpost", 500.0),
        ("$<span data-currency-value>138,000</span>", "Devpost", 138000.0),
        ("$150,000+ Prize Money", "AIcrowd", 150000.0),
        ("$1.1M", None, 1100000.0),
        ("¥300,000", "SIGNATE", 2000.0),
        ("1500万円", "SIGNATE", 100000.0),
        ("¥280,000 CNY", "Tianchi", 40000.0),
        ("3 000 Zindi Points", "Zindi", None),
        ("500 Points", "Zindi", None),
        ("Knowledge", "Kaggle", None),
        ("Kudos", "Kaggle", None),
        ("Swag", "Kaggle", None),
        ("$0", "Devpost", None),
        (None, None, None),
    ],
)
def test_parse_prize(raw, platform, expected):
    assert parse_prize(raw, platform=platform, fx_per_usd=FX) == expected


@pytest.mark.parametrize(
    "a,b",
    [
        ("https://www.kaggle.com/competitions/foo?ref=mlcontests", "https://kaggle.com/c/foo"),
        ("https://www.kaggle.com/competitions/foo/overview", "https://www.kaggle.com/competitions/foo/"),
        ("https://zindi.africa/competitions/bar?utm_source=mlcontests", "https://zindi.africa/competitions/bar/data"),
        ("https://www.drivendata.org/competitions/306/competition-doe-gems/", "https://drivendata.org/competitions/306/x/page/1"),
        ("https://www.codabench.org/competitions/18185/", "https://codabench.org/competitions/18185"),
    ],
)
def test_canonical_url_equivalence(a, b):
    assert canonical_url(a) == canonical_url(b)


def test_canonical_url_distinct():
    assert canonical_url("https://www.kaggle.com/competitions/a") != canonical_url("https://www.kaggle.com/competitions/b")


def test_strip_tracking_keeps_meaningful_params():
    assert strip_tracking("https://flagos.io/race?id=8q4&lang=en&ref=mlcontests") == "https://flagos.io/race?id=8q4&lang=en"


def test_normalize_title():
    assert normalize_title("The ARC Prize 2026 – ARC-AGI-2!") == "arc prize arc agi 2"


def test_normalize_platform():
    assert normalize_platform("Trustii.io") == "Trustii"
    assert normalize_platform("DEVPOST") == "Devpost"
    assert normalize_platform("Independent", "https://www.kaggle.com/competitions/x") == "Kaggle"
    assert normalize_platform("Independent", "https://example.org/challenge") == "Independent"
    assert normalize_platform(None, "https://www.kaggle.com/competitions/x") == "Kaggle"


def test_infer_category():
    assert infer_category("Detect Knee Abnormalities in MRI", []) == "Healthcare & Biology"
    assert infer_category("Some title", ["nlp", "text"]) == "NLP"
    assert infer_category("Build Coding Agents with Gemma", []) == "LLMs & Agents"
    assert infer_category("Mystery", []) == "Other"



def test_infer_category_no_false_health_match():
    assert infer_category("ARC White-Box Estimation", [], "predict its expected per-neuron activations") != "Healthcare & Biology"
    assert infer_category("Decode Brain Signals in Task-Specific Settings", []) == "Healthcare & Biology"
