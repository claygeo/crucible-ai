import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { PAPER_TRADING_PROOF_RULES } from "@/lib/trading";
import type {
  StrategyDailyEvidenceSeries,
  StrategyVariantSummary,
  TradingControls,
  TradingSample,
  TradingSnapshot,
  TradingSource,
} from "@/lib/trading";

const SNAPSHOT_TABLE = "paper_trading_snapshots";
const DEFAULT_HISTORY_LIMIT = 500;
const REQUIRED_PROOF_DAYS = PAPER_TRADING_PROOF_RULES.requiredLiveDays;
const SNAPSHOT_CRON_UTC_HOUR = 5;
const SNAPSHOT_CRON_UTC_MINUTE = 12;
const STALE_AFTER_HOURS = 36;

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
  capture_coverage: PaperTradingCaptureCoverage;
  durable_proof_gate: DurableProofGate;
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
    scheduled_time_utc: "05:12",
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
    scheduled_time_utc: "05:12",
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
    .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at))[0];
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

function buildProofWindow(
  latestRowsByDay: PaperTradingSnapshotRow[],
  captureCoverage: PaperTradingCaptureCoverage
): PaperTradingProofWindow {
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

function durableProofLabel(status: DurableProofStatus): string {
  if (status === "candidate") return "Candidate";
  if (status === "not_qualified") return "Not qualified";
  if (status === "control_only") return "Control only";
  if (status === "stale") return "Stale";
  return "Collecting";
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
      const captureCoverage = buildCaptureCoverage(
        latestRowsByDay,
        captureHealth
      );
      const proofWindow = buildProofWindow(latestRowsByDay, captureCoverage);

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
        proof_window: proofWindow,
        capture_coverage: captureCoverage,
        durable_proof_gate: buildDurableProofGate(
          latest,
          captureCoverage,
          proofWindow,
          captureHealth
        ),
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
      capture_health: unavailableCaptureHealth(
        "Unconfigured",
        "Supabase env is not configured for persisted paper-trading snapshots."
      ),
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
      capture_health: unavailableCaptureHealth(
        isMissingTableError(error) ? "Table missing" : "Error",
        error.message
      ),
      snapshots: [],
      strategy_rollups: [],
    };
  }

  const snapshots = (data ?? []) as unknown as PaperTradingSnapshotRow[];
  const captureHealth = buildPaperTradingCaptureHealth(
    snapshots[0]?.captured_at ?? null
  );
  return {
    status: "available",
    message: "Persisted paper-trading snapshots loaded.",
    latest_captured_at: snapshots[0]?.captured_at ?? null,
    capture_health: captureHealth,
    snapshots,
    strategy_rollups: buildPaperTradingStrategyRollups(snapshots, captureHealth),
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
