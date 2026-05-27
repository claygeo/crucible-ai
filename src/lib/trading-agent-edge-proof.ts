import type { PublishedPaperTradingArtifactProof } from "@/lib/trading-artifacts";
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
  | "flat"
  | "loss_making"
  | "unresolved";

export type PaperTradingAgentEdgeProofLeaderboardRow =
  PaperTradingAgentEdgeProofRow & {
    rank: number;
    source: PaperTradingAgentEdgeProofSource;
    profitability_status: PaperTradingAgentEdgeProfitabilityStatus;
    profitability_status_label: string;
    is_profitable: boolean;
    is_reviewable_candidate: boolean;
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
  unresolved_rule_count: number;
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

function profitabilityStatus(
  row: PaperTradingAgentEdgeProofRow,
): PaperTradingAgentEdgeProfitabilityStatus {
  if (row.resolved_trades <= 0) return "unresolved";
  if (row.window_pnl_usd > 0 && row.window_roi_on_stake > 0) {
    return "profitable";
  }
  if (row.window_pnl_usd < 0 || row.window_roi_on_stake < 0) {
    return "loss_making";
  }
  return "flat";
}

function profitabilityStatusLabel(
  status: PaperTradingAgentEdgeProfitabilityStatus,
): string {
  if (status === "profitable") return "Profitable";
  if (status === "loss_making") return "Loss making";
  if (status === "flat") return "Flat";
  return "Unresolved";
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
    const status = profitabilityStatus(row);
    return {
      ...row,
      rank: index + 1,
      source: args.source,
      profitability_status: status,
      profitability_status_label: profitabilityStatusLabel(status),
      is_profitable: status === "profitable",
      is_reviewable_candidate: row.proof_status === "candidate",
    };
  });
  const candidateCount = rows.filter(
    (row) => row.is_reviewable_candidate,
  ).length;
  const profitableRuleCount = rows.filter((row) => row.is_profitable).length;
  const unresolvedRuleCount = rows.filter(
    (row) => row.profitability_status === "unresolved",
  ).length;
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
    unresolved_rule_count: unresolvedRuleCount,
    latest_snapshot_date: latestDate(rows),
    latest_captured_at: latestCapturedAt(rows),
    best_resolved_rule: bestResolvedRule,
    best_open_ev_rule: bestOpenEvRule,
    rows,
  };
}
