# Eivra Paper Trading V2

## Goal Prompt

Build Eivra into a paper-only prediction-market trader that answers one sharper question:

> Which AI forecaster is not just accurate, but tradable?

Use Eivra's existing live predictions, market prices, and eventual resolutions. For every agent forecast, compare the agent probability to the market price at lock time. If the gap is large enough, create a bounded paper ticket:

- Positive edge: buy YES.
- Negative edge: buy NO.
- Stake: quarter-Kelly from a $5,000 paper bankroll, capped at $100 per ticket.
- Maximum loss: the ticket stake.
- P&L: binary-share payoff when the market resolves.
- No real execution, no wallet, no leverage, no order placement.

The product surface should make the difference between "forecasting skill" and "tradable edge" obvious. A market-prior agent can have great Brier score and poor P&L. A less calibrated contrarian can have worse Brier and better paper returns if it finds mispriced markets.

## First Slice

Ship a vertical slice that works with current data:

1. Compute paper tickets from existing predictions.
2. Rank agents by resolved paper P&L and ROI.
3. Show open paper tickets still awaiting resolution.
4. Expose `/api/trading.json` for public auditability.
5. Add `/trading` as a first-class page in the app nav.

## Risk Rules

This is deliberately safer than the Hyperliquid leverage idea:

- Prediction-market tickets have bounded downside.
- A wrong ticket loses the stake, not the whole account.
- There is no liquidation path.
- The public verifier remains the market's final resolution.
- The experiment can run for weeks without capital pressure.

## Current Configuration

```text
bankroll_usd: 5000
min_edge: 5 percentage points
stake_mode: quarter Kelly
max_stake_usd: 100
max_open_exposure_usd: 500
min_stake_usd: 5
flat_stake_comparison: 25
entry_price_bounds: 0.02 to 0.98
```

## Configurable Lab Controls

The `/trading` page and `/api/trading.json` share the same bounded query params:

```text
sample: live_only | all | backfill
agent: all | sage | hawk | magpie | echo | mirror | ensemble
category: all | politics | sports | ai-tech | crypto | other
side: all | YES | NO
min_edge: 0.01 to 0.50
stake_mode: kelly_capped | flat
ticket_usd: 5 to 100
max_stake_usd: 5 to 100
max_open_exposure_usd: 100 to 5000
```

These params only change analytics. They do not create wallets, orders, leverage,
or any execution path.

## Canonical Agent Edge Matrix

The lab now tracks every house agent with two live-only rules:

```text
edge >= 5 percentage points
edge >= 10 percentage points
```

These canonical rules are exposed as `agent_edge_matrix` in `/api/trading.json`
and rendered on the dashboard as "Agent edge rules." The matrix is separate
from custom URL controls so the 30-day lab can compare Sage, Hawk, Magpie, Echo,
Mirror, and Crowd under the same stake caps, exposure cap, and proof gates.

## Exposure Ledger

Each strategy is replayed chronologically through a paper exposure cap before
P&L, open tickets, daily snapshots, or proof gates are summarized. A ticket is
accepted only when adding its maximum loss keeps simultaneous open risk under
`max_open_exposure_usd`. Otherwise the signal is recorded as skipped with the
exposure-before amount and reason.

The selected strategy exposes `selected_exposure_ledger`; each canned strategy
variant exposes `exposure_ledger`. This prevents a strategy from looking good
only because it pretended unlimited simultaneous tickets could be taken.

## Daily Evidence Series

The dashboard and `/api/trading.json` expose capped daily evidence in two forms:

- `selected_daily_series` and the compatibility alias `selected_daily_snapshots`
  for the current URL-selected strategy.
- `strategy_daily_series` for every canned strategy in the lab.

Every series is derived from the same exposure-capped replay as the matching
strategy summary. Daily rows therefore reconcile with proof gates, skipped
signals, open risk, and resolved P&L instead of using uncapped raw signals.

## Resolution Watch

`/api/trading.json` exposes `resolution_watch` for open live paper tickets. It
tracks how many live signals are still awaiting market resolution, how many are
past their market close time, how many close in the next seven days, the next
known close time, and a compact watchlist of unresolved tickets. This keeps the
proof gap explicit: open EV is not profit until the market resolves.

## Persisted Proof Log

The 30-day proof window now has a durable audit surface:

- `paper_trading_snapshots` stores append-only strategy proof snapshots.
- `GET /api/trading-snapshots` returns the persisted proof log.
- `POST /api/trading-snapshots` writes the current capped snapshot and requires
  `CRON_SHARED_SECRET`.
- `npm run paper:snapshot` builds the exact same snapshot rows locally as a
  dry-run recovery path. `npm run paper:snapshot:write` inserts them directly
  with `SUPABASE_SERVICE_ROLE_KEY`; it refuses to write demo-sourced rows unless
  `--allow-demo-write` is passed explicitly.
- `npm run paper:audit` is the non-mutating capital-review gate. It reads the
  current live snapshot plus persisted proof log, verifies every paper-only,
  capture, resolution, P&L, ROI, drawdown, and readiness invariant, and exits
  nonzero until all gates pass. Use `npm run paper:audit:soft` when a report is
  needed without failing the shell.
- `GET /api/trading-proof-audit` exposes the same read-only audit contract for
  API consumers. The CLI and route share `buildPaperTradingProofAudit`, so the
  local gate and public JSON cannot drift.
- A Netlify scheduled function runs the writer once per day on published deploys.
- `/api/trading.json` includes `persistence`, `persisted_daily_snapshots`, and
  `persisted_strategy_rollups` so the public feed shows both current
  request-derived math and stored evidence.
- `/api/trading.json` and `GET /api/trading-snapshots` also expose
  `persisted_agent_edge_proof_matrix` / `agent_edge_proof_matrix`, a durable
  projection of the canonical Sage, Hawk, Magpie, Echo, Mirror, and Crowd
  5pp/10pp live rules.
- `persistence.capture_health` reports the daily recorder status, latest capture
  age, next expected capture, cron expression, and stale threshold.
- `persistence.capture_calendar` reports the proof window day by day, including
  complete, partial, and missing capture days plus the number of unique live
  strategy rules recorded for each expected snapshot date.
- `persistence.proof_readiness` and the top-level
  `persisted_proof_readiness` turn the durable evidence into explicit
  pass/collecting/blocked gates: archive availability, paper-only lock, capture
  freshness, registry sync, current resolution hygiene, 30-day capture window,
  resolved-trade minimum, positive window P&L/ROI, drawdown, and
  capital-review boundary. The readiness payload also includes per-status item
  counts, blocked item ids, and structured evidence for gates with live blockers
  such as overdue resolution signals.
- `persistence.proof_runway` and the top-level `persisted_proof_runway` turn the
  same evidence into an operator timeline: earliest possible capital-review
  date, remaining capture days, remaining resolved live trades, open resolution
  capacity, overdue/closing resolution pressure, and milestone-level ETAs.

The database table is public-read, service-role-write, and RLS-enabled. Snapshot
rows are analytics evidence only; they do not create wallets, orders, leverage,
or any execution path.

Persisted strategy rollups dedupe repeated same-day captures by keeping the
latest row for each `(strategy_id, snapshot_date)` pair. The 30-day proof count
is therefore `captured_days`, not raw row count. Raw rows remain in the feed for
auditability.

Rollups also dedupe equivalent strategy rules by fingerprinting the live/backfill
sample, edge gate, stake mode, ticket caps, exposure cap, agent set, category,
and side. This keeps the URL-selected `selected-query` row from double-counting
when it exactly matches a canned strategy, while still preserving truly custom
URL configurations as their own rollups.

Each persisted rollup also carries `durable_proof_gate`. This is the
authoritative readiness gate for the 30-day lab because it uses stored capture
days, latest resolved live-trade stats, drawdown, and capture freshness instead
of the current request's URL filters.

Each rollup also carries `capture_coverage`, which compares captured snapshot
dates against the latest up-to-30 scheduled capture dates in the proof window.
Missing scheduled dates block live strategies from becoming candidates, even
when the latest global capture is still inside the broader freshness window.

The persisted feed also carries a top-level `capture_calendar`. This is the
operator-facing evidence ledger: it shows whether each expected proof day has a
complete live-strategy snapshot set, a partial set, or no capture at all. The
calendar does not replace per-strategy proof gates; it makes recorder quality
auditable before anyone reads P&L.

`/api/trading.json` also carries `persistence.registry_sync` and the top-level
alias `persisted_registry_sync`. This compares the current live strategy
registry against the latest persisted proof day by strategy-rule fingerprint.
When new canonical rules ship, the dashboard shows `pending_capture` until the
next daily snapshot records those rules in the durable log.

Each rollup also carries `proof_window`, a rolling-window delta from the row
before the proof window into the latest captured row. The durable gate uses this
window's resolved trades, resolved P&L, ROI, and drawdown instead of all-time
cumulative totals, so old wins cannot make a strategy pass a fresh 30-day test.

The persisted feed also exposes `proof_summary`, a live-first status surface
that counts live candidates, collecting strategies, stale/not-qualified
strategies, and control rows. The summary's best-live strategy is ranked by the
same rolling-window proof metrics as the durable gate, so backfill controls stay
auditable without leading the live proof table.

`proof_summary` also carries the capital-review boundary: `paper_only: true`,
`real_money_execution_allowed: false`, and `capital_review_status`. A durable
candidate can make the strategy reviewable by the operator, but it never enables
execution in this app.

The dashboard and public JSON feed load a 1000-row persisted history window. That
is intentionally larger than 30 days because the daily writer stores multiple
strategy rows per capture, same-day manual probes can add duplicate rows, and
the proof-window delta needs the baseline row before the 30-day window.

The dashboard renders the persisted agent-edge proof matrix separately from the
current in-memory matrix. The persisted table is the one to watch for the
30-day capital decision because it is built from stored rollups, capture
coverage, resolved trades, rolling-window P&L, drawdown, and blockers.

The dashboard also renders a proof-readiness checklist above the persisted
tables. This is the operator surface for "what is blocking real-money review
right now"; it never enables execution and always keeps `paper_only: true`.
When loaded through `/api/trading.json`, the checklist includes the current
resolution backlog so overdue live paper markets are visible before open EV is
mistaken for realized P&L. Blocked gates can render their attached evidence
directly under the checklist row, linking back to the market that needs review.
The proof-runway section beside it answers the next question: if capture health
stays fresh and markets resolve, what is the earliest date this evidence could
be reviewable, and which milestone is still short.

Capture health is `fresh` while the latest persisted row is less than 36 hours
old. It becomes `stale` after that window, which makes a missed daily snapshot
visible before anyone trusts the proof gate.

## Proof Gate

Every live strategy carries a conservative proof status in both the dashboard and
`/api/trading.json`.

```text
required_live_days: 30
required_resolved_trades: 30
min_resolved_net_pnl_usd: 1
min_roi_on_stake: positive
max_drawdown_usd: 500
statuses: collecting | candidate | not_qualified | control_only | stale
```

Backfill strategies are always `control_only`. Live strategies remain
`collecting` until the 30-day window and resolved-trade minimum are both met.
Only then can the gate classify them as `candidate` or `not_qualified`. If the
daily capture is not fresh, persisted live rollups become `stale` regardless of
P&L. This label is evidence hygiene, not an execution signal.

## Later Phases

- Add a public "would trade today" feed once live sample size is meaningful.
