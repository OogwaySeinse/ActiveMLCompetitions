"""Parser tests on trimmed real-world HTML snippets (captured 2026-10-16)."""
from scraper.sources import aicrowd, codalab, drivendata
from scraper.sources.devpost import parse_period

DRIVENDATA_HTML = """
<h2>Prize competitions</h2>
<div class="row competition-list" id="active_competitions">
 <div class="d-flex col-md-6 col-xl-4 panel-container active-comp prize-comp" data-category_energy="1"
      data-category_science="1" data-deadline="-120991203" data-joined="635" data-start_date="20260910"
      data-total_prize_purse="300000.0">
  <a class="image" href="/competitions/306/competition-doe-gems/" title="GEMS">
   <img alt="Hosted by DOE" src="x.png"/></a>
  <h3 class="panel-competition-title"><a href="/competitions/306/competition-doe-gems/">The GEMS Prize Challenge</a></h3>
  <div class="row row-description"><div class="col-sm-12"><p>Identify hidden geologic faults. <span class="d-none">#energy</span></p></div></div>
  <span class="prize"><strong>$300,000</strong></span>
  <span class="end-date" title="Dec. 3, 2099, 11:59 p.m. UTC">Dec 3</span>
 </div>
</div>
<h2>Completed competitions</h2>
<div class="panel-container"><h3><a href="/competitions/1/old/">Old One</a></h3></div>
"""

AICROWD_HTML = """
<div class="card card-challenge">
 <a class="card-img-overlay" href="/challenges/arc-white-box">
  <span class="badge badge-primary" title="2030-10-17 23:59:00 UTC">Phase 2: 39 hours left</span></a>
 <div class="card-body"><h5 class="card-title"><a href="/challenges/arc-white-box">ARC White-Box Estimation Challenge 2026</a></h5>
  <p class="card-text">Predict activations.</p>
  <div class="prizes-breakdown"><div class="prize-item prize-item-cash">$150,000+ Prize Money</div></div>
  <div class="category-group"><a><span class="badge badge-outline">#white_box</span></a></div></div>
 <div class="card-footer"><a href="/organizers/arc"><span title="Alignment Research Center">ARC</span></a></div>
</div>
<div class="card card-challenge">
 <a class="card-img-overlay" href="/challenges/old"><span class="badge badge-primary" title="2099-01-01 00:00:00 UTC">Post Challenge Round: 99 days left</span></a>
 <div class="card-body"><h5 class="card-title"><a href="/challenges/old">Old Challenge</a></h5></div>
</div>
<div class="card card-challenge">
 <a class="card-img-overlay" href="/challenges/spotify"><span class="badge badge-primary" title="2100-11-01 19:49:00 UTC">Benchmark Challenge: 27044 days left</span></a>
 <div class="card-body"><h5 class="card-title"><a href="/challenges/spotify">Spotify Million Playlist Dataset Challenge</a></h5></div>
</div>
"""

CODALAB_HTML = """
<div class="competition-tile full-width"><input id="competitionID" type="hidden" value="99001"/>
 <h3>Future Challenge @ CVPR 2099</h3><p class="organizer">Organized by alice</p><p>Workshop track.</p>
 <div class="right-panel">Jan 19, 2026- Aug 30, 2099 <b>4</b> participants</div></div>
<div class="competition-tile full-width"><input id="competitionID" type="hidden" value="99002"/>
 <h3>Finished Challenge</h3><p class="organizer">Organized by bob</p>
 <div class="right-panel">Jan 19, 2020- Aug 30, 2020 <b>4</b> participants</div></div>
"""


def test_drivendata_parse():
    out = drivendata.parse(DRIVENDATA_HTML)
    assert len(out) == 1
    c = out[0]
    assert c.name == "The GEMS Prize Challenge"
    assert c.url == "https://www.drivendata.org/competitions/306/competition-doe-gems/"
    assert c.end_date == "2099-12-03" and c.start_date == "2026-09-10"
    assert c.prize_raw == "$300,000" and c.organizer == "DOE"
    assert set(c.tags) == {"energy", "science"}


def test_aicrowd_parse_skips_post_challenge_and_flags_benchmarks():
    out = aicrowd.parse(AICROWD_HTML)
    names = {c.name: c for c in out}
    assert "Old Challenge" not in names
    arc = names["ARC White-Box Estimation Challenge 2026"]
    assert arc.end_date == "2030-10-17" and arc.prize_raw == "$150,000+ Prize Money"
    assert arc.organizer == "Alignment Research Center" and arc.tags == ["white box"]
    spotify = names["Spotify Million Playlist Dataset Challenge"]
    assert spotify.competition_type == "benchmark" and spotify.end_date is None


def test_codalab_parse_filters_past():
    out = codalab.parse(CODALAB_HTML)
    assert [c.name for c in out] == ["Future Challenge @ CVPR 2099"]
    assert out[0].organizer == "alice" and out[0].url.endswith("/competitions/99001")


def test_devpost_period():
    assert parse_period("Aug 31 - Oct 23, 2026") == ("2026-08-31", "2026-10-23")
    assert parse_period("Oct 01 - 12, 2026") == ("2026-10-01", "2026-10-12")
    assert parse_period("Dec 15 - Jan 10, 2027") == ("2026-12-15", "2027-01-10")
    assert parse_period("Dec 15, 2026 - Jan 10, 2027") == ("2026-12-15", "2027-01-10")



def test_signate_cards_only_open():
    from scraper.sources.spa_playwright import parse_signate_cards

    cards = [
        {"href": "/en/competition/detail/?competition=a", "h3": ["NEDO Challenge Robot", "1500万円"],
         "h6": ["NEDO", "1236 entries", "Medal", "Open"], "body": ["Airport challenge"]},
        {"href": "/en/competition/detail/?competition=b", "h3": ["Upcoming", ""], "h6": ["MLIT", "Coming Soon", "Medal", "30 days until open"]},
        {"href": "/en/competition/detail/?competition=c", "h3": ["Old one", "27万円"], "h6": ["X", "1560 entries", "Medal", "Closed"]},
        {"href": "/en/competition/detail/?competition=d", "h3": ["【練習問題】タイタニックの生存予測"], "h6": ["SIGNATE", "7400 entries", "Knowledge", "Open"]},
    ]
    out = parse_signate_cards(cards)
    assert [c.name for c in out] == ["NEDO Challenge Robot", "【練習問題】タイタニックの生存予測"]
    assert out[0].prize_raw == "1500万円" and out[0].organizer == "NEDO" and out[0].competition_type == "featured"
    assert out[1].competition_type == "practice"
