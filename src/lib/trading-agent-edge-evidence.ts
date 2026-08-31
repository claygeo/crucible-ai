import { PAPER_TRADING_PROOF_RULES } from "@/lib/trading";
import type { PaperTradingAgentEdgeProof } from "@/lib/trading-agent-edge-proof";
import type { PublishedPaperTradingArtifactProof } from "@/lib/trading-artifacts";
import type {
  DurableProofStatus,
  PaperTradingCaptureCalendarDay,
  PaperTradingPersistenceRead,
  PaperTradingSnapshotRow,
} from "@/lib/trading-snapshots";

export type PaperTradingAgentEdgeEvidenceDay = {
  snapshot_date: string;
  capture_status: PaperTradingCaptureCalendarDay["status"];
  capture_status_label: string;
  has_rule_snapshot: boolean;
  captured_at: string | null;
  resolved_trades: number | null;
  delta_resolved_trades: number | null;
  resolved_net_pnl_usd: number | null;
  delta_resolved_net_pnl_usd: number | null;
  resolved_roi_on_stake: number | null;
  open_signals: number | null;
  open_exposure_usd: number | null;
  open_expected_pnl_usd: number | null;
  skipped_trades: number | null;
  skipped_resolved_trades: number | null;
  delta_skipped_resolved_trades: number | null;
  skipped_resolved_net_pnl_usd: number | null;
  delta_skipped_resolved_net_pnl_usd: number | null;
  missed_pnl_counts_as_proof: false;
  proof_status: DurableProofStatus | null;
  proof_status_label: string | null;
};

export type PaperTradingAgentEdgeEvidenceRule = {
  rank: number;
  strategy_id: string;
  strategy_label: string;
  agent_id: string;
  agent_name: string;
  min_edge: number;
  proof_status: DurableProofStatus;
  proof_status_label: string;
  profitability_status: string;
  profitability_status_label: string;
  profitability_proven: boolean;
  positive_unproven: boolean;
  captured_days: number;
  missing_capture_days: number;
  required_captured_days: number;
  resolved_trades: number;
  required_resolved_trades: number;
  resolved_trades_remaining: number;
  window_pnl_usd: number;
  window_roi_on_stake: number;
  max_drawdown_usd: number;
  skipped_resolved_net_pnl_usd: number;
  missed_pnl_counts_as_proof: false;
  latest_snapshot_date: string | null;
  latest_captured_at: string | null;
  blockers: string[];
  recent_days: PaperTradingAgentEdgeEvidenceDay[];
};

export type PaperTradingAgentEdgeEvidenceTimeline = {
  schema_version: "1";
  generated_at: string;
  status: "available" | "collecting" | "unavailable";
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  source: PaperTradingAgentEdgeProof["source"];
  source_label: string;
  proof_source_status: PaperTradingAgentEdgeProof["status"];
  persistence_status: PaperTradingPersistenceRead["status"];
  required_days: number;
  expected_days: number;
  complete_days: number;
  partial_days: number;
  missing_days: number;
  days_remaining_to_30: number;
  rule_count: number;
  total_expected_rule_days: number;
  captured_rule_days: number;
  missing_rule_days: number;
  rule_day_coverage_ratio: number;
  rules_with_full_capture: number;
  rules_with_profitability_proven: number;
  rules_positive_but_unproven: number;
  rules_with_resolved_trades: number;
  total_resolved_trades: number;
  total_window_pnl_usd: number;
  missed_pnl_counts_as_proof: false;
  latest_snapshot_date: string | null;
  latest_captured_at: string | null;
  selected_rule: PaperTradingAgentEdgeEvidenceRule | null;
  rules: PaperTradingAgentEdgeEvidenceRule[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function timestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestSnapshotForDay(
  current: PaperTradingSnapshotRow | undefined,
  candidate: PaperTradingSnapshotRow,
): PaperTradingSnapshotRow {
  if (!current) return candidate;
  return timestamp(candidate.captured_at) >= timestamp(current.captured_at)
    ? candidate
    : current;
}

function buildSnapshotIndex(
  snapshots: PaperTradingSnapshotRow[],
): Map<string, Map<string, PaperTradingSnapshotRow>> {
  const byStrategy = new Map<string, Map<string, PaperTradingSnapshotRow>>();
  for (const snapshot of snapshots) {
    const byDate = byStrategy.get(snapshot.strategy_id) ?? new Map();
    byDate.set(
      snapshot.snapshot_date,
      latestSnapshotForDay(byDate.get(snapshot.snapshot_date), snapshot),
    );
    byStrategy.set(snapshot.strategy_id, byDate);
  }
  return byStrategy;
}

function dayFromSnapshot(
  calendarDay: PaperTradingCaptureCalendarDay,
  snapshot: PaperTradingSnapshotRow | undefined,
  previousSnapshot: PaperTradingSnapshotRow | null,
): PaperTradingAgentEdgeEvidenceDay {
  if (!snapshot) {
    return {
      snapshot_date: calendarDay.snapshot_date,
      capture_status: calendarDay.status,
      capture_status_label: calendarDay.status_label,
      has_rule_snapshot: false,
      captured_at: null,
      resolved_trades: null,
      delta_resolved_trades: null,
      resolved_net_pnl_usd: null,
      delta_resolved_net_pnl_usd: null,
      resolved_roi_on_stake: null,
      open_signals: null,
      open_exposure_usd: null,
      open_expected_pnl_usd: null,
      skipped_trades: null,
      skipped_resolved_trades: null,
      delta_skipped_resolved_trades: null,
      skipped_resolved_net_pnl_usd: null,
      delta_skipped_resolved_net_pnl_usd: null,
      missed_pnl_counts_as_proof: false,
      proof_status: null,
      proof_status_label: null,
    };
  }

  return {
    snapshot_date: calendarDay.snapshot_date,
    capture_status: calendarDay.status,
    capture_status_label: calendarDay.status_label,
    has_rule_snapshot: true,
    captured_at: snapshot.captured_at,
    resolved_trades: snapshot.resolved_trades,
    delta_resolved_trades: previousSnapshot
      ? snapshot.resolved_trades - previousSnapshot.resolved_trades
      : snapshot.resolved_trades,
    resolved_net_pnl_usd: snapshot.resolved_net_pnl_usd,
    delta_resolved_net_pnl_usd: previousSnapshot
      ? round2(
          snapshot.resolved_net_pnl_usd - previousSnapshot.resolved_net_pnl_usd,
        )
      : snapshot.resolved_net_pnl_usd,
    resolved_roi_on_stake: snapshot.resolved_roi_on_stake,
    open_signals: snapshot.open_signals,
    open_exposure_usd: snapshot.open_exposure_usd,
    open_expected_pnl_usd: snapshot.open_expected_pnl_usd,
    skipped_trades: snapshot.skipped_trades,
    skipped_resolved_trades: snapshot.exposure_ledger.skipped_resolved_trades,
    delta_skipped_resolved_trades: previousSnapshot
      ? snapshot.exposure_ledger.skipped_resolved_trades -
        previousSnapshot.exposure_ledger.skipped_resolved_trades
      : snapshot.exposure_ledger.skipped_resolved_trades,
    skipped_resolved_net_pnl_usd:
      snapshot.exposure_ledger.skipped_resolved_net_pnl_usd,
    delta_skipped_resolved_net_pnl_usd: previousSnapshot
      ? round2(
          snapshot.exposure_ledger.skipped_resolved_net_pnl_usd -
            previousSnapshot.exposure_ledger.skipped_resolved_net_pnl_usd,
        )
      : snapshot.exposure_ledger.skipped_resolved_net_pnl_usd,
    missed_pnl_counts_as_proof: false,
    proof_status: snapshot.proof_status,
    proof_status_label: snapshot.proof_gate.status_label,
  };
}

function buildRuleDays(args: {
  strategyId: string;
  calendarDays: PaperTradingCaptureCalendarDay[];
  snapshotsByDate: Map<string, PaperTradingSnapshotRow> | undefined;
}): PaperTradingAgentEdgeEvidenceDay[] {
  const daysAsc: PaperTradingAgentEdgeEvidenceDay[] = [];
  let previousSnapshot: PaperTradingSnapshotRow | null = null;

  for (const calendarDay of args.calendarDays) {
    const snapshot = args.snapshotsByDate?.get(calendarDay.snapshot_date);
    daysAsc.push(dayFromSnapshot(calendarDay, snapshot, previousSnapshot));
    if (snapshot) previousSnapshot = snapshot;
  }

  return daysAsc.reverse();
}

function timelineStatus(args: {
  ruleCount: number;
  capturedRuleDays: number;
  completeDays: number;
}): PaperTradingAgentEdgeEvidenceTimeline["status"] {
  if (args.ruleCount === 0) return "unavailable";
  if (args.capturedRuleDays === 0) return "collecting";
  if (args.completeDays >= PAPER_TRADING_PROOF_RULES.requiredLiveDays) {
    return "available";
  }
  return "collecting";
}

function statusLabel(
  status: PaperTradingAgentEdgeEvidenceTimeline["status"],
): string {
  if (status === "available") return "Available";
  if (status === "collecting") return "Collecting";
  return "Unavailable";
}

function latestCapturedAt(
  rules: PaperTradingAgentEdgeEvidenceRule[],
): string | null {
  return (
    rules
      .map((rule) => rule.latest_captured_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => timestamp(b) - timestamp(a))[0] ?? null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAgentEdgeEvidenceRule(
  value: unknown,
): value is PaperTradingAgentEdgeEvidenceRule {
  return (
    isRecord(value) &&
    typeof value.strategy_id === "string" &&
    typeof value.agent_id === "string" &&
    typeof value.min_edge === "number" &&
    Array.isArray(value.recent_days)
  );
}

function artifactEvidenceTimeline(
  value: unknown,
): PaperTradingAgentEdgeEvidenceTimeline | null {
  if (
    !isRecord(value) ||
    value.schema_version !== "1" ||
    value.paper_only !== true ||
    value.real_money_execution_allowed !== false ||
    !Array.isArray(value.rules)
  ) {
    return null;
  }
  const rules = value.rules.filter(isAgentEdgeEvidenceRule);
  if (rules.length !== value.rules.length) return null;
  return {
    ...(value as PaperTradingAgentEdgeEvidenceTimeline),
    rules,
    selected_rule: isAgentEdgeEvidenceRule(value.selected_rule)
      ? value.selected_rule
      : null,
  };
}

function withSelectedRule(args: {
  timeline: PaperTradingAgentEdgeEvidenceTimeline;
  agentEdgeProof: PaperTradingAgentEdgeProof;
  persistenceStatus: PaperTradingPersistenceRead["status"];
  selectedAgentId?: string | null;
  selectedMinEdge?: number | null;
  generatedAt?: string;
}): PaperTradingAgentEdgeEvidenceTimeline {
  const selectedRule =
    args.selectedAgentId && typeof args.selectedMinEdge === "number"
      ? (args.timeline.rules.find(
          (rule) =>
            rule.agent_id === args.selectedAgentId &&
            rule.min_edge === args.selectedMinEdge,
        ) ?? null)
      : null;
  return {
    ...args.timeline,
    generated_at: args.generatedAt ?? args.timeline.generated_at,
    source: args.agentEdgeProof.source,
    source_label: args.agentEdgeProof.source_label,
    proof_source_status: args.agentEdgeProof.status,
    persistence_status: args.persistenceStatus,
    selected_rule: selectedRule,
  };
}

export function buildPaperTradingAgentEdgeEvidenceTimeline(args: {
  persistence: PaperTradingPersistenceRead;
  agentEdgeProof: PaperTradingAgentEdgeProof;
  publishedArtifactProof?: PublishedPaperTradingArtifactProof | null;
  selectedAgentId?: string | null;
  selectedMinEdge?: number | null;
  generatedAt?: string;
}): PaperTradingAgentEdgeEvidenceTimeline {
  const publishedArtifactTimeline = artifactEvidenceTimeline(
    args.publishedArtifactProof?.agent_edge_evidence,
  );
  if (
    args.persistence.snapshots.length === 0 &&
    args.agentEdgeProof.source === "published_artifact" &&
    publishedArtifactTimeline
  ) {
    return withSelectedRule({
      timeline: publishedArtifactTimeline,
      agentEdgeProof: args.agentEdgeProof,
      persistenceStatus: args.persistence.status,
      selectedAgentId: args.selectedAgentId,
      selectedMinEdge: args.selectedMinEdge,
      generatedAt: args.generatedAt,
    });
  }

  const calendarDays = args.persistence.capture_calendar.days;
  const snapshotIndex = buildSnapshotIndex(args.persistence.snapshots);
  const rules = args.agentEdgeProof.rows.map((row) => {
    const recentDays = buildRuleDays({
      strategyId: row.strategy_id,
      calendarDays,
      snapshotsByDate: snapshotIndex.get(row.strategy_id),
    });
    const capturedRuleDays = recentDays.filter(
      (day) => day.has_rule_snapshot,
    ).length;

    return {
      rank: row.rank,
      strategy_id: row.strategy_id,
      strategy_label: row.strategy_label,
      agent_id: row.agent_id,
      agent_name: row.agent_name,
      min_edge: row.min_edge,
      proof_status: row.proof_status,
      proof_status_label: row.proof_status_label,
      profitability_status: row.profitability_status,
      profitability_status_label: row.profitability_status_label,
      profitability_proven: row.is_profitable,
      positive_unproven: row.is_positive_unproven,
      captured_days: row.captured_days,
      missing_capture_days: row.missing_capture_days,
      required_captured_days: row.required_captured_days,
      resolved_trades: row.resolved_trades,
      required_resolved_trades: row.required_resolved_trades,
      resolved_trades_remaining: Math.max(
        0,
        row.required_resolved_trades - row.resolved_trades,
      ),
      window_pnl_usd: row.window_pnl_usd,
      window_roi_on_stake: row.window_roi_on_stake,
      max_drawdown_usd: row.max_drawdown_usd,
      skipped_resolved_net_pnl_usd: row.skipped_resolved_net_pnl_usd,
      missed_pnl_counts_as_proof: false as const,
      latest_snapshot_date: row.latest_snapshot_date,
      latest_captured_at: row.latest_captured_at,
      blockers: row.blockers,
      recent_days: recentDays.slice(
        0,
        PAPER_TRADING_PROOF_RULES.requiredLiveDays,
      ),
      captured_rule_days: capturedRuleDays,
    };
  });
  const totalExpectedRuleDays = calendarDays.length * rules.length;
  const capturedRuleDays = rules.reduce(
    (sum, rule) => sum + rule.captured_rule_days,
    0,
  );
  const missingRuleDays = Math.max(0, totalExpectedRuleDays - capturedRuleDays);
  const rulesWithFullCapture = rules.filter(
    (rule) =>
      calendarDays.length > 0 &&
      rule.captured_rule_days === calendarDays.length,
  ).length;
  const status = timelineStatus({
    ruleCount: rules.length,
    capturedRuleDays,
    completeDays: args.persistence.capture_calendar.complete_days,
  });
  const publicRules: PaperTradingAgentEdgeEvidenceRule[] = rules.map(
    ({ captured_rule_days: _capturedRuleDays, ...rule }) => rule,
  );
  const selectedRule =
    args.selectedAgentId && typeof args.selectedMinEdge === "number"
      ? (publicRules.find(
          (rule) =>
            rule.agent_id === args.selectedAgentId &&
            rule.min_edge === args.selectedMinEdge,
        ) ?? null)
      : null;

  return {
    schema_version: "1",
    generated_at: args.generatedAt ?? new Date().toISOString(),
    status,
    status_label: statusLabel(status),
    message:
      status === "unavailable"
        ? "No canonical agent-edge proof rows are available for a timeline."
        : status === "available"
          ? "Agent-edge evidence has a complete persisted capture window."
          : "Agent-edge evidence stopped at the final archived snapshot; no further rows will be collected.",
    next_required_action:
      status === "unavailable"
        ? "Run the paper snapshot workflow until canonical agent-edge rows are present."
        : args.persistence.capture_calendar.days_remaining_to_30 > 0
          ? `Collect ${args.persistence.capture_calendar.days_remaining_to_30} more complete daily proof captures.`
          : args.agentEdgeProof.profitability_guard.next_required_action,
    paper_only: true,
    real_money_execution_allowed: false,
    source: args.agentEdgeProof.source,
    source_label: args.agentEdgeProof.source_label,
    proof_source_status: args.agentEdgeProof.status,
    persistence_status: args.persistence.status,
    required_days: PAPER_TRADING_PROOF_RULES.requiredLiveDays,
    expected_days: calendarDays.length,
    complete_days: args.persistence.capture_calendar.complete_days,
    partial_days: args.persistence.capture_calendar.partial_days,
    missing_days: args.persistence.capture_calendar.missing_days,
    days_remaining_to_30:
      args.persistence.capture_calendar.days_remaining_to_30,
    rule_count: publicRules.length,
    total_expected_rule_days: totalExpectedRuleDays,
    captured_rule_days: capturedRuleDays,
    missing_rule_days: missingRuleDays,
    rule_day_coverage_ratio:
      totalExpectedRuleDays > 0
        ? round2(capturedRuleDays / totalExpectedRuleDays)
        : 0,
    rules_with_full_capture: rulesWithFullCapture,
    rules_with_profitability_proven:
      args.agentEdgeProof.profitability_guard.rules_with_profitability_proven,
    rules_positive_but_unproven:
      args.agentEdgeProof.profitability_guard.rules_positive_but_unproven,
    rules_with_resolved_trades: publicRules.filter(
      (rule) => rule.resolved_trades > 0,
    ).length,
    total_resolved_trades: publicRules.reduce(
      (sum, rule) => sum + rule.resolved_trades,
      0,
    ),
    total_window_pnl_usd: round2(
      publicRules.reduce((sum, rule) => sum + rule.window_pnl_usd, 0),
    ),
    missed_pnl_counts_as_proof: false,
    latest_snapshot_date: args.agentEdgeProof.latest_snapshot_date,
    latest_captured_at: latestCapturedAt(publicRules),
    selected_rule: selectedRule,
    rules: publicRules,
  };
}
