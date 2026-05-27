import { PAPER_TRADING_PROOF_RULES } from "@/lib/trading";
import type {
  AgentEdgeOpenSignalWatchlist,
  AgentEdgeOpenSignalWatchlistRule,
  AgentEdgeProofRunway,
  AgentEdgeProofRunwayRule,
  AgentEdgeResolvedTradeLedger,
  AgentEdgeResolvedTradeLedgerRule,
} from "@/lib/trading";
import type {
  PaperTradingAgentEdgeEvidenceRule,
  PaperTradingAgentEdgeEvidenceTimeline,
} from "@/lib/trading-agent-edge-evidence";
import type {
  PaperTradingAgentEdgeProof,
  PaperTradingAgentEdgeProofLeaderboardRow,
} from "@/lib/trading-agent-edge-proof";

export type PaperTradingAgentEdgeDossierCheckStatus =
  | "pass"
  | "collecting"
  | "blocked"
  | "unavailable";

export type PaperTradingAgentEdgeDossierCheck = {
  id: string;
  label: string;
  status: PaperTradingAgentEdgeDossierCheckStatus;
  current: string;
  target: string;
  detail: string;
};

export type PaperTradingAgentEdgeDossierSelection = {
  strategy_id: string | null;
  strategy_label: string | null;
  agent_id: string | null;
  agent_name: string | null;
  min_edge: number | null;
  selection_source:
    | "query"
    | "best_resolved_rule"
    | "best_open_ev_rule"
    | "ranked_rule"
    | "none";
};

export type PaperTradingAgentEdgeDossier = {
  schema_version: "1";
  generated_at: string;
  status: "reviewable" | "collecting" | "unavailable";
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  execution_recommendation: "paper_only_review";
  ready_for_operator_review: boolean;
  missed_pnl_counts_as_proof: false;
  selection: PaperTradingAgentEdgeDossierSelection;
  source: PaperTradingAgentEdgeProof["source"];
  source_label: string;
  proof_rule: PaperTradingAgentEdgeProofLeaderboardRow | null;
  evidence_rule: PaperTradingAgentEdgeEvidenceRule | null;
  resolved_ledger_rule: AgentEdgeResolvedTradeLedgerRule | null;
  runway_rule: AgentEdgeProofRunwayRule | null;
  watchlist_rule: AgentEdgeOpenSignalWatchlistRule | null;
  summary: {
    captured_days: number;
    required_captured_days: number;
    missing_capture_days: number;
    resolved_trades: number;
    required_resolved_trades: number;
    resolved_trades_remaining: number;
    window_pnl_usd: number;
    window_roi_on_stake: number;
    max_drawdown_usd: number;
    open_signals: number;
    tradable_open_signals: number;
    pending_resolution_capacity: number;
    sample_gap_after_open: number;
    skipped_resolved_net_pnl_usd: number;
    recent_resolved_trade_count: number;
    recent_evidence_day_count: number;
  };
  open_checks: string[];
  failed_checks: string[];
  checks: PaperTradingAgentEdgeDossierCheck[];
};

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function check(
  id: string,
  label: string,
  status: PaperTradingAgentEdgeDossierCheckStatus,
  current: string,
  target: string,
  detail: string,
): PaperTradingAgentEdgeDossierCheck {
  return { id, label, status, current, target, detail };
}

function statusLabel(status: PaperTradingAgentEdgeDossier["status"]): string {
  if (status === "reviewable") return "Reviewable";
  if (status === "collecting") return "Collecting";
  return "Unavailable";
}

function selectProofRule(args: {
  proof: PaperTradingAgentEdgeProof;
  selectedAgentId?: string | null;
  selectedMinEdge?: number | null;
}): {
  rule: PaperTradingAgentEdgeProofLeaderboardRow | null;
  selectionSource: PaperTradingAgentEdgeDossierSelection["selection_source"];
} {
  if (args.selectedAgentId && typeof args.selectedMinEdge === "number") {
    const queryRule =
      args.proof.rows.find(
        (rule) =>
          rule.agent_id === args.selectedAgentId &&
          rule.min_edge === args.selectedMinEdge,
      ) ?? null;
    if (queryRule) return { rule: queryRule, selectionSource: "query" };
  }

  if (args.proof.best_resolved_rule) {
    return {
      rule: args.proof.best_resolved_rule,
      selectionSource: "best_resolved_rule",
    };
  }
  if (args.proof.best_open_ev_rule) {
    return {
      rule: args.proof.best_open_ev_rule,
      selectionSource: "best_open_ev_rule",
    };
  }
  return {
    rule: args.proof.rows[0] ?? null,
    selectionSource: args.proof.rows[0] ? "ranked_rule" : "none",
  };
}

function byRule<T extends { agent_id: string; min_edge: number }>(
  rows: T[],
  proofRule: PaperTradingAgentEdgeProofLeaderboardRow | null,
): T | null {
  if (!proofRule) return null;
  return (
    rows.find(
      (row) =>
        row.agent_id === proofRule.agent_id &&
        row.min_edge === proofRule.min_edge,
    ) ?? null
  );
}

function buildChecks(args: {
  proofRule: PaperTradingAgentEdgeProofLeaderboardRow | null;
  evidenceRule: PaperTradingAgentEdgeEvidenceRule | null;
  runwayRule: AgentEdgeProofRunwayRule | null;
}): PaperTradingAgentEdgeDossierCheck[] {
  const proof = args.proofRule;
  if (!proof) {
    return [
      check(
        "selected_rule",
        "Selected rule",
        "unavailable",
        "missing",
        "canonical rule available",
        "No canonical agent-edge rule matches this selection.",
      ),
    ];
  }

  const resolvedSampleMet = proof.profitability_evidence.resolved_sample_met;

  return [
    check(
      "capture_window",
      "Capture window",
      proof.profitability_evidence.capture_sample_met ? "pass" : "collecting",
      `${proof.captured_days}/${proof.required_captured_days} days`,
      `${PAPER_TRADING_PROOF_RULES.requiredLiveDays} complete live days`,
      args.evidenceRule
        ? `${args.evidenceRule.recent_days.length} evidence days are attached to this dossier.`
        : "No per-day evidence row is attached yet.",
    ),
    check(
      "resolved_sample",
      "Resolved sample",
      proof.profitability_evidence.resolved_sample_met ? "pass" : "collecting",
      `${proof.resolved_trades}/${proof.required_resolved_trades} tickets`,
      `${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades} resolved paper tickets`,
      args.runwayRule
        ? args.runwayRule.next_required_action
        : "Resolved sample is read from the canonical proof row.",
    ),
    check(
      "positive_pnl",
      "Positive P&L",
      !resolvedSampleMet
        ? "collecting"
        : proof.profitability_evidence.positive_pnl_met
          ? "pass"
          : "blocked",
      money(proof.window_pnl_usd),
      `>= ${money(PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd)}`,
      "Only accepted resolved paper tickets count; missed capacity P&L is excluded.",
    ),
    check(
      "positive_roi",
      "Positive ROI",
      !resolvedSampleMet
        ? "collecting"
        : proof.profitability_evidence.positive_roi_met
          ? "pass"
          : "blocked",
      pct(proof.window_roi_on_stake),
      `> ${pct(PAPER_TRADING_PROOF_RULES.minRoiOnStake)}`,
      "ROI is judged only on resolved accepted stake.",
    ),
    check(
      "drawdown",
      "Drawdown",
      proof.profitability_evidence.drawdown_limit_met ? "pass" : "blocked",
      money(proof.max_drawdown_usd),
      `<= ${money(PAPER_TRADING_PROOF_RULES.maxDrawdownUsd)}`,
      "Drawdown must stay inside the durable proof limit.",
    ),
  ];
}

export function buildPaperTradingAgentEdgeDossier(args: {
  agentEdgeProof: PaperTradingAgentEdgeProof;
  evidenceTimeline: PaperTradingAgentEdgeEvidenceTimeline;
  tradeLedger: AgentEdgeResolvedTradeLedger;
  runway: AgentEdgeProofRunway;
  watchlist: AgentEdgeOpenSignalWatchlist;
  selectedAgentId?: string | null;
  selectedMinEdge?: number | null;
  generatedAt?: string;
}): PaperTradingAgentEdgeDossier {
  const { rule: proofRule, selectionSource } = selectProofRule({
    proof: args.agentEdgeProof,
    selectedAgentId: args.selectedAgentId,
    selectedMinEdge: args.selectedMinEdge,
  });
  const evidenceRule = byRule(args.evidenceTimeline.rules, proofRule);
  const ledgerRule = byRule(args.tradeLedger.rules, proofRule);
  const runwayRule = byRule(args.runway.rules, proofRule);
  const watchlistRule = byRule(args.watchlist.rules, proofRule);
  const checks = buildChecks({
    proofRule,
    evidenceRule,
    runwayRule,
  });
  const openChecks = checks.filter((item) => item.status !== "pass");
  const failedChecks = checks.filter((item) => item.status === "blocked");
  const readyForOperatorReview =
    Boolean(proofRule?.profitability_evidence.profitability_proven) &&
    openChecks.length === 0;
  const status: PaperTradingAgentEdgeDossier["status"] = !proofRule
    ? "unavailable"
    : readyForOperatorReview
      ? "reviewable"
      : "collecting";

  return {
    schema_version: "1",
    generated_at: args.generatedAt ?? new Date().toISOString(),
    status,
    status_label: statusLabel(status),
    message:
      status === "reviewable"
        ? "The selected agent-edge rule has enough paper evidence for operator review."
        : status === "collecting"
          ? "The selected agent-edge rule is still collecting paper evidence."
          : "No selected agent-edge rule dossier is available.",
    next_required_action:
      status === "reviewable"
        ? "Review the resolved tickets and daily evidence; execution remains disabled."
        : (failedChecks[0]?.detail ??
          openChecks[0]?.detail ??
          "Select a canonical agent-edge rule with persisted proof evidence."),
    paper_only: true,
    real_money_execution_allowed: false,
    execution_recommendation: "paper_only_review",
    ready_for_operator_review: readyForOperatorReview,
    missed_pnl_counts_as_proof: false,
    selection: {
      strategy_id: proofRule?.strategy_id ?? null,
      strategy_label: proofRule?.strategy_label ?? null,
      agent_id: proofRule?.agent_id ?? args.selectedAgentId ?? null,
      agent_name: proofRule?.agent_name ?? null,
      min_edge: proofRule?.min_edge ?? args.selectedMinEdge ?? null,
      selection_source: selectionSource,
    },
    source: args.agentEdgeProof.source,
    source_label: args.agentEdgeProof.source_label,
    proof_rule: proofRule,
    evidence_rule: evidenceRule,
    resolved_ledger_rule: ledgerRule,
    runway_rule: runwayRule,
    watchlist_rule: watchlistRule,
    summary: {
      captured_days: proofRule?.captured_days ?? 0,
      required_captured_days:
        proofRule?.required_captured_days ??
        PAPER_TRADING_PROOF_RULES.requiredLiveDays,
      missing_capture_days: proofRule?.missing_capture_days ?? 0,
      resolved_trades: proofRule?.resolved_trades ?? 0,
      required_resolved_trades:
        proofRule?.required_resolved_trades ??
        PAPER_TRADING_PROOF_RULES.requiredResolvedTrades,
      resolved_trades_remaining: evidenceRule?.resolved_trades_remaining ?? 0,
      window_pnl_usd: proofRule?.window_pnl_usd ?? 0,
      window_roi_on_stake: proofRule?.window_roi_on_stake ?? 0,
      max_drawdown_usd: proofRule?.max_drawdown_usd ?? 0,
      open_signals:
        watchlistRule?.open_signals ?? runwayRule?.open_signals ?? 0,
      tradable_open_signals:
        watchlistRule?.tradable_signals ??
        runwayRule?.tradable_open_signals ??
        0,
      pending_resolution_capacity: runwayRule?.pending_resolution_capacity ?? 0,
      sample_gap_after_open: runwayRule?.sample_gap_after_open ?? 0,
      skipped_resolved_net_pnl_usd:
        proofRule?.skipped_resolved_net_pnl_usd ?? 0,
      recent_resolved_trade_count:
        ledgerRule?.recent_resolved_trades.length ?? 0,
      recent_evidence_day_count: evidenceRule?.recent_days.length ?? 0,
    },
    open_checks: openChecks.map((item) => item.id),
    failed_checks: failedChecks.map((item) => item.id),
    checks,
  };
}
