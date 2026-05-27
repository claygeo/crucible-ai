-- Eivra paper-trading proof snapshots.
--
-- Append-only daily audit records for the paper-only strategy lab. These rows
-- are analytics evidence only: no wallets, orders, leverage, or execution path.

create table if not exists public.paper_trading_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  snapshot_date date not null default current_date,
  source text not null check (source in ('live', 'demo')),
  schema_version text not null default '1',
  strategy_id text not null,
  strategy_label text not null,
  sample text not null check (sample in ('all', 'live_only', 'backfill')),
  is_custom boolean not null default false,
  controls_hash text not null,
  controls jsonb not null,
  strategy_summary jsonb not null,
  proof_gate jsonb not null,
  exposure_ledger jsonb not null,
  daily_series jsonb not null,
  resolved_trades integer not null default 0,
  open_signals integer not null default 0,
  skipped_trades integer not null default 0,
  resolved_net_pnl_usd numeric not null default 0,
  resolved_roi_on_stake numeric not null default 0,
  open_exposure_usd numeric not null default 0,
  open_expected_pnl_usd numeric not null default 0,
  proof_status text not null check (
    proof_status in ('collecting', 'candidate', 'not_qualified', 'control_only')
  )
);

comment on table public.paper_trading_snapshots is
  'Append-only paper-trading strategy proof snapshots captured by the Eivra lab.';

create index if not exists paper_trading_snapshots_captured_idx
  on public.paper_trading_snapshots(captured_at desc);

create index if not exists paper_trading_snapshots_strategy_captured_idx
  on public.paper_trading_snapshots(strategy_id, captured_at desc);

create index if not exists paper_trading_snapshots_date_strategy_idx
  on public.paper_trading_snapshots(snapshot_date desc, strategy_id);

create index if not exists paper_trading_snapshots_proof_status_idx
  on public.paper_trading_snapshots(proof_status, captured_at desc);

alter table public.paper_trading_snapshots enable row level security;

drop policy if exists "public read paper_trading_snapshots"
  on public.paper_trading_snapshots;

create policy "public read paper_trading_snapshots"
  on public.paper_trading_snapshots
  for select
  using (true);

grant select on table public.paper_trading_snapshots to anon, authenticated;
grant select, insert, update, delete on table public.paper_trading_snapshots to service_role;
