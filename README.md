# 🏆 Active ML Competitions — live dashboard

A dashboard of **currently open machine-learning competitions** from many platforms. The data is merged, de-duplicated and enriched, and it **refreshes automatically every morning** with GitHub Actions. The site is hosted for free on GitHub Pages.

**Live site:** https://oogwayseinse.github.io/ActiveMLCompetitions/

## Features

- **Sources:** Kaggle (featured, research, playground **and community**), DrivenData, AIcrowd, Zindi, CodaLab, Devpost, Tianchi, SIGNATE, ODS.ai and Yandex Cup. Codabench, Hugging Face and independent competitions come in through the [MLContests](https://mlcontests.com) feed.
- **Merging and cleaning:** a competition listed by several sources becomes one row. Duplicates are matched on cleaned-up URLs plus guarded fuzzy title matching. The direct platform's data wins, and the aggregator fills any gaps.
- **Prize money:** shown as listed (e.g. `€25,000`, `1500万円`, `Kudos`) and converted to USD (`prize_usd`) with daily exchange rates, for sorting and totals.
- **Research competitions:** extra **co-authors** (organisers / host team) and **journal / venue** (conference or journal + year, e.g. `NeurIPS 2026`) columns.
- **Dashboard:** sortable, filterable table, search, live countdowns, "closing soon" highlighting, **NEW** badges for competitions first seen in the latest refresh, summary stats, charts and CSV download.
- **Resilient:** each source runs on its own. If one fails, its last good result (up to 7 days old) is reused and flagged as *stale* in the dashboard footer.

## Repository layout

```
scraper/                  Python package: python -m scraper
  sources/                one module per platform (kaggle, zindi, drivendata, aicrowd, codalab,
                          devpost, tianchi, spa_playwright, mlcontests)
  normalize.py            dates, prize → USD, URL canonicalisation, categories
  dedupe.py               duplicate detection + field-level merge
  research.py             research detection, venue extraction, co-authors
  history.py              first-seen tracking / daily snapshots / NEW flags
  pipeline.py             orchestration + outputs
tests/                    pytest unit tests (parsers, prizes, dedupe, research)
data/
  competitions.json       dashboard data (meta + competitions)
  competitions.csv        same data as CSV
  history/                first_seen.json + daily snapshots (120-day retention)
  cache/                  last good result per source (fallback)
apps/dashboard/           React + Vite + TypeScript + Tailwind + TanStack Table + Recharts
.github/workflows/daily-update.yml   daily scrape → commit data → build → deploy Pages
```

## One-time setup on GitHub

1. **Push** this repo to `https://github.com/OogwaySeinse/ActiveMLCompetitions` (public).
2. **Kaggle secrets:** go to *Settings → Secrets and variables → Actions → New repository secret* and add:
   - `KAGGLE_USERNAME`: the `username` value from your `kaggle.json`
   - `KAGGLE_KEY`: the `key` value from your `kaggle.json`
3. **Enable Pages:** go to *Settings → Pages → Build and deployment → Source* and choose **GitHub Actions**.
4. **First run:** go to *Actions → "Daily refresh & deploy dashboard" → Run workflow*.

After that it runs every day at **06:00 UTC** (07:00 UK summer time).

> `kaggle.json` is git-ignored. Never commit it.

## Local development

```powershell
# Python (3.11+)
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m playwright install chromium
.venv\Scripts\python -m pytest -q
.venv\Scripts\python -m scraper            # writes data/competitions.{json,csv}
.venv\Scripts\python -m scraper --only kaggle zindi   # run a subset of sources

# Dashboard (Node 20+)
cd apps/dashboard
npm install
npm run dev        # http://localhost:5173 (copies ../../data into public/data)
npm run build      # production build in dist/
```

Set `SCRAPER_DISABLE_PLAYWRIGHT=1` to skip the headless-browser source (SIGNATE / ODS.ai / Yandex).

## Adding a source

Create `scraper/sources/<name>.py` with a `NAME` constant and a `fetch() -> list[Competition]` function, then add it to `SOURCE_MODULES` in `scraper/sources/__init__.py`. The list order sets merge priority: direct platforms come first, aggregators last.

## Notes and limitations

- **Codabench** serves an anti-bot decoy page to scripts, and **Hugging Face** has no public listing of active competitions. Both are therefore covered through MLContests rather than scraped directly.
- **Kaggle community** competitions with deadlines more than ~13 months away (perpetual class sandboxes) are skipped. Kaggle *getting started*, CodaLab long-running evaluation servers and DrivenData practice competitions are tagged as benchmark/practice and **hidden by default**; use the dashboard toggle to show them.
- **Co-authors** are rarely published in structured form, so this column holds the organisers / host team reported by the platforms.

