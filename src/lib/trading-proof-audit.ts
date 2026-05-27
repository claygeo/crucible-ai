import {
  PAPER_TRADING_PROOF_RULES,
  type TradingControls,
  type TradingSnapshot,
} from "@/lib/trading";
import type {
  PaperTradingPersistenceRead,
  PaperTradingProofReadiness,
  PaperTradingProofReadinessStatus,
  PaperTradingProofRunway,
  PaperTradingStrategyRegistrySync,
} from "@/lib/trading-snapshots";

export type PaperTradingProofAuditStatus =
  | "pass"
  | "collecting"
  | "blocked"
  | "unavailable";

export type PaperTradingProofAuditCheck = {
  id: string;
  label: string;
  status: PaperTradingProofAuditStatus;
  current: string;
  target: string;
  detail: string;
};

export type PaperTradingProofAudit = {
  generated_at: string;
  verdict: PaperTradingProofAuditStatus;
  verdict_label: string;
  ready_for_capital_review: boolean;
  exit_code: 0 | 1;
  loaded_env_files: string[];
  source: TradingSnapshot["source"];
  controls: TradingControls;
  proof_rules: typeof PAPER_TRADING_PROOF_RULES;
  summary: {
    live_strategy_count: number;
    best_live_strategy_label: string | null;
    captured_days: number;
    resolved_live_trades: number;
    window_pnl_usd: number;
    window_roi_on_stake: number;
    open_live_signals: number;
    overdue_live_signals: number;
    earliest_capital_review_at: string | null;
  };
  readiness: PaperTradingProofReadiness;
  runway: PaperTradingProofRunway;
  failed_checks: string[];
  checks: PaperTradingProofAuditCheck[];
};

function statusRank(status: PaperTradingProofAuditStatus): number {
  if (status === "blocked") return 0;
  if (status === "unavailable") return 1;
  if (status === "collecting") return 2;
  return 3;
}

function readinessToAudit(
  status: PaperTradingProofReadinessStatus
): PaperTradingProofAuditStatus {
  return status;
}

function check(
  id: string,
  label: string,
  status: PaperTradingProofAuditStatus,
  current: string,
  target: string,
  detail: string
): PaperTradingProofAuditCheck {
  return { id, label, status, current, target, detail };
}

function verdictFromChecks(
  checks: PaperTradingProofAuditCheck[]
): PaperTradingProofAuditStatus {
  return checks.reduce<PaperTradingProofAuditStatus>((worst, item) => {
    return statusRank(item.status) < statusRank(worst) ? item.status : worst;
  }, "pass");
}

function statusLabel(status: PaperTradingProofAuditStatus): string {
  if (status === "pass") return "Pass";
  if (status === "blocked") return "Blocked";
  if (status === "unavailable") return "Unavailable";
  return "Collecting";
}

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function buildPaperTradingProofAudit(args: {
  snapshot: TradingSnapshot;
  persisted: PaperTradingPersistenceRead;
  registrySync: PaperTradingStrategyRegistrySync;
  readiness: PaperTradingProofReadiness;
  runway: PaperTradingProofRunway;
  controls: TradingControls;
  loadedEnvFiles?: string[];
  soft?: boolean;
  generatedAt?: string;
}): PaperTradingProofAudit {
  const evidenceWindowReady =
    args.persisted.capture_calendar.complete_days >=
      PAPER_TRADING_PROOF_RULES.requiredLiveDays &&
    args.persisted.capture_calendar.missing_days === 0 &&
    args.persisted.capture_calendar.partial_days === 0 &&
    args.persisted.proof_summary.best_live_resolved_trades >=
      PAPER_TRADING_PROOF_RULES.requiredResolvedTrades;

  const checks: PaperTradingProofAuditCheck[] = [
    check(
      "paper_only_lock",
      "Paper-only lock",
      args.readiness.paper_only &&
        args.runway.paper_only &&
        args.persisted.proof_summary.paper_only &&
        !args.readiness.real_money_execution_allowed &&
        !args.runway.real_money_execution_allowed &&
        !args.persisted.proof_summary.real_money_execution_allowed
        ? "pass"
        : "blocked",
      args.persisted.proof_summary.real_money_execution_allowed
        ? "execution enabled"
        : "execution disabled",
      "execution disabled everywhere",
      "The audit must never pass if any surface allows real-money execution."
    ),
    check(
      "live_data_source",
      "Live data source",
      args.snapshot.source === "live" ? "pass" : "unavailable",
      args.snapshot.source,
      "live",
      "Demo-sourced analytics cannot support capital review."
    ),
    check(
      "persisted_archive",
      "Persisted proof archive",
      args.persisted.status === "available" ? "pass" : "unavailable",
      args.persisted.status,
      "available",
      args.persisted.message
    ),
    check(
      "capture_freshness",
      "Capture freshness",
      args.persisted.capture_health.status === "fresh"
        ? "pass"
        : args.persisted.capture_health.status === "waiting_first_capture"
          ? "collecting"
          : args.persisted.capture_health.status === "stale"
            ? "blocked"
            : "unavailable",
      args.persisted.capture_health.status_label,
      "fresh",
      args.persisted.capture_health.message
    ),
    check(
      "registry_sync",
      "Strategy registry sync",
      args.registrySync.status === "synced"
        ? "pass"
        : args.registrySync.status === "pending_capture"
          ? "collecting"
          : "unavailable",
      `${args.registrySync.persisted_latest_live_strategy_count}/${args.registrySync.current_live_strategy_count} live`,
      "current live registry captured",
      args.registrySync.message
    ),
    check(
      "resolution_hygiene",
      "Resolution hygiene",
      args.snapshot.resolution_watch.overdue_live_signals > 0
        ? "blocked"
        : "pass",
      `${args.snapshot.resolution_watch.overdue_live_signals} overdue / ${args.snapshot.resolution_watch.open_live_signals} open`,
      "0 overdue live paper markets",
      "Open EV is not realized profit; overdue markets must be resolved or investigated."
    ),
    check(
      "capture_window",
      "30-day capture window",
      args.persisted.capture_calendar.status === "unavailable"
        ? "unavailable"
        : args.persisted.capture_calendar.missing_days > 0 ||
            args.persisted.capture_calendar.partial_days > 0
          ? "blocked"
          : args.persisted.capture_calendar.complete_days >=
              PAPER_TRADING_PROOF_RULES.requiredLiveDays
            ? "pass"
            : "collecting",
      `${args.persisted.capture_calendar.complete_days}/${PAPER_TRADING_PROOF_RULES.requiredLiveDays} complete days`,
      `${PAPER_TRADING_PROOF_RULES.requiredLiveDays} complete days, 0 missing`,
      `${args.persisted.capture_calendar.missing_days} missing, ${args.persisted.capture_calendar.partial_days} partial.`
    ),
    check(
      "resolved_live_trades",
      "Resolved live trades",
      args.persisted.proof_summary.status === "unavailable"
        ? "unavailable"
        : args.persisted.proof_summary.best_live_resolved_trades >=
            PAPER_TRADING_PROOF_RULES.requiredResolvedTrades
          ? "pass"
          : "collecting",
      `${args.persisted.proof_summary.best_live_resolved_trades}/${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades}`,
      `${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades} resolved live paper trades`,
      args.persisted.proof_summary.best_live_strategy_label
        ? `Best live rollup: ${args.persisted.proof_summary.best_live_strategy_label}.`
        : "No live rollup is available yet."
    ),
    check(
      "window_pnl",
      "Positive window P&L",
      !evidenceWindowReady
        ? "collecting"
        : args.persisted.proof_summary.best_live_window_pnl_usd >=
              PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd
          ? "pass"
          : "blocked",
      money(args.persisted.proof_summary.best_live_window_pnl_usd),
      `>= ${money(PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd)}`,
      "Judged only after enough captured days and resolved live trades exist."
    ),
    check(
      "window_roi",
      "Positive window ROI",
      !evidenceWindowReady
        ? "collecting"
        : args.persisted.proof_summary.best_live_window_roi_on_stake >
              PAPER_TRADING_PROOF_RULES.minRoiOnStake
          ? "pass"
          : "blocked",
      `${(args.persisted.proof_summary.best_live_window_roi_on_stake * 100).toFixed(1)}%`,
      `> ${(PAPER_TRADING_PROOF_RULES.minRoiOnStake * 100).toFixed(1)}%`,
      "Judged only after the proof window is complete."
    ),
    check(
      "drawdown",
      "Drawdown limit",
      !evidenceWindowReady
        ? "collecting"
        : args.persisted.proof_summary.best_live_blockers.some((blocker) =>
              blocker.toLowerCase().includes("drawdown")
            )
          ? "blocked"
          : "pass",
      "tracked in rollups",
      `<= ${money(PAPER_TRADING_PROOF_RULES.maxDrawdownUsd)}`,
      "Drawdown blockers come from the durable proof gate."
    ),
    check(
      "capital_review_boundary",
      "Capital review boundary",
      args.readiness.ready_for_capital_review &&
        args.persisted.proof_summary.capital_review_status === "reviewable"
        ? "pass"
        : args.persisted.proof_summary.capital_review_status === "unavailable"
          ? "unavailable"
          : "collecting",
      args.persisted.proof_summary.capital_review_status_label,
      "reviewable candidate, execution still disabled",
      args.readiness.next_required_action
    ),
    check(
      "readiness_contract",
      "Readiness contract",
      readinessToAudit(args.readiness.status),
      args.readiness.status_label,
      "Ready for review",
      args.readiness.next_required_action
    ),
  ];

  const verdict = verdictFromChecks(checks);
  const failedChecks = checks.filter((item) => item.status !== "pass");
  const exitCode = verdict === "pass" || args.soft ? 0 : 1;

  return {
    generated_at: args.generatedAt ?? new Date().toISOString(),
    verdict,
    verdict_label: statusLabel(verdict),
    ready_for_capital_review: verdict === "pass",
    exit_code: exitCode,
    loaded_env_files: args.loadedEnvFiles ?? [],
    source: args.snapshot.source,
    controls: args.controls,
    proof_rules: PAPER_TRADING_PROOF_RULES,
    summary: {
      live_strategy_count: args.persisted.proof_summary.live_strategy_count,
      best_live_strategy_label:
        args.persisted.proof_summary.best_live_strategy_label,
      captured_days: args.persisted.proof_summary.best_live_captured_days,
      resolved_live_trades:
        args.persisted.proof_summary.best_live_resolved_trades,
      window_pnl_usd: args.persisted.proof_summary.best_live_window_pnl_usd,
      window_roi_on_stake:
        args.persisted.proof_summary.best_live_window_roi_on_stake,
      open_live_signals: args.snapshot.resolution_watch.open_live_signals,
      overdue_live_signals:
        args.snapshot.resolution_watch.overdue_live_signals,
      earliest_capital_review_at: args.runway.earliest_capital_review_at,
    },
    readiness: args.readiness,
    runway: args.runway,
    failed_checks: failedChecks.map((item) => item.id),
    checks,
  };
}
