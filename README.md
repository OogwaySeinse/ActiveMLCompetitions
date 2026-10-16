# ✦ WUNDERCOMP // Active ML Competitions & AI Matchmaker

A live intelligence arena of **currently open machine-learning competitions** across 9+ global feeds, paired with a **Gemini 3.8 Flash AI Competition Strategist**. The dataset is merged, deduplicated, and enriched every morning at **06:00 UTC** via GitHub Actions and deployed to GitHub Pages.

**Live site:** https://oogwayseinse.github.io/ActiveMLCompetitions/

## Highlights

- **Wundernn-inspired Aesthetic:** Warm cream viewport frame (`#f4f0e0`), atmospheric bioluminescent obsidian canvas with drifting ML/math ASCII clusters (`∇L(θ)`, `OOF_AUC`, `attn(Q,K,V)`), editorial `Instrument Serif` display typography paired with `JetBrains Mono` telemetry, smoked-glass panels, and segmented vertical-tick progress bars.
- **Prompt-to-Podium AI Competition Matchmaker:**
  - Free-text mission prompt + 1-click archetype presets (*LLM & Agent Builder*, *Tabular Weekend Sprinter*, *CV & Medical Research*, *First Medal Starter*).
  - Quick preference chips for experience level, preferred ML domains, primary goal (prize, learning, paper, portfolio), squad mode (solo/team), and weekly time budget (`4h`–`25h/wk`).
  - Explains **WHY** each recommended competition fits your profile, highlights technical watch-outs, and synthesizes a **4-phase weekly execution plan**.
  - Automatically remembers your profile and last recommendations in browser `localStorage`.
  - Powered by a lightweight **Cloudflare Worker proxy** (`workers/recommender/`) calling `gemini-3.8-flash` via the May 2026 Interactions API (`/v1beta/interactions`) with per-IP rate limiting — plus an instant client-side Neural Ranker fallback so the recommender works out-of-the-box even before deploying a Worker.
- **9 Global Sources:** Kaggle (featured, research, playground, **and community**), DrivenData, AIcrowd, Zindi, CodaLab, Devpost, Tianchi, SIGNATE, ODS.ai, and Yandex Cup, plus Codabench, Hugging Face, and independent challenges via [MLContests](https://mlcontests.com).
- **Prize Normalization & Research Enrichment:** Converts multi-currency prizes (`€`, `£`, `¥`, `₹`, `RMB`) to USD (`prize_usd`) for sorting and totals while keeping raw labels, and extracts **co-authors** (organisers/host team) and **journal / venue** (`NeurIPS`, `CVPR`, `MICCAI`, `ICML`, etc.) for research tracks.

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
tests/                    pytest unit tests (51 passing tests)
data/
  competitions.json       dashboard data (meta + competitions)
  competitions.csv        same data as CSV
  history/                first_seen.json + daily snapshots (120-day retention)
  cache/                  last good result per source (fallback)
apps/dashboard/           React + Vite + TypeScript + Tailwind v4 + TanStack Table + Recharts
  src/components/
    AsciiBackdrop.tsx     drifting ML math/code ASCII canvas with radial glow halos
    AiRecommender.tsx     prompt + preference chips + WHY fit + weekly plan UI
    CompetitionTable.tsx  smoked-glass table with vertical-tick deadline meters
    StatCards.tsx         telemetry cards with segmented tick bars
    FilterBar.tsx         instant search & multi-select domain/platform filters
    Charts.tsx            platform, domain, prize bracket, and 12-week deadline charts
  src/lib/
    recommender.ts        candidate ranker, localStorage memory, Worker client + fallback
workers/recommender/      Cloudflare Worker proxy for Gemini 3.8 Flash (/v1beta/interactions)
.github/workflows/daily-update.yml   daily scrape → commit data → build → deploy Pages
```

## Deploying the Cloudflare Worker (Gemini 3.8 Flash Proxy)

The AI Matchmaker works immediately using its built-in client-side Neural Ranker. To connect live **Gemini 3.8 Flash** synthesis with per-IP rate limiting while keeping your API key secret:

```powershell
cd workers/recommender
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY   # paste your Gemini API key when prompted
npx wrangler deploy
```

Once deployed, Wrangler prints your Worker URL (e.g. `https://active-ml-competitions-recommender.<subdomain>.workers.dev`). You can either:
1. Click **⚙ Configure Gemini Worker** in the dashboard's AI Matchmaker header and paste the URL (saved in `localStorage`), or
2. Set `VITE_RECOMMENDER_URL` in your repository's GitHub Actions secrets/variables so every build uses your Worker automatically.

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
