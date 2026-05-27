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

## Persisted Proof Log

The 30-day proof window now has a durable audit surface:

- `paper_trading_snapshots` stores append-only strategy proof snapshots.
- `GET /api/trading-snapshots` returns the persisted proof log.
- `POST /api/trading-snapshots` writes the current capped snapshot and requires
  `CRON_SHARED_SECRET`.
- A Netlify scheduled function runs the writer once per day on published deploys.
- `/api/trading.json` includes `persistence`, `persisted_daily_snapshots`, and
  `persisted_strategy_rollups` so the public feed shows both current
  request-derived math and stored evidence.
- `persistence.capture_health` reports the daily recorder status, latest capture
  age, next expected capture, cron expression, and stale threshold.

The database table is public-read, service-role-write, and RLS-enabled. Snapshot
rows are analytics evidence only; they do not create wallets, orders, leverage,
or any execution path.

Persisted strategy rollups dedupe repeated same-day captures by keeping the
latest row for each `(strategy_id, snapshot_date)` pair. The 30-day proof count
is therefore `captured_days`, not raw row count. Raw rows remain in the feed for
auditability.

Each persisted rollup also carries `durable_proof_gate`. This is the
authoritative readiness gate for the 30-day lab because it uses stored capture
days, latest resolved live-trade stats, drawdown, and capture freshness instead
of the current request's URL filters.

The dashboard and public JSON feed load a 360-row persisted history window. That
is intentionally larger than 30 days because the daily writer stores multiple
strategy rows per capture, and same-day manual probes can add duplicate rows.

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
