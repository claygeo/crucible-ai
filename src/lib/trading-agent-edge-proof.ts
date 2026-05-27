import type { PublishedPaperTradingArtifactProof } from "@/lib/trading-artifacts";
import { PAPER_TRADING_PROOF_RULES } from "@/lib/trading";
import type {
  DurableProofStatus,
  PaperTradingAgentEdgeProofRow,
  PaperTradingProofQuality,
  PaperTradingProofQualityGrade,
} from "@/lib/trading-snapshots";

export type PaperTradingAgentEdgeProofSource =
  | "supabase"
  | "published_artifact"
  | "none";

export type PaperTradingAgentEdgeProfitabilityStatus =
  | "profitable"
  | "positive_unproven"
  | "flat"
  | "loss_making"
  | "unresolved";

export type PaperTradingAgentEdgeProfitabilityEvidence = {
  status: PaperTradingAgentEdgeProfitabilityStatus;
  status_label: string;
  minimum_sample_met: boolean;
  capture_sample_met: boolean;
  resolved_sample_met: boolean;
  positive_pnl_met: boolean;
  positive_roi_met: boolean;
  drawdown_limit_met: boolean;
  profitability_proven: boolean;
  resolved_trades: number;
  required_resolved_trades: number;
  missing_resolved_trades: number;
  captured_days: number;
  required_captured_days: number;
  missing_capture_days: number;
  net_pnl_usd: number;
  roi_on_stake: number;
  max_drawdown_usd: number;
  max_allowed_drawdown_usd: number;
  blockers: string[];
};

export type PaperTradingAgentEdgeProofLeaderboardRow =
  PaperTradingAgentEdgeProofRow & {
    rank: number;
    source: PaperTradingAgentEdgeProofSource;
    profitability_status: PaperTradingAgentEdgeProfitabilityStatus;
    profitability_status_label: string;
    profitability_evidence: PaperTradingAgentEdgeProfitabilityEvidence;
    is_profitable: boolean;
    is_positive_unproven: boolean;
    is_reviewable_candidate: boolean;
  };

export type PaperTradingAgentEdgeProfitabilityGuard = {
  status: "reviewable" | "collecting" | "unavailable";
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  required_resolved_trades_per_rule: number;
  required_captured_days_per_rule: number;
  min_resolved_net_pnl_usd: number;
  min_roi_on_stake: number;
  max_allowed_drawdown_usd: number;
  rules_with_minimum_sample: number;
  rules_positive_but_unproven: number;
  rules_with_profitability_proven: number;
  blockers: string[];
};

export type PaperTradingAgentEdgeCapacityLeakage = {
  status:
    | "none"
    | "open_only"
    | "resolved_missed_profit"
    | "resolved_missed_loss"
    | "resolved_mixed";
  status_label: string;
  message: string;
  paper_only: true;
  real_money_execution_allowed: false;
  missed_pnl_counts_as_proof: false;
  rules_with_skips: number;
  rules_with_skipped_resolved: number;
  rules_with_profitable_skipped_resolved: number;
  skipped_open_signals: number;
  skipped_resolved_trades: number;
  skipped_profitable_resolved_trades: number;
  skipped_loss_resolved_trades: number;
  skipped_resolved_net_pnl_usd: number;
  skipped_expected_open_pnl_usd: number;
  top_missed_rule: PaperTradingAgentEdgeProofLeaderboardRow | null;
};

export type PaperTradingAgentEdgeProof = {
  schema_version: "1";
  generated_at: string;
  status: "available" | "collecting" | "unavailable";
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  source: PaperTradingAgentEdgeProofSource;
  source_label: string;
  rule_count: number;
  candidate_count: number;
  profitable_rule_count: number;
  positive_unproven_rule_count: number;
  unresolved_rule_count: number;
  profitability_guard: PaperTradingAgentEdgeProfitabilityGuard;
  capacity_leakage: PaperTradingAgentEdgeCapacityLeakage;
  latest_snapshot_date: string | null;
  latest_captured_at: string | null;
  best_resolved_rule: PaperTradingAgentEdgeProofLeaderboardRow | null;
  best_open_ev_rule: PaperTradingAgentEdgeProofLeaderboardRow | null;
  rows: PaperTradingAgentEdgeProofLeaderboardRow[];
};

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function durableProofStatus(value: unknown): DurableProofStatus {
  if (
    value === "collecting" ||
    value === "candidate" ||
    value === "not_qualified" ||
    value === "control_only" ||
    value === "stale"
  ) {
    return value;
  }
  return "collecting";
}

function proofQualityGrade(value: unknown): PaperTradingProofQualityGrade {
  if (
    value === "none" ||
    value === "thin" ||
    value === "developing" ||
    value === "reviewable"
  ) {
    return value;
  }
  return "none";
}

function normalizeProofQuality(value: unknown): PaperTradingProofQuality {
  const record = objectOrNull(value);
  return {
    evidence_grade: proofQualityGrade(record?.evidence_grade),
    evidence_grade_label: stringValue(
      record?.evidence_grade_label,
      "No sample",
    ),
    resolved_trades: numberValue(record?.resolved_trades),
    winning_trades: numberValue(record?.winning_trades),
    losing_trades: numberValue(record?.losing_trades),
    win_rate: numberValue(record?.win_rate),
    avg_pnl_per_trade_usd: numberValue(record?.avg_pnl_per_trade_usd),
    avg_stake_usd: numberValue(record?.avg_stake_usd),
    winning_days: numberValue(record?.winning_days),
    losing_days: numberValue(record?.losing_days),
    flat_days: numberValue(record?.flat_days),
    avg_daily_pnl_usd: numberValue(record?.avg_daily_pnl_usd),
    daily_profit_factor: nullableNumber(record?.daily_profit_factor),
    blockers: stringArray(record?.blockers),
  };
}

function normalizeArtifactAgentEdgeRow(
  value: unknown,
): PaperTradingAgentEdgeProofRow | null {
  const record = objectOrNull(value);
  if (!record) return null;
  const strategyId = stringValue(record.strategy_id);
  const agentId = stringValue(record.agent_id);
  if (!strategyId || !agentId) return null;

  return {
    strategy_id: strategyId,
    strategy_label: stringValue(record.strategy_label, strategyId),
    agent_id: agentId,
    agent_name: stringValue(record.agent_name, agentId),
    min_edge: numberValue(record.min_edge),
    proof_status: durableProofStatus(record.proof_status),
    proof_status_label: stringValue(record.proof_status_label, "Collecting"),
    captured_days: numberValue(record.captured_days),
    required_captured_days: numberValue(record.required_captured_days),
    missing_capture_days: numberValue(record.missing_capture_days),
    resolved_trades: numberValue(record.resolved_trades),
    required_resolved_trades: numberValue(record.required_resolved_trades),
    skipped_trades: numberValue(record.skipped_trades),
    skipped_open_signals: numberValue(record.skipped_open_signals),
    skipped_resolved_trades: numberValue(record.skipped_resolved_trades),
    skipped_profitable_resolved_trades: numberValue(
      record.skipped_profitable_resolved_trades,
    ),
    skipped_loss_resolved_trades: numberValue(
      record.skipped_loss_resolved_trades,
    ),
    skipped_resolved_net_pnl_usd: numberValue(
      record.skipped_resolved_net_pnl_usd,
    ),
    skipped_expected_open_pnl_usd: numberValue(
      record.skipped_expected_open_pnl_usd,
    ),
    missed_pnl_counts_as_proof: false as const,
    win_rate: numberValue(record.win_rate),
    avg_pnl_per_trade_usd: numberValue(record.avg_pnl_per_trade_usd),
    daily_profit_factor: nullableNumber(record.daily_profit_factor),
    evidence_grade: proofQualityGrade(record.evidence_grade),
    evidence_grade_label: stringValue(record.evidence_grade_label, "No sample"),
    window_pnl_usd: numberValue(record.window_pnl_usd),
    window_roi_on_stake: numberValue(record.window_roi_on_stake),
    max_drawdown_usd: numberValue(record.max_drawdown_usd),
    open_exposure_usd: numberValue(record.open_exposure_usd),
    open_expected_pnl_usd: numberValue(record.open_expected_pnl_usd),
    latest_snapshot_date: nullableString(record.latest_snapshot_date),
    latest_captured_at: nullableString(record.latest_captured_at),
    proof_quality: normalizeProofQuality(record.proof_quality),
    blockers: stringArray(record.blockers),
  };
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter((item) => item.length > 0)));
}

function profitabilityStatusLabel(
  status: PaperTradingAgentEdgeProfitabilityStatus,
): string {
  if (status === "profitable") return "Profitability proven";
  if (status === "positive_unproven") return "Positive, unproven";
  if (status === "loss_making") return "Loss making";
  if (status === "flat") return "Flat";
  return "Unresolved";
}

function buildProfitabilityEvidence(
  row: PaperTradingAgentEdgeProofRow,
): PaperTradingAgentEdgeProfitabilityEvidence {
  const missingResolvedTrades = Math.max(
    0,
    row.required_resolved_trades - row.resolved_trades,
  );
  const captureSampleMet =
    row.captured_days >= row.required_captured_days &&
    row.missing_capture_days === 0;
  const resolvedSampleMet = missingResolvedTrades === 0;
  const minimumSampleMet = captureSampleMet && resolvedSampleMet;
  const positivePnlMet =
    row.window_pnl_usd >= PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd;
  const positiveRoiMet =
    row.window_roi_on_stake > PAPER_TRADING_PROOF_RULES.minRoiOnStake;
  const drawdownLimitMet =
    row.max_drawdown_usd <= PAPER_TRADING_PROOF_RULES.maxDrawdownUsd;
  const profitabilityProven =
    row.proof_status === "candidate" &&
    minimumSampleMet &&
    positivePnlMet &&
    positiveRoiMet &&
    drawdownLimitMet;
  const blockers = new Set(row.blockers);

  if (!captureSampleMet) {
    if (row.captured_days < row.required_captured_days) {
      blockers.add(
        `${row.required_captured_days - row.captured_days} more captured proof days needed.`,
      );
    }
    if (row.missing_capture_days > 0) {
      blockers.add(`${row.missing_capture_days} missing proof days.`);
    }
  }
  if (!resolvedSampleMet) {
    blockers.add(`${missingResolvedTrades} more resolved trades needed.`);
  }
  if (row.resolved_trades <= 0) {
    blockers.add("No resolved trades in proof window.");
  }
  if (!positivePnlMet) {
    blockers.add("Resolved paper P&L is not positive.");
  }
  if (!positiveRoiMet) {
    blockers.add("Resolved ROI is not positive.");
  }
  if (!drawdownLimitMet) {
    blockers.add("Drawdown exceeds proof limit.");
  }

  const status: PaperTradingAgentEdgeProfitabilityStatus =
    row.resolved_trades <= 0
      ? "unresolved"
      : profitabilityProven
        ? "profitable"
        : positivePnlMet && positiveRoiMet
          ? "positive_unproven"
          : row.window_pnl_usd < 0 || row.window_roi_on_stake < 0
            ? "loss_making"
            : "flat";

  return {
    status,
    status_label: profitabilityStatusLabel(status),
    minimum_sample_met: minimumSampleMet,
    capture_sample_met: captureSampleMet,
    resolved_sample_met: resolvedSampleMet,
    positive_pnl_met: positivePnlMet,
    positive_roi_met: positiveRoiMet,
    drawdown_limit_met: drawdownLimitMet,
    profitability_proven: profitabilityProven,
    resolved_trades: row.resolved_trades,
    required_resolved_trades: row.required_resolved_trades,
    missing_resolved_trades: missingResolvedTrades,
    captured_days: row.captured_days,
    required_captured_days: row.required_captured_days,
    missing_capture_days: row.missing_capture_days,
    net_pnl_usd: row.window_pnl_usd,
    roi_on_stake: row.window_roi_on_stake,
    max_drawdown_usd: row.max_drawdown_usd,
    max_allowed_drawdown_usd: PAPER_TRADING_PROOF_RULES.maxDrawdownUsd,
    blockers: uniqueStrings(Array.from(blockers)),
  };
}

function proofStatusRank(status: DurableProofStatus): number {
  if (status === "candidate") return 0;
  if (status === "collecting") return 1;
  if (status === "not_qualified") return 2;
  if (status === "stale") return 3;
  return 4;
}

function evidenceGradeRank(grade: PaperTradingProofQualityGrade): number {
  if (grade === "reviewable") return 0;
  if (grade === "developing") return 1;
  if (grade === "thin") return 2;
  return 3;
}

function compareAgentEdgeRows(
  a: PaperTradingAgentEdgeProofRow,
  b: PaperTradingAgentEdgeProofRow,
): number {
  const proofDelta =
    proofStatusRank(a.proof_status) - proofStatusRank(b.proof_status);
  if (proofDelta !== 0) return proofDelta;
  const gradeDelta =
    evidenceGradeRank(a.evidence_grade) - evidenceGradeRank(b.evidence_grade);
  if (gradeDelta !== 0) return gradeDelta;
  if (b.resolved_trades !== a.resolved_trades) {
    return b.resolved_trades - a.resolved_trades;
  }
  if (b.window_pnl_usd !== a.window_pnl_usd) {
    return b.window_pnl_usd - a.window_pnl_usd;
  }
  if (b.window_roi_on_stake !== a.window_roi_on_stake) {
    return b.window_roi_on_stake - a.window_roi_on_stake;
  }
  if (b.open_expected_pnl_usd !== a.open_expected_pnl_usd) {
    return b.open_expected_pnl_usd - a.open_expected_pnl_usd;
  }
  return `${a.agent_id}-${a.min_edge}`.localeCompare(
    `${b.agent_id}-${b.min_edge}`,
  );
}

function sourceLabel(source: PaperTradingAgentEdgeProofSource): string {
  if (source === "supabase") return "Supabase";
  if (source === "published_artifact") return "Published artifact";
  return "None";
}

function latestDate(rows: PaperTradingAgentEdgeProofRow[]): string | null {
  return (
    rows
      .map((row) => row.latest_snapshot_date)
      .filter((date): date is string => Boolean(date))
      .sort((a, b) => b.localeCompare(a))[0] ?? null
  );
}

function latestCapturedAt(
  rows: PaperTradingAgentEdgeProofRow[],
): string | null {
  return (
    rows
      .map((row) => row.latest_captured_at)
      .filter((date): date is string => Boolean(date))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
  );
}

function buildProfitabilityGuard(
  rows: PaperTradingAgentEdgeProofLeaderboardRow[],
  source: PaperTradingAgentEdgeProofSource,
): PaperTradingAgentEdgeProfitabilityGuard {
  const provenRules = rows.filter(
    (row) => row.profitability_evidence.profitability_proven,
  );
  const positiveUnprovenRules = rows.filter(
    (row) => row.profitability_status === "positive_unproven",
  );
  const minimumSampleRules = rows.filter(
    (row) => row.profitability_evidence.minimum_sample_met,
  );
  const blockers =
    rows.length === 0
      ? ["No canonical agent-edge proof rows are available."]
      : uniqueStrings(
          rows.flatMap((row) => row.profitability_evidence.blockers),
        );
  const status: PaperTradingAgentEdgeProfitabilityGuard["status"] =
    rows.length === 0
      ? "unavailable"
      : provenRules.length > 0
        ? "reviewable"
        : "collecting";

  return {
    status,
    status_label:
      status === "reviewable"
        ? "Reviewable"
        : status === "collecting"
          ? "Collecting"
          : "Unavailable",
    message:
      status === "reviewable"
        ? "At least one agent-edge rule has positive realized results after the full paper proof gate."
        : status === "collecting" && positiveUnprovenRules.length > 0
          ? "Some agent-edge rules are positive, but the sample is not large enough to call them profitable."
          : status === "collecting"
            ? "Agent-edge profitability proof is still collecting resolved live paper tickets."
            : "No agent-edge profitability proof source is available.",
    next_required_action:
      status === "reviewable"
        ? "Operator review can inspect the proven paper rows; execution remains disabled."
        : source === "none"
          ? "Run the paper snapshot workflow and publish a proof artifact."
          : positiveUnprovenRules.length > 0
            ? "Keep collecting until each positive rule also clears the 30-day and 30-resolved-ticket gates."
            : "Wait for live paper markets to resolve before judging profitability.",
    paper_only: true,
    real_money_execution_allowed: false,
    required_resolved_trades_per_rule:
      PAPER_TRADING_PROOF_RULES.requiredResolvedTrades,
    required_captured_days_per_rule: PAPER_TRADING_PROOF_RULES.requiredLiveDays,
    min_resolved_net_pnl_usd: PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd,
    min_roi_on_stake: PAPER_TRADING_PROOF_RULES.minRoiOnStake,
    max_allowed_drawdown_usd: PAPER_TRADING_PROOF_RULES.maxDrawdownUsd,
    rules_with_minimum_sample: minimumSampleRules.length,
    rules_positive_but_unproven: positiveUnprovenRules.length,
    rules_with_profitability_proven: provenRules.length,
    blockers,
  };
}

function capacityLeakageStatus(
  skippedOpenSignals: number,
  skippedResolvedTrades: number,
  skippedProfitableResolvedTrades: number,
  skippedLossResolvedTrades: number,
): PaperTradingAgentEdgeCapacityLeakage["status"] {
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

function capacityLeakageStatusLabel(
  status: PaperTradingAgentEdgeCapacityLeakage["status"],
): string {
  if (status === "open_only") return "Open capacity pressure";
  if (status === "resolved_missed_profit") return "Missed profitable resolves";
  if (status === "resolved_missed_loss") return "Missed loss resolves";
  if (status === "resolved_mixed") return "Mixed missed resolves";
  return "No leakage";
}

function buildCapacityLeakage(
  rows: PaperTradingAgentEdgeProofLeaderboardRow[],
): PaperTradingAgentEdgeCapacityLeakage {
  const skippedOpenSignals = rows.reduce(
    (sum, row) => sum + row.skipped_open_signals,
    0,
  );
  const skippedResolvedTrades = rows.reduce(
    (sum, row) => sum + row.skipped_resolved_trades,
    0,
  );
  const skippedProfitableResolvedTrades = rows.reduce(
    (sum, row) => sum + row.skipped_profitable_resolved_trades,
    0,
  );
  const skippedLossResolvedTrades = rows.reduce(
    (sum, row) => sum + row.skipped_loss_resolved_trades,
    0,
  );
  const skippedResolvedNetPnlUsd = rows.reduce(
    (sum, row) => sum + row.skipped_resolved_net_pnl_usd,
    0,
  );
  const skippedExpectedOpenPnlUsd = rows.reduce(
    (sum, row) => sum + row.skipped_expected_open_pnl_usd,
    0,
  );
  const topMissedRule =
    rows
      .filter((row) => row.skipped_resolved_trades > 0)
      .slice()
      .sort(
        (a, b) =>
          b.skipped_resolved_net_pnl_usd - a.skipped_resolved_net_pnl_usd ||
          b.skipped_resolved_trades - a.skipped_resolved_trades,
      )[0] ?? null;
  const status = capacityLeakageStatus(
    skippedOpenSignals,
    skippedResolvedTrades,
    skippedProfitableResolvedTrades,
    skippedLossResolvedTrades,
  );

  return {
    status,
    status_label: capacityLeakageStatusLabel(status),
    message:
      skippedResolvedTrades > 0
        ? "Some canonical agent-edge signals were skipped by exposure caps and later resolved; this is capacity leakage, not proof P&L."
        : skippedOpenSignals > 0
          ? "Some canonical agent-edge signals are currently skipped by exposure caps before resolution."
          : "No canonical agent-edge capacity leakage is visible in the selected proof source.",
    paper_only: true,
    real_money_execution_allowed: false,
    missed_pnl_counts_as_proof: false as const,
    rules_with_skips: rows.filter((row) => row.skipped_trades > 0).length,
    rules_with_skipped_resolved: rows.filter(
      (row) => row.skipped_resolved_trades > 0,
    ).length,
    rules_with_profitable_skipped_resolved: rows.filter(
      (row) => row.skipped_profitable_resolved_trades > 0,
    ).length,
    skipped_open_signals: skippedOpenSignals,
    skipped_resolved_trades: skippedResolvedTrades,
    skipped_profitable_resolved_trades: skippedProfitableResolvedTrades,
    skipped_loss_resolved_trades: skippedLossResolvedTrades,
    skipped_resolved_net_pnl_usd:
      Math.round(skippedResolvedNetPnlUsd * 100) / 100,
    skipped_expected_open_pnl_usd:
      Math.round(skippedExpectedOpenPnlUsd * 100) / 100,
    top_missed_rule: topMissedRule,
  };
}

export function buildPaperTradingAgentEdgeProof(args: {
  persistedRows: PaperTradingAgentEdgeProofRow[];
  publishedArtifactProof: PublishedPaperTradingArtifactProof;
  generatedAt?: string;
}): PaperTradingAgentEdgeProof {
  const artifactRows = args.publishedArtifactProof.agent_edge_proof_matrix
    .map(normalizeArtifactAgentEdgeRow)
    .filter((row): row is PaperTradingAgentEdgeProofRow => row !== null);
  const source: PaperTradingAgentEdgeProofSource =
    args.persistedRows.length > 0
      ? "supabase"
      : artifactRows.length > 0
        ? "published_artifact"
        : "none";
  const sourceRows =
    source === "supabase"
      ? args.persistedRows
      : source === "published_artifact"
        ? artifactRows
        : [];
  return buildPaperTradingAgentEdgeProofFromRows({
    rows: sourceRows,
    source,
    generatedAt: args.generatedAt,
  });
}

export function buildPaperTradingAgentEdgeProofFromRows(args: {
  rows: PaperTradingAgentEdgeProofRow[];
  source: PaperTradingAgentEdgeProofSource;
  generatedAt?: string;
}): PaperTradingAgentEdgeProof {
  const sortedRows = args.rows.slice().sort(compareAgentEdgeRows);
  const rows = sortedRows.map((row, index) => {
    const profitabilityEvidence = buildProfitabilityEvidence(row);
    return {
      ...row,
      rank: index + 1,
      source: args.source,
      profitability_status: profitabilityEvidence.status,
      profitability_status_label: profitabilityEvidence.status_label,
      profitability_evidence: profitabilityEvidence,
      is_profitable: profitabilityEvidence.profitability_proven,
      is_positive_unproven:
        profitabilityEvidence.status === "positive_unproven",
      is_reviewable_candidate: row.proof_status === "candidate",
    };
  });
  const candidateCount = rows.filter(
    (row) => row.is_reviewable_candidate,
  ).length;
  const profitableRuleCount = rows.filter((row) => row.is_profitable).length;
  const positiveUnprovenRuleCount = rows.filter(
    (row) => row.is_positive_unproven,
  ).length;
  const unresolvedRuleCount = rows.filter(
    (row) => row.profitability_status === "unresolved",
  ).length;
  const profitabilityGuard = buildProfitabilityGuard(rows, args.source);
  const capacityLeakage = buildCapacityLeakage(rows);
  const bestResolvedRule =
    rows
      .filter((row) => row.resolved_trades > 0)
      .sort(compareAgentEdgeRows)[0] ?? null;
  const bestOpenEvRule =
    rows
      .slice()
      .sort((a, b) => b.open_expected_pnl_usd - a.open_expected_pnl_usd)[0] ??
    null;
  const status: PaperTradingAgentEdgeProof["status"] =
    rows.length === 0
      ? "unavailable"
      : candidateCount > 0 || rows.some((row) => row.resolved_trades > 0)
        ? "available"
        : "collecting";

  return {
    schema_version: "1",
    generated_at: args.generatedAt ?? new Date().toISOString(),
    status,
    status_label:
      status === "available"
        ? "Available"
        : status === "collecting"
          ? "Collecting"
          : "Unavailable",
    message:
      args.source === "none"
        ? "No canonical agent-edge proof matrix is available yet."
        : status === "collecting"
          ? "Canonical agent-edge rules are being captured, but no live paper trades have resolved in the proof window yet."
          : "Canonical agent-edge proof is available for profitability review.",
    next_required_action:
      args.source === "none"
        ? "Run the paper snapshot workflow and publish a proof artifact."
        : status === "collecting"
          ? "Wait for live paper markets to resolve before treating open EV as realized profit."
          : candidateCount > 0
            ? "Review candidate agent-edge rules; execution remains disabled."
            : "Compare resolved P&L, ROI, drawdown, and blockers before any operator review.",
    paper_only: true,
    real_money_execution_allowed: false,
    source: args.source,
    source_label: sourceLabel(args.source),
    rule_count: rows.length,
    candidate_count: candidateCount,
    profitable_rule_count: profitableRuleCount,
    positive_unproven_rule_count: positiveUnprovenRuleCount,
    unresolved_rule_count: unresolvedRuleCount,
    profitability_guard: profitabilityGuard,
    capacity_leakage: capacityLeakage,
    latest_snapshot_date: latestDate(rows),
    latest_captured_at: latestCapturedAt(rows),
    best_resolved_rule: bestResolvedRule,
    best_open_ev_rule: bestOpenEvRule,
    rows,
  };
}
