import type { PaperTradingAgentEdgeProof } from "@/lib/trading-agent-edge-proof";
import type {
  PaperTradingArtifactHistory,
  PaperTradingEvidenceSla,
  PaperTradingWriteReadiness,
} from "@/lib/trading-artifacts";
import type { ResolutionCatchupPreview } from "@/lib/trading-resolution-catchup";
import { PAPER_TRADING_PROOF_RULES, type TradingSnapshot } from "@/lib/trading";
import type {
  PaperTradingCapitalReviewPacket,
  PaperTradingProofReadiness,
  PaperTradingProofRunway,
  PaperTradingStrategyRegistrySync,
} from "@/lib/trading-snapshots";

export type PaperTradingLabStatusStatus =
  | "reviewable"
  | "collecting"
  | "degraded"
  | "blocked"
  | "unavailable";

export type PaperTradingLabCheckStatus =
  | "pass"
  | "collecting"
  | "warning"
  | "blocked"
  | "unavailable";

export type PaperTradingLabCheck = {
  id:
    | "paper_only_lock"
    | "evidence_sla"
    | "capture_window"
    | "write_mode"
    | "resolution_catchup"
    | "registry_sync"
    | "agent_edge_profitability"
    | "selected_tradability"
    | "selected_agent_edge_proof_lag"
    | "capital_review";
  label: string;
  status: PaperTradingLabCheckStatus;
  status_label: string;
  current: string;
  target: string;
  detail: string;
};

export type PaperTradingLabOperatingPlanStatus =
  | "reviewable"
  | "collecting"
  | "attention"
  | "blocked"
  | "unavailable";

export type PaperTradingLabOperatingPlan = {
  status: PaperTradingLabOperatingPlanStatus;
  status_label: string;
  primary_action: string;
  primary_reason: string;
  primary_check_id: PaperTradingLabCheck["id"] | "operator_review";
  secondary_actions: string[];
  evidence_day: {
    complete_days: number;
    required_days: number;
    days_remaining_to_30: number;
    latest_snapshot_date: string | null;
    latest_captured_at: string | null;
  };
  earliest_capital_review_date: string | null;
  capital_review_allowed: boolean;
  paper_only: true;
  real_money_execution_allowed: false;
};

export type PaperTradingSelectedAgentEdgeProofLag = {
  status:
    | "in_sync"
    | "live_ahead_of_durable"
    | "durable_ahead_of_live"
    | "not_applicable";
  status_label: string;
  source_label: string;
  selected_strategy_id: string;
  selected_strategy_label: string;
  agent_id: string | null;
  agent_name: string | null;
  min_edge: number;
  live_skipped_resolved_trades: number;
  durable_skipped_resolved_trades: number;
  delta_skipped_resolved_trades: number;
  live_skipped_resolved_net_pnl_usd: number;
  durable_skipped_resolved_net_pnl_usd: number;
  delta_skipped_resolved_net_pnl_usd: number;
  missed_pnl_counts_as_proof: false;
  message: string;
};

export type PaperTradingLabStatus = {
  schema_version: "1";
  generated_at: string;
  status: PaperTradingLabStatusStatus;
  status_label: string;
  message: string;
  next_required_action: string;
  operating_plan: PaperTradingLabOperatingPlan;
  execution_recommendation:
    | "keep_paper_trading"
    | "operator_review_only"
    | "repair_evidence";
  paper_only: true;
  real_money_execution_allowed: false;
  capital_review_allowed: boolean;
  selected_strategy: {
    strategy_id: string;
    strategy_label: string;
    sample: string;
    min_edge: number;
    stake_mode: string;
    bankroll_usd: number;
  };
  proof_window: {
    required_days: number;
    complete_days: number;
    partial_days: number;
    missing_days: number;
    days_remaining_to_30: number;
    coverage_ratio: number;
    latest_snapshot_date: string | null;
    latest_captured_at: string | null;
    data_source_status: PaperTradingEvidenceSla["data_source_status"];
    evidence_sla_status: PaperTradingEvidenceSla["status"];
    proof_runway_status: PaperTradingProofRunway["status"];
    artifact_history_status: PaperTradingArtifactHistory["status"];
    write_mode_status: PaperTradingWriteReadiness["status"];
  };
  profitability: {
    source: PaperTradingAgentEdgeProof["source"];
    source_label: string;
    rule_count: number;
    resolved_rule_count: number;
    positive_unproven_rule_count: number;
    proven_profitable_rule_count: number;
    rules_with_minimum_sample: number;
    best_resolved_strategy_id: string | null;
    best_resolved_strategy_label: string | null;
    best_resolved_agent_name: string | null;
    best_resolved_net_pnl_usd: number;
    best_resolved_roi_on_stake: number;
    best_resolved_trades: number;
    guard_status: PaperTradingAgentEdgeProof["profitability_guard"]["status"];
    guard_status_label: string;
  };
  tradability: {
    selected_accepted_resolved_trades: number;
    selected_accepted_open_signals: number;
    selected_bankroll_usd: number;
    selected_accepted_resolved_pnl_usd: number;
    selected_realized_equity_usd: number;
    selected_open_exposure_usd: number;
    selected_open_exposure_pct_of_bankroll: number;
    selected_worst_case_open_loss_usd: number;
    selected_bankroll_after_worst_case_usd: number;
    selected_remaining_open_capacity_usd: number;
    selected_best_case_total_pnl_usd: number;
    selected_model_expected_total_pnl_usd: number;
    selected_break_even_open_wins_required: number | null;
    selected_break_even_open_win_rate_required: number | null;
    selected_peak_open_exposure_usd: number;
    selected_max_open_exposure_usd: number;
    skipped_open_signals: number;
    skipped_resolved_trades: number;
    skipped_profitable_resolved_trades: number;
    skipped_loss_resolved_trades: number;
    skipped_resolved_net_pnl_usd: number;
    capacity_leakage_status:
      | "none"
      | "open_only"
      | "resolved_missed_profit"
      | "resolved_missed_loss"
      | "resolved_mixed";
    missed_pnl_counts_as_proof: false;
    canonical_agent_edge_leakage: {
      rule_count: number;
      source_label: string;
      rules_with_skipped_resolved: number;
      rules_with_profitable_skipped_resolved: number;
      top_missed_strategy_id: string | null;
      top_missed_strategy_label: string | null;
      top_missed_agent_name: string | null;
      top_missed_pnl_usd: number;
      top_missed_resolved_trades: number;
      total_missed_pnl_usd: number;
      missed_pnl_counts_as_proof: false;
    };
    selected_agent_edge_proof_lag: PaperTradingSelectedAgentEdgeProofLag;
  };
  operations: {
    registry_sync_status: PaperTradingStrategyRegistrySync["status"];
    resolution_catchup_status: ResolutionCatchupPreview["status"];
    provider_resolved_market_count: number;
    projected_catchup_pnl_usd: number;
    open_live_signals: number;
    review_required_live_signals: number;
    capital_review_status: PaperTradingCapitalReviewPacket["status"];
    capital_review_decision: PaperTradingCapitalReviewPacket["decision"];
    earliest_capital_review_date: string | null;
  };
  checks: PaperTradingLabCheck[];
  blockers: string[];
  warnings: string[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function selectedProofLagStatusLabel(
  status: PaperTradingSelectedAgentEdgeProofLag["status"],
): string {
  if (status === "live_ahead_of_durable") return "Live ahead of proof source";
  if (status === "durable_ahead_of_live") return "Proof source ahead of live";
  if (status === "not_applicable") return "Not applicable";
  return "In sync";
}

function selectedProofLagMessage(args: {
  status: PaperTradingSelectedAgentEdgeProofLag["status"];
  sourceLabel: string;
  deltaTrades: number;
  deltaPnl: number;
}): string {
  if (args.status === "live_ahead_of_durable") {
    return `The live selected strategy has ${args.deltaTrades} more skipped resolved ticket${args.deltaTrades === 1 ? "" : "s"} than the durable ${args.sourceLabel} proof row. Treat this as proof-source lag; missed P&L still does not count as proof P&L.`;
  }
  if (args.status === "durable_ahead_of_live") {
    return `The durable ${args.sourceLabel} proof row has more skipped resolved leakage than the current selected live replay. Inspect the next capture before relying on the delta.`;
  }
  if (args.status === "not_applicable") {
    return "The selected strategy is not a single canonical agent-edge rule, so there is no direct durable row to compare.";
  }
  return `The selected live strategy and durable ${args.sourceLabel} proof row agree on skipped resolved leakage.`;
}

function buildSelectedAgentEdgeProofLag(args: {
  selectedStrategy: TradingSnapshot["selected_strategy"];
  exposureLedger: TradingSnapshot["selected_exposure_ledger"];
  agentEdgeProof: PaperTradingAgentEdgeProof;
}): PaperTradingSelectedAgentEdgeProofLag {
  const selectedAgentId =
    args.selectedStrategy.agent_ids.length === 1
      ? args.selectedStrategy.agent_ids[0]
      : null;
  const durableRow = selectedAgentId
    ? (args.agentEdgeProof.rows.find(
        (row) =>
          row.agent_id === selectedAgentId &&
          Math.abs(row.min_edge - args.selectedStrategy.min_edge) < 0.000001,
      ) ?? null)
    : null;
  const liveTrades = args.exposureLedger.skipped_resolved_trades;
  const durableTrades = durableRow?.skipped_resolved_trades ?? 0;
  const livePnl = round2(args.exposureLedger.skipped_resolved_net_pnl_usd);
  const durablePnl = round2(durableRow?.skipped_resolved_net_pnl_usd ?? 0);
  const deltaTrades = liveTrades - durableTrades;
  const deltaPnl = round2(livePnl - durablePnl);
  const status: PaperTradingSelectedAgentEdgeProofLag["status"] =
    !selectedAgentId
      ? "not_applicable"
      : deltaTrades > 0 || deltaPnl > 0
        ? "live_ahead_of_durable"
        : deltaTrades < 0 || deltaPnl < 0
          ? "durable_ahead_of_live"
          : "in_sync";

  return {
    status,
    status_label: selectedProofLagStatusLabel(status),
    source_label: args.agentEdgeProof.source_label,
    selected_strategy_id: args.selectedStrategy.id,
    selected_strategy_label: args.selectedStrategy.label,
    agent_id: selectedAgentId,
    agent_name: durableRow?.agent_name ?? null,
    min_edge: args.selectedStrategy.min_edge,
    live_skipped_resolved_trades: liveTrades,
    durable_skipped_resolved_trades: durableTrades,
    delta_skipped_resolved_trades: deltaTrades,
    live_skipped_resolved_net_pnl_usd: livePnl,
    durable_skipped_resolved_net_pnl_usd: durablePnl,
    delta_skipped_resolved_net_pnl_usd: deltaPnl,
    missed_pnl_counts_as_proof: false,
    message: selectedProofLagMessage({
      status,
      sourceLabel: args.agentEdgeProof.source_label,
      deltaTrades: Math.abs(deltaTrades),
      deltaPnl: Math.abs(deltaPnl),
    }),
  };
}

function statusLabel(status: PaperTradingLabStatusStatus): string {
  if (status === "reviewable") return "Reviewable";
  if (status === "degraded") return "Degraded";
  if (status === "blocked") return "Blocked";
  if (status === "unavailable") return "Unavailable";
  return "Collecting";
}

function checkStatusLabel(status: PaperTradingLabCheckStatus): string {
  if (status === "pass") return "Pass";
  if (status === "warning") return "Warning";
  if (status === "blocked") return "Blocked";
  if (status === "unavailable") return "Unavailable";
  return "Collecting";
}

function check(
  item: Omit<PaperTradingLabCheck, "status_label">,
): PaperTradingLabCheck {
  return {
    ...item,
    status_label: checkStatusLabel(item.status),
  };
}

function labStatusMessage(status: PaperTradingLabStatusStatus): string {
  if (status === "reviewable") {
    return "The paper lab has reviewable evidence for operator inspection; execution remains disabled.";
  }
  if (status === "degraded") {
    return "The paper lab is collecting usable evidence, but at least one warning needs attention before proof claims are trusted.";
  }
  if (status === "blocked") {
    return "The paper lab has a blocker that must be repaired before the proof window is trusted.";
  }
  if (status === "unavailable") {
    return "The paper lab does not have enough usable evidence sources to report proof status.";
  }
  return "The paper lab is collecting live-only evidence toward the 30-day proof window.";
}

function capacityLeakageStatus(
  skippedOpenSignals: number,
  skippedResolvedTrades: number,
  skippedProfitableResolvedTrades: number,
  skippedLossResolvedTrades: number,
): PaperTradingLabStatus["tradability"]["capacity_leakage_status"] {
  if (skippedResolvedTrades === 0) {
    return skippedOpenSignals > 0 ? "open_only" : "none";
  }
  if (skippedProfitableResolvedTrades > 0 && skippedLossResolvedTrades > 0) {
    return "resolved_mixed";
  }
  if (skippedProfitableResolvedTrades > 0) return "resolved_missed_profit";
  if (skippedLossResolvedTrades > 0) return "resolved_missed_loss";
  return "resolved_mixed";
}

function resolutionCheckStatus(
  status: ResolutionCatchupPreview["status"],
): PaperTradingLabCheckStatus {
  if (status === "clear") return "pass";
  if (status === "provider_pending") return "collecting";
  if (status === "resolver_lag") return "warning";
  if (status === "error") return "blocked";
  return "warning";
}

function registryCheckStatus(
  status: PaperTradingStrategyRegistrySync["status"],
): PaperTradingLabCheckStatus {
  if (status === "synced") return "pass";
  if (status === "pending_capture") return "collecting";
  return "unavailable";
}

function evidenceCheckStatus(
  status: PaperTradingEvidenceSla["status"],
): PaperTradingLabCheckStatus {
  if (status === "on_track") return "pass";
  if (status === "collecting") return "collecting";
  if (status === "degraded") return "warning";
  if (status === "blocked") return "blocked";
  return "unavailable";
}

function writeModeCheckStatus(args: {
  status: PaperTradingWriteReadiness["status"];
  evidenceSla: PaperTradingEvidenceSla;
}): PaperTradingLabCheckStatus {
  const primaryPersistedEvidenceFresh =
    args.status === "artifact_only" &&
    args.evidenceSla.data_source_status === "supabase_and_artifacts" &&
    args.evidenceSla.status !== "blocked" &&
    args.evidenceSla.status !== "unavailable";

  if (primaryPersistedEvidenceFresh) return "collecting";
  if (args.status === "persisting") return "pass";
  if (args.status === "artifact_only") return "warning";
  return "warning";
}

function capitalCheckStatus(
  status: PaperTradingCapitalReviewPacket["status"],
): PaperTradingLabCheckStatus {
  if (status === "reviewable_paper_candidate") return "pass";
  if (status === "unavailable") return "warning";
  return "collecting";
}

function operatingPlanStatusLabel(
  status: PaperTradingLabOperatingPlanStatus,
): string {
  if (status === "reviewable") return "Ready for operator review";
  if (status === "attention") return "Needs attention";
  if (status === "blocked") return "Blocked";
  if (status === "unavailable") return "Unavailable";
  return "Keep collecting";
}

function uniqueActions(actions: string[]): string[] {
  return actions
    .map((action) => action.trim())
    .filter((action) => action.length > 0)
    .filter((action, index, list) => list.indexOf(action) === index);
}

function buildOperatingPlan(args: {
  status: PaperTradingLabStatusStatus;
  checks: PaperTradingLabCheck[];
  evidenceSla: PaperTradingEvidenceSla;
  proofRunway: PaperTradingProofRunway;
  capitalReviewPacket: PaperTradingCapitalReviewPacket;
  agentEdgeProof: PaperTradingAgentEdgeProof;
}): PaperTradingLabOperatingPlan {
  const blocker = args.checks.find(
    (item) => item.status === "blocked" || item.status === "unavailable",
  );
  const warningActions = uniqueActions(
    args.checks
      .filter((item) => item.status === "warning")
      .map((item) => `${item.label}: ${item.detail}`),
  ).slice(0, 4);
  const evidenceSlaCheck =
    args.checks.find((item) => item.id === "evidence_sla") ?? null;

  let operatingStatus: PaperTradingLabOperatingPlanStatus =
    warningActions.length ? "attention" : "collecting";
  let primaryAction = args.evidenceSla.next_required_action;
  let primaryReason =
    "The 30-day proof window is the gating evidence source for any future capital discussion.";
  let primaryCheckId: PaperTradingLabOperatingPlan["primary_check_id"] =
    "capture_window";

  if (blocker) {
    operatingStatus =
      blocker.status === "unavailable" ? "unavailable" : "blocked";
    primaryAction = blocker.detail;
    primaryReason = `${blocker.label} is preventing the paper lab from producing trustworthy evidence.`;
    primaryCheckId = blocker.id;
  } else if (args.status === "reviewable") {
    operatingStatus = "reviewable";
    primaryAction = args.capitalReviewPacket.decision_summary;
    primaryReason =
      "The paper proof gates are reviewable; execution still remains disabled in this app.";
    primaryCheckId = "operator_review";
  } else if (evidenceSlaCheck?.status === "warning") {
    primaryAction = evidenceSlaCheck.detail;
    primaryReason =
      "The evidence SLA has a warning, so repair or account for that before treating the proof window as clean.";
    primaryCheckId = "evidence_sla";
  } else if (
    args.evidenceSla.days_remaining_to_30 > 0 ||
    args.evidenceSla.status === "collecting"
  ) {
    primaryAction = args.evidenceSla.next_required_action;
    primaryReason =
      "Daily capture coverage is still filling, so warnings are secondary unless they block capture quality.";
    primaryCheckId = "capture_window";
  } else if (args.agentEdgeProof.profitability_guard.status !== "reviewable") {
    primaryAction =
      args.agentEdgeProof.profitability_guard.next_required_action;
    primaryReason =
      "The capture window is no longer the limiting factor; resolved rule-level profitability is.";
    primaryCheckId = "agent_edge_profitability";
  } else if (args.proofRunway.status !== "reviewable") {
    primaryAction =
      args.proofRunway.blocker_summary ||
      args.capitalReviewPacket.next_required_action;
    primaryReason =
      "The proof runway still has a milestone that must clear before operator review.";
    primaryCheckId = "capital_review";
  } else {
    primaryAction = args.capitalReviewPacket.next_required_action;
    primaryReason =
      "The remaining gate is the capital-review boundary; no execution path is enabled.";
    primaryCheckId = "capital_review";
  }

  return {
    status: operatingStatus,
    status_label: operatingPlanStatusLabel(operatingStatus),
    primary_action: primaryAction,
    primary_reason: primaryReason,
    primary_check_id: primaryCheckId,
    secondary_actions: warningActions,
    evidence_day: {
      complete_days: args.evidenceSla.complete_days,
      required_days: PAPER_TRADING_PROOF_RULES.requiredLiveDays,
      days_remaining_to_30: args.evidenceSla.days_remaining_to_30,
      latest_snapshot_date: args.evidenceSla.latest_snapshot_date,
      latest_captured_at: args.evidenceSla.latest_captured_at,
    },
    earliest_capital_review_date:
      args.capitalReviewPacket.earliest_capital_review_date,
    capital_review_allowed: args.capitalReviewPacket.capital_review_allowed,
    paper_only: true,
    real_money_execution_allowed: false,
  };
}

function labStatusFromChecks(args: {
  checks: PaperTradingLabCheck[];
  evidenceSla: PaperTradingEvidenceSla;
  capitalReviewPacket: PaperTradingCapitalReviewPacket;
  agentEdgeProof: PaperTradingAgentEdgeProof;
}): PaperTradingLabStatusStatus {
  if (args.checks.some((item) => item.status === "unavailable")) {
    return "unavailable";
  }
  if (args.checks.some((item) => item.status === "blocked")) {
    return "blocked";
  }
  if (args.checks.some((item) => item.status === "warning")) {
    return "degraded";
  }
  if (
    args.capitalReviewPacket.status === "reviewable_paper_candidate" &&
    args.evidenceSla.status === "on_track" &&
    args.agentEdgeProof.profitability_guard.status === "reviewable"
  ) {
    return "reviewable";
  }
  return "collecting";
}

export function buildPaperTradingLabStatus(args: {
  snapshot: TradingSnapshot;
  registrySync: PaperTradingStrategyRegistrySync;
  proofReadiness: PaperTradingProofReadiness;
  proofRunway: PaperTradingProofRunway;
  capitalReviewPacket: PaperTradingCapitalReviewPacket;
  writeReadiness: PaperTradingWriteReadiness;
  artifactHistory: PaperTradingArtifactHistory;
  evidenceSla: PaperTradingEvidenceSla;
  agentEdgeProof: PaperTradingAgentEdgeProof;
  resolutionCatchupPreview: ResolutionCatchupPreview;
  generatedAt?: string;
}): PaperTradingLabStatus {
  const selectedStrategy = args.snapshot.selected_strategy;
  const exposureLedger = args.snapshot.selected_exposure_ledger;
  const durableCapacityLeakage = args.agentEdgeProof.capacity_leakage;
  const topMissedAgentEdgeRule = durableCapacityLeakage.top_missed_rule;
  const selectedAgentEdgeProofLag = buildSelectedAgentEdgeProofLag({
    selectedStrategy,
    exposureLedger,
    agentEdgeProof: args.agentEdgeProof,
  });
  const leakageStatus = capacityLeakageStatus(
    exposureLedger.skipped_open_signals,
    exposureLedger.skipped_resolved_trades,
    exposureLedger.skipped_profitable_resolved_trades,
    exposureLedger.skipped_loss_resolved_trades,
  );
  const bestResolvedRule = args.agentEdgeProof.best_resolved_rule;

  const checks = [
    check({
      id: "paper_only_lock",
      label: "Paper-only lock",
      status:
        args.proofReadiness.real_money_execution_allowed === false &&
        args.capitalReviewPacket.real_money_execution_allowed === false &&
        args.agentEdgeProof.real_money_execution_allowed === false
          ? "pass"
          : "blocked",
      current: "execution disabled",
      target: "no wallet, order, leverage, or live execution path",
      detail:
        "Every composed proof source must keep real_money_execution_allowed false.",
    }),
    check({
      id: "evidence_sla",
      label: "Evidence SLA",
      status: evidenceCheckStatus(args.evidenceSla.status),
      current: args.evidenceSla.status_label,
      target: "on track or still collecting without violations",
      detail: args.evidenceSla.next_required_action,
    }),
    check({
      id: "capture_window",
      label: "30-day capture window",
      status:
        args.evidenceSla.complete_days >=
        PAPER_TRADING_PROOF_RULES.requiredLiveDays
          ? "pass"
          : "collecting",
      current: `${args.evidenceSla.complete_days}/${PAPER_TRADING_PROOF_RULES.requiredLiveDays} complete days`,
      target: `${PAPER_TRADING_PROOF_RULES.requiredLiveDays} complete live proof days`,
      detail: `Collect ${args.evidenceSla.days_remaining_to_30} more complete daily proof captures.`,
    }),
    check({
      id: "write_mode",
      label: "Write mode",
      status: writeModeCheckStatus({
        status: args.writeReadiness.status,
        evidenceSla: args.evidenceSla,
      }),
      current: args.writeReadiness.status_label,
      target: "persisting Supabase rows plus public artifact fallback",
      detail:
        args.writeReadiness.status === "artifact_only" &&
        args.evidenceSla.data_source_status === "supabase_and_artifacts" &&
        args.evidenceSla.status !== "blocked" &&
        args.evidenceSla.status !== "unavailable"
          ? "Primary Supabase proof rows are fresh; GitHub artifacts remain a read-only public fallback."
          : args.writeReadiness.next_required_action,
    }),
    check({
      id: "resolution_catchup",
      label: "Resolution catch-up",
      status: resolutionCheckStatus(args.resolutionCatchupPreview.status),
      current: args.resolutionCatchupPreview.status_label,
      target: "no provider-resolved unscored live markets",
      detail: args.resolutionCatchupPreview.next_required_action,
    }),
    check({
      id: "registry_sync",
      label: "Strategy registry",
      status: registryCheckStatus(args.registrySync.status),
      current: args.registrySync.status_label,
      target: "latest daily proof captured the current live strategy registry",
      detail: args.registrySync.message,
    }),
    check({
      id: "agent_edge_profitability",
      label: "Agent-edge profitability",
      status:
        args.agentEdgeProof.profitability_guard.status === "reviewable"
          ? "pass"
          : args.agentEdgeProof.profitability_guard.status === "unavailable"
            ? "unavailable"
            : "collecting",
      current: args.agentEdgeProof.profitability_guard.status_label,
      target: "at least one rule clears sample, P&L, ROI, and drawdown gates",
      detail: args.agentEdgeProof.profitability_guard.next_required_action,
    }),
    check({
      id: "selected_tradability",
      label: "Selected strategy tradability",
      status:
        leakageStatus === "resolved_missed_profit" ||
        leakageStatus === "resolved_mixed"
          ? "warning"
          : "pass",
      current:
        exposureLedger.skipped_resolved_trades > 0
          ? `${exposureLedger.skipped_resolved_trades} skipped resolved / $${exposureLedger.skipped_resolved_net_pnl_usd.toFixed(2)} missed`
          : `${exposureLedger.skipped_open_signals} skipped open`,
      target: "profitable rules count only accepted, exposure-capped trades",
      detail:
        exposureLedger.skipped_resolved_trades > 0
          ? "Skipped resolved P&L is capacity leakage, not proof P&L."
          : "No skipped resolved ticket is inflating proof P&L.",
    }),
    check({
      id: "selected_agent_edge_proof_lag",
      label: "Selected proof source lag",
      status:
        selectedAgentEdgeProofLag.status === "live_ahead_of_durable" ||
        selectedAgentEdgeProofLag.status === "durable_ahead_of_live"
          ? "warning"
          : "pass",
      current:
        selectedAgentEdgeProofLag.status === "not_applicable"
          ? "no direct canonical row"
          : `live ${selectedAgentEdgeProofLag.live_skipped_resolved_trades} / durable ${selectedAgentEdgeProofLag.durable_skipped_resolved_trades}`,
      target:
        "current selected leakage matches the durable agent-edge proof source",
      detail: selectedAgentEdgeProofLag.message,
    }),
    check({
      id: "capital_review",
      label: "Capital review",
      status: capitalCheckStatus(args.capitalReviewPacket.status),
      current: args.capitalReviewPacket.status_label,
      target: "operator review only after the full paper proof gate",
      detail: args.capitalReviewPacket.next_required_action,
    }),
  ];

  const status = labStatusFromChecks({
    checks,
    evidenceSla: args.evidenceSla,
    capitalReviewPacket: args.capitalReviewPacket,
    agentEdgeProof: args.agentEdgeProof,
  });
  const blockers = checks
    .filter(
      (item) => item.status === "blocked" || item.status === "unavailable",
    )
    .map((item) => `${item.label}: ${item.detail}`);
  const warnings = checks
    .filter((item) => item.status === "warning")
    .map((item) => `${item.label}: ${item.detail}`);
  const operatingPlan = buildOperatingPlan({
    status,
    checks,
    evidenceSla: args.evidenceSla,
    proofRunway: args.proofRunway,
    capitalReviewPacket: args.capitalReviewPacket,
    agentEdgeProof: args.agentEdgeProof,
  });

  return {
    schema_version: "1",
    generated_at: args.generatedAt ?? new Date().toISOString(),
    status,
    status_label: statusLabel(status),
    message: labStatusMessage(status),
    next_required_action: operatingPlan.primary_action,
    operating_plan: operatingPlan,
    execution_recommendation:
      status === "reviewable"
        ? "operator_review_only"
        : status === "blocked" || status === "unavailable"
          ? "repair_evidence"
          : "keep_paper_trading",
    paper_only: true,
    real_money_execution_allowed: false,
    capital_review_allowed: args.capitalReviewPacket.capital_review_allowed,
    selected_strategy: {
      strategy_id: selectedStrategy.id,
      strategy_label: selectedStrategy.label,
      sample: selectedStrategy.sample,
      min_edge: selectedStrategy.min_edge,
      stake_mode: selectedStrategy.stake_mode,
      bankroll_usd: selectedStrategy.bankroll_usd,
    },
    proof_window: {
      required_days: PAPER_TRADING_PROOF_RULES.requiredLiveDays,
      complete_days: args.evidenceSla.complete_days,
      partial_days: args.evidenceSla.partial_days,
      missing_days: args.evidenceSla.missing_days,
      days_remaining_to_30: args.evidenceSla.days_remaining_to_30,
      coverage_ratio: args.evidenceSla.coverage_ratio,
      latest_snapshot_date: args.evidenceSla.latest_snapshot_date,
      latest_captured_at: args.evidenceSla.latest_captured_at,
      data_source_status: args.evidenceSla.data_source_status,
      evidence_sla_status: args.evidenceSla.status,
      proof_runway_status: args.proofRunway.status,
      artifact_history_status: args.artifactHistory.status,
      write_mode_status: args.writeReadiness.status,
    },
    profitability: {
      source: args.agentEdgeProof.source,
      source_label: args.agentEdgeProof.source_label,
      rule_count: args.agentEdgeProof.rule_count,
      resolved_rule_count: args.agentEdgeProof.rows.filter(
        (row) => row.resolved_trades > 0,
      ).length,
      positive_unproven_rule_count:
        args.agentEdgeProof.positive_unproven_rule_count,
      proven_profitable_rule_count:
        args.agentEdgeProof.profitability_guard.rules_with_profitability_proven,
      rules_with_minimum_sample:
        args.agentEdgeProof.profitability_guard.rules_with_minimum_sample,
      best_resolved_strategy_id: bestResolvedRule?.strategy_id ?? null,
      best_resolved_strategy_label: bestResolvedRule?.strategy_label ?? null,
      best_resolved_agent_name: bestResolvedRule?.agent_name ?? null,
      best_resolved_net_pnl_usd: round2(bestResolvedRule?.window_pnl_usd ?? 0),
      best_resolved_roi_on_stake: bestResolvedRule?.window_roi_on_stake ?? 0,
      best_resolved_trades: bestResolvedRule?.resolved_trades ?? 0,
      guard_status: args.agentEdgeProof.profitability_guard.status,
      guard_status_label: args.agentEdgeProof.profitability_guard.status_label,
    },
    tradability: {
      selected_accepted_resolved_trades:
        exposureLedger.accepted_resolved_trades,
      selected_accepted_open_signals: exposureLedger.accepted_open_signals,
      selected_bankroll_usd: args.snapshot.selected_bankroll_risk.bankroll_usd,
      selected_accepted_resolved_pnl_usd: round2(
        exposureLedger.accepted_resolved_net_pnl_usd,
      ),
      selected_realized_equity_usd:
        args.snapshot.selected_bankroll_risk.realized_equity_usd,
      selected_open_exposure_usd: exposureLedger.current_open_exposure_usd,
      selected_open_exposure_pct_of_bankroll:
        args.snapshot.selected_bankroll_risk.open_exposure_pct_of_bankroll,
      selected_worst_case_open_loss_usd:
        args.snapshot.selected_bankroll_risk.worst_case_open_loss_usd,
      selected_bankroll_after_worst_case_usd:
        args.snapshot.selected_bankroll_risk.bankroll_after_worst_case_usd,
      selected_remaining_open_capacity_usd:
        args.snapshot.selected_bankroll_risk.remaining_open_capacity_usd,
      selected_best_case_total_pnl_usd:
        args.snapshot.selected_open_outcome_scenarios.scenarios.find(
          (scenario) => scenario.id === "best_case",
        )?.total_pnl_usd ?? 0,
      selected_model_expected_total_pnl_usd:
        args.snapshot.selected_open_outcome_scenarios.scenarios.find(
          (scenario) => scenario.id === "model_expected",
        )?.total_pnl_usd ?? 0,
      selected_break_even_open_wins_required:
        args.snapshot.selected_open_outcome_scenarios
          .break_even_open_wins_required,
      selected_break_even_open_win_rate_required:
        args.snapshot.selected_open_outcome_scenarios
          .break_even_open_win_rate_required,
      selected_peak_open_exposure_usd: exposureLedger.peak_open_exposure_usd,
      selected_max_open_exposure_usd: exposureLedger.max_open_exposure_usd,
      skipped_open_signals: exposureLedger.skipped_open_signals,
      skipped_resolved_trades: exposureLedger.skipped_resolved_trades,
      skipped_profitable_resolved_trades:
        exposureLedger.skipped_profitable_resolved_trades,
      skipped_loss_resolved_trades: exposureLedger.skipped_loss_resolved_trades,
      skipped_resolved_net_pnl_usd: round2(
        exposureLedger.skipped_resolved_net_pnl_usd,
      ),
      capacity_leakage_status: leakageStatus,
      missed_pnl_counts_as_proof: false,
      canonical_agent_edge_leakage: {
        rule_count: args.agentEdgeProof.rule_count,
        source_label: args.agentEdgeProof.source_label,
        rules_with_skipped_resolved:
          durableCapacityLeakage.rules_with_skipped_resolved,
        rules_with_profitable_skipped_resolved:
          durableCapacityLeakage.rules_with_profitable_skipped_resolved,
        top_missed_strategy_id: topMissedAgentEdgeRule?.strategy_id ?? null,
        top_missed_strategy_label:
          topMissedAgentEdgeRule?.strategy_label ?? null,
        top_missed_agent_name: topMissedAgentEdgeRule?.agent_name ?? null,
        top_missed_pnl_usd: round2(
          topMissedAgentEdgeRule?.skipped_resolved_net_pnl_usd ?? 0,
        ),
        top_missed_resolved_trades:
          topMissedAgentEdgeRule?.skipped_resolved_trades ?? 0,
        total_missed_pnl_usd: round2(
          durableCapacityLeakage.skipped_resolved_net_pnl_usd,
        ),
        missed_pnl_counts_as_proof: false,
      },
      selected_agent_edge_proof_lag: selectedAgentEdgeProofLag,
    },
    operations: {
      registry_sync_status: args.registrySync.status,
      resolution_catchup_status: args.resolutionCatchupPreview.status,
      provider_resolved_market_count:
        args.resolutionCatchupPreview.provider_resolved_market_count,
      projected_catchup_pnl_usd: round2(
        args.resolutionCatchupPreview.projected_resolved_pnl_usd,
      ),
      open_live_signals: args.snapshot.resolution_watch.open_live_signals,
      review_required_live_signals:
        args.snapshot.resolution_watch.review_required_live_signals,
      capital_review_status: args.capitalReviewPacket.status,
      capital_review_decision: args.capitalReviewPacket.decision,
      earliest_capital_review_date:
        args.capitalReviewPacket.earliest_capital_review_date,
    },
    checks,
    blockers,
    warnings,
  };
}
