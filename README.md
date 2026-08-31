# Eivra

> Public AI forecasting, scored on resolved outcomes. Six AI agents made probabilistic predictions on real Polymarket and Manifold markets. Every call was tracked with Brier, log-loss, and 10-bin calibration plots with Wilson 95% intervals. No real money, no hiding, just resolved outcomes.

**Live:** [eivra.xyz](https://eivra.xyz) · **Source:** [github.com/claygeo/eivra](https://github.com/claygeo/eivra) · **Author:** [@deforestpeg](https://x.com/deforestpeg)

> **Status: archived run.** Eivra ran as a live system in May–June 2026. The pipeline was decommissioned afterward (database June 2026, forecasting VPS August 2026), so nothing updates anymore. The deployed site stays up and renders the deterministic in-repo demo dataset, labeled as such on every page. The last real-data record survives in [`public/paper-trading/latest-artifact-proof.json`](./public/paper-trading/latest-artifact-proof.json); real numbers quoted below come from that final snapshot. The full system remains deployable from this repo — see [Deploy your own](#deploy-your-own).

---

## TL;DR

- **6 AI agents** across distinct personas forecast live prediction markets and got scored when the markets resolved.
- **Two scoring lanes:** *backfill* (agents forecast already-resolved historical markets — fast to accumulate, but look-ahead-prone) and *live* (agents lock a forecast on an **open** market, scored only after it resolves — no look-ahead by construction).
- **Hawk (contrarian, Opus 4.7) led** the final leaderboard. But read the [honesty section](#how-honest-are-these-numbers) first: every agent ended the run near ~0.02 Brier / ~97% win, which is *far* better than human superforecasters (~0.15–0.20) and the best published LLM forecaster (~0.24). That gap is the backfill lane flattering itself, not superhuman skill.
- **$0 Anthropic API spend** — forecasts ran a `claude -p` subprocess on a Hetzner VPS under a Max subscription. No `ANTHROPIC_API_KEY`.
- **A paper-trading proof lab** (`/trading`) turns each forecast into a bounded quarter-Kelly paper ticket and asks a sharper question: which agent is not just *accurate* but *tradable*? It ships with explicit anti-overclaim guards (no real execution, ever).
- Auto-deploys via GitHub → Netlify. While the run was live, cron jobs handled market ingestion, backfill scoring, live forecasting, and nightly insight cards.

> **Numbers are frozen.** The pipeline is decommissioned; no count on this page will change again. [`/api/summary.json`](https://eivra.xyz/api/summary.json) and [`/api/leaderboard.json`](https://eivra.xyz/api/leaderboard.json) still respond, but they serve the labeled demo dataset — not run data. Real numbers in this README are quoted from the final proof artifact.

---

## What this is

Eivra is a **public scoreboard for LLM forecasting accuracy**.

Six AI agents — each with a distinct system prompt and model — read real prediction-market questions from [Polymarket](https://polymarket.com) and [Manifold Markets](https://manifold.markets), produced a probability estimate with a short reasoning trace, and got scored against the eventual ground-truth resolution.

While live, the site updated every two minutes (Next.js ISR), open markets ingested every 15 minutes, forecasts landed on a 6-hour backfill cycle plus a separate live-forecasting pass, and insight cards regenerated nightly. Without database credentials the whole site renders from a deterministic in-repo seed (`src/lib/demo-data.ts`, 25 markets / 150 predictions) so it loads with zero infrastructure — since decommissioning, that seed is what the deployed site serves.

## Why this exists

LLMs are confidently wrong all the time. Existing public LLM benchmarks (MMLU, HumanEval, MTEB) mostly measure narrow correctness on static datasets. Forecasting is different: the truth resolves on a clock, humans have a strong baseline (the market itself), and *confidence* can be measured separately from *accuracy*.

The two questions Eivra tracks:

1. **Is this LLM accurate?** — Brier and log-loss on resolved markets.
2. **Is this LLM calibrated?** — when it says 70%, does it win 70% of the time? (Calibration plot, 10 bins, Wilson 95% intervals.)

A confident-and-wrong model is worse than a humble-and-wrong model. The leaderboard surfaces both.

## How Eivra compares

Eivra is not the first to score LLMs on real-world forecasting, and it does not claim to be the most rigorous. It is a small, fully open-source, opinionated take. Honest landscape:

| Project | What it is | How Eivra differs |
|---|---|---|
| [ForecastBench](https://www.forecastbench.org/) (Forecasting Research Institute, ICLR 2025) | Dynamic, contamination-free benchmark; nightly questions from 9 sources incl. prediction markets; human comparison groups; difficulty-adjusted Brier | Academic gold standard. Eivra is smaller and scrappier, but fully open end-to-end (schema, agents, crons, deploy) and adds persona-diverse agents + a paper-trading lane |
| [Prophet Arena](https://www.prophetarena.co/leaderboard) (2025) | Live benchmark over Kalshi + Polymarket; Brier + simulated betting return; tests frontier models | Eivra's closest sibling. Prophet Arena pits raw frontier models against each other; Eivra studies *forecasting styles* (six house personas, one model family) and is open-source |
| [Metaculus AI Benchmarking / FutureEval](https://www.metaculus.com/aib/) (2025–2026) | Quarterly bot tournaments ($175k/yr prizes) on Metaculus questions, vs Pro Forecasters | Tournament format over curated questions; Eivra runs continuously over prediction-market questions with no prize/competition layer |
| [Approaching Human-Level Forecasting with LMs](https://arxiv.org/abs/2402.18563) (Halawi et al., NeurIPS 2024) | Retrieval-augmented LM that nears the human crowd (Brier .240 vs .247) on post-cutoff questions | The reference point for what *real* LLM forecasting skill looks like. Eivra's agents do no retrieval (web tools are disabled), so they forecast from parametric knowledge alone |

**What's actually distinctive about Eivra:** persona-diverse agents (deliberative / contrarian / snap / market-anchored / cross-family control / ensemble) rather than model-vs-model; a tradable-edge lane on top of accuracy; $0 inference via a Max-sub subprocess; and the fact that the whole thing — code, schema, agents, deploy, ops — was built and run autonomously by an AI.

## The six agents

| # | Name | Model | Persona | Edge |
|---|------|-------|---------|------|
| 1 | **Sage** | Claude Opus 4.7 (`--effort high`) | Deliberative · base-rate first | Finds the closest historical reference class and anchors to its base rate before adjusting. Wins on slow-moving questions; loses when a market is genuinely unprecedented |
| 2 | **Hawk** | Claude Opus 4.7 (`--effort high`) | Contrarian · hunts mispricings | Steelmans the crowd, then the opposite. **Abstains** rather than rubber-stamp consensus; only forecasts when it spots a genuine mispricing. High variance, high alpha when right |
| 3 | **Magpie** | Claude Sonnet 4.6 (`--effort low`) | Snap forecaster | One fact, one sentence, one number. Tests whether snap intuition beats deliberation |
| 4 | **Echo** | Claude Haiku 4.5 (`--effort low`) | Market-anchored · small Bayesian steps | The market price is the prior; only deviates on hard new info, usually by <5pp. Tests disciplined humility |
| 5 | **Mirror** | *intended GPT-5, currently Claude Sonnet 4.6* (`--effort medium`) | Cross-family control | Meant to expose biases shared across the Claude-family agents. **Disclosed honestly:** no OpenAI key is configured, so Mirror runs as Sonnet with an adversarial cross-family prompt. It becomes a real A/B the day a GPT key is added |
| 6 | **Crowd** | Synthetic (no model call) | Uniform ensemble | Equal-weight mean of all non-abstaining agents per market. The wisdom-of-AI-crowds baseline |

Display roster lives in [`src/lib/agents.ts`](./src/lib/agents.ts); the runner duplicates the prompts in [`backfill/run.ts`](./backfill/run.ts) so the backfill script is standalone. Note: the `agents.daily_budget_usd` column exists in the schema but the runner does not read it — actual cost control is a per-call flag (see below).

## How forecasts are produced

Every agent forecast was generated by spawning a `claude -p` (print-mode) subprocess on the VPS, where the operator's **Max subscription** was logged in via `claude login`. The subprocess inherits that auth, makes the call, and emits JSON to stdout. The runner extracts the first `{` to the last `}` and parses it.

The flags that matter, from [`backfill/run.ts`](./backfill/run.ts):

```bash
claude -p \
  --model <claude-opus-4-7|claude-sonnet-4-6|claude-haiku-4-5> \
  --effort <low|medium|high> \
  --system-prompt "<persona> + strict single-line-JSON output contract" \
  --disallowedTools WebSearch,WebFetch,Bash,Read,Write,Edit,Glob,Grep,Task \
  --max-budget-usd 0.30 \
  --max-turns 5
```

Details that took a few iterations to get right:

- **No `ANTHROPIC_API_KEY`, no `--bare`.** `--bare` would strip the Max-sub OAuth and force API-key mode. Inference is billed to the Max subscription, not the API. Net Anthropic API spend: **$0**.
- **Tools disabled** so the model doesn't burn turns on web lookups or permission denials. (Consequence: agents forecast from parametric knowledge only — no retrieval.)
- **Cost is bounded per call** by `--max-budget-usd 0.30` + `--max-turns 5` + a 90-second subprocess timeout — *not* by the `daily_budget_usd` DB column, which is currently unused by the runner.
- **`cwd` is set away from the repo** (`/tmp` on the Linux VPS, `%TEMP%` on Windows) so `claude` doesn't auto-load this repo's `CLAUDE.md` as context.
- **Lenient parsing.** The probability field is read from any of `probability`, `probability_yes`, `p_yes`, `forecast`, `p`, `prob`, `yes` — models pick slightly different keys across runs. Probabilities are clamped to `[0.01, 0.99]`.
- **Dedup.** Backfill mode caches each result on disk in `.backfill-cache/`, keyed by `(agent_id, market_source, market_source_id)`, so reruns don't re-spawn the same call. Live mode dedups via a Supabase existence check on `(agent_id, market_id, is_backfill=false)`.

### Backfill vs live (and why it matters)

**Backfill mode** (`backfill/run.ts`, default) pulls markets that resolved between 2026-02-01 and 2026-05-08 (after Claude's Jan-2026 training cutoff, to *limit* not eliminate look-ahead), forecasts them, and scores immediately. These rows are flagged `is_backfill = true`. The runner does **not** pass the resolution outcome to the model, and it stamps each backfill prediction with a synthetic `created_at` of `resolved_at − 24h` — a defensible "we forecasted ~a day before close" timestamp. It is still a reconstruction, and the model may have seen news about these outcomes in training. Treat backfill numbers as a warm-up set, not proof of skill.

**Live mode** (`backfill/run.ts --mode=live`) pulls markets that are still **open** (closing >24h out), locks one forecast per agent at `created_at = NOW()` with `is_backfill = false`, and writes nothing to `scores` until the market actually resolves. There is no look-ahead by construction: the lock is the receipt. Locked forecasts surfaced at [`/live`](https://eivra.xyz/live) (now demo rows). This was the honest signal, and the resolved-live sample stayed small for the whole run.

## Scoring methodology

Scoring runs server-side from `agent_id`, `market_id`, `predicted_probability`, and `resolved_outcome ∈ {true, false}`.

### Brier score
```
B = (p − y)²        y ∈ {0, 1}
```
Lower is better. **0** = perfect; **0.25** = the always-50% baseline; **1** = maximally wrong. For reference, Tetlock's superforecasters land around **0.15–0.20**.

### Log-loss
```
L = −[y · log(p) + (1 − y) · log(1 − p)]
```
Probabilities are clamped to **`[0.01, 0.99]`** before the log so a single confident-and-wrong call doesn't produce `Infinity`. Lower is better.

### Calibration plot
10 equal-width bins on predicted probability. For each bin, plot realized win rate against the bin center; the diagonal is perfect calibration. Each dot carries a **Wilson 95% interval**:

```
center = (p̂ + z²/2n) / (1 + z²/n)
half   = z·√(p̂(1−p̂)/n + z²/4n²) / (1 + z²/n)        z = 1.96
```

Bins with `n < 5` render as hollow gray dots and are excluded from the over/under-confidence label. The site shows an `[INSUFFICIENT_DATA]` panel instead of plotting noise when the scored sample is tiny.

### Leaderboard paper P&L
The P&L column on the leaderboard is a **simple flat-$25 directional paper bet** per forecast: take YES if `p > market_price`, NO otherwise, and book `±$25 × (outcome − market_price)`. It is a quick sanity check, not a trading model. The realistic quarter-Kelly model lives in the [paper-trading lab](#the-paper-trading-proof-lab).

### Eivra Score (composite)
```
S = 0.5 · (1 − Brier_norm) + 0.3 · win_rate + 0.2 · (1 − logloss_norm)
```
Brier and log-loss are min-max normalized across the active agent set. The leaderboard sorts by `S` descending. (A separate `agent_elo` table tracks pairwise head-to-head records; ELO does not currently feed the composite.)

## The paper-trading proof lab

The largest subsystem beyond the core scoreboard, reachable at [`/trading`](https://eivra.xyz/trading). It answers a sharper question than Brier: **which agent is not just accurate, but tradable?** A market-anchored agent can have a great Brier score and poor returns; a contrarian can have worse Brier and better paper returns if it finds genuinely mispriced markets.

How it works:

- **Bounded paper tickets.** For each agent forecast, compare the agent's probability to the market price. If the edge clears a threshold (default 5pp), open a paper ticket: YES on positive edge, NO on negative. Stake is **quarter-Kelly** off a $5,000 paper bankroll, **capped at $100/ticket**, with a $500 open-exposure cap. Maximum loss is the stake. No wallet, no leverage, no order placement, no liquidation path.
- **Proof gate.** A live strategy stays `collecting` until it has **30 live days** and **30 resolved tickets**, then must show positive net P&L, positive ROI, and bounded drawdown (<$500) to be marked a `candidate`. Backfill strategies are `control_only` and can never qualify. Stale captures are flagged.
- **Durable evidence pipeline.** Daily snapshots were written to `paper_trading_snapshots` (a Netlify scheduled function at 05:12 UTC) with a GitHub Actions fallback recorder (05:22 UTC) that captured artifact proof even when service-role writes were disabled, plus a resolution catch-up pass (05:02 UTC). The Actions schedule is disabled post-decommission; the whole record is still auditable offline (`npm run paper:artifact-audit`).
- **Anti-overclaim guards, everywhere.** Every payload carries `paper_only: true` and `real_money_execution_allowed: false`. Missed/skipped signals are tracked but flagged `missed_pnl_counts_as_proof: false`. Pending open-ticket EV is flagged `pending_pnl_counts_as_proof: false`. A liquidity/slippage review is a hard blocker on any "this rule is profitable" claim, because real fill quality isn't modeled. The point of the lab is to make it *hard* to fool yourself, not to look good.

The lab exposes roughly two dozen read-only JSON endpoints under `/api/trading-*` (agent-edge proof matrix, exposure ledger, resolution watch, capital-review packet, evidence SLA, lab status, and so on). The full design spec is in [`docs/designs/eivra-paper-trading-v2.md`](./docs/designs/eivra-paper-trading-v2.md).

### Final archived numbers (last real capture: 2026-06-14)

The last real-data proof artifact — [`public/paper-trading/latest-artifact-proof.json`](./public/paper-trading/latest-artifact-proof.json), written by the scheduled Actions run — froze the lab at:

- **26 resolved live paper tickets**, **+$519.64 net paper P&L**, over an 18-of-30-day proof window.
- **9 of 12 rules resolved** — 6 positive, 0 below break-even, and **0 profitability-proven**: no rule reached the 30-resolved-tickets / 30-live-days gate before decommission.
- Best rule: `magpie-live-edge-10`, **+$253.52** on 5 tickets (0.8 win rate, 0.507 ROI on stake). `mirror-live-edge-10` shows identical figures because both rules caught the same trades — they are not independent results.
- 53 open live signals / $5,298.79 open paper exposure at final capture.
- The capital-review gate ended **`blocked` / `do_not_allocate_capital`** — which is exactly what the anti-overclaim design should say about an 18-day sample.

Brier and leaderboard figures did not survive the decommission: the scoring database was deleted without an export, so the ~0.02-Brier leaderboard described elsewhere in this README is quoted from the last observed state and can no longer be recomputed. This artifact is the only independently verifiable record of the run.

## How honest are these numbers?

Read this before trusting the leaderboard.

- **The headline numbers are too good to be real skill.** In the final snapshot every agent sat near **~0.02 Brier and ~97% win rate**. Human superforecasters land around 0.15–0.20; the best published LLM forecasting system (Halawi et al.) reached ~0.24 on genuinely-uncertain post-cutoff questions. Six agents all an order of magnitude better than that is a red flag, not a triumph. The cause is almost certainly the **backfill lane**: resolved markets skew lopsided (many close near 0/1), and the models may have absorbed the outcomes in training. The numbers measure "can the model recognize an already-decided question," not "can it forecast the future."
- **Backfill dominates the dataset.** Most resolved rows are `is_backfill = true` with a synthetic pre-resolution timestamp. The **live lane** (`is_backfill = false`, locked on open markets) is the honest signal, and its resolved sample is still small. Watch that, not the aggregate.
- **No retrieval.** Web tools are disabled in the subprocess, so agents forecast from parametric knowledge. That's a deliberate cost/simplicity choice, and a real limitation versus retrieval-augmented systems.
- **Mirror is not GPT-5 yet.** It runs as Claude Sonnet with a cross-family prompt because no OpenAI key is configured. Disclosed on the agent card and above. Five of six agents are one model family, so "cross-model" comparison is currently weak.
- **Clamping.** Probabilities are clamped to `[0.01, 0.99]` before log-based scoring so one confident-wrong call doesn't blow up the metric.

None of this is hidden in the code. It shouldn't be hidden here either.

## Architecture

```
  Polymarket Gamma API            Manifold Markets API
         │                               │
         └───────────────┬───────────────┘
                         ▼
        ┌────────────────────────────────────┐
        │ backfill/pull-open.ts  (15m cron)  │  normalize → UPSERT markets
        └────────────────┬───────────────────┘
                         ▼
        ┌────────────────────────────────────┐
        │ Supabase Postgres 17 (RLS)         │  agents, markets, predictions,
        │  public-read · service-write       │  scores, agent_stats, agent_elo,
        └────────────────┬───────────────────┘  evidence_events, eureka_cards,
                         │                        paper_trading_snapshots, system_*
                         ├─► backfill/run.ts            (6h cron)  spawn claude -p,
                         │     backfill resolved markets, score, refresh stats
                         │
                         ├─► backfill/run.ts --mode=live (separate pass) lock
                         │     forecasts on OPEN markets, score on resolution
                         │
                         ├─► backfill/generate-eureka.ts (24h cron) insight cards
                         │
                         └─► paper-trading snapshot + resolution-catchup
                               (Netlify scheduled fns + GitHub Actions fallback)
                         ▼
        ┌────────────────────────────────────┐
        │ Next.js 15 (App Router, ISR=120s)  │  src/app/* SSR + ISR
        │ Netlify · auto-deploy on push      │  src/lib/data.ts (demo fallback)
        └────────────────┬───────────────────┘
                         ▼
                  https://eivra.xyz
```

A claude.ai cloud routine also ran periodically during the live months, picking one autonomous polish task per fire (landing copy, OG image, agent text, lint fixes) and shipping it via Netlify + Supabase MCP, gated on typecheck + build passing.

## Data sources

- **Polymarket Gamma API** — fully public, no auth, free. Eivra reads `?closed=true` for resolved markets (resolution from `outcomePrices`, time from `closedTime`) and open markets for live mode, filtering out joke/low-volume markets.
- **Manifold Markets API** — public read endpoints, no auth, ~500 req/min. Eivra reads `BINARY` markets only, resolution from `resolution ∈ {YES, NO}` and `resolutionTime`, with quality gates on unique bettors and volume.
- **Kalshi** — listed as future work. Its API needs RSA-key auth, which is why it's deferred.

Both sources are polled well under their rate limits. Markets are normalized to one schema and categorized (politics / crypto / sports / ai-tech / other) by keyword.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15.5 (App Router, ISR=120s, React Server Components) |
| Language | TypeScript 5.7 (strict) · React 19 |
| UI | Tailwind 3.4 · `IBM_Plex_Sans` headings · `JetBrains_Mono` mono · `Inter` body |
| Data | Supabase Postgres 17 + Row-Level Security (public-read, service-write) |
| Auth | Supabase anon key (read) + service role (server) via `@supabase/ssr` |
| LLM | `claude -p` subprocess via Max sub. No `ANTHROPIC_API_KEY` |
| Sources | Polymarket Gamma API, Manifold Markets API |
| Hosting | Netlify (frontend + scheduled functions) + Hetzner CX22 (VPS cron) |
| Deploy | GitHub → Netlify CD with `@netlify/plugin-nextjs` pinned in `netlify.toml` |

The visual system — fonts, color, spacing, the dark terminal aesthetic, and the per-screen empty/loading/error/degraded state matrix — is specified in [`DESIGN.md`](./DESIGN.md).

## Schema (key tables)

```
agents                  the 6 (mirrors src/lib/agents.ts)
markets                 Polymarket + Manifold, UNIQUE(source, source_id), status, resolved_outcome
predictions             (agent_id, market_id, probability, reasoning, market_price_at_forecast, is_backfill)
scores                  (prediction_id, brier, log_loss, paper_pnl, was_correct)
agent_stats             rolling rollup (Brier, win rate, log-loss, calibration bins, eivra_score, rank)
agent_elo               pairwise head-to-head records
agent_runs              per-agent per-market spawn record (observability)
evidence_events         reasoning/evidence trace events
eureka_cards            auto-generated insight tiles, refreshed nightly
paper_trading_snapshots append-only paper-trading proof log (RLS: public-read, service-write)
system_settings         feature flags incl. global_pause kill switch
system_events           cron runs, errors, deploys
```

Full DDL in [`supabase/migrations/`](./supabase/migrations). The Supabase Edge Functions in [`supabase/functions/`](./supabase/functions) (`pull-markets`, `resolve-markets`, `forecast-market`) are an earlier ingestion path; the live system runs the VPS `backfill/*.ts` scripts instead.

## Cron jobs (VPS)

The VPS bootstrap installs three jobs; live forecasting is the same runner with `--mode=live`, run as a separate pass. The VPS retained its original `crucible-ai` paths from before the project was renamed to Eivra. (The VPS itself was retired in August 2026 — this section is preserved for redeployment.)

```cron
*/15 * * * *  cd /opt/crucible-ai && npx tsx backfill/pull-open.ts                 # ingest open markets
11 */6 * * *  cd /opt/crucible-ai && git pull && npx tsx backfill/run.ts --limit=30 # backfill + score
37 3  * * *   cd /opt/crucible-ai && npx tsx backfill/generate-eureka.ts            # nightly insight cards
#             cd /opt/crucible-ai && npx tsx backfill/run.ts --mode=live --limit=30 # live lock (separate pass)
```

`git pull` before the backfill run picks up agent-prompt edits without a redeploy. Runbook: [`scripts/VPS-SETUP.md`](./scripts/VPS-SETUP.md).

## Project structure

```
eivra/
├── README.md  DESIGN.md  LICENSE
├── netlify.toml                       ← @netlify/plugin-nextjs pin (required)
├── .github/workflows/                 ← daily paper-proof snapshot fallback
├── backfill/
│   ├── run.ts                         ← claude -p forecasts: backfill + --mode=live
│   ├── pull-open.ts                   ← ingest open markets
│   └── generate-eureka.ts             ← nightly insight cards
├── scripts/
│   ├── vps-bootstrap.sh               ← idempotent VPS setup
│   ├── wsl-deploy.sh                  ← fallback deploy via WSL Linux build
│   ├── paper-trading-*.ts             ← proof snapshot / audit / smoke / publish
│   └── VPS-SETUP.md                   ← operator runbook
├── src/
│   ├── app/
│   │   ├── page.tsx                   ← homepage (hero + ticker + eureka + leaderboard)
│   │   ├── benchmark  leaderboard  about
│   │   ├── agents/ + agents/[id]/     ← profiles (+ per-agent OG image)
│   │   ├── markets/ + markets/[id]/
│   │   ├── live/                      ← locked live forecasts (no look-ahead)
│   │   ├── trading/                   ← paper-trading proof lab dashboard
│   │   ├── api/
│   │   │   ├── summary  leaderboard  agents  markets  predictions
│   │   │   │   calibration  diverge  eureka  health (.json routes)
│   │   │   └── trading-*  (≈20 read-only paper-lab endpoints)
│   │   ├── opengraph-image.tsx  robots.ts  sitemap.ts
│   ├── components/                    ← Header Footer HeroMetric Leaderboard
│   │   ├── LiveTicker  EurekaCard  StatePanel  Tooltip
│   │   └── CalibrationPlot            ← 10-bin SVG, Wilson 95%, hollow sparse bins
│   └── lib/
│       ├── agents.ts  data.ts  demo-data.ts  format.ts
│       ├── supabase/                  ← server + browser client factories
│       └── trading-*.ts               ← paper-lab logic (proof, evidence, liquidity, …)
├── supabase/
│   ├── migrations/                    ← schema DDL (incl. paper_trading_snapshots)
│   └── functions/                     ← earlier Edge Functions (pull/resolve/forecast)
├── netlify/functions/                 ← paper-trading snapshot + resolution catch-up
└── public/paper-trading/              ← published artifact-proof JSON
```

## Run it locally

```bash
git clone https://github.com/claygeo/eivra.git
cd eivra
npm install
cp .env.example .env.local        # publishable Supabase URL + anon key are prefilled
npm run dev                       # http://localhost:3000
```

With `NEXT_PUBLIC_USE_DEMO_DATA=true` (the default) the site renders entirely from `src/lib/demo-data.ts` — 6 agents, 25 demo markets, 150 mocked predictions — so the UI loads with zero infrastructure.

### Run the backfill yourself

The original Supabase project no longer exists — point these at your own (see [Deploy your own](#deploy-your-own)).

```bash
# Requires:  claude on PATH, logged in via `claude login` (Max sub)
# Optional:  SUPABASE_SERVICE_ROLE_KEY in .env.local for live writes
npx tsx backfill/pull-open.ts                 # ingest open markets
npx tsx backfill/run.ts --limit=10            # backfill-forecast 10 markets across agents
npx tsx backfill/run.ts --mode=live --limit=10 # lock forecasts on open markets (no look-ahead)
npx tsx backfill/generate-eureka.ts           # regenerate insight cards
```

### Paper-trading proof commands

```bash
npm run paper:snapshot           # build today's proof snapshot (dry run)
npm run paper:snapshot:write     # write it (needs SUPABASE_SERVICE_ROLE_KEY)
npm run paper:audit              # non-mutating capital-review gate (exits nonzero until gates pass)
npm run paper:artifact-audit -- ./paper-artifacts --json   # audit downloaded GitHub artifacts offline
```

### Deploy your own

1. Fork the repo.
2. Create a Supabase project, run the DDL in `supabase/migrations/`.
3. Connect to Netlify, add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SHARED_SECRET` (for the paper-proof writer).
4. Push to `main` → Netlify auto-deploys.
5. For continuous forecasting: provision a VPS (Hetzner CX22 is plenty), run `scripts/vps-bootstrap.sh`, `claude login`, and install the crontab from [`scripts/VPS-SETUP.md`](./scripts/VPS-SETUP.md).

## What's next

*(Preserved roadmap — the run itself is concluded. This is where a restart would pick up.)*

- **Grow the live lane** until resolved-live forecasts outnumber backfill, so headline numbers reflect real (not reconstructed) skill.
- **Real GPT-5 in Mirror** once an OpenAI key is available — turns the cross-family slot into an actual A/B.
- **Retrieval** for at least one agent, to compare parametric-only forecasting against a Halawi-style retrieval pipeline.
- **More sources** — Kalshi (needs RSA-key auth), additional Manifold subcategories.
- **User-submitted agents** — paste a system prompt + model choice, get scored alongside the house agents. Sandboxed, budget-capped.
- **Per-category leaderboards** — politics, crypto, sports, AI/tech separately.
- **Embeddable leaderboard widget** for blog posts and HN.

## Honest limits

- **Sample size.** The resolved-live sample is small; rankings will move as it grows. Don't anchor on today's order.
- **Backfill dominance.** Most current resolutions are backfill and probably look-ahead-contaminated (see the [honesty section](#how-honest-are-these-numbers)).
- **Selection bias.** Polymarket and Manifold skew toward US politics, crypto, and AI/tech. Performance there may not generalize.
- **One model family.** Five of six agents are Claude until Mirror gets a real GPT key. The "ensemble beats individuals" story is within-family for now.
- **One operator, AI-built.** Solo project, no team review, bugs likely. Issues welcome.

## Contributing

This is a one-operator project, but contributions are welcome:

- **File an issue** for a methodology problem, scoring bug, or UI quirk.
- **Submit a market source** — open a PR adding an ingestion path to `backfill/`.
- **Suggest an agent prompt** — open an issue with a proposed `systemPrompt` and the angle it tests.
- **Improve the calibration math** — Wilson is the current default; happy to discuss Clopper-Pearson, Jeffreys, or beta-binomial.

For larger changes, open an issue first to discuss the approach.

## Credits

Built **autonomously** by [Claude Opus 4.7](https://www.anthropic.com/news/claude-4-7). The operator ([@claygeo](https://github.com/claygeo)) gave a single instruction — *"build something innovative, like ML, game changer"* — and walked away. The model designed the schema, wrote the agents, built the dashboard and the paper-trading lab, deployed to Netlify, provisioned the VPS, and ran the cron. The original brand `Crucible.AI` was renamed to **Eivra** mid-project after a `/codex` check flagged a trademark collision (the VPS paths still carry the old `crucible-ai` name).

## Related work

- [solhunt](https://github.com/claygeo/solhunt) — autonomous AI agent that finds and exploits smart-contract vulnerabilities. 67.7% on a curated DeFiHackLabs subset, 13% on a random sample. That honesty gap drove the verifier-gate design in solhunt-duel.
- [solhunt-duel](https://github.com/claygeo/solhunt-duel) — adversarial red/blue agent system for smart-contract auditing. Red writes exploits, Blue writes patches, server-side Forge-verified gates decide the verdict.

## License

MIT. See [LICENSE](./LICENSE).

---

**Curated by [@deforestpeg](https://x.com/deforestpeg).**
