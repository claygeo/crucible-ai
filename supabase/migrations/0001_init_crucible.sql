-- Crucible — initial schema
--
-- Five core tables + system_settings + system_events.
-- Idempotency keys on every write. RLS public-read, service-role-write.

create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────────────────
-- agents — the 6 house agents (mirrored from src/lib/agents.ts)
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.agents (
  id text primary key,
  name text not null,
  persona text not null,
  edge text not null,
  model text not null,
  synthetic boolean not null default false,
  hue text not null check (hue in ('teal','amber','rose','indigo','lime','white')),
  daily_budget_usd numeric not null default 1.0,
  active boolean not null default true,
  disabled_until timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.agents is 'House agents that compete in the Crucible. Mirror of src/lib/agents.ts';

-- ───────────────────────────────────────────────────────────────────────────
-- markets — prediction-market questions (Polymarket / Manifold / Kalshi)
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.markets (
  -- composite key:  source + source_id  ensures idempotent UPSERT.
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('polymarket','manifold','kalshi','demo')),
  source_id text not null,
  question text not null,
  description text,
  url text,
  category text,                -- politics / crypto / sports / ai-tech / other
  status text not null check (status in ('open','pending_resolution','resolved','disputed','voided')),
  outcome_yes_price numeric,    -- last-known yes price (0-1)
  resolved_outcome boolean,     -- true=yes, false=no, null=unresolved
  closes_at timestamptz,
  resolved_at timestamptz,
  raw jsonb,                    -- full provider payload, for debugging
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists markets_status_idx on public.markets(status);
create index if not exists markets_resolved_at_idx on public.markets(resolved_at);
create index if not exists markets_category_idx on public.markets(category);

-- ───────────────────────────────────────────────────────────────────────────
-- agent_runs — observability for forecast invocations
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id),
  market_id uuid not null references public.markets(id) on delete cascade,
  -- run window: bucket so we don't refetch within the same 30-min window.
  -- format: ISO timestamp truncated to 30 min  e.g. '2026-05-10T22:30:00Z'
  run_window_start timestamptz not null,
  status text not null check (status in ('pending','running','completed','failed','quota_exceeded','abstained')),
  error text,
  cost_usd numeric default 0,
  duration_ms integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (agent_id, market_id, run_window_start)
);

create index if not exists agent_runs_status_idx on public.agent_runs(status);
create index if not exists agent_runs_agent_id_idx on public.agent_runs(agent_id, completed_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- predictions — what each agent forecasted on each market
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id),
  market_id uuid not null references public.markets(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  -- Forecast probability: 0.0001 .. 0.9999 (clamped server-side)
  probability numeric not null check (probability >= 0.0001 and probability <= 0.9999),
  confidence text check (confidence in ('low','medium','high')),
  reasoning text not null,
  abstained boolean not null default false,
  -- The market's prevailing yes-price at the time of forecast (paper-trade entry)
  market_price_at_forecast numeric,
  -- True for predictions backfilled on already-resolved historical markets
  is_backfill boolean not null default false,
  created_at timestamptz not null default now(),
  unique (agent_id, market_id, created_at)
);

create index if not exists predictions_market_id_idx on public.predictions(market_id);
create index if not exists predictions_agent_id_idx on public.predictions(agent_id, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- evidence_events — append-only timeline of agent reasoning
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.evidence_events (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  ts timestamptz not null default now(),
  kind text not null check (kind in ('pull','cite','reason','conclude','abstain')),
  content text not null,
  url text,
  meta jsonb
);

create index if not exists evidence_events_prediction_idx on public.evidence_events(prediction_id, ts);

-- ───────────────────────────────────────────────────────────────────────────
-- scores — Brier + log-loss + paper P&L per (prediction, resolution)
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions(id) on delete cascade unique,
  agent_id text not null references public.agents(id),
  market_id uuid not null references public.markets(id) on delete cascade,
  brier numeric not null,         -- (predicted - outcome)^2 ∈ [0, 1]
  log_loss numeric not null,      -- -log(p if outcome else 1-p)
  -- Paper P&L using Kelly fraction = 0.25 of $100 bankroll, entered at market_price_at_forecast.
  paper_pnl numeric,
  was_correct boolean not null,   -- true if (probability > 0.5) == outcome
  scored_at timestamptz not null default now(),
  unique (prediction_id)
);

create index if not exists scores_agent_id_idx on public.scores(agent_id, scored_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- agent_stats — materialized rollup, refreshed by scoring job
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.agent_stats (
  agent_id text primary key references public.agents(id),
  total_predictions integer not null default 0,
  total_scored integer not null default 0,
  brier_30d numeric,
  log_loss_30d numeric,
  brier_alltime numeric,
  log_loss_alltime numeric,
  win_rate_30d numeric,
  paper_pnl_30d numeric,
  paper_pnl_alltime numeric,
  -- Crucible Score = composite ranking (see PLAN.md)
  crucible_score numeric,
  rank integer,
  rank_delta_24h integer default 0,
  -- 10-bin calibration: array of {bin_low, bin_high, n, observed_rate, ci_low, ci_high}
  calibration jsonb,
  -- Per-category breakdown
  by_category jsonb,
  updated_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- elo — head-to-head Elo between agents (simple K=24 version)
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.agent_elo (
  agent_id text primary key references public.agents(id),
  rating numeric not null default 1500,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- system_settings — kill switch + global config
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings (key, value)
values
  ('global_pause', 'false'::jsonb),
  ('demo_mode_default', 'true'::jsonb),
  ('forecast_cadence_min', '30'::jsonb),
  ('market_pull_cadence_min', '15'::jsonb)
on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- system_events — observability log
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  level text not null check (level in ('debug','info','warn','error')),
  source text not null,    -- e.g. 'pull-markets', 'forecast-market', 'resolve-markets'
  message text not null,
  meta jsonb
);

create index if not exists system_events_ts_idx on public.system_events(ts desc);
create index if not exists system_events_level_idx on public.system_events(level, ts desc);

-- ───────────────────────────────────────────────────────────────────────────
-- eureka_cards — auto-generated insight cards for the homepage
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.eureka_cards (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  body text not null,
  evidence jsonb,
  generated_at timestamptz not null default now(),
  active boolean not null default true,
  -- Sort order on the homepage. Lower = higher.
  sort_order integer not null default 0
);

create index if not exists eureka_cards_active_idx on public.eureka_cards(active, sort_order);

-- ───────────────────────────────────────────────────────────────────────────
-- Row-level security: public read on read-only tables, service-role-only write
-- ───────────────────────────────────────────────────────────────────────────

alter table public.agents enable row level security;
alter table public.markets enable row level security;
alter table public.predictions enable row level security;
alter table public.evidence_events enable row level security;
alter table public.scores enable row level security;
alter table public.agent_stats enable row level security;
alter table public.agent_elo enable row level security;
alter table public.eureka_cards enable row level security;
alter table public.agent_runs enable row level security;
alter table public.system_settings enable row level security;
alter table public.system_events enable row level security;

-- Public read policies — Crucible is a public dashboard
create policy "public read agents"          on public.agents          for select using (true);
create policy "public read markets"         on public.markets         for select using (true);
create policy "public read predictions"     on public.predictions     for select using (true);
create policy "public read evidence_events" on public.evidence_events for select using (true);
create policy "public read scores"          on public.scores          for select using (true);
create policy "public read agent_stats"     on public.agent_stats     for select using (true);
create policy "public read agent_elo"       on public.agent_elo       for select using (true);
create policy "public read eureka_cards"    on public.eureka_cards    for select using (active);
create policy "public read agent_runs"      on public.agent_runs      for select using (true);
create policy "public read system_settings" on public.system_settings for select using (true);

-- system_events is intentionally NOT publicly readable (could leak internal errors).
-- service role bypasses RLS automatically.
