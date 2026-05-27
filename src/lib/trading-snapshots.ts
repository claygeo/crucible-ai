import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agents";
import { AGENT_EDGE_GATES, PAPER_TRADING_PROOF_RULES } from "@/lib/trading";
import type {
  ResolutionWatchSignal,
  StrategyDailyEvidenceSeries,
  StrategyVariantSummary,
  TradingControls,
  TradingResolutionWatch,
  TradingSample,
  TradingSnapshot,
  TradingSource,
} from "@/lib/trading";

const SNAPSHOT_TABLE = "paper_trading_snapshots";
const DEFAULT_HISTORY_LIMIT = 1000;
const REQUIRED_PROOF_DAYS = PAPER_TRADING_PROOF_RULES.requiredLiveDays;
const SNAPSHOT_CRON_UTC_HOUR = 5;
const SNAPSHOT_CRON_UTC_MINUTE = 22;
const STALE_AFTER_HOURS = 36;
const SNAPSHOT_SCHEDULED_TIME_UTC = "05:22";

export const PAPER_TRADING_ARTIFACT_CONTRACT = {
  repository: "claygeo/eivra",
  workflow_name: "Paper trading snapshot",
  workflow_path: ".github/workflows/paper-trading-snapshot.yml",
  schedule_cron_utc: `${SNAPSHOT_CRON_UTC_MINUTE} ${SNAPSHOT_CRON_UTC_HOUR} * * *`,
  scheduled_time_utc: SNAPSHOT_SCHEDULED_TIME_UTC,
  retention_days: 30,
  artifact_name_pattern: "paper-trading-proof-<run_id>",
  expected_files: [
    "paper-snapshot-workflow.json",
    "paper-snapshot-result.json",
    "paper-snapshot-rows.json",
    "paper-audit-result.json",
    "paper-artifact-audit-result.json",
  ],
  download_command:
    "gh run download <run_id> --repo claygeo/eivra --dir ./paper-artifacts",
  audit_command: "npm run paper:artifact-audit -- ./paper-artifacts --json",
  proof_report_file: "paper-artifact-audit-result.json",
} as const;

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
  capture_health: PaperTradingCaptureHealth;
  capture_calendar: PaperTradingCaptureCalendar;
  proof_summary: PaperTradingProofSummary;
  proof_readiness: PaperTradingProofReadiness;
  proof_runway: PaperTradingProofRunway;
  agent_edge_proof_matrix: PaperTradingAgentEdgeProofRow[];
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

export type PaperTradingCaptureHealth = {
  status: "fresh" | "waiting_first_capture" | "stale" | "unavailable";
  status_label: string;
  message: string;
  cron: string;
  scheduled_time_utc: string;
  stale_after_hours: number;
  latest_captured_at: string | null;
  latest_capture_age_hours: number | null;
  previous_expected_capture_at: string;
  next_expected_capture_at: string;
};

export type DurableProofStatus =
  | "collecting"
  | "candidate"
  | "not_qualified"
  | "control_only"
  | "stale";

export type DurableProofGate = {
  status: DurableProofStatus;
  status_label: string;
  captured_days: number;
  required_captured_days: number;
  missing_capture_days: number;
  resolved_trades: number;
  required_resolved_trades: number;
  resolved_net_pnl_usd: number;
  min_resolved_net_pnl_usd: number;
  resolved_roi_on_stake: number;
  min_roi_on_stake: number;
  max_drawdown_usd: number;
  max_allowed_drawdown_usd: number;
  capture_health_status: PaperTradingCaptureHealth["status"];
  blockers: string[];
};

export type PaperTradingProofWindow = {
  start_snapshot_date: string | null;
  end_snapshot_date: string | null;
  baseline_snapshot_date: string | null;
  resolved_trades: number;
  resolved_stake_usd: number;
  resolved_net_pnl_usd: number;
  resolved_roi_on_stake: number;
  max_drawdown_usd: number;
  latest_open_exposure_usd: number;
  latest_open_expected_pnl_usd: number;
};

export type PaperTradingProofQualityGrade =
  | "none"
  | "thin"
  | "developing"
  | "reviewable";

export type PaperTradingProofQuality = {
  evidence_grade: PaperTradingProofQualityGrade;
  evidence_grade_label: string;
  resolved_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  avg_pnl_per_trade_usd: number;
  avg_stake_usd: number;
  winning_days: number;
  losing_days: number;
  flat_days: number;
  avg_daily_pnl_usd: number;
  daily_profit_factor: number | null;
  blockers: string[];
};

export type PaperTradingCaptureCoverage = {
  status: "complete" | "missing";
  status_label: string;
  expected_days: number;
  captured_days: number;
  missing_days: number;
  coverage_ratio: number;
  current_streak_days: number;
  first_expected_snapshot_date: string | null;
  last_expected_snapshot_date: string | null;
  captured_snapshot_dates: string[];
  missing_snapshot_dates: string[];
};

export type PaperTradingCaptureCalendarDay = {
  snapshot_date: string;
  status: "complete" | "partial" | "missing";
  status_label: string;
  captured_rows: number;
  live_strategy_rows: number;
  live_strategy_count: number;
  control_rows: number;
  control_strategy_count: number;
  custom_rows: number;
  expected_live_strategy_rows: number;
  expected_live_strategy_count: number;
  strategy_ids: string[];
  live_strategy_ids: string[];
  latest_captured_at: string | null;
};

export type PaperTradingCaptureCalendar = {
  status: "complete" | "partial" | "missing" | "unavailable";
  status_label: string;
  expected_days: number;
  complete_days: number;
  partial_days: number;
  missing_days: number;
  coverage_ratio: number;
  current_streak_days: number;
  expected_live_strategy_rows: number;
  expected_live_strategy_count: number;
  first_expected_snapshot_date: string | null;
  last_expected_snapshot_date: string | null;
  days_remaining_to_30: number;
  days: PaperTradingCaptureCalendarDay[];
};

export type PaperTradingStrategyRegistrySync = {
  status: "synced" | "pending_capture" | "unavailable";
  status_label: string;
  message: string;
  latest_snapshot_date: string | null;
  latest_captured_at: string | null;
  current_live_strategy_count: number;
  persisted_latest_live_strategy_count: number;
  missing_live_strategy_count: number;
  extra_persisted_live_strategy_count: number;
  missing_live_strategy_ids: string[];
  missing_live_strategy_labels: string[];
  extra_persisted_strategy_ids: string[];
};

export type PaperTradingAgentEdgeProofRow = {
  strategy_id: string;
  strategy_label: string;
  agent_id: string;
  agent_name: string;
  min_edge: number;
  proof_status: DurableProofStatus;
  proof_status_label: string;
  captured_days: number;
  required_captured_days: number;
  missing_capture_days: number;
  resolved_trades: number;
  required_resolved_trades: number;
  win_rate: number;
  avg_pnl_per_trade_usd: number;
  daily_profit_factor: number | null;
  evidence_grade: PaperTradingProofQualityGrade;
  evidence_grade_label: string;
  window_pnl_usd: number;
  window_roi_on_stake: number;
  max_drawdown_usd: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
  latest_snapshot_date: string | null;
  latest_captured_at: string | null;
  proof_quality: PaperTradingProofQuality;
  blockers: string[];
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
  proof_window: PaperTradingProofWindow;
  proof_quality: PaperTradingProofQuality;
  capture_coverage: PaperTradingCaptureCoverage;
  durable_proof_gate: DurableProofGate;
  latest_snapshot: PaperTradingSnapshotRow;
};

export type PaperTradingProofSummary = {
  status: DurableProofStatus | "unavailable";
  status_label: string;
  capital_review_status: "blocked" | "reviewable" | "unavailable";
  capital_review_status_label: string;
  real_money_execution_allowed: false;
  paper_only: true;
  capital_review_blockers: string[];
  live_strategy_count: number;
  candidate_count: number;
  collecting_count: number;
  not_qualified_count: number;
  stale_count: number;
  control_count: number;
  best_live_strategy_id: string | null;
  best_live_strategy_label: string | null;
  best_live_status: DurableProofStatus | null;
  best_live_window_pnl_usd: number;
  best_live_window_roi_on_stake: number;
  best_live_resolved_trades: number;
  best_live_captured_days: number;
  best_live_missing_capture_days: number;
  best_live_blockers: string[];
};

export type PaperTradingProofReadinessStatus =
  | "pass"
  | "collecting"
  | "blocked"
  | "unavailable";

export type PaperTradingProofReadinessEvidence = {
  kind: "resolution_signal";
  prediction_id: string;
  market_id: string;
  market_question: string;
  agent_id: string;
  agent_name: string;
  side: ResolutionWatchSignal["side"];
  stake_usd: number;
  expected_pnl_usd: number;
  market_closes_at: string | null;
  created_at: string;
  close_status: ResolutionWatchSignal["close_status"];
  days_until_close: number | null;
  age_days: number;
};

export type PaperTradingProofReadinessItem = {
  id: string;
  label: string;
  status: PaperTradingProofReadinessStatus;
  status_label: string;
  current: string;
  target: string;
  detail: string;
  evidence: PaperTradingProofReadinessEvidence[];
};

export type PaperTradingProofReadiness = {
  status: PaperTradingProofReadinessStatus;
  status_label: string;
  ready_for_capital_review: boolean;
  real_money_execution_allowed: false;
  paper_only: true;
  next_required_action: string;
  passed_item_count: number;
  collecting_item_count: number;
  blocked_item_count: number;
  unavailable_item_count: number;
  blocked_item_ids: string[];
  items: PaperTradingProofReadinessItem[];
};

export type PaperTradingProofRunwayStatus =
  | "reviewable"
  | "collecting"
  | "blocked"
  | "unavailable";

export type PaperTradingProofRunwayMilestone = {
  id: string;
  label: string;
  status: PaperTradingProofRunwayStatus;
  status_label: string;
  current: string;
  target: string;
  eta_at: string | null;
  detail: string;
};

export type PaperTradingProofRunway = {
  status: PaperTradingProofRunwayStatus;
  status_label: string;
  paper_only: true;
  real_money_execution_allowed: false;
  earliest_capital_review_at: string | null;
  earliest_capital_review_date: string | null;
  days_until_earliest_review: number | null;
  capture_days_remaining: number;
  resolved_trades_remaining: number;
  open_live_signals: number | null;
  overdue_live_signals: number | null;
  review_required_live_signals: number | null;
  closing_next_7d_signals: number | null;
  unknown_close_live_signals: number | null;
  pending_resolution_capacity: number | null;
  blocker_summary: string;
  milestones: PaperTradingProofRunwayMilestone[];
};

export type PaperTradingProofEvidenceSourceStatus =
  | "active"
  | "available"
  | "collecting"
  | "blocked"
  | "reviewable"
  | "unavailable";

export type PaperTradingProofEvidenceSource = {
  id:
    | "supabase_persistence"
    | "github_artifacts"
    | "resolution_hygiene"
    | "capital_review";
  label: string;
  status: PaperTradingProofEvidenceSourceStatus;
  status_label: string;
  current: string;
  target: string;
  detail: string;
  evidence: string[];
};

export type PaperTradingProofEvidenceSources = {
  status: PaperTradingProofEvidenceSourceStatus;
  status_label: string;
  paper_only: true;
  real_money_execution_allowed: false;
  artifact_contract: typeof PAPER_TRADING_ARTIFACT_CONTRACT;
  sources: PaperTradingProofEvidenceSource[];
  supabase_persistence: PaperTradingProofEvidenceSource;
  github_artifacts: PaperTradingProofEvidenceSource;
  resolution_hygiene: PaperTradingProofEvidenceSource;
  capital_review: PaperTradingProofEvidenceSource;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getSupabaseEnv(): { url: string; key: string } | null {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    readEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return { url, key };
}

function getServiceSupabaseEnv(): { url: string; key: string } | null {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
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

function strategyRuleFingerprint(
  strategy: Partial<StrategyVariantSummary> | null | undefined
): string {
  const agentIds = Array.isArray(strategy?.agent_ids)
    ? [...strategy.agent_ids].sort()
    : [];
  const exposureLedger =
    strategy?.exposure_ledger as
      | Partial<StrategyVariantSummary["exposure_ledger"]>
      | null
      | undefined;

  return stableJson({
    sample: strategy?.sample ?? null,
    min_edge: strategy?.min_edge ?? null,
    stake_mode: strategy?.stake_mode ?? null,
    flat_stake_usd: strategy?.flat_stake_usd ?? null,
    max_stake_usd: strategy?.max_stake_usd ?? null,
    max_open_exposure_usd: exposureLedger?.max_open_exposure_usd ?? null,
    agent_ids: agentIds,
    category: strategy?.category ?? null,
    side: strategy?.side ?? null,
  });
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

  const selectedRow = buildSnapshotRow(
    snapshot,
    snapshot.selected_strategy,
    snapshot.selected_daily_series,
    snapshot.controls
  );
  const selectedFingerprint = strategyRuleFingerprint(
    selectedRow.strategy_summary
  );
  const selectedAlreadyCaptured = rows.some(
    (row) =>
      row.strategy_id === selectedRow.strategy_id ||
      strategyRuleFingerprint(row.strategy_summary) === selectedFingerprint
  );
  if (!selectedAlreadyCaptured) {
    rows.push(selectedRow);
  }

  return rows;
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.message?.toLowerCase().includes(SNAPSHOT_TABLE) === true
  );
}

function scheduledCaptureAt(reference: Date, offsetDays: number): Date {
  const scheduled = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate() + offsetDays,
      SNAPSHOT_CRON_UTC_HOUR,
      SNAPSHOT_CRON_UTC_MINUTE,
      0,
      0
    )
  );
  return scheduled;
}

function previousExpectedCaptureAt(now = new Date()): Date {
  const today = scheduledCaptureAt(now, 0);
  if (now.getTime() >= today.getTime()) return today;
  return scheduledCaptureAt(now, -1);
}

function nextExpectedCaptureAt(now = new Date()): Date {
  const today = scheduledCaptureAt(now, 0);
  if (now.getTime() < today.getTime()) return today;
  return scheduledCaptureAt(now, 1);
}

function unavailableCaptureHealth(
  statusLabel: string,
  message: string
): PaperTradingCaptureHealth {
  const now = new Date();
  return {
    status: "unavailable",
    status_label: statusLabel,
    message,
    cron: `${SNAPSHOT_CRON_UTC_MINUTE} ${SNAPSHOT_CRON_UTC_HOUR} * * *`,
    scheduled_time_utc: SNAPSHOT_SCHEDULED_TIME_UTC,
    stale_after_hours: STALE_AFTER_HOURS,
    latest_captured_at: null,
    latest_capture_age_hours: null,
    previous_expected_capture_at: previousExpectedCaptureAt(now).toISOString(),
    next_expected_capture_at: nextExpectedCaptureAt(now).toISOString(),
  };
}

export function buildPaperTradingCaptureHealth(
  latestCapturedAt: string | null,
  now = new Date()
): PaperTradingCaptureHealth {
  const previousExpected = previousExpectedCaptureAt(now);
  const nextExpected = nextExpectedCaptureAt(now);
  const base = {
    cron: `${SNAPSHOT_CRON_UTC_MINUTE} ${SNAPSHOT_CRON_UTC_HOUR} * * *`,
    scheduled_time_utc: SNAPSHOT_SCHEDULED_TIME_UTC,
    stale_after_hours: STALE_AFTER_HOURS,
    latest_captured_at: latestCapturedAt,
    previous_expected_capture_at: previousExpected.toISOString(),
    next_expected_capture_at: nextExpected.toISOString(),
  };

  if (!latestCapturedAt) {
    return {
      ...base,
      status: "waiting_first_capture",
      status_label: "Waiting",
      message: "No persisted paper-trading snapshots have been captured yet.",
      latest_capture_age_hours: null,
    };
  }

  const latestTs = Date.parse(latestCapturedAt);
  if (!Number.isFinite(latestTs)) {
    return {
      ...base,
      status: "stale",
      status_label: "Stale",
      message: "Latest persisted capture timestamp is not parseable.",
      latest_capture_age_hours: null,
    };
  }

  const ageHours = Math.max(0, (now.getTime() - latestTs) / (60 * 60 * 1000));
  const roundedAgeHours = Math.round(ageHours * 10) / 10;
  const isFresh = ageHours <= STALE_AFTER_HOURS;

  return {
    ...base,
    status: isFresh ? "fresh" : "stale",
    status_label: isFresh ? "Fresh" : "Stale",
    message: isFresh
      ? "Latest persisted capture is within the daily freshness window."
      : "Latest persisted capture is older than the daily freshness window.",
    latest_capture_age_hours: roundedAgeHours,
  };
}

function latestRowForDay(rows: PaperTradingSnapshotRow[]): PaperTradingSnapshotRow {
  return rows
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.captured_at) - Date.parse(a.captured_at) ||
        Number(a.is_custom) - Number(b.is_custom)
    )[0];
}

function latestCapturedAt(snapshots: PaperTradingSnapshotRow[]): string | null {
  const latest = snapshots
    .slice()
    .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at))[0];
  return latest?.captured_at ?? null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function snapshotDateToUtcDate(snapshotDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) return null;
  const date = new Date(`${snapshotDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
      0,
      0,
      0,
      0
    )
  );
}

function utcSnapshotDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function snapshotDateRange(startDate: string, endDate: string): string[] {
  const start = snapshotDateToUtcDate(startDate);
  const end = snapshotDateToUtcDate(endDate);
  if (!start || !end || start.getTime() > end.getTime()) return [];

  const dates: string[] = [];
  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    dates.push(utcSnapshotDate(cursor));
  }
  return dates;
}

function buildCaptureCoverage(
  latestRowsByDay: PaperTradingSnapshotRow[],
  captureHealth: PaperTradingCaptureHealth
): PaperTradingCaptureCoverage {
  const allCapturedDates = latestRowsByDay
    .map((row) => row.snapshot_date)
    .filter((date) => snapshotDateToUtcDate(date))
    .sort((a, b) => a.localeCompare(b));
  const capturedSet = new Set(allCapturedDates);
  const firstCapturedDate = allCapturedDates[0] ?? null;
  const previousExpectedDate = captureHealth.previous_expected_capture_at.slice(0, 10);
  const previousExpectedUtc = snapshotDateToUtcDate(previousExpectedDate);
  const windowStartDate = previousExpectedUtc
    ? utcSnapshotDate(addUtcDays(previousExpectedUtc, -(REQUIRED_PROOF_DAYS - 1)))
    : null;
  const firstExpectedDate =
    firstCapturedDate && windowStartDate
      ? firstCapturedDate > windowStartDate
        ? firstCapturedDate
        : windowStartDate
      : firstCapturedDate;
  const lastExpectedDate =
    firstExpectedDate && firstExpectedDate <= previousExpectedDate
      ? previousExpectedDate
      : firstExpectedDate;
  const expectedDates =
    firstExpectedDate && lastExpectedDate
      ? snapshotDateRange(firstExpectedDate, lastExpectedDate)
      : [];
  const capturedDates = expectedDates.filter((date) => capturedSet.has(date));
  const missingDates = expectedDates.filter((date) => !capturedSet.has(date));

  let currentStreakDays = 0;
  for (let i = expectedDates.length - 1; i >= 0; i -= 1) {
    if (!capturedSet.has(expectedDates[i])) break;
    currentStreakDays += 1;
  }

  return {
    status: missingDates.length > 0 ? "missing" : "complete",
    status_label: missingDates.length > 0 ? "Missing captures" : "Complete",
    expected_days: expectedDates.length,
    captured_days: capturedDates.length,
    missing_days: missingDates.length,
    coverage_ratio:
      expectedDates.length > 0
        ? round2(capturedDates.length / expectedDates.length)
        : 0,
    current_streak_days: currentStreakDays,
    first_expected_snapshot_date: firstExpectedDate,
    last_expected_snapshot_date: lastExpectedDate,
    captured_snapshot_dates: capturedDates,
    missing_snapshot_dates: missingDates,
  };
}

function emptyCaptureCalendar(
  statusLabel: string
): PaperTradingCaptureCalendar {
  return {
    status: "unavailable",
    status_label: statusLabel,
    expected_days: 0,
    complete_days: 0,
    partial_days: 0,
    missing_days: 0,
    coverage_ratio: 0,
    current_streak_days: 0,
    expected_live_strategy_rows: 0,
    expected_live_strategy_count: 0,
    first_expected_snapshot_date: null,
    last_expected_snapshot_date: null,
    days_remaining_to_30: REQUIRED_PROOF_DAYS,
    days: [],
  };
}

function latestCapturedAtForRows(
  rows: PaperTradingSnapshotRow[]
): string | null {
  return latestRowForDay(rows)?.captured_at ?? null;
}

function uniqueStrategyRuleCount(rows: PaperTradingSnapshotRow[]): number {
  return new Set(
    rows.map((row) => strategyRuleFingerprint(row.strategy_summary))
  ).size;
}

export function buildPaperTradingCaptureCalendar(
  snapshots: PaperTradingSnapshotRow[],
  captureHealth: PaperTradingCaptureHealth
): PaperTradingCaptureCalendar {
  const byDate = new Map<string, PaperTradingSnapshotRow[]>();
  for (const snapshot of snapshots) {
    if (!snapshotDateToUtcDate(snapshot.snapshot_date)) continue;
    const rows = byDate.get(snapshot.snapshot_date) ?? [];
    rows.push(snapshot);
    byDate.set(snapshot.snapshot_date, rows);
  }

  const capturedDates = Array.from(byDate.keys()).sort((a, b) =>
    a.localeCompare(b)
  );
  const firstCapturedDate = capturedDates[0] ?? null;
  const previousExpectedDate = captureHealth.previous_expected_capture_at.slice(0, 10);
  const previousExpectedUtc = snapshotDateToUtcDate(previousExpectedDate);
  const windowStartDate = previousExpectedUtc
    ? utcSnapshotDate(addUtcDays(previousExpectedUtc, -(REQUIRED_PROOF_DAYS - 1)))
    : null;
  const firstExpectedDate =
    firstCapturedDate && windowStartDate
      ? firstCapturedDate > windowStartDate
        ? firstCapturedDate
        : windowStartDate
      : firstCapturedDate;
  const lastExpectedDate =
    firstExpectedDate && firstExpectedDate <= previousExpectedDate
      ? previousExpectedDate
      : firstExpectedDate;
  const expectedDates =
    firstExpectedDate && lastExpectedDate
      ? snapshotDateRange(firstExpectedDate, lastExpectedDate)
      : [];

  if (expectedDates.length === 0) {
    return emptyCaptureCalendar("No captures");
  }

  const expectedLiveStrategyCount = Math.max(
    0,
    ...expectedDates.map((date) =>
      uniqueStrategyRuleCount(
        (byDate.get(date) ?? []).filter((row) => row.sample === "live_only")
      )
    )
  );

  const days = expectedDates.map((date): PaperTradingCaptureCalendarDay => {
    const rows = byDate.get(date) ?? [];
    const liveRows = rows.filter((row) => row.sample === "live_only");
    const controlRows = rows.filter((row) => row.sample !== "live_only");
    const capturedRows = rows.length;
    const liveStrategyCount = uniqueStrategyRuleCount(liveRows);
    const controlStrategyCount = uniqueStrategyRuleCount(controlRows);
    const status: PaperTradingCaptureCalendarDay["status"] =
      capturedRows === 0
        ? "missing"
        : expectedLiveStrategyCount === 0 ||
            liveStrategyCount < expectedLiveStrategyCount
          ? "partial"
          : "complete";

    return {
      snapshot_date: date,
      status,
      status_label:
        status === "complete"
          ? "Complete"
          : status === "partial"
            ? "Partial"
            : "Missing",
      captured_rows: capturedRows,
      live_strategy_rows: liveStrategyCount,
      live_strategy_count: liveStrategyCount,
      control_rows: controlRows.length,
      control_strategy_count: controlStrategyCount,
      custom_rows: rows.filter((row) => row.is_custom).length,
      expected_live_strategy_rows: expectedLiveStrategyCount,
      expected_live_strategy_count: expectedLiveStrategyCount,
      strategy_ids: Array.from(new Set(rows.map((row) => row.strategy_id))).sort(),
      live_strategy_ids: Array.from(
        new Set(liveRows.map((row) => row.strategy_id))
      ).sort(),
      latest_captured_at: capturedRows > 0 ? latestCapturedAtForRows(rows) : null,
    };
  });

  const completeDays = days.filter((day) => day.status === "complete").length;
  const partialDays = days.filter((day) => day.status === "partial").length;
  const missingDays = days.filter((day) => day.status === "missing").length;
  let currentStreakDays = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i].status !== "complete") break;
    currentStreakDays += 1;
  }

  const status: PaperTradingCaptureCalendar["status"] =
    missingDays > 0
      ? "missing"
      : partialDays > 0
        ? "partial"
        : "complete";

  return {
    status,
    status_label:
      status === "complete"
        ? "Complete"
        : status === "partial"
          ? "Partial"
          : "Missing",
    expected_days: expectedDates.length,
    complete_days: completeDays,
    partial_days: partialDays,
    missing_days: missingDays,
    coverage_ratio:
      expectedDates.length > 0 ? round2(completeDays / expectedDates.length) : 0,
    current_streak_days: currentStreakDays,
    expected_live_strategy_rows: expectedLiveStrategyCount,
    expected_live_strategy_count: expectedLiveStrategyCount,
    first_expected_snapshot_date: expectedDates[0] ?? null,
    last_expected_snapshot_date: expectedDates[expectedDates.length - 1] ?? null,
    days_remaining_to_30: Math.max(0, REQUIRED_PROOF_DAYS - completeDays),
    days,
  };
}

function latestSnapshotDate(snapshots: PaperTradingSnapshotRow[]): string | null {
  return snapshots
    .map((snapshot) => snapshot.snapshot_date)
    .filter((date) => snapshotDateToUtcDate(date))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

export function buildPaperTradingStrategyRegistrySync(
  currentStrategies: StrategyVariantSummary[],
  persistedSnapshots: PaperTradingSnapshotRow[]
): PaperTradingStrategyRegistrySync {
  const currentLiveStrategies = currentStrategies.filter(
    (strategy) => strategy.sample === "live_only" && !strategy.is_custom
  );
  const latestDate = latestSnapshotDate(persistedSnapshots);

  if (currentLiveStrategies.length === 0) {
    return {
      status: "unavailable",
      status_label: "Unavailable",
      message: "No current live strategy registry is available.",
      latest_snapshot_date: latestDate,
      latest_captured_at: null,
      current_live_strategy_count: 0,
      persisted_latest_live_strategy_count: 0,
      missing_live_strategy_count: 0,
      extra_persisted_live_strategy_count: 0,
      missing_live_strategy_ids: [],
      missing_live_strategy_labels: [],
      extra_persisted_strategy_ids: [],
    };
  }

  if (!latestDate) {
    return {
      status: "pending_capture",
      status_label: "Pending capture",
      message: "No persisted proof day has captured the current strategy registry yet.",
      latest_snapshot_date: null,
      latest_captured_at: null,
      current_live_strategy_count: currentLiveStrategies.length,
      persisted_latest_live_strategy_count: 0,
      missing_live_strategy_count: currentLiveStrategies.length,
      extra_persisted_live_strategy_count: 0,
      missing_live_strategy_ids: currentLiveStrategies.map((strategy) => strategy.id),
      missing_live_strategy_labels: currentLiveStrategies.map(
        (strategy) => strategy.label
      ),
      extra_persisted_strategy_ids: [],
    };
  }

  const latestRows = persistedSnapshots.filter(
    (snapshot) => snapshot.snapshot_date === latestDate
  );
  const latestLiveRows = latestRows.filter(
    (snapshot) => snapshot.sample === "live_only"
  );
  const currentByFingerprint = new Map(
    currentLiveStrategies.map((strategy) => [
      strategyRuleFingerprint(strategy),
      strategy,
    ])
  );
  const persistedByFingerprint = new Map<string, PaperTradingSnapshotRow>();
  for (const row of latestLiveRows) {
    const fingerprint = strategyRuleFingerprint(row.strategy_summary);
    const existing = persistedByFingerprint.get(fingerprint);
    if (!existing || Date.parse(row.captured_at) > Date.parse(existing.captured_at)) {
      persistedByFingerprint.set(fingerprint, row);
    }
  }

  const missingStrategies = Array.from(currentByFingerprint.entries())
    .filter(([fingerprint]) => !persistedByFingerprint.has(fingerprint))
    .map(([, strategy]) => strategy);
  const extraPersistedRows = Array.from(persistedByFingerprint.entries())
    .filter(([fingerprint]) => !currentByFingerprint.has(fingerprint))
    .map(([, row]) => row);
  const status: PaperTradingStrategyRegistrySync["status"] =
    missingStrategies.length === 0 && extraPersistedRows.length === 0
      ? "synced"
      : "pending_capture";
  const latestCapturedAt = latestCapturedAtForRows(latestRows);
  const pendingMessage =
    missingStrategies.length > 0
      ? `${missingStrategies.length} current live strategies are waiting for the next persisted proof capture.`
      : `${extraPersistedRows.length} persisted live strategies are no longer in the current registry.`;

  return {
    status,
    status_label: status === "synced" ? "Synced" : "Pending capture",
    message:
      status === "synced"
        ? "Latest persisted proof day matches the current live strategy registry."
        : pendingMessage,
    latest_snapshot_date: latestDate,
    latest_captured_at: latestCapturedAt,
    current_live_strategy_count: currentLiveStrategies.length,
    persisted_latest_live_strategy_count: persistedByFingerprint.size,
    missing_live_strategy_count: missingStrategies.length,
    extra_persisted_live_strategy_count: extraPersistedRows.length,
    missing_live_strategy_ids: missingStrategies.map((strategy) => strategy.id),
    missing_live_strategy_labels: missingStrategies.map(
      (strategy) => strategy.label
    ),
    extra_persisted_strategy_ids: extraPersistedRows.map((row) => row.strategy_id),
  };
}

function strategySummaryValue(
  row: PaperTradingSnapshotRow | null,
  key: keyof StrategyVariantSummary
): number {
  if (!row) return 0;
  const summary = row.strategy_summary as Partial<StrategyVariantSummary> | null | undefined;
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rowResolvedTrades(row: PaperTradingSnapshotRow | null): number {
  if (!row) return 0;
  return Number.isFinite(row.resolved_trades) ? row.resolved_trades : 0;
}

function rowResolvedPnl(row: PaperTradingSnapshotRow | null): number {
  if (!row) return 0;
  return Number.isFinite(row.resolved_net_pnl_usd)
    ? row.resolved_net_pnl_usd
    : strategySummaryValue(row, "net_pnl_usd");
}

function rowResolvedStake(row: PaperTradingSnapshotRow | null): number {
  return strategySummaryValue(row, "stake_usd");
}

function rowStrategyCount(
  row: PaperTradingSnapshotRow | null,
  key: "wins" | "losses"
): number {
  return Math.max(0, Math.round(strategySummaryValue(row, key)));
}

function rowOpenExposure(row: PaperTradingSnapshotRow | null): number {
  if (!row) return 0;
  return Number.isFinite(row.open_exposure_usd)
    ? row.open_exposure_usd
    : strategySummaryValue(row, "open_exposure_usd");
}

function rowOpenExpectedPnl(row: PaperTradingSnapshotRow | null): number {
  if (!row) return 0;
  return Number.isFinite(row.open_expected_pnl_usd)
    ? row.open_expected_pnl_usd
    : strategySummaryValue(row, "open_expected_pnl_usd");
}

type PaperTradingProofWindowContext = {
  windowStart: string | null;
  windowEnd: string | null;
  rowsInWindow: PaperTradingSnapshotRow[];
  baseline: PaperTradingSnapshotRow | null;
  latest: PaperTradingSnapshotRow | null;
};

function buildProofWindowContext(
  latestRowsByDay: PaperTradingSnapshotRow[],
  captureCoverage: PaperTradingCaptureCoverage
): PaperTradingProofWindowContext {
  const windowStart = captureCoverage.first_expected_snapshot_date;
  const windowEnd = captureCoverage.last_expected_snapshot_date;
  const latestRows = latestRowsByDay
    .slice()
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const baseline =
    windowStart === null
      ? null
      : latestRows
          .slice()
          .reverse()
          .find((row) => row.snapshot_date < windowStart) ?? null;
  const rowsInWindow = latestRows.filter((row) => {
    if (!windowStart || !windowEnd) return false;
    return row.snapshot_date >= windowStart && row.snapshot_date <= windowEnd;
  });
  const latest = rowsInWindow[rowsInWindow.length - 1] ?? latestRows[latestRows.length - 1] ?? null;

  return {
    windowStart,
    windowEnd,
    rowsInWindow,
    baseline,
    latest,
  };
}

function buildProofWindow(
  context: PaperTradingProofWindowContext
): PaperTradingProofWindow {
  const { windowStart, windowEnd, rowsInWindow, baseline, latest } = context;
  const baselineTrades = rowResolvedTrades(baseline);
  const baselinePnl = rowResolvedPnl(baseline);
  const baselineStake = rowResolvedStake(baseline);
  const resolvedTrades = Math.max(0, rowResolvedTrades(latest) - baselineTrades);
  const resolvedStakeUsd = Math.max(0, rowResolvedStake(latest) - baselineStake);
  const resolvedNetPnlUsd = rowResolvedPnl(latest) - baselinePnl;

  let peakPnl = 0;
  let maxDrawdownUsd = 0;
  for (const row of rowsInWindow) {
    const windowPnl = rowResolvedPnl(row) - baselinePnl;
    peakPnl = Math.max(peakPnl, windowPnl);
    maxDrawdownUsd = Math.max(maxDrawdownUsd, peakPnl - windowPnl);
  }

  return {
    start_snapshot_date: windowStart,
    end_snapshot_date: windowEnd,
    baseline_snapshot_date: baseline?.snapshot_date ?? null,
    resolved_trades: resolvedTrades,
    resolved_stake_usd: round2(resolvedStakeUsd),
    resolved_net_pnl_usd: round2(resolvedNetPnlUsd),
    resolved_roi_on_stake:
      resolvedStakeUsd > 0 ? Math.round((resolvedNetPnlUsd / resolvedStakeUsd) * 10000) / 10000 : 0,
    max_drawdown_usd: round2(maxDrawdownUsd),
    latest_open_exposure_usd: round2(rowOpenExposure(latest)),
    latest_open_expected_pnl_usd: round2(rowOpenExpectedPnl(latest)),
  };
}

function proofQualityGradeLabel(
  grade: PaperTradingProofQualityGrade
): string {
  if (grade === "reviewable") return "Reviewable";
  if (grade === "developing") return "Developing";
  if (grade === "thin") return "Thin sample";
  return "No sample";
}

function proofWindowTradeCountDelta(
  context: PaperTradingProofWindowContext,
  key: "wins" | "losses"
): number {
  return Math.max(
    0,
    rowStrategyCount(context.latest, key) - rowStrategyCount(context.baseline, key)
  );
}

function proofWindowDailyPnlValues(
  context: PaperTradingProofWindowContext
): number[] {
  const windowStart = context.windowStart;
  const windowEnd = context.windowEnd;
  if (!windowStart || !windowEnd || !context.latest) return [];

  return context.latest.daily_series.days
    .filter((day) => day.date >= windowStart && day.date <= windowEnd)
    .map((day) => (Number.isFinite(day.net_pnl_usd) ? day.net_pnl_usd : 0));
}

function buildProofQuality(
  context: PaperTradingProofWindowContext,
  captureCoverage: PaperTradingCaptureCoverage,
  proofWindow: PaperTradingProofWindow,
  durableGate: DurableProofGate
): PaperTradingProofQuality {
  const winningTrades = proofWindowTradeCountDelta(context, "wins");
  const losingTrades = proofWindowTradeCountDelta(context, "losses");
  const classifiedTrades = winningTrades + losingTrades;
  const dailyPnlValues = proofWindowDailyPnlValues(context);
  const grossPositiveDailyPnl = dailyPnlValues
    .filter((pnl) => pnl > 0)
    .reduce((sum, pnl) => sum + pnl, 0);
  const grossNegativeDailyPnl = Math.abs(
    dailyPnlValues
      .filter((pnl) => pnl < 0)
      .reduce((sum, pnl) => sum + pnl, 0)
  );
  const winningDays = dailyPnlValues.filter((pnl) => pnl > 0).length;
  const losingDays = dailyPnlValues.filter((pnl) => pnl < 0).length;
  const flatDays = dailyPnlValues.length - winningDays - losingDays;
  const blockers = new Set<string>();

  if (captureCoverage.captured_days === 0) {
    blockers.add("No persisted captures in proof window.");
  }
  if (proofWindow.resolved_trades === 0) {
    blockers.add("No resolved trades in proof window.");
  }
  if (captureCoverage.missing_days > 0) {
    const label =
      captureCoverage.missing_days === 1 ? "capture" : "captures";
    blockers.add(`${captureCoverage.missing_days} missed daily ${label}.`);
  }
  if (captureCoverage.captured_days < PAPER_TRADING_PROOF_RULES.requiredLiveDays) {
    blockers.add(
      `${PAPER_TRADING_PROOF_RULES.requiredLiveDays - captureCoverage.captured_days} more capture days needed.`
    );
  }
  if (proofWindow.resolved_trades < PAPER_TRADING_PROOF_RULES.requiredResolvedTrades) {
    blockers.add(
      `${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades - proofWindow.resolved_trades} more resolved trades needed.`
    );
  }
  if (dailyPnlValues.length === 0) {
    blockers.add("No daily P&L series in proof window.");
  }
  for (const blocker of durableGate.blockers) {
    blockers.add(blocker);
  }

  const evidenceGrade: PaperTradingProofQualityGrade =
    captureCoverage.captured_days === 0 || proofWindow.resolved_trades === 0
      ? "none"
      : captureCoverage.captured_days <
            PAPER_TRADING_PROOF_RULES.requiredLiveDays ||
          captureCoverage.missing_days > 0 ||
          proofWindow.resolved_trades <
            PAPER_TRADING_PROOF_RULES.requiredResolvedTrades
        ? "thin"
        : durableGate.status === "candidate"
          ? "reviewable"
          : "developing";

  return {
    evidence_grade: evidenceGrade,
    evidence_grade_label: proofQualityGradeLabel(evidenceGrade),
    resolved_trades: proofWindow.resolved_trades,
    winning_trades: winningTrades,
    losing_trades: losingTrades,
    win_rate: classifiedTrades > 0 ? winningTrades / classifiedTrades : 0,
    avg_pnl_per_trade_usd:
      proofWindow.resolved_trades > 0
        ? round2(proofWindow.resolved_net_pnl_usd / proofWindow.resolved_trades)
        : 0,
    avg_stake_usd:
      proofWindow.resolved_trades > 0
        ? round2(proofWindow.resolved_stake_usd / proofWindow.resolved_trades)
        : 0,
    winning_days: winningDays,
    losing_days: losingDays,
    flat_days: flatDays,
    avg_daily_pnl_usd:
      dailyPnlValues.length > 0
        ? round2(
            dailyPnlValues.reduce((sum, pnl) => sum + pnl, 0) /
              dailyPnlValues.length
          )
        : 0,
    daily_profit_factor:
      grossNegativeDailyPnl > 0
        ? round2(grossPositiveDailyPnl / grossNegativeDailyPnl)
        : null,
    blockers: Array.from(blockers),
  };
}

function durableProofLabel(status: DurableProofStatus): string {
  if (status === "candidate") return "Candidate";
  if (status === "not_qualified") return "Not qualified";
  if (status === "control_only") return "Control only";
  if (status === "stale") return "Stale";
  return "Collecting";
}

function proofStatusRank(status: DurableProofStatus): number {
  if (status === "candidate") return 0;
  if (status === "collecting") return 1;
  if (status === "not_qualified") return 2;
  if (status === "stale") return 3;
  return 4;
}

function compareStrategyRollups(
  a: PaperTradingStrategyProofRollup,
  b: PaperTradingStrategyProofRollup
): number {
  const aLive = a.sample === "live_only";
  const bLive = b.sample === "live_only";
  if (aLive !== bLive) return aLive ? -1 : 1;

  const statusDelta =
    proofStatusRank(a.durable_proof_gate.status) -
    proofStatusRank(b.durable_proof_gate.status);
  if (statusDelta !== 0) return statusDelta;

  if (b.capture_coverage.captured_days !== a.capture_coverage.captured_days) {
    return b.capture_coverage.captured_days - a.capture_coverage.captured_days;
  }
  if (a.capture_coverage.missing_days !== b.capture_coverage.missing_days) {
    return a.capture_coverage.missing_days - b.capture_coverage.missing_days;
  }
  if (b.proof_window.resolved_net_pnl_usd !== a.proof_window.resolved_net_pnl_usd) {
    return b.proof_window.resolved_net_pnl_usd - a.proof_window.resolved_net_pnl_usd;
  }
  if (b.proof_window.resolved_roi_on_stake !== a.proof_window.resolved_roi_on_stake) {
    return b.proof_window.resolved_roi_on_stake - a.proof_window.resolved_roi_on_stake;
  }
  return a.strategy_label.localeCompare(b.strategy_label);
}

function emptyPaperTradingProofSummary(
  status: PaperTradingProofSummary["status"],
  statusLabel: string
): PaperTradingProofSummary {
  return {
    status,
    status_label: statusLabel,
    capital_review_status:
      status === "unavailable" ? "unavailable" : "blocked",
    capital_review_status_label:
      status === "unavailable" ? "Unavailable" : "Blocked",
    real_money_execution_allowed: false,
    paper_only: true,
    capital_review_blockers:
      status === "unavailable"
        ? ["Persisted paper proof log is unavailable."]
        : ["No live strategy has passed the durable proof gate."],
    live_strategy_count: 0,
    candidate_count: 0,
    collecting_count: 0,
    not_qualified_count: 0,
    stale_count: 0,
    control_count: 0,
    best_live_strategy_id: null,
    best_live_strategy_label: null,
    best_live_status: null,
    best_live_window_pnl_usd: 0,
    best_live_window_roi_on_stake: 0,
    best_live_resolved_trades: 0,
    best_live_captured_days: 0,
    best_live_missing_capture_days: 0,
    best_live_blockers: [],
  };
}

export function buildPaperTradingProofSummary(
  rollups: PaperTradingStrategyProofRollup[]
): PaperTradingProofSummary {
  if (rollups.length === 0) {
    return emptyPaperTradingProofSummary("unavailable", "No proof log");
  }

  const liveRollups = rollups.filter((rollup) => rollup.sample === "live_only");
  const candidates = liveRollups.filter(
    (rollup) => rollup.durable_proof_gate.status === "candidate"
  );
  const collecting = liveRollups.filter(
    (rollup) => rollup.durable_proof_gate.status === "collecting"
  );
  const notQualified = liveRollups.filter(
    (rollup) => rollup.durable_proof_gate.status === "not_qualified"
  );
  const stale = liveRollups.filter(
    (rollup) => rollup.durable_proof_gate.status === "stale"
  );
  const controlCount = rollups.filter(
    (rollup) => rollup.durable_proof_gate.status === "control_only"
  ).length;

  if (liveRollups.length === 0) {
    return {
      ...emptyPaperTradingProofSummary("unavailable", "No live strategies"),
      control_count: controlCount,
    };
  }

  const bestLive = liveRollups.slice().sort(compareStrategyRollups)[0];
  const status: PaperTradingProofSummary["status"] =
    candidates.length > 0
      ? "candidate"
      : stale.length > 0
        ? "stale"
        : collecting.length > 0
          ? "collecting"
          : "not_qualified";

  return {
    status,
    status_label:
      status === "candidate"
        ? "Candidate found"
        : status === "stale"
          ? "Stale"
          : status === "not_qualified"
            ? "No candidate"
            : "Collecting",
    capital_review_status: candidates.length > 0 ? "reviewable" : "blocked",
    capital_review_status_label:
      candidates.length > 0 ? "Reviewable" : "Blocked",
    real_money_execution_allowed: false,
    paper_only: true,
    capital_review_blockers:
      candidates.length > 0
        ? []
        : bestLive.durable_proof_gate.blockers.length > 0
          ? bestLive.durable_proof_gate.blockers
          : ["No live strategy has passed the durable proof gate."],
    live_strategy_count: liveRollups.length,
    candidate_count: candidates.length,
    collecting_count: collecting.length,
    not_qualified_count: notQualified.length,
    stale_count: stale.length,
    control_count: controlCount,
    best_live_strategy_id: bestLive.strategy_id,
    best_live_strategy_label: bestLive.strategy_label,
    best_live_status: bestLive.durable_proof_gate.status,
    best_live_window_pnl_usd: bestLive.proof_window.resolved_net_pnl_usd,
    best_live_window_roi_on_stake: bestLive.proof_window.resolved_roi_on_stake,
    best_live_resolved_trades: bestLive.proof_window.resolved_trades,
    best_live_captured_days: bestLive.capture_coverage.captured_days,
    best_live_missing_capture_days: bestLive.capture_coverage.missing_days,
    best_live_blockers: bestLive.durable_proof_gate.blockers,
  };
}

function buildDurableProofGate(
  latest: PaperTradingSnapshotRow,
  captureCoverage: PaperTradingCaptureCoverage,
  proofWindow: PaperTradingProofWindow,
  captureHealth: PaperTradingCaptureHealth
): DurableProofGate {
  const blockers: string[] = [];

  if (latest.sample !== "live_only") {
    blockers.push("Not live-only evidence.");
    return {
      status: "control_only",
      status_label: durableProofLabel("control_only"),
      captured_days: captureCoverage.captured_days,
      required_captured_days: PAPER_TRADING_PROOF_RULES.requiredLiveDays,
      missing_capture_days: captureCoverage.missing_days,
      resolved_trades: proofWindow.resolved_trades,
      required_resolved_trades: PAPER_TRADING_PROOF_RULES.requiredResolvedTrades,
      resolved_net_pnl_usd: proofWindow.resolved_net_pnl_usd,
      min_resolved_net_pnl_usd: PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd,
      resolved_roi_on_stake: proofWindow.resolved_roi_on_stake,
      min_roi_on_stake: PAPER_TRADING_PROOF_RULES.minRoiOnStake,
      max_drawdown_usd: proofWindow.max_drawdown_usd,
      max_allowed_drawdown_usd: PAPER_TRADING_PROOF_RULES.maxDrawdownUsd,
      capture_health_status: captureHealth.status,
      blockers,
    };
  }

  if (captureHealth.status !== "fresh") {
    blockers.push("Daily capture is not fresh.");
  }

  if (captureCoverage.missing_days > 0) {
    const label =
      captureCoverage.missing_days === 1 ? "capture" : "captures";
    blockers.push(
      `${captureCoverage.missing_days} missed daily ${label} in proof window.`
    );
  }

  if (captureCoverage.captured_days < PAPER_TRADING_PROOF_RULES.requiredLiveDays) {
    blockers.push(
      `${PAPER_TRADING_PROOF_RULES.requiredLiveDays - captureCoverage.captured_days} more persisted capture days needed.`
    );
  }

  if (proofWindow.resolved_trades < PAPER_TRADING_PROOF_RULES.requiredResolvedTrades) {
    blockers.push(
      `${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades - proofWindow.resolved_trades} more resolved live trades needed.`
    );
  }

  const enoughEvidence =
    captureCoverage.captured_days >= PAPER_TRADING_PROOF_RULES.requiredLiveDays &&
    captureCoverage.missing_days === 0 &&
    proofWindow.resolved_trades >= PAPER_TRADING_PROOF_RULES.requiredResolvedTrades;

  if (enoughEvidence) {
    if (
      proofWindow.resolved_net_pnl_usd <
      PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd
    ) {
      blockers.push("Resolved paper P&L is not positive.");
    }
    if (proofWindow.resolved_roi_on_stake <= PAPER_TRADING_PROOF_RULES.minRoiOnStake) {
      blockers.push("Resolved ROI is not positive.");
    }
    if (proofWindow.max_drawdown_usd > PAPER_TRADING_PROOF_RULES.maxDrawdownUsd) {
      blockers.push("Drawdown exceeds proof limit.");
    }
  }

  const status: DurableProofStatus =
    captureHealth.status !== "fresh"
      ? "stale"
      : enoughEvidence
        ? blockers.length === 0
          ? "candidate"
          : "not_qualified"
        : "collecting";

  return {
    status,
    status_label: durableProofLabel(status),
    captured_days: captureCoverage.captured_days,
    required_captured_days: PAPER_TRADING_PROOF_RULES.requiredLiveDays,
    missing_capture_days: captureCoverage.missing_days,
    resolved_trades: proofWindow.resolved_trades,
    required_resolved_trades: PAPER_TRADING_PROOF_RULES.requiredResolvedTrades,
    resolved_net_pnl_usd: proofWindow.resolved_net_pnl_usd,
    min_resolved_net_pnl_usd: PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd,
    resolved_roi_on_stake: proofWindow.resolved_roi_on_stake,
    min_roi_on_stake: PAPER_TRADING_PROOF_RULES.minRoiOnStake,
    max_drawdown_usd: proofWindow.max_drawdown_usd,
    max_allowed_drawdown_usd: PAPER_TRADING_PROOF_RULES.maxDrawdownUsd,
    capture_health_status: captureHealth.status,
    blockers,
  };
}

export function buildPaperTradingStrategyRollups(
  snapshots: PaperTradingSnapshotRow[],
  captureHealth = buildPaperTradingCaptureHealth(latestCapturedAt(snapshots))
): PaperTradingStrategyProofRollup[] {
  const byStrategy = new Map<string, PaperTradingSnapshotRow[]>();
  for (const snapshot of snapshots) {
    const strategyKey = strategyRuleFingerprint(snapshot.strategy_summary);
    const existing = byStrategy.get(strategyKey) ?? [];
    existing.push(snapshot);
    byStrategy.set(strategyKey, existing);
  }

  return Array.from(byStrategy.entries())
    .map(([, rows]) => {
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
      const captureCoverage = buildCaptureCoverage(
        latestRowsByDay,
        captureHealth
      );
      const proofWindowContext = buildProofWindowContext(
        latestRowsByDay,
        captureCoverage
      );
      const proofWindow = buildProofWindow(proofWindowContext);
      const durableProofGate = buildDurableProofGate(
        latest,
        captureCoverage,
        proofWindow,
        captureHealth
      );
      const proofQuality = buildProofQuality(
        proofWindowContext,
        captureCoverage,
        proofWindow,
        durableProofGate
      );

      return {
        strategy_id: latest.strategy_id,
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
        proof_window: proofWindow,
        proof_quality: proofQuality,
        capture_coverage: captureCoverage,
        durable_proof_gate: durableProofGate,
        latest_snapshot: latest,
      };
    })
    .sort(compareStrategyRollups);
}

const AGENT_EDGE_GATE_SET = new Set<number>(AGENT_EDGE_GATES);

function isPersistedAgentEdgeRollup(
  rollup: PaperTradingStrategyProofRollup
): boolean {
  const summary = rollup.latest_snapshot.strategy_summary;
  return (
    rollup.sample === "live_only" &&
    !rollup.is_custom &&
    Array.isArray(summary.agent_ids) &&
    summary.agent_ids.length === 1 &&
    (summary.category ?? null) === null &&
    (summary.side ?? null) === null &&
    AGENT_EDGE_GATE_SET.has(summary.min_edge)
  );
}

export function buildPaperTradingAgentEdgeProofMatrix(
  rollups: PaperTradingStrategyProofRollup[]
): PaperTradingAgentEdgeProofRow[] {
  const agentRank = new Map(AGENTS.map((agent, index) => [agent.id, index]));

  return rollups
    .filter(isPersistedAgentEdgeRollup)
    .map((rollup) => {
      const summary = rollup.latest_snapshot.strategy_summary;
      const agentId = summary.agent_ids[0];
      const agent = AGENTS.find((item) => item.id === agentId);
      const gate = rollup.durable_proof_gate;
      const proofWindow = rollup.proof_window;
      const proofQuality = rollup.proof_quality;

      return {
        strategy_id: rollup.strategy_id,
        strategy_label: rollup.strategy_label,
        agent_id: agentId,
        agent_name: agent?.name ?? agentId,
        min_edge: summary.min_edge,
        proof_status: gate.status,
        proof_status_label: gate.status_label,
        captured_days: gate.captured_days,
        required_captured_days: gate.required_captured_days,
        missing_capture_days: gate.missing_capture_days,
        resolved_trades: gate.resolved_trades,
        required_resolved_trades: gate.required_resolved_trades,
        win_rate: proofQuality.win_rate,
        avg_pnl_per_trade_usd: proofQuality.avg_pnl_per_trade_usd,
        daily_profit_factor: proofQuality.daily_profit_factor,
        evidence_grade: proofQuality.evidence_grade,
        evidence_grade_label: proofQuality.evidence_grade_label,
        window_pnl_usd: gate.resolved_net_pnl_usd,
        window_roi_on_stake: gate.resolved_roi_on_stake,
        max_drawdown_usd: gate.max_drawdown_usd,
        open_exposure_usd: round2(proofWindow.latest_open_exposure_usd),
        open_expected_pnl_usd: round2(proofWindow.latest_open_expected_pnl_usd),
        latest_snapshot_date: rollup.latest_snapshot_date,
        latest_captured_at: rollup.latest_captured_at,
        proof_quality: proofQuality,
        blockers: gate.blockers,
      };
    })
    .sort((a, b) => {
      const agentDelta =
        (agentRank.get(a.agent_id) ?? Number.MAX_SAFE_INTEGER) -
        (agentRank.get(b.agent_id) ?? Number.MAX_SAFE_INTEGER);
      if (agentDelta !== 0) return agentDelta;
      return a.min_edge - b.min_edge;
    });
}

function readinessStatusLabel(status: PaperTradingProofReadinessStatus): string {
  if (status === "pass") return "Pass";
  if (status === "blocked") return "Blocked";
  if (status === "unavailable") return "Unavailable";
  return "Collecting";
}

function readinessItem(
  id: string,
  label: string,
  status: PaperTradingProofReadinessStatus,
  current: string,
  target: string,
  detail: string,
  evidence: PaperTradingProofReadinessEvidence[] = []
): PaperTradingProofReadinessItem {
  return {
    id,
    label,
    status,
    status_label: readinessStatusLabel(status),
    current,
    target,
    detail,
    evidence,
  };
}

function resolutionSignalEvidence(
  signal: ResolutionWatchSignal
): PaperTradingProofReadinessEvidence {
  return {
    kind: "resolution_signal",
    prediction_id: signal.prediction_id,
    market_id: signal.market_id,
    market_question: signal.market_question,
    agent_id: signal.agent_id,
    agent_name: signal.agent_name,
    side: signal.side,
    stake_usd: signal.stake_usd,
    expected_pnl_usd: signal.expected_pnl_usd,
    market_closes_at: signal.market_closes_at,
    created_at: signal.created_at,
    close_status: signal.close_status,
    days_until_close: signal.days_until_close,
    age_days: signal.age_days,
  };
}

function proofRunwayStatusLabel(status: PaperTradingProofRunwayStatus): string {
  if (status === "reviewable") return "Reviewable";
  if (status === "blocked") return "Blocked";
  if (status === "unavailable") return "Unavailable";
  return "Collecting";
}

function parseDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysAtSameTime(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function daysUntil(date: Date, now = new Date()): number {
  return Math.max(
    0,
    Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  );
}

function buildRunwayMilestone(
  id: string,
  label: string,
  status: PaperTradingProofRunwayStatus,
  current: string,
  target: string,
  etaAt: string | null,
  detail: string
): PaperTradingProofRunwayMilestone {
  return {
    id,
    label,
    status,
    status_label: proofRunwayStatusLabel(status),
    current,
    target,
    eta_at: etaAt,
    detail,
  };
}

function earliestCaptureCompletionAt(
  captureCalendar: PaperTradingCaptureCalendar,
  captureHealth: PaperTradingCaptureHealth
): string | null {
  if (captureCalendar.days_remaining_to_30 <= 0) {
    return captureHealth.latest_captured_at;
  }

  const nextCapture = parseDateOrNull(captureHealth.next_expected_capture_at);
  if (!nextCapture) return null;

  return addDaysAtSameTime(
    nextCapture,
    Math.max(0, captureCalendar.days_remaining_to_30 - 1)
  ).toISOString();
}

export function buildPaperTradingProofRunway(args: {
  proofSummary: PaperTradingProofSummary;
  captureHealth: PaperTradingCaptureHealth;
  captureCalendar: PaperTradingCaptureCalendar;
  resolutionWatch?: TradingResolutionWatch | null;
  now?: Date;
}): PaperTradingProofRunway {
  const now = args.now ?? new Date();
  const captureDaysRemaining = Math.max(
    0,
    REQUIRED_PROOF_DAYS - args.captureCalendar.complete_days
  );
  const resolvedTradesRemaining = Math.max(
    0,
    PAPER_TRADING_PROOF_RULES.requiredResolvedTrades -
      args.proofSummary.best_live_resolved_trades
  );
  const captureEta = earliestCaptureCompletionAt(
    args.captureCalendar,
    args.captureHealth
  );
  const resolvedCapacity =
    args.resolutionWatch === undefined
      ? null
      : args.resolutionWatch?.open_live_signals ?? 0;
  const openLiveSignals =
    args.resolutionWatch === undefined
      ? null
      : args.resolutionWatch?.open_live_signals ?? 0;
  const overdueLiveSignals =
    args.resolutionWatch === undefined
      ? null
      : args.resolutionWatch?.overdue_live_signals ?? 0;
  const reviewRequiredLiveSignals =
    args.resolutionWatch === undefined
      ? null
      : args.resolutionWatch?.review_required_live_signals ?? 0;
  const closingNext7dSignals =
    args.resolutionWatch === undefined
      ? null
      : args.resolutionWatch?.closing_next_7d_signals ?? 0;
  const unknownCloseLiveSignals =
    args.resolutionWatch === undefined
      ? null
      : args.resolutionWatch?.unknown_close_live_signals ?? 0;
  const captureBlocked =
    args.captureHealth.status === "stale" ||
    args.captureHealth.status === "unavailable" ||
    args.captureCalendar.status === "missing" ||
    args.captureCalendar.status === "partial";
  const resolutionUnchecked = args.resolutionWatch === undefined;
  const resolutionBlocked = (reviewRequiredLiveSignals ?? 0) > 0;
  const unavailable =
    args.proofSummary.status === "unavailable" ||
    args.captureCalendar.status === "unavailable";
  const status: PaperTradingProofRunwayStatus = unavailable
    ? "unavailable"
    : captureBlocked || resolutionBlocked
      ? "blocked"
      : args.proofSummary.capital_review_status === "reviewable" &&
          !resolutionUnchecked
        ? "reviewable"
        : "collecting";
  const blockerSummary = unavailable
    ? "Persisted proof data is unavailable."
    : resolutionBlocked
      ? `Investigate ${reviewRequiredLiveSignals} live paper market${
          reviewRequiredLiveSignals === 1 ? "" : "s"
        } needing review before trusting open EV.`
      : captureBlocked
        ? "Repair capture freshness or missing daily proof rows before review."
        : resolutionUnchecked
          ? "Check the current live resolution backlog before capital review."
        : captureDaysRemaining > 0 || resolvedTradesRemaining > 0
          ? `Collect ${captureDaysRemaining} more proof day${
              captureDaysRemaining === 1 ? "" : "s"
            } and ${resolvedTradesRemaining} more resolved live paper trade${
              resolvedTradesRemaining === 1 ? "" : "s"
            }.`
          : "A durable live candidate can be reviewed; execution remains disabled.";
  const earliestReviewAt =
    status === "reviewable"
      ? args.captureHealth.latest_captured_at
      : captureEta;
  const earliestReviewDate = earliestReviewAt?.slice(0, 10) ?? null;
  const earliestReviewDateObject = parseDateOrNull(earliestReviewAt);
  const captureMilestoneStatus: PaperTradingProofRunwayStatus = captureBlocked
    ? "blocked"
    : captureDaysRemaining === 0
      ? "reviewable"
      : "collecting";
  const resolvedMilestoneStatus: PaperTradingProofRunwayStatus =
    resolvedTradesRemaining === 0 ? "reviewable" : "collecting";
  const resolutionMilestoneStatus: PaperTradingProofRunwayStatus =
    args.resolutionWatch === undefined || !args.resolutionWatch
      ? "unavailable"
      : args.resolutionWatch.review_required_live_signals > 0
        ? "blocked"
        : args.resolutionWatch.open_live_signals > 0
          ? "collecting"
          : "reviewable";
  const capitalReviewMilestoneStatus: PaperTradingProofRunwayStatus =
    args.proofSummary.capital_review_status === "reviewable"
      ? "reviewable"
      : status === "blocked"
        ? "blocked"
        : status === "unavailable"
          ? "unavailable"
          : "collecting";

  return {
    status,
    status_label: proofRunwayStatusLabel(status),
    paper_only: true,
    real_money_execution_allowed: false,
    earliest_capital_review_at: earliestReviewAt,
    earliest_capital_review_date: earliestReviewDate,
    days_until_earliest_review: earliestReviewDateObject
      ? daysUntil(earliestReviewDateObject, now)
      : null,
    capture_days_remaining: captureDaysRemaining,
    resolved_trades_remaining: resolvedTradesRemaining,
    open_live_signals: openLiveSignals,
    overdue_live_signals: overdueLiveSignals,
    review_required_live_signals: reviewRequiredLiveSignals,
    closing_next_7d_signals: closingNext7dSignals,
    unknown_close_live_signals: unknownCloseLiveSignals,
    pending_resolution_capacity: resolvedCapacity,
    blocker_summary: blockerSummary,
    milestones: [
      buildRunwayMilestone(
        "capture_window",
        "30-day capture runway",
        captureMilestoneStatus,
        `${args.captureCalendar.complete_days}/${REQUIRED_PROOF_DAYS} complete days`,
        `${REQUIRED_PROOF_DAYS} complete days`,
        captureEta,
        captureBlocked
          ? "Daily capture quality must be repaired before the runway is meaningful."
          : "Earliest date assumes the daily snapshot keeps landing on schedule."
      ),
      buildRunwayMilestone(
        "resolved_trades",
        "Resolved trade runway",
        resolvedMilestoneStatus,
        `${args.proofSummary.best_live_resolved_trades}/${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades} resolved`,
        `${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades} resolved live paper trades`,
        null,
        resolvedCapacity === null
          ? "Current open live resolution capacity is only available from /api/trading.json."
          : `${resolvedCapacity} open live paper tickets can become realized evidence when markets resolve.`
      ),
      buildRunwayMilestone(
        "resolution_hygiene",
        "Resolution hygiene",
        resolutionMilestoneStatus,
        args.resolutionWatch
          ? `${args.resolutionWatch.review_required_live_signals} needs review / ${args.resolutionWatch.open_live_signals} open`
          : "not checked",
        "0 review-required live paper markets",
        args.resolutionWatch?.next_close_at ?? null,
        args.resolutionWatch
          ? "Overdue or unknown-close markets must be investigated before their EV is treated as actionable."
          : "Live resolution status is available only when paired with the current trading snapshot."
      ),
      buildRunwayMilestone(
        "capital_review",
        "Capital review boundary",
        capitalReviewMilestoneStatus,
        args.proofSummary.capital_review_status_label,
        "reviewable candidate, execution still disabled",
        earliestReviewAt,
        args.proofSummary.capital_review_blockers[0] ??
          "The lab can become reviewable, but it never enables real-money execution."
      ),
    ],
  };
}

function proofReadinessNextAction(
  args: {
    persistenceStatus: PaperTradingPersistenceRead["status"];
    proofSummary: PaperTradingProofSummary;
    captureHealth: PaperTradingCaptureHealth;
    captureCalendar: PaperTradingCaptureCalendar;
    registrySync?: PaperTradingStrategyRegistrySync | null;
    resolutionWatch?: TradingResolutionWatch | null;
  },
  evidenceWindowReady: boolean
): string {
  if (args.persistenceStatus !== "available") {
    return "Restore persisted paper snapshot storage before reading proof metrics.";
  }
  if (args.captureHealth.status !== "fresh") {
    return "Restore the daily snapshot writer before trusting proof metrics.";
  }
  if (args.registrySync && args.registrySync.status === "pending_capture") {
    return "Wait for the next daily snapshot to capture the current strategy registry.";
  }
  if (args.resolutionWatch && args.resolutionWatch.review_required_live_signals > 0) {
    const label =
      args.resolutionWatch.review_required_live_signals === 1
        ? "market"
        : "markets";
    return `Investigate ${args.resolutionWatch.review_required_live_signals} live paper ${label} needing resolution review before trusting open EV.`;
  }
  if (
    args.captureCalendar.missing_days > 0 ||
    args.captureCalendar.partial_days > 0
  ) {
    return "Repair missing or partial daily captures in the proof window.";
  }
  if (args.proofSummary.best_live_captured_days < REQUIRED_PROOF_DAYS) {
    return `Collect ${REQUIRED_PROOF_DAYS - args.proofSummary.best_live_captured_days} more persisted daily capture days.`;
  }
  if (
    args.proofSummary.best_live_resolved_trades <
    PAPER_TRADING_PROOF_RULES.requiredResolvedTrades
  ) {
    return `Wait for ${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades - args.proofSummary.best_live_resolved_trades} more live paper tickets to resolve.`;
  }
  if (!evidenceWindowReady || args.proofSummary.status === "collecting") {
    return "Continue paper-only collection until the proof window is complete.";
  }
  if (args.proofSummary.capital_review_status === "reviewable") {
    return "A durable candidate is ready for operator capital review; execution remains disabled.";
  }
  return "Do not allocate capital; inspect the durable proof blockers.";
}

export function buildPaperTradingProofReadiness(args: {
  persistenceStatus: PaperTradingPersistenceRead["status"];
  proofSummary: PaperTradingProofSummary;
  captureHealth: PaperTradingCaptureHealth;
  captureCalendar: PaperTradingCaptureCalendar;
  registrySync?: PaperTradingStrategyRegistrySync | null;
  resolutionWatch?: TradingResolutionWatch | null;
}): PaperTradingProofReadiness {
  const registryStatus: PaperTradingProofReadinessStatus = !args.registrySync
    ? "unavailable"
    : args.registrySync.status === "synced"
      ? "pass"
      : args.registrySync.status === "pending_capture"
        ? "collecting"
        : "unavailable";
  const captureWindowReady =
    args.captureCalendar.complete_days >= REQUIRED_PROOF_DAYS &&
    args.captureCalendar.missing_days === 0 &&
    args.captureCalendar.partial_days === 0;
  const evidenceWindowReady =
    captureWindowReady &&
    args.proofSummary.best_live_resolved_trades >=
      PAPER_TRADING_PROOF_RULES.requiredResolvedTrades;
  const captureWindowStatus: PaperTradingProofReadinessStatus =
    args.captureCalendar.status === "unavailable"
      ? "unavailable"
      : args.captureCalendar.missing_days > 0 ||
          args.captureCalendar.partial_days > 0
        ? "blocked"
        : captureWindowReady
          ? "pass"
          : "collecting";
  const resolvedTradesStatus: PaperTradingProofReadinessStatus =
    args.proofSummary.best_live_strategy_id === null
      ? "unavailable"
      : args.proofSummary.best_live_resolved_trades >=
          PAPER_TRADING_PROOF_RULES.requiredResolvedTrades
        ? "pass"
        : "collecting";
  const pendingEvidenceStatus: PaperTradingProofReadinessStatus =
    evidenceWindowReady ? "pass" : "collecting";
  const capitalReviewStatus: PaperTradingProofReadinessStatus =
    args.proofSummary.capital_review_status === "reviewable"
      ? "pass"
      : args.proofSummary.capital_review_status === "unavailable"
        ? "unavailable"
        : args.proofSummary.status === "not_qualified" ||
            args.proofSummary.status === "stale"
          ? "blocked"
          : "collecting";
  const reviewRequiredResolutionEvidence =
    args.resolutionWatch?.signals
      .filter((signal) => signal.tradability_status === "needs_review")
      .slice(0, 5)
      .map(resolutionSignalEvidence) ?? [];
  const resolutionItem =
    args.resolutionWatch === undefined
      ? null
      : readinessItem(
          "resolution_hygiene",
          "Resolution hygiene",
          !args.resolutionWatch
            ? "unavailable"
            : args.resolutionWatch.review_required_live_signals > 0
              ? "blocked"
              : args.resolutionWatch.open_live_signals > 0
                ? "collecting"
                : "pass",
          !args.resolutionWatch
            ? "not checked"
            : `${args.resolutionWatch.review_required_live_signals} needs review (${args.resolutionWatch.overdue_live_signals} overdue, ${args.resolutionWatch.unknown_close_live_signals} unknown close) / ${args.resolutionWatch.open_live_signals} open`,
          "0 review-required live paper markets",
          !args.resolutionWatch
            ? "Only /api/trading.json can inspect the current live resolution backlog."
            : args.resolutionWatch.review_required_live_signals > 0
              ? "Overdue or unknown-close open markets must be checked before treating open EV as credible."
              : args.resolutionWatch.open_live_signals > 0
                ? "Open live tickets are waiting for market resolution; they are not realized profit."
                : "No open live paper tickets are waiting for resolution.",
          reviewRequiredResolutionEvidence
        );

  const items = [
    readinessItem(
      "archive",
      "Persisted proof archive",
      args.persistenceStatus === "available" ? "pass" : "unavailable",
      args.persistenceStatus.replace("_", " "),
      "available",
      "Stored snapshots must be readable before the lab can prove anything."
    ),
    readinessItem(
      "paper_only",
      "Paper-only lock",
      args.proofSummary.paper_only && !args.proofSummary.real_money_execution_allowed
        ? "pass"
        : "blocked",
      args.proofSummary.real_money_execution_allowed ? "execution enabled" : "execution disabled",
      "execution disabled",
      "The proof lab must never enable orders, wallets, leverage, or live capital."
    ),
    readinessItem(
      "capture_freshness",
      "Daily capture freshness",
      args.captureHealth.status === "fresh"
        ? "pass"
        : args.captureHealth.status === "waiting_first_capture"
          ? "collecting"
          : args.captureHealth.status === "stale"
            ? "blocked"
            : "unavailable",
      args.captureHealth.status_label,
      "fresh",
      args.captureHealth.message
    ),
    readinessItem(
      "registry_sync",
      "Strategy registry sync",
      registryStatus,
      args.registrySync
        ? `${args.registrySync.persisted_latest_live_strategy_count}/${args.registrySync.current_live_strategy_count} live`
        : "not checked",
      "current live registry captured",
      args.registrySync?.message ?? "Only /api/trading.json can compare current and persisted registries."
    ),
    readinessItem(
      "capture_window",
      "30-day capture window",
      captureWindowStatus,
      `${args.captureCalendar.complete_days}/${REQUIRED_PROOF_DAYS} complete days`,
      `${REQUIRED_PROOF_DAYS} complete days, 0 missing`,
      `${args.captureCalendar.missing_days} missing, ${args.captureCalendar.partial_days} partial.`
    ),
    readinessItem(
      "resolved_trades",
      "Resolved live trades",
      resolvedTradesStatus,
      `${args.proofSummary.best_live_resolved_trades}/${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades}`,
      `${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades} resolved live paper trades`,
      args.proofSummary.best_live_strategy_label
        ? `Best live rollup: ${args.proofSummary.best_live_strategy_label}.`
        : "No live rollup is available yet."
    ),
    readinessItem(
      "window_pnl",
      "Positive window P&L",
      evidenceWindowReady
        ? args.proofSummary.best_live_window_pnl_usd >=
          PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd
          ? "pass"
          : "blocked"
        : pendingEvidenceStatus,
      `$${args.proofSummary.best_live_window_pnl_usd.toFixed(2)}`,
      `>= $${PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd.toFixed(2)}`,
      evidenceWindowReady
        ? "Measured on the durable rolling proof window."
        : "Waiting for enough captured days and resolved trades."
    ),
    readinessItem(
      "window_roi",
      "Positive window ROI",
      evidenceWindowReady
        ? args.proofSummary.best_live_window_roi_on_stake >
          PAPER_TRADING_PROOF_RULES.minRoiOnStake
          ? "pass"
          : "blocked"
        : pendingEvidenceStatus,
      `${(args.proofSummary.best_live_window_roi_on_stake * 100).toFixed(1)}%`,
      `> ${(PAPER_TRADING_PROOF_RULES.minRoiOnStake * 100).toFixed(1)}%`,
      evidenceWindowReady
        ? "Measured only after the proof window has enough evidence."
        : "ROI is not judged until the proof window is complete."
    ),
    readinessItem(
      "drawdown",
      "Drawdown limit",
      evidenceWindowReady
        ? args.proofSummary.best_live_blockers.some((blocker) =>
            blocker.toLowerCase().includes("drawdown")
          )
          ? "blocked"
          : "pass"
        : pendingEvidenceStatus,
      "tracked in rollups",
      `<= $${PAPER_TRADING_PROOF_RULES.maxDrawdownUsd.toFixed(0)}`,
      evidenceWindowReady
        ? "Drawdown blockers come from durable proof gates."
        : "Drawdown is not final until the proof window is complete."
    ),
    readinessItem(
      "capital_review",
      "Capital review boundary",
      capitalReviewStatus,
      args.proofSummary.capital_review_status_label,
      "reviewable candidate, execution still disabled",
      args.proofSummary.capital_review_blockers[0] ??
        "A candidate can become reviewable, but this app never enables execution."
    ),
  ];
  if (resolutionItem) {
    items.splice(4, 0, resolutionItem);
  }

  const overallStatus: PaperTradingProofReadinessStatus =
    args.persistenceStatus !== "available" || args.proofSummary.status === "unavailable"
      ? "unavailable"
      : items.some((item) => item.status === "blocked")
        ? "blocked"
        : args.proofSummary.capital_review_status === "reviewable"
          ? "pass"
          : "collecting";
  const blockedItemIds = items
    .filter((item) => item.status === "blocked")
    .map((item) => item.id);

  return {
    status: overallStatus,
    status_label:
      overallStatus === "pass"
        ? "Ready for review"
        : readinessStatusLabel(overallStatus),
    ready_for_capital_review:
      args.proofSummary.capital_review_status === "reviewable",
    real_money_execution_allowed: false,
    paper_only: true,
    next_required_action: proofReadinessNextAction(args, evidenceWindowReady),
    passed_item_count: items.filter((item) => item.status === "pass").length,
    collecting_item_count: items.filter((item) => item.status === "collecting")
      .length,
    blocked_item_count: blockedItemIds.length,
    unavailable_item_count: items.filter((item) => item.status === "unavailable")
      .length,
    blocked_item_ids: blockedItemIds,
    items,
  };
}

function evidenceSourceStatusLabel(
  status: PaperTradingProofEvidenceSourceStatus
): string {
  if (status === "active") return "Active";
  if (status === "available") return "Available";
  if (status === "blocked") return "Blocked";
  if (status === "reviewable") return "Reviewable";
  if (status === "unavailable") return "Unavailable";
  return "Collecting";
}

function proofEvidenceSource(
  source: Omit<PaperTradingProofEvidenceSource, "status_label">
): PaperTradingProofEvidenceSource {
  return {
    ...source,
    status_label: evidenceSourceStatusLabel(source.status),
  };
}

function capitalEvidenceStatus(
  proofReadiness: PaperTradingProofReadiness
): PaperTradingProofEvidenceSourceStatus {
  if (proofReadiness.ready_for_capital_review) return "reviewable";
  if (proofReadiness.status === "blocked") return "blocked";
  if (proofReadiness.status === "unavailable") return "unavailable";
  return "collecting";
}

export function buildPaperTradingProofEvidenceSources(args: {
  persistence: PaperTradingPersistenceRead;
  proofReadiness: PaperTradingProofReadiness;
  proofRunway: PaperTradingProofRunway;
  resolutionWatch?: TradingResolutionWatch | null;
}): PaperTradingProofEvidenceSources {
  const rowCount = args.persistence.snapshots.length;
  const hasPersistedRows = rowCount > 0;
  const persistenceStatus: PaperTradingProofEvidenceSourceStatus =
    args.persistence.status === "available"
      ? hasPersistedRows
        ? "available"
        : "collecting"
      : args.persistence.status === "error" ||
          args.persistence.status === "table_missing"
        ? "blocked"
        : "unavailable";
  const supabasePersistence = proofEvidenceSource({
    id: "supabase_persistence",
    label: "Supabase proof log",
    status: persistenceStatus,
    current:
      args.persistence.status === "available"
        ? `${rowCount} rows / ${args.persistence.capture_calendar.complete_days} complete days`
        : args.persistence.status.replace("_", " "),
    target: `${REQUIRED_PROOF_DAYS} complete days, current strategy registry captured`,
    detail: hasPersistedRows
      ? "Dashboard rollups are reading append-only proof rows from Supabase."
      : args.persistence.status === "available"
        ? "Supabase is reachable, but the proof log has not accumulated rows yet."
        : args.persistence.message,
    evidence: [
      `latest captured: ${args.persistence.latest_captured_at ?? "none"}`,
      `capture health: ${args.persistence.capture_health.status_label}`,
      "registry rows are replayed, not used for execution",
    ],
  });

  const githubArtifacts = proofEvidenceSource({
    id: "github_artifacts",
    label: "GitHub proof artifacts",
    status: "active",
    current: `${PAPER_TRADING_ARTIFACT_CONTRACT.scheduled_time_utc} UTC / ${PAPER_TRADING_ARTIFACT_CONTRACT.retention_days}d retention`,
    target: "self-contained proof bundle per workflow run",
    detail:
      "The scheduled workflow uploads a live proof bundle even when Supabase writes are disabled.",
    evidence: [
      PAPER_TRADING_ARTIFACT_CONTRACT.workflow_path,
      PAPER_TRADING_ARTIFACT_CONTRACT.artifact_name_pattern,
      PAPER_TRADING_ARTIFACT_CONTRACT.proof_report_file,
    ],
  });

  const resolutionStatus: PaperTradingProofEvidenceSourceStatus =
    args.resolutionWatch === undefined || args.resolutionWatch === null
      ? "unavailable"
      : args.resolutionWatch.review_required_live_signals > 0
        ? "blocked"
        : args.resolutionWatch.open_live_signals > 0
          ? "collecting"
          : "available";
  const resolutionHygiene = proofEvidenceSource({
    id: "resolution_hygiene",
    label: "Resolution hygiene",
    status: resolutionStatus,
    current: args.resolutionWatch
      ? `${args.resolutionWatch.tradable_open_live_signals} tradable / ${args.resolutionWatch.review_required_live_signals} review / ${args.resolutionWatch.open_live_signals} open`
      : "not checked",
    target: "0 review-required live paper markets",
    detail: args.resolutionWatch
      ? args.resolutionWatch.review_required_live_signals > 0
        ? "Open EV is split until overdue or unknown-close markets are reviewed."
        : "Open live paper tickets remain unrealized until markets resolve."
      : "Current resolution hygiene requires the live trading snapshot context.",
    evidence: args.resolutionWatch
      ? [
          `tradable EV: $${args.resolutionWatch.tradable_open_expected_pnl_usd.toFixed(2)}`,
          `review EV: $${args.resolutionWatch.review_required_open_expected_pnl_usd.toFixed(2)}`,
          `next close: ${args.resolutionWatch.next_close_at ?? "unknown"}`,
        ]
      : [],
  });

  const capitalStatus = capitalEvidenceStatus(args.proofReadiness);
  const capitalReview = proofEvidenceSource({
    id: "capital_review",
    label: "Capital review gate",
    status: capitalStatus,
    current: args.proofReadiness.status_label,
    target: "operator review only, execution disabled",
    detail:
      args.proofRunway.blocker_summary ||
      args.proofReadiness.next_required_action,
    evidence: [
      args.proofReadiness.next_required_action,
      `paper only: ${args.proofReadiness.paper_only ? "true" : "false"}`,
      `real money execution allowed: ${
        args.proofReadiness.real_money_execution_allowed ? "true" : "false"
      }`,
    ],
  });

  const status: PaperTradingProofEvidenceSourceStatus =
    capitalReview.status === "reviewable"
      ? "reviewable"
      : capitalReview.status === "blocked"
        ? "blocked"
        : supabasePersistence.status === "unavailable" &&
            githubArtifacts.status === "active"
          ? "active"
          : capitalReview.status;
  const sources = [
    supabasePersistence,
    githubArtifacts,
    resolutionHygiene,
    capitalReview,
  ];

  return {
    status,
    status_label:
      status === "active"
        ? "Evidence active"
        : evidenceSourceStatusLabel(status),
    paper_only: true,
    real_money_execution_allowed: false,
    artifact_contract: PAPER_TRADING_ARTIFACT_CONTRACT,
    sources,
    supabase_persistence: supabasePersistence,
    github_artifacts: githubArtifacts,
    resolution_hygiene: resolutionHygiene,
    capital_review: capitalReview,
  };
}

export async function loadPaperTradingSnapshotHistory(
  limit = DEFAULT_HISTORY_LIMIT
): Promise<PaperTradingPersistenceRead> {
  const env = getSupabaseEnv();
  if (!env) {
    const captureHealth = unavailableCaptureHealth(
      "Unconfigured",
      "Supabase env is not configured for persisted paper-trading snapshots."
    );
    const captureCalendar = emptyCaptureCalendar("Unconfigured");
    const proofSummary = emptyPaperTradingProofSummary(
      "unavailable",
      "Unconfigured"
    );
    return {
      status: "unconfigured",
      message: "Supabase env is not configured for persisted paper-trading snapshots.",
      latest_captured_at: null,
      capture_health: captureHealth,
      capture_calendar: captureCalendar,
      proof_summary: proofSummary,
      proof_readiness: buildPaperTradingProofReadiness({
        persistenceStatus: "unconfigured",
        proofSummary,
        captureHealth,
        captureCalendar,
      }),
      proof_runway: buildPaperTradingProofRunway({
        proofSummary,
        captureHealth,
        captureCalendar,
      }),
      agent_edge_proof_matrix: [],
      snapshots: [],
      strategy_rollups: [],
    };
  }

  const sb = createSupabaseClient(env);
  const { data, error } = await sb
    .from(SNAPSHOT_TABLE)
    .select("*")
    .order("captured_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 1000)));

  if (error) {
    const status = isMissingTableError(error) ? "table_missing" : "error";
    const statusLabel = isMissingTableError(error) ? "Table missing" : "Error";
    const captureHealth = unavailableCaptureHealth(statusLabel, error.message);
    const captureCalendar = emptyCaptureCalendar(statusLabel);
    const proofSummary = emptyPaperTradingProofSummary(
      "unavailable",
      statusLabel
    );
    return {
      status,
      message: error.message,
      latest_captured_at: null,
      capture_health: captureHealth,
      capture_calendar: captureCalendar,
      proof_summary: proofSummary,
      proof_readiness: buildPaperTradingProofReadiness({
        persistenceStatus: status,
        proofSummary,
        captureHealth,
        captureCalendar,
      }),
      proof_runway: buildPaperTradingProofRunway({
        proofSummary,
        captureHealth,
        captureCalendar,
      }),
      agent_edge_proof_matrix: [],
      snapshots: [],
      strategy_rollups: [],
    };
  }

  const snapshots = (data ?? []) as unknown as PaperTradingSnapshotRow[];
  const captureHealth = buildPaperTradingCaptureHealth(
    snapshots[0]?.captured_at ?? null
  );
  const captureCalendar = buildPaperTradingCaptureCalendar(
    snapshots,
    captureHealth
  );
  const strategyRollups = buildPaperTradingStrategyRollups(snapshots, captureHealth);
  const agentEdgeProofMatrix =
    buildPaperTradingAgentEdgeProofMatrix(strategyRollups);
  const proofSummary = buildPaperTradingProofSummary(strategyRollups);
  return {
    status: "available",
    message: "Persisted paper-trading snapshots loaded.",
    latest_captured_at: snapshots[0]?.captured_at ?? null,
    capture_health: captureHealth,
    capture_calendar: captureCalendar,
    proof_summary: proofSummary,
    proof_readiness: buildPaperTradingProofReadiness({
      persistenceStatus: "available",
      proofSummary,
      captureHealth,
      captureCalendar,
    }),
    proof_runway: buildPaperTradingProofRunway({
      proofSummary,
      captureHealth,
      captureCalendar,
    }),
    agent_edge_proof_matrix: agentEdgeProofMatrix,
    snapshots,
    strategy_rollups: strategyRollups,
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
