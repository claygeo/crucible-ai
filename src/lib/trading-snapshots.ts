import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type {
  StrategyDailyEvidenceSeries,
  StrategyVariantSummary,
  TradingControls,
  TradingSample,
  TradingSnapshot,
  TradingSource,
} from "@/lib/trading";

const SNAPSHOT_TABLE = "paper_trading_snapshots";
const DEFAULT_HISTORY_LIMIT = 96;
const REQUIRED_PROOF_DAYS = 30;

export type PaperTradingSnapshotRow = {
  id: string;
  captured_at: string;
  snapshot_date: string;
  source: TradingSource;
  schema_version: "1";
  strategy_id: string;
  strategy_label: string;
  sample: TradingSample;
  is_custom: boolean;
  controls_hash: string;
  controls: TradingControls;
  strategy_summary: StrategyVariantSummary;
  proof_gate: StrategyVariantSummary["proof_gate"];
  exposure_ledger: StrategyVariantSummary["exposure_ledger"];
  daily_series: StrategyDailyEvidenceSeries;
  resolved_trades: number;
  open_signals: number;
  skipped_trades: number;
  resolved_net_pnl_usd: number;
  resolved_roi_on_stake: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
  proof_status: StrategyVariantSummary["proof_gate"]["status"];
};

type PaperTradingSnapshotInsert = Omit<
  PaperTradingSnapshotRow,
  "id" | "captured_at" | "snapshot_date"
> & {
  snapshot_date: string;
};

export type PaperTradingPersistenceRead = {
  status: "available" | "unconfigured" | "table_missing" | "error";
  message: string;
  latest_captured_at: string | null;
  snapshots: PaperTradingSnapshotRow[];
  strategy_rollups: PaperTradingStrategyProofRollup[];
};

export type PaperTradingPersistenceWrite = {
  status: "written" | "unconfigured" | "error";
  message: string;
  inserted: number;
  snapshot_date: string;
  captured_strategy_ids: string[];
};

export type PaperTradingStrategyProofRollup = {
  strategy_id: string;
  strategy_label: string;
  source: TradingSource;
  sample: TradingSample;
  is_custom: boolean;
  captured_rows: number;
  captured_days: number;
  days_remaining_to_30: number;
  first_snapshot_date: string | null;
  latest_snapshot_date: string | null;
  latest_captured_at: string | null;
  proof_status: StrategyVariantSummary["proof_gate"]["status"];
  proof_status_label: string;
  latest_resolved_trades: number;
  latest_open_signals: number;
  latest_skipped_trades: number;
  latest_resolved_net_pnl_usd: number;
  latest_resolved_roi_on_stake: number;
  latest_open_exposure_usd: number;
  latest_open_expected_pnl_usd: number;
  latest_snapshot: PaperTradingSnapshotRow;
};

function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function getServiceSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function createSupabaseClient(env: { url: string; key: string }) {
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function controlsHash(controls: TradingControls): string {
  return createHash("sha256").update(stableJson(controls)).digest("hex").slice(0, 16);
}

function snapshotDateFromGeneratedAt(generatedAt: string): string {
  const parsed = new Date(generatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function seriesByStrategyId(snapshot: TradingSnapshot) {
  return new Map(
    snapshot.strategy_daily_series.map((series) => [series.strategy_id, series])
  );
}

function buildSnapshotRow(
  snapshot: TradingSnapshot,
  strategy: StrategyVariantSummary,
  dailySeries: StrategyDailyEvidenceSeries,
  controls: TradingControls
): PaperTradingSnapshotInsert {
  return {
    snapshot_date: snapshotDateFromGeneratedAt(snapshot.generated_at),
    source: snapshot.source,
    schema_version: snapshot.schema_version,
    strategy_id: strategy.id,
    strategy_label: strategy.label,
    sample: strategy.sample,
    is_custom: strategy.is_custom,
    controls_hash: controlsHash(controls),
    controls,
    strategy_summary: strategy,
    proof_gate: strategy.proof_gate,
    exposure_ledger: strategy.exposure_ledger,
    daily_series: dailySeries,
    resolved_trades: strategy.resolved_trades,
    open_signals: strategy.open_signals,
    skipped_trades: strategy.exposure_ledger.skipped_trades,
    resolved_net_pnl_usd: strategy.net_pnl_usd,
    resolved_roi_on_stake: strategy.roi_on_stake,
    open_exposure_usd: strategy.open_exposure_usd,
    open_expected_pnl_usd: strategy.open_expected_pnl_usd,
    proof_status: strategy.proof_gate.status,
  };
}

export function buildPaperTradingSnapshotRows(
  snapshot: TradingSnapshot
): PaperTradingSnapshotInsert[] {
  const byStrategyId = seriesByStrategyId(snapshot);
  const rows = snapshot.strategy_variants
    .map((strategy) => {
      const dailySeries = byStrategyId.get(strategy.id);
      if (!dailySeries) return null;
      return buildSnapshotRow(snapshot, strategy, dailySeries, snapshot.controls);
    })
    .filter((row): row is PaperTradingSnapshotInsert => Boolean(row));

  const selectedAlreadyCaptured = rows.some(
    (row) => row.strategy_id === snapshot.selected_strategy.id
  );
  if (!selectedAlreadyCaptured) {
    rows.push(
      buildSnapshotRow(
        snapshot,
        snapshot.selected_strategy,
        snapshot.selected_daily_series,
        snapshot.controls
      )
    );
  }

  return rows;
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.message?.toLowerCase().includes(SNAPSHOT_TABLE) === true
  );
}

function latestRowForDay(rows: PaperTradingSnapshotRow[]): PaperTradingSnapshotRow {
  return rows
    .slice()
    .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at))[0];
}

export function buildPaperTradingStrategyRollups(
  snapshots: PaperTradingSnapshotRow[]
): PaperTradingStrategyProofRollup[] {
  const byStrategy = new Map<string, PaperTradingSnapshotRow[]>();
  for (const snapshot of snapshots) {
    const existing = byStrategy.get(snapshot.strategy_id) ?? [];
    existing.push(snapshot);
    byStrategy.set(snapshot.strategy_id, existing);
  }

  return Array.from(byStrategy.entries())
    .map(([strategyId, rows]) => {
      const byDay = new Map<string, PaperTradingSnapshotRow[]>();
      for (const row of rows) {
        const dayRows = byDay.get(row.snapshot_date) ?? [];
        dayRows.push(row);
        byDay.set(row.snapshot_date, dayRows);
      }

      const latestRowsByDay = Array.from(byDay.values())
        .map(latestRowForDay)
        .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
      const latest = latestRowsByDay
        .slice()
        .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at))[0];
      const firstDate = latestRowsByDay[0]?.snapshot_date ?? null;

      return {
        strategy_id: strategyId,
        strategy_label: latest.strategy_label,
        source: latest.source,
        sample: latest.sample,
        is_custom: latest.is_custom,
        captured_rows: rows.length,
        captured_days: latestRowsByDay.length,
        days_remaining_to_30: Math.max(
          0,
          REQUIRED_PROOF_DAYS - latestRowsByDay.length
        ),
        first_snapshot_date: firstDate,
        latest_snapshot_date: latest.snapshot_date,
        latest_captured_at: latest.captured_at,
        proof_status: latest.proof_status,
        proof_status_label: latest.proof_gate.status_label,
        latest_resolved_trades: latest.resolved_trades,
        latest_open_signals: latest.open_signals,
        latest_skipped_trades: latest.skipped_trades,
        latest_resolved_net_pnl_usd: latest.resolved_net_pnl_usd,
        latest_resolved_roi_on_stake: latest.resolved_roi_on_stake,
        latest_open_exposure_usd: latest.open_exposure_usd,
        latest_open_expected_pnl_usd: latest.open_expected_pnl_usd,
        latest_snapshot: latest,
      };
    })
    .sort((a, b) => {
      if (b.captured_days !== a.captured_days) {
        return b.captured_days - a.captured_days;
      }
      return b.latest_resolved_net_pnl_usd - a.latest_resolved_net_pnl_usd;
    });
}

export async function loadPaperTradingSnapshotHistory(
  limit = DEFAULT_HISTORY_LIMIT
): Promise<PaperTradingPersistenceRead> {
  const env = getSupabaseEnv();
  if (!env) {
    return {
      status: "unconfigured",
      message: "Supabase env is not configured for persisted paper-trading snapshots.",
      latest_captured_at: null,
      snapshots: [],
      strategy_rollups: [],
    };
  }

  const sb = createSupabaseClient(env);
  const { data, error } = await sb
    .from(SNAPSHOT_TABLE)
    .select("*")
    .order("captured_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));

  if (error) {
    return {
      status: isMissingTableError(error) ? "table_missing" : "error",
      message: error.message,
      latest_captured_at: null,
      snapshots: [],
      strategy_rollups: [],
    };
  }

  const snapshots = (data ?? []) as unknown as PaperTradingSnapshotRow[];
  return {
    status: "available",
    message: "Persisted paper-trading snapshots loaded.",
    latest_captured_at: snapshots[0]?.captured_at ?? null,
    snapshots,
    strategy_rollups: buildPaperTradingStrategyRollups(snapshots),
  };
}

export async function persistPaperTradingSnapshot(
  snapshot: TradingSnapshot
): Promise<PaperTradingPersistenceWrite> {
  const env = getServiceSupabaseEnv();
  const rows = buildPaperTradingSnapshotRows(snapshot);
  const snapshotDate = snapshotDateFromGeneratedAt(snapshot.generated_at);

  if (!env) {
    return {
      status: "unconfigured",
      message:
        "SUPABASE_SERVICE_ROLE_KEY is required to persist paper-trading snapshots.",
      inserted: 0,
      snapshot_date: snapshotDate,
      captured_strategy_ids: [],
    };
  }

  const sb = createSupabaseClient(env);
  const { data, error } = await sb.from(SNAPSHOT_TABLE).insert(rows).select("strategy_id");

  if (error) {
    return {
      status: "error",
      message: error.message,
      inserted: 0,
      snapshot_date: snapshotDate,
      captured_strategy_ids: [],
    };
  }

  const capturedStrategyIds = ((data ?? []) as Array<{ strategy_id: string }>).map(
    (row) => row.strategy_id
  );

  return {
    status: "written",
    message: "Persisted paper-trading snapshot rows.",
    inserted: capturedStrategyIds.length,
    snapshot_date: snapshotDate,
    captured_strategy_ids: capturedStrategyIds,
  };
}
