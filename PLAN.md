# Eivra — Build Plan (week of 2026-05-10 → 2026-05-17)

> Built autonomously by Claude Opus 4.7. Operator away the entire week.
> **Plan version 2** — revised after /autoplan dual-voice review (codex + Claude subagent), 2026-05-10.

## North star

Top HN. Get retweeted by ML twitter. Operator returns to a live, working, impressive product that demonstrates Opus 4.7 can autonomously ship a polished, technically deep product in a week.

## Hero thesis (sharpened post-review)

> **"Watch six AI agents publicly bet on the future. Every prediction gets a report card."**

ONE thesis: the chess.com of AI prediction. NOT "Bloomberg terminal for AI forecasters" (too professional, no daily-return reason). The hook is *spectacle plus rigor* — agents have personalities, agents publicly fail, agents get scored.

**Hero metric (above-the-fold on homepage):** *"Agent calibration delta vs. market consensus, last 30 days"* — does a given AI agent know more or less than the wisdom of crowds, on average?

**Hero narrative for launch (HN title candidates):**
- "I let six AI agents loose on prediction markets for a week. Here's the scoreboard."
- "Watch Claude and GPT bet on the future, in public, with calibration scoring."
- "AI agents systematically overreact to breaking news — receipts attached."

**The screenshotable Eureka cards** — auto-generated insight tiles on homepage:
- *"Sage and Hawk agreed on 12% of markets; on those, they're 89% accurate."*
- *"Echo (price-anchor) beats Sage (deep-research) when the news cycle is quiet."*
- *"Ensemble has 0.18 Brier; best individual agent is 0.21. Wisdom of (AI) crowds wins."*

## The core loop (the "wedge")

1. **Market intake.** Pull open prediction-market questions from Polymarket Gamma + Manifold Markets + Kalshi (when accessible) every 15 min. Normalize to a common schema.
2. **Forecast round.** For every new market, every active agent produces: a probability estimate, a 1-paragraph reasoning trace, and a list of cited sources (URLs / search snippets).
3. **Position book.** Each agent's forecast is recorded as a "paper trade" at the market's prevailing price using a Kelly-fraction-of-bankroll sizing rule.
4. **Resolution.** When a market resolves (yes/no), every agent's prediction is scored: Brier, log-loss, paper P&L vs. baseline (market consensus).
5. **Aggregation.** Per-agent stats refresh: rolling 30-day Brier, calibration curve, ELO vs. each other agent (Bayesian Bradley-Terry), category-conditional accuracy.
6. **Public dashboard.** Live leaderboard, agent profiles (cards with stats + recent picks), market detail (all agents side-by-side + how the market moved), and a real-time ticker of fresh forecasts.

The wow moment is steps 2 + 6: watch agents reason about real-world questions in real time, watch them win and lose in public.

## Agents (week-1 roster)

Six house agents to ship with:

1. **Sage** (Opus 4.7, "deliberative") — extended thinking, reads full source, produces base-rate-anchored estimates
2. **Hawk** (Opus 4.7, "contrarian") — explicitly searches for the strongest case against market consensus
3. **Magpie** (Sonnet 4.6, "cheap-and-fast") — short-context, snap forecasts, tests if speed beats depth
4. **Echo** (Haiku 4.5, "consensus-tracker") — explicitly anchors to current market price + small adjustment
5. **Mirror** (GPT-4-class, "control") — different model family for contrast
6. **Ensemble** (synthetic) — log-linear blend of the above, weights learned from past performance

Week-2 stretch: user-submitted agents (paste a system prompt + temperature + model choice).

## Data sources (week-1)

- **Polymarket Gamma API** — public, free, has all open & resolved markets
- **Manifold Markets API** — public, free, has tons of fun markets including AI-on-AI bets
- **Kalshi API** — needs API key (defer to week-2 unless trivial)

## Phased milestones (v2 — revised post-review)

### Phase 1 — Idempotent pipeline + DB + demo mode (days 1-2)
- [ ] Scaffold Next.js 15 + Tailwind + Supabase client + repo CI to Netlify
- [ ] Apply DB migrations: `markets`, `agents`, `predictions`, `resolutions`, `scores`, `agent_runs`, `evidence_events`, `system_events`
- [ ] **All writes use idempotency keys.** `predictions.uniq_key = (agent_id, market_id, run_window_start)`. UPSERT-on-conflict-do-nothing.
- [ ] Build `pull-markets` Edge Function — Polymarket Gamma + Manifold; pg_cron every 15 min; idempotent UPSERT into `markets`
- [ ] Build `forecast-market` Edge Function — invoked per (agent × pending market). 90s wall budget per call. Writes `agent_runs` row first (pending) → calls Anthropic → writes `prediction` + `evidence_events` → marks `agent_runs` complete. On timeout: row stays `pending`, retry on next sweep.
- [ ] Build `resolve-markets` Edge Function — every 30 min; pulls newly-resolved markets, scores predictions where `predictions.created_at < markets.resolved_at` (no lookahead). Brier + log-loss with p-clamping at 1e-4 / 1-1e-4.
- [ ] **Demo mode is FIRST-CLASS** — `seed-demo-data.sql` script populates 25 historical markets with realistic agent predictions across 6 agents. Dashboard renders perfectly with zero live API calls. Toggle `NEXT_PUBLIC_USE_DEMO_DATA` flips between live + demo without code changes.
- [ ] **Hard budget guards** — `agents.daily_budget_usd` column. Anthropic call wrapper checks today's spend before each call. On budget hit: set `agents.disabled_until = end_of_day` and log to `system_events`. Dashboard shows "QUOTA" badge on disabled agents.
- [ ] **Kill switch** — `system_settings.global_pause` boolean. If true, all crons no-op. Status endpoint at `/api/health` shows queue depths, recent errors, budget burn per agent.
- [ ] First deploy verified live on Netlify

### Phase 2 — Dashboard MVP with full state matrix (days 3-4)
- [ ] **Every screen has explicit empty / loading / error / degraded states** — see DESIGN.md state-matrix section.
- [ ] Home: hero metric (calibration delta vs. consensus, last 30d) + 3 Eureka insight cards (auto-refreshed) + leaderboard table + live ticker (reduced-motion fallback)
- [ ] Leaderboard: pin the ranking basis at top ("Last 30 days · Resolved markets only · Sorted by Brier ↓"). Filter chips for time window + category.
- [ ] Agent profile: hero stat (calibration delta) + recent forecasts table + calibration plot WITH Wilson intervals + N-per-bin annotations + persona blurb + last 7d streak
- [ ] **Market detail = disagreement-first.** Header: market + close date + status pill. PRIMARY VIEW: stacked horizontal bars showing each agent's probability with the spread highlighted, sorted by absolute distance from market. Below: "How the market moved" mini-chart + each agent's reasoning expandable.
- [ ] Live ticker (bottom): respects `prefers-reduced-motion` → switches to discrete cycling (4s dwell) instead of marquee
- [ ] Auth (Supabase magic link) — minimal week-1 use: just for saved-views (defer agent submission to v2 per review)
- [ ] Dark mode terminal aesthetic per DESIGN.md (with WCAG AA contrast fixes)

### Phase 3 — Calibration scoring + Eureka card generator (days 5-6)
- [ ] Calibration: 10-bin reliability diagram per agent, Wilson 95% intervals
- [ ] Simple Elo (K=24) head-to-head between agents on per-market disagreements; **defer Bayesian Bradley-Terry to v2** (per review — too much stateful ML for week-1)
- [ ] **Uniform-weight ensemble** — average of all active agents per market. Show on leaderboard as "Crowd". **Defer learned-weight ensemble to v2.**
- [ ] Category-conditional stats — group markets by tag (politics / crypto / sports / AI-tech / other), show per-category leaderboard
- [ ] **Eureka card generator** — runs nightly, scans agent stats for screenshotable insights (largest spread, biggest streak, surprising winner). Top 3 surface on homepage.
- [ ] **Defer pgvector embeddings to v2** (per review — high infra surface, low day-1 ROI)
- [ ] **Defer multi-armed bandit position sizing to v2** (per review — use fixed Kelly fraction = 0.25)

### Phase 4 — Landing polish + launch (day 7)
- [ ] Landing hero: live counter "currently watching N markets · K predictions logged · J resolved today" + the 3 Eureka cards
- [ ] OpenGraph cards per agent profile + per market — generated dynamically (Next.js OG image route)
- [ ] HN copy draft (Show HN: ...) + 60s screencap loop demo
- [ ] /qa full pass + /review PR + /ship final deploy + verify production
- [ ] Save handoff memory + status report for operator's return

## Deferred to v2 (per /autoplan review)

- User-submitted agents (paste a prompt) — moderation + fairness + infra surface; ship the house league first
- pgvector market similarity widget — high infra cost, low day-1 wow vs. effort
- Multi-armed bandit position sizing — adds conceptual noise, real reward signal weak in week-1
- Bayesian Bradley-Terry ELO — overengineered for week-1; simple Elo with K=24 is fine
- Learned-weight ensemble — uniform-weight ensemble first, learn weights once we have N>500 resolutions
- Subscribe-to-agent email digest
- Twitter bot
- Polymarket order-book snapshots (smart-money positioning)
- Cross-market arbitrage detection

## Open decisions resolved (post-/autoplan)

1. **ELO:** simple Elo with K=24, head-to-head per market disagreement. Bayesian B-T deferred to v2.
2. **Demo data:** 25 historical markets, mix of resolved + open, across 6 agents. Frozen JSON in `db/seed/demo-markets.json`.
3. **Agent budget:** $1/day per Opus agent, $0.50/day per Sonnet, $0.20/day per Haiku, $1/day per OpenAI agent. Surface in admin.
4. **Reasoning trace:** show full mono trace, but collapsed by default (~200 chars preview). User clicks to expand. Mobile = expand-only modal.
5. **Composite score:** call it "Eivra Score" = weighted blend of normalized Brier (50%) + ELO percentile (30%) + 7-day calibration delta (20%). Surfaces on leaderboard.

## Risks (with mitigations)

- **Anthropic API cost spirals.** Mitigation: hard per-agent daily budget + auto-disable + visible QUOTA badge. Haiku for cheap classification, Opus only when extended-thinking actually helps.
- **Supabase Edge Function timeouts.** Mitigation: 90s wall budget per `forecast-market` call, idempotent UPSERTs, retry-on-pending sweep every 5min, single-writer per (agent, market).
- **Polymarket / Manifold rate limits.** Mitigation: 15min poll cadence is well below limits, conditional fetch, exponential backoff on 429.
- **Markets resolve slowly so leaderboard looks empty day 1.** Mitigation: backfill predictions on 25 already-resolved historical markets at deploy-time (with `is_backfill=true` flag and "BACKFILL" badge so we don't claim look-ahead-free skill on those). Demo mode hides backfill behind a toggle.
- **Operator unavailable for blockers.** Mitigation: demo mode = first-class deterministic fallback (site always alive). `/api/health` endpoint surfaces all green/red. Memory checkpoints at every phase. Kill-switch column lets operator `UPDATE system_settings SET global_pause=true` from phone via Supabase dashboard.
- **Polymarket/Manifold semantic drift.** Mitigation: contract test on each provider's API runs in CI; deploy fails if shape mismatch.
- **Mirror agent dependency on OpenAI.** Mitigation: if OpenAI key absent, Mirror = Sonnet-with-different-system-prompt + agent card discloses honestly.

## /autoplan decision audit trail

| # | Phase | Decision | Classification | Principle | Rationale |
|---|-------|----------|---------------|-----------|-----------|
| 1 | CEO | Sharpen wedge to single thesis: "chess.com of AI prediction" | Auto | P5 explicit | Both reviewers said wedge was too broad; one thesis, hero metric, narrative |
| 2 | CEO | Defer user-submitted agents to v2 | Auto | P3 pragmatic | Both reviewers agreed; ship house league first, moderation surface too big for week-1 |
| 3 | CEO | Add 3 auto-generated Eureka insight cards on homepage | Auto | P1 completeness | Surfaces a screenshotable truth (codex's missing-for-HN-virality fix) |
| 4 | Eng | Idempotency keys on every write + agent_runs status table | Auto | P5 explicit | Both reviewers flagged Edge Function retry/duplicate risk |
| 5 | Eng | Demo mode = first-class deterministic fallback (not afterthought) | Auto | P1 completeness | Both reviewers called this out; site always alive, AFK-safe |
| 6 | Eng | Hard daily budget per agent + visible QUOTA badge + auto-disable | Auto | P1 completeness | AFK risk: silent quota hit + empty leaderboard |
| 7 | Eng | Kill-switch via system_settings.global_pause | Auto | P5 explicit | Operator can pause from phone via Supabase dashboard if anything goes sideways |
| 8 | Eng | Defer pgvector market similarity to v2 | Auto | P3 pragmatic | High infra surface, low day-1 ROI per both reviewers |
| 9 | Eng | Defer Bayesian Bradley-Terry; use simple Elo K=24 | Auto | P5 explicit | Stateful ML behavior too risky for week-1 unattended ship |
| 10 | Eng | Defer learned-weight ensemble; use uniform-weight | Auto | P3 pragmatic | Same — wait for >500 resolutions to learn weights |
| 11 | Eng | Defer multi-armed bandit; fixed Kelly fraction 0.25 | Auto | P3 pragmatic | "Adds conceptual noise, fake-finance complexity" — codex |
| 12 | Eng | Brier/log-loss p-clamping at 1e-4 | Auto | P1 completeness | Numerical edge case both reviewers caught |
| 13 | Eng | Lookahead guard on resolution scoring (predictions.created_at < markets.resolved_at) | Auto | P1 completeness | Polymarket continuous resolution + intake lag |
| 14 | Eng | Mirror agent fallback to Sonnet-with-different-prompt if OpenAI unavailable | Auto | P3 pragmatic | OpenAI key may not be paid; honest agent-card disclosure |
| 15 | Design | State matrix per screen (empty/loading/error/degraded) added to DESIGN.md | Auto | P1 completeness | Day-1 dashboard will be empty; both reviewers flagged this as fatal |
| 16 | Design | Calibration plot: Wilson intervals + N-per-bin annotations | Auto | P1 completeness | Sparse bins = misleading without uncertainty bands |
| 17 | Design | Live ticker respects prefers-reduced-motion (discrete cycling fallback) | Auto | P1 completeness | Accessibility + mobile + screen-reader friendly |
| 18 | Design | Bump --text-muted to pass WCAG AA contrast | Auto | P1 completeness | Subagent flagged 3.8:1 ratio fails AA |
| 19 | Design | Market detail = disagreement-first layout (not stats-table-first) | Auto | P5 explicit | Codex: "make disagreement the visual centerpiece" |
| 20 | Design | Leaderboard pins ranking basis ("Last 30 days · Resolved markets only · Sorted by Brier ↓") | Auto | P5 explicit | Avoids ambiguity about all-time-vs-recent | 

**Net verdict:** BUILD WITH REVISIONS — applied. Plan is now sharper, narrower, more demo-resilient. Building begins.
