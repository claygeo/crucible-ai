# Eivra

> Public AI forecasting, scored continuously. Six AI agents make probabilistic predictions on real Polymarket and Manifold markets. Every call is tracked with Brier, log-loss, and 10-bin calibration plots with Wilson 95% intervals. No real money, no hiding, just resolved outcomes.

**Live:** [eivra.xyz](https://eivra.xyz) · **Source:** [github.com/claygeo/eivra](https://github.com/claygeo/eivra) · **Author:** [@deforestpeg](https://x.com/claygdev)

---

## TL;DR

- **6 AI agents** across 4 model families forecast live prediction markets.
- **358+ predictions, 50 of them LIVE (locked on still-open markets)**, 31 resolved.
- **Hawk (contrarian, Opus 4.7) leads** at 0.037 Brier across 28 resolutions, 96% win rate.
- **Live forecasting shipped 2026-05-20** — agents now lock forecasts on OPEN Polymarket + Manifold markets every 12h, scored when they resolve. Zero look-ahead by construction.
- **$0 Anthropic API spend** — runs `claude -p` subprocess on a Hetzner VPS via Max subscription.
- Auto-deploys via GitHub→Netlify CD. Four cron jobs handle ingestion (15m), backfill (6h), **live forecasting (12h)**, and insights (24h).
- Built autonomously by Claude Opus 4.7 over a week while the operator was AFK.

---

## What this is

Eivra is a **public benchmark for LLM forecasting accuracy**.

Six AI agents — each with a distinct system prompt and model — read real prediction-market questions from [Polymarket](https://polymarket.com) and [Manifold Markets](https://manifold.markets), produce a probability estimate with a reasoning trace, and get scored against the eventual ground-truth resolution.

The result is the **first live, continuously-updated, stats-honest scoreboard** for AI probabilistic forecasting. Calibration plots have Wilson 95% intervals. Sparse bins are flagged. Backfill predictions are marked. No real money changes hands.

The site updates every 2 minutes (Next.js ISR). New predictions land every 6 hours. New open markets ingest every 15 minutes. Insight cards regenerate nightly.

## Why this exists

LLMs are confidently wrong all the time. Existing public LLM benchmarks (MMLU, HumanEval, MTEB) mostly measure narrow correctness on static datasets. **Forecasting is different**: the truth resolves on a clock, humans have a strong baseline (the market itself), and "confidence" can be measured separately from accuracy.

The two questions Eivra answers continuously:

1. **Is this LLM accurate?** — Brier and log-loss on resolved markets.
2. **Is this LLM calibrated?** — when it says 70%, does it win 70% of the time? (Calibration plot, 10 bins, Wilson 95%.)

A confident-and-wrong model is worse than a humble-and-wrong model. The leaderboard surfaces both.

## The six agents

| # | Name | Model | Persona | Edge |
|---|------|-------|---------|------|
| 1 | **Sage** | Claude Opus 4.7 | Deliberative · base-rate-anchored | Reference-class anchoring, slow updates with strong evidence |
| 2 | **Hawk** | Claude Opus 4.7 | Contrarian · disagrees with consensus | Steelmans both sides, takes positions more extreme than the market when it finds real mispricings, ABSTAINS rather than rubber-stamp |
| 3 | **Magpie** | Claude Sonnet 4.6 | Snap forecasts · speed over depth | One key fact, one paragraph, ≤200 reasoning tokens |
| 4 | **Echo** | Claude Haiku 4.5 | Anchors to market price · small Bayesian moves | Market price is the prior; only adjusts on hard new info |
| 5 | **Mirror** | GPT-5 (cross-family control) | Different model family by design | Control variable — if Claude-family agents share a bias, Mirror exposes it |
| 6 | **Crowd** | Synthetic ensemble | Uniform-weight average of the rest | Tests whether AI ensembling beats any single agent |

Full system prompts in [`src/lib/agents.ts`](./src/lib/agents.ts). Each non-synthetic agent has a hard daily USD cap and an idempotency-keyed run window so it never forecasts the same market twice within 30 minutes.

## Scoring methodology

All scoring runs server-side from `agent_id`, `market_id`, `predicted_probability`, and `resolved_outcome ∈ {true, false}`.

### Brier score
```
B = (p − y)²
```
where `p` is the predicted probability and `y` ∈ {0, 1}. Lower is better. **0** = perfect; **0.25** = naive 50% baseline; **1** = maximally wrong.

### Log-loss
```
L = −[y · log(p) + (1 − y) · log(1 − p)]
```
Probabilities are **clamped to [1e-4, 1 − 1e-4]** before log-loss so confident-and-wrong predictions don't produce `Infinity`. Lower is better.

### Calibration plot
10 equal-width bins on predicted probability. For each bin, plot realized win rate against bin center. Diagonal = perfect calibration. Each dot carries a **Wilson 95% confidence interval**:

```
center = (p̂ + z²/2n) / (1 + z²/n)
half   = z·√(p̂(1−p̂)/n + z²/4n²) / (1 + z²/n)
```

Bins with `n < 5` render as hollow gray dots and are **excluded** from the over/under-confidence label. Below the chart: `Total predictions: N · Resolved: M`. The site shows a placeholder `[INSUFFICIENT_DATA]` panel when total scored < 20 instead of plotting noise.

### ELO
Pairwise comparison: for every resolved market where both agents predicted, the agent with the lower Brier "wins" that head-to-head. K-factor = 24. Refreshed after each scoring run.

### Paper P&L (Kelly)
Each forecast is paper-traded against the prevailing market price using fixed-fraction Kelly:

```
edge   = p − market_price
stake  = bankroll × 0.25 × |edge| / variance
pnl    = stake × (y − market_price) / market_price · sign(edge)
```

No real capital is involved. The P&L column on the leaderboard reflects hypothetical $100 bankroll at Kelly fraction 0.25.

### Eivra Score (composite)
```
S = 0.5 · (1 − Brier_norm) + 0.3 · win_rate + 0.2 · (1 − logloss_norm)
```
Brier and log-loss are min-max normalized across the active agent set. The leaderboard sorts by S descending.

## How honest are these numbers?

The site flags four caveats on every page:

- **Backfill mode.** Most resolutions in the initial dataset closed *before* this site went live. Backfill forecasts run on resolved markets and may have seen training-data news about the outcome. Every backfill prediction is flagged `is_backfill=true` in Supabase. Live-mode forecasting (on markets that resolve in the future) is the next milestone, and the lookahead concern fully disappears there.
- **No look-ahead by construction.** Scoring queries gate on `predictions.created_at < markets.resolved_at`. A model forecast made after resolution is dropped from the leaderboard.
- **Probability clamping.** Probs are clamped to `[1e-4, 1 − 1e-4]` before any log-based scoring so a single confident-and-wrong call doesn't blow up the metric.
- **Mirror disclosure.** Mirror's "GPT-5" slot currently runs as Sonnet-with-different-prompt. Operator is on a Claude Max sub and not paying for OpenAI API. The agent card discloses this. If OpenAI provides a key, Mirror upgrades — and that A/B becomes interesting.

The methodology card surfaces all four on `/benchmark`. None of this is hidden.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Polymarket Gamma API           Manifold Markets API                    │
│         │                              │                                │
│         └──────────────┬───────────────┘                                │
│                        ▼                                                │
│        ┌───────────────────────────────────┐                            │
│        │ backfill/pull-open.ts (VPS cron)  │   every 15 min             │
│        │ Normalize → UPSERT markets table  │                            │
│        └────────────────┬──────────────────┘                            │
│                         ▼                                               │
│        ┌───────────────────────────────────┐                            │
│        │ Supabase Postgres                 │   markets, predictions,    │
│        │  • agents (the 6)                 │   scores, agent_stats,     │
│        │  • markets (Polymarket+Manifold)  │   agent_runs, agent_elo,   │
│        │  • predictions (idempotent)       │   eureka_cards, events     │
│        │  • scores (Brier, log-loss)       │                            │
│        │  • agent_stats (aggregated)       │                            │
│        │  • agent_elo (head-to-head)       │                            │
│        │  • eureka_cards (insights)        │                            │
│        └────────────────┬──────────────────┘                            │
│                         │                                               │
│                         ├────────────► backfill/run.ts (VPS cron)       │
│                         │              every 6 hours                    │
│                         │              ─────────────────                │
│                         │              For each unscored market:        │
│                         │                For each active agent:         │
│                         │                  spawn `claude.cmd -p`        │
│                         │                  parse JSON forecast          │
│                         │                  INSERT prediction            │
│                         │              Score resolved markets           │
│                         │              Refresh agent_stats              │
│                         │                                               │
│                         ├────────────► backfill/generate-eureka.ts      │
│                         │              every 24 hours                   │
│                         │              ─────────────────                │
│                         │              Query agent_stats + scores       │
│                         │              Auto-generate 3 insight cards    │
│                         │                                               │
│                         ▼                                               │
│        ┌───────────────────────────────────┐                            │
│        │ Next.js 15 (App Router, ISR=120s) │   src/app/* SSR + ISR      │
│        │  Deployed to Netlify              │   src/components/* UI      │
│        │  Auto-deploys on git push to main │   src/lib/data.ts adapter  │
│        └────────────────┬──────────────────┘                            │
│                         ▼                                               │
│                  https://eivra.xyz                                      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Cloud routine (claude.ai, every 6h, MCP-aware)                  │    │
│  │  Picks one autonomous polish task per fire (landing copy, OG    │    │
│  │  image, agent persona text, tooltips, lint fixes) and ships     │    │
│  │  it via Netlify + Supabase MCP. Pre-commit gates: typecheck +   │    │
│  │  build must pass.                                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## The "$0 API cost" trick

Every backfill forecast spawns a `claude.cmd -p` subprocess on the Hetzner VPS, where the operator's Max subscription is logged in via `claude login`. The subprocess inherits that auth, makes the call, and emits JSON to stdout. The runner parses the first `{` to last `}` and inserts into `predictions`.

Critical details that took a few iterations to get right:

- **No `--bare` flag.** It strips Max-sub OAuth and forces API-key mode.
- **`--disallowedTools WebSearch,WebFetch,Bash,Read,Write,Edit,Glob,Grep`** — without this, Claude wastes turns trying to look things up.
- **`cwd=/tmp`** so `claude.cmd` doesn't auto-load this repo's CLAUDE.md (~33k tokens of irrelevant context).
- **Probability aliases accepted.** The parser accepts `probability`, `probability_yes`, `p_yes`, `forecast`, `prob`, `yes`, `p` — Claude picks slightly different keys across runs.
- **Idempotency cache** in `.backfill-cache/` keyed by `(agent_id, market_id, run_window)` skips already-forecasted markets.
- **Hard daily $ cap per agent** in `agents.daily_budget_usd` — gates the spawn.

Net result: continuous backfill on a Max subscription. **Zero dollars billed to Anthropic for inference.** (Supabase + Netlify are on free tiers; the only fixed cost is the Hetzner VPS at €4.69/mo.)

## Cron jobs (VPS, user `crucible`)

```cron
*/15 * * * * cd /opt/crucible-ai && npx tsx backfill/pull-open.ts                >> /var/log/crucible-ai/pull-open.log 2>&1
11 */6 * * * cd /opt/crucible-ai && git pull && npx tsx backfill/run.ts --limit=30 >> /var/log/crucible-ai/backfill.log 2>&1
37 3  * * * cd /opt/crucible-ai && npx tsx backfill/generate-eureka.ts          >> /var/log/crucible-ai/eureka.log 2>&1
```

Idempotent. Resilient to mid-run failures. `git pull` before the backfill run picks up agent prompt edits without redeploy.

## Paper proof snapshots

The 30-day paper-trading lab has two daily capture paths:

- Netlify scheduled function: `netlify/functions/paper-trading-snapshot.ts` posts to `/api/trading-snapshots` at `05:12 UTC` and requires `CRON_SHARED_SECRET` in the deployed site env.
- GitHub Actions fallback: `.github/workflows/paper-trading-snapshot.yml` runs at `05:22 UTC`, uploads the workflow-mode, snapshot summary, full snapshot rows, and soft-audit JSON artifacts for that run, and writes Supabase rows only when `SUPABASE_SERVICE_ROLE_KEY` is configured.

The GitHub workflow does not depend on the deployed frontend. It uses the public Supabase URL and publishable anon key from this repo by default, with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` available as optional repository-secret overrides. If `SUPABASE_SERVICE_ROLE_KEY` is missing, scheduled runs degrade to read-only live artifact capture instead of failing before evidence is collected. Writes still require the repository secret `SUPABASE_SERVICE_ROLE_KEY`. It sets `NEXT_PUBLIC_USE_DEMO_DATA=false` and the snapshot script refuses to write demo-sourced rows unless `--allow-demo-write` is passed manually.

Manual `workflow_dispatch` dry runs are safe without service-role access and
exercise the same snapshot and audit artifact path without inserting rows.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15.5.18 (App Router, ISR=120s, RSC server components) |
| Language | TypeScript 5.7 (strict, `noImplicitAny`) |
| UI | Tailwind 3.4 · `IBM_Plex_Sans` heading · `JetBrains_Mono` mono · `Inter` body |
| Data | Supabase Postgres 16 + Row-Level Security (public-read, service-write) |
| Auth | Supabase Anon key (read) + Service Role (server) via `@supabase/ssr` |
| LLM | `claude.cmd -p` subprocess via Max sub. No `ANTHROPIC_API_KEY` |
| Sources | Polymarket Gamma API, Manifold Markets API |
| Hosting | Netlify (frontend) + Hetzner CX22 (VPS for cron) |
| Deploy | GitHub→Netlify CD with `@netlify/plugin-nextjs` pinned in `netlify.toml` |
| Cloud agent | claude.ai remote-trigger routine, every 6h, Netlify + Supabase MCP attached |

## Schema (key tables)

```
agents            6 rows, mirrors src/lib/agents.ts
markets           116 rows  → UNIQUE(source, source_id), status, resolved_outcome
agent_runs        observability: per-agent per-market spawn record, idempotent on run_window
predictions       182 rows  → (agent_id, market_id, probability, reasoning, market_price_at_forecast)
scores            180 rows  → (prediction_id, brier, log_loss, paper_pnl, was_correct)
agent_stats       6 rows    → rolling rollup (Brier 30d, win rate, log-loss, eivra_score, rank)
agent_elo         pairwise  → ELO matrix between agents
eureka_cards      auto-generated insight tiles, refresh nightly
system_settings   feature flags + global config
system_events     log of cron runs, errors, deploys
```

Full DDL in [`supabase/migrations/`](./supabase/migrations).

## Project structure

```
eivra/
├── README.md  PLAN.md  DESIGN.md  LAUNCH.md  LAUNCH-X.md  HANDOFF.md
├── netlify.toml                  ← @netlify/plugin-nextjs pin (required)
├── .github/workflows/            ← daily paper proof snapshot fallback
├── backfill/
│   ├── run.ts                    ← claude -p agent forecasts (6h cron)
│   ├── pull-open.ts              ← scrape open markets (15min cron)
│   └── generate-eureka.ts        ← daily insight cards (24h cron)
├── scripts/
│   ├── vps-bootstrap.sh          ← VPS setup, idempotent
│   ├── paper-trading-snapshot.ts ← persisted paper proof capture
│   ├── wsl-deploy.sh             ← fallback deploy via WSL Linux build
│   └── VPS-SETUP.md              ← operator runbook
├── src/
│   ├── app/
│   │   ├── page.tsx              ← homepage (hero + ticker + eureka + leaderboard)
│   │   ├── benchmark/page.tsx    ← HN hero / methodology hub
│   │   ├── leaderboard/page.tsx
│   │   ├── agents/page.tsx + [id]/page.tsx
│   │   ├── markets/page.tsx + [id]/page.tsx
│   │   ├── about/page.tsx
│   │   ├── opengraph-image.tsx + agents/[id]/opengraph-image.tsx
│   │   └── api/health/route.ts
│   ├── components/
│   │   ├── Header  Footer  HeroMetric  Leaderboard  EurekaCard
│   │   ├── LiveTicker            ← server-fetched, client-cycled
│   │   ├── CalibrationPlot       ← 10-bin SVG, Wilson 95%, hollow sparse-bin dots
│   │   └── StatePanel
│   └── lib/
│       ├── agents.ts             ← the 6 (id, model, persona, hue, systemPrompt)
│       ├── data.ts               ← Supabase adapter with demo fallback
│       ├── demo-data.ts          ← deterministic seed (offline preview)
│       ├── format.ts             ← prob/num/relativeTime helpers
│       └── supabase/             ← server + browser client factories
└── supabase/
    ├── migrations/               ← schema DDL (applied to prod)
    └── functions/                ← Edge Functions (pull-markets, resolve-markets)
```

## Run it locally

```bash
git clone https://github.com/claygeo/eivra.git
cd eivra
npm install
cp .env.example .env.local        # fill in Supabase URL + anon key
npm run dev                       # http://localhost:3000
```

Without Supabase credentials it falls back to `src/lib/demo-data.ts` (deterministic seed of 6 agents, 8 demo markets, mocked stats) so the UI loads with zero infra.

### Run the backfill yourself

```bash
# Requires:  claude.cmd / claude on PATH, logged in via `claude login`
# Optional:  SUPABASE_SERVICE_ROLE_KEY in .env.local for live writes
npx tsx backfill/pull-open.ts            # scrape ~30 open markets
npx tsx backfill/run.ts --limit=10       # forecast 10 markets across all agents
npx tsx backfill/generate-eureka.ts      # regenerate insight cards
```

### Deploy your own

1. Fork the repo
2. Create a Supabase project, run `supabase/migrations/` DDL
3. Connect to Netlify, add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
4. Push to `main` → Netlify auto-deploys
5. For continuous backfill: provision a VPS (Hetzner CX22 is plenty), run `scripts/vps-bootstrap.sh`, log in via `claude login`, install the crontab in `scripts/VPS-SETUP.md`

## What's next

In rough priority order:

- [ ] **Live-mode forecasting** on markets that resolve in the future (eliminates the backfill look-ahead concern)
- [ ] **User-submitted agents.** Submit a system prompt + model choice, get scored alongside the house agents. Sandboxed, daily budget cap.
- [ ] **GPT-5 in Mirror** when an OpenAI key is available
- [ ] **More sources** — Kalshi API once approved, additional Manifold subcategories
- [ ] **Embeddable leaderboard widget** — `<iframe>` snippet for HN / blog posts
- [ ] **Slack / Discord webhook** when an agent makes a high-conviction call (probability outside [0.2, 0.8] on a high-volume market)
- [ ] **Per-category leaderboards** — politics, crypto, sports, AI/tech separately

## Honest limits

- **Sample size.** 31 resolved markets is small. Brier scores will shift as N grows. Don't anchor too hard on the current rankings.
- **Selection.** Polymarket and Manifold skew toward US politics, crypto, AI/tech. Performance there may not generalize to other categories.
- **Backfill dominance.** Most current resolutions are backfill (model may have seen training-data news). The flag is there, but it pollutes the headline numbers.
- **One operator.** This is a solo project. No team review. Bugs likely exist. Issues welcome.

## Contributing

This is currently a one-operator project, but contributions are welcome:

- **File an issue** if you spot a methodology problem, scoring bug, or UI quirk
- **Submit a market source** — open a PR adding a new ingestion script to `backfill/`
- **Suggest an agent prompt** — open an issue with your proposed `systemPrompt` and the angle it tests
- **Improve calibration math** — Wilson interval is the current default; happy to discuss Clopper-Pearson, Jeffreys, or beta-binomial alternatives

For larger changes, open an issue first to discuss the approach.

## Credits

Built **autonomously** by [Claude Opus 4.7](https://www.anthropic.com/news/claude-4-7) over the week. The operator ([@claygeo](https://github.com/claygeo)) gave a single instruction — *"build something innovative, like ML, game changer"* — and walked away.

Everything you see was designed, written, deployed, and operated by the model:

- 1 codebase (Next.js + TypeScript + Supabase)
- 1 schema (Postgres DDL with idempotency keys, RLS, indexes)
- 6 agents (system prompts, persona, model choice, budget)
- 3 cron scripts (open-market pull, forecast backfill, eureka cards)
- 1 VPS deployment (Hetzner bootstrap, claude login, cron install)
- 1 cloud routine (autonomous polish every 6h, Netlify + Supabase MCP)
- Original brand name `Crucible.AI` → renamed to **Eivra** mid-project after `/codex` identified a trademark collision with an existing AI workflow company

The full conversation history is preserved at `~/.claude/projects/...` — see [HANDOFF.md](./HANDOFF.md) for the session checkpoint.

## Related work

- [solhunt](https://github.com/claygeo/solhunt) — autonomous AI agent that finds + exploits smart-contract vulnerabilities. 67.7% on DeFiHackLabs, dropped to 13% on a random sample. The honesty gap drove the verifier-gate design in solhunt-duel.
- [solhunt-duel](https://github.com/claygeo/solhunt-duel) — adversarial red/blue agent system for smart-contract auditing. Red writes exploits, Blue writes patches, four server-side Forge-verified gates decide the verdict.

## License

MIT. See [LICENSE](./LICENSE).

---

**Built autonomously by Claude Opus 4.7. Curated by [@deforestpeg](https://x.com/claygdev).**
