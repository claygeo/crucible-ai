import type {
  AgentEdgeResolvedTradeLedgerEntry,
  PaperTradingMarketExecutionQuality,
  PaperTradingExposureBreakdownRow,
  PaperTradingMarketExposureRow,
  TradingSnapshot,
} from "@/lib/trading";

export const PAPER_TRADING_LIQUIDITY_RULES = {
  required_source_fields: [
    "bid_ask_spread_at_entry",
    "order_book_depth_at_entry",
    "fee_schedule_at_entry",
    "max_fill_size_at_simulated_stake",
    "slippage_adjusted_entry_price",
  ],
  execution_stress_scenarios: [
    {
      id: "friction_50bps",
      label: "50 bps friction",
      total_friction_bps: 50,
    },
    {
      id: "friction_100bps",
      label: "100 bps friction",
      total_friction_bps: 100,
    },
    {
      id: "friction_250bps",
      label: "250 bps friction",
      total_friction_bps: 250,
    },
  ],
  proof_policy:
    "Paper P&L is valid analytics evidence, but it is not capital-review evidence until source-level liquidity, spread, fee, and fill-size data is persisted.",
  stress_policy:
    "Execution-friction stress subtracts a fixed basis-point cost from paper stake. It is a fragility screen only, not a replacement for persisted source-level liquidity data.",
} as const;

export type PaperTradingLiquidityReviewStatus =
  | "clear"
  | "blocked"
  | "collecting"
  | "unavailable";

export type PaperTradingLiquidityReviewSource = {
  source_id: string;
  source_label: string;
  status: "blocked" | "collecting";
  status_label: string;
  live_open_signals: number;
  unique_open_markets: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
  exposure_share: number;
  recent_resolved_trades: number;
  recent_resolved_net_pnl_usd: number;
  liquidity_fields_available: boolean;
  slippage_adjusted_pnl_available: false;
  execution_quality_sample_count: number;
  partial_execution_quality_market_count: number;
  measured_execution_quality_market_count: number;
  available_fields: string[];
  missing_fields: readonly string[];
  sample_markets: Array<{
    market_id: string;
    market_question: string;
    open_exposure_usd: number;
    signal_count: number;
    execution_quality: PaperTradingMarketExecutionQuality;
  }>;
  blocker: string;
};

export type PaperTradingExecutionStressScenario = {
  id: string;
  label: string;
  total_friction_bps: number;
  friction_cost_usd: number;
  net_pnl_after_friction_usd: number;
  roi_after_friction: number;
  remains_profitable: boolean;
};

export type PaperTradingExecutionStressRule = {
  strategy_id: string;
  strategy_label: string;
  agent_id: string;
  agent_name: string;
  min_edge: number;
  status: "survives_stress" | "fragile_profit" | "loss_making" | "collecting";
  status_label: string;
  resolved_trades: number;
  stake_usd: number;
  gross_net_pnl_usd: number;
  gross_roi_on_stake: number;
  break_even_win_rate: number | null;
  win_rate: number;
  worst_case_net_pnl_usd: number;
  worst_case_roi_on_stake: number;
  stress_evidence_counts_as_proof: false;
  scenarios: PaperTradingExecutionStressScenario[];
};

export type PaperTradingLiquidityReview = {
  schema_version: "1";
  generated_at: string;
  status: PaperTradingLiquidityReviewStatus;
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  capital_review_allowed: false;
  execution_recommendation: "paper_only_until_liquidity_evidence";
  source: TradingSnapshot["source"];
  rules: typeof PAPER_TRADING_LIQUIDITY_RULES;
  source_count: number;
  blocked_source_count: number;
  live_open_signals: number;
  unique_open_markets: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
  recent_resolved_trades: number;
  recent_resolved_net_pnl_usd: number;
  stress_scenario_count: number;
  stress_tested_rule_count: number;
  stress_surviving_rule_count: number;
  stress_fragile_rule_count: number;
  stress_loss_rule_count: number;
  stress_evidence_counts_as_proof: false;
  stress_rules: PaperTradingExecutionStressRule[];
  sources: PaperTradingLiquidityReviewSource[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function statusLabel(status: PaperTradingLiquidityReviewStatus): string {
  if (status === "clear") return "Clear";
  if (status === "blocked") return "Blocked";
  if (status === "collecting") return "Collecting";
  return "Unavailable";
}

function stressRuleStatusLabel(
  status: PaperTradingExecutionStressRule["status"],
): string {
  if (status === "survives_stress") return "Survives stress";
  if (status === "fragile_profit") return "Fragile profit";
  if (status === "loss_making") return "Loss making";
  return "Collecting";
}

function uniqueRecentResolvedTrades(
  snapshot: TradingSnapshot,
): AgentEdgeResolvedTradeLedgerEntry[] {
  const byPrediction = new Map<string, AgentEdgeResolvedTradeLedgerEntry>();
  for (const rule of snapshot.agent_edge_trade_ledger.rules) {
    for (const trade of rule.recent_resolved_trades) {
      const previous = byPrediction.get(trade.prediction_id);
      if (
        !previous ||
        Date.parse(trade.resolved_at ?? trade.created_at) >
          Date.parse(previous.resolved_at ?? previous.created_at)
      ) {
        byPrediction.set(trade.prediction_id, trade);
      }
    }
  }
  return [...byPrediction.values()];
}

function sourceRowFromOpenExposure(
  row: PaperTradingExposureBreakdownRow | undefined,
  sourceId: string,
  marketRows: PaperTradingMarketExposureRow[],
  resolvedTrades: AgentEdgeResolvedTradeLedgerEntry[],
): PaperTradingLiquidityReviewSource {
  const hasSourceActivity =
    (row?.signal_count ?? 0) > 0 || resolvedTrades.length > 0;
  const sampleMarkets = marketRows
    .filter((market) => market.market_source === sourceId)
    .slice(0, 8)
    .map((market) => ({
      market_id: market.market_id,
      market_question: market.market_question,
      open_exposure_usd: market.open_exposure_usd,
      signal_count: market.signal_count,
      execution_quality: market.execution_quality,
    }));
  const availableFields = Array.from(
    new Set(
      sampleMarkets.flatMap(
        (market) => market.execution_quality.available_fields,
      ),
    ),
  ).sort();
  const missingFields = PAPER_TRADING_LIQUIDITY_RULES.required_source_fields
    .filter((field) => !availableFields.includes(field))
    .sort();
  const measuredMarketCount = sampleMarkets.filter(
    (market) => market.execution_quality.status === "measured",
  ).length;
  const partialMarketCount = sampleMarkets.filter(
    (market) => market.execution_quality.status === "partial",
  ).length;
  return {
    source_id: sourceId,
    source_label: row?.label ?? sourceId,
    status: hasSourceActivity ? "blocked" : "collecting",
    status_label: hasSourceActivity ? "Blocked" : "Collecting",
    live_open_signals: row?.signal_count ?? 0,
    unique_open_markets: row?.market_count ?? 0,
    open_exposure_usd: row?.open_exposure_usd ?? 0,
    open_expected_pnl_usd: row?.open_expected_pnl_usd ?? 0,
    exposure_share: row?.exposure_share ?? 0,
    recent_resolved_trades: resolvedTrades.length,
    recent_resolved_net_pnl_usd: round2(
      resolvedTrades.reduce((sum, trade) => sum + trade.pnl_usd, 0),
    ),
    liquidity_fields_available: missingFields.length === 0,
    slippage_adjusted_pnl_available: false,
    execution_quality_sample_count: sampleMarkets.length,
    partial_execution_quality_market_count: partialMarketCount,
    measured_execution_quality_market_count: measuredMarketCount,
    available_fields: availableFields,
    missing_fields: missingFields,
    sample_markets: sampleMarkets,
    blocker:
      missingFields.length ===
      PAPER_TRADING_LIQUIDITY_RULES.required_source_fields.length
        ? "No source-level spread, depth, fee, or fill-size evidence is persisted for these paper tickets."
        : missingFields.length === 1
          ? `Partial execution-quality evidence exists, but ${missingFields[0]} still blocks capital review.`
          : `Partial execution-quality evidence exists, but ${missingFields.join(
              ", ",
            )} still block capital review.`,
  };
}

function buildStressRule(
  rule: TradingSnapshot["agent_edge_trade_ledger"]["rules"][number],
): PaperTradingExecutionStressRule {
  const scenarios =
    PAPER_TRADING_LIQUIDITY_RULES.execution_stress_scenarios.map((scenario) => {
      const frictionCostUsd =
        rule.stake_usd * (scenario.total_friction_bps / 10000);
      const netPnlAfterFriction = rule.net_pnl_usd - frictionCostUsd;
      return {
        id: scenario.id,
        label: scenario.label,
        total_friction_bps: scenario.total_friction_bps,
        friction_cost_usd: round2(frictionCostUsd),
        net_pnl_after_friction_usd: round2(netPnlAfterFriction),
        roi_after_friction:
          rule.stake_usd > 0 ? round4(netPnlAfterFriction / rule.stake_usd) : 0,
        remains_profitable: netPnlAfterFriction > 0,
      };
    });
  const worstCase = scenarios[scenarios.length - 1] ?? null;
  const hasResolvedTrades = rule.resolved_trades > 0;
  const status: PaperTradingExecutionStressRule["status"] = !hasResolvedTrades
    ? "collecting"
    : rule.net_pnl_usd <= 0
      ? "loss_making"
      : scenarios.every((scenario) => scenario.remains_profitable)
        ? "survives_stress"
        : "fragile_profit";

  return {
    strategy_id: rule.strategy_id,
    strategy_label: rule.strategy_label,
    agent_id: rule.agent_id,
    agent_name: rule.agent_name,
    min_edge: rule.min_edge,
    status,
    status_label: stressRuleStatusLabel(status),
    resolved_trades: rule.resolved_trades,
    stake_usd: rule.stake_usd,
    gross_net_pnl_usd: rule.net_pnl_usd,
    gross_roi_on_stake: rule.roi_on_stake,
    break_even_win_rate: rule.break_even_win_rate,
    win_rate: rule.win_rate,
    worst_case_net_pnl_usd: worstCase?.net_pnl_after_friction_usd ?? 0,
    worst_case_roi_on_stake: worstCase?.roi_after_friction ?? 0,
    stress_evidence_counts_as_proof: false,
    scenarios,
  };
}

export function buildPaperTradingLiquidityReview(
  snapshot: TradingSnapshot,
  generatedAt = new Date().toISOString(),
): PaperTradingLiquidityReview {
  const resolvedBySource = new Map<
    string,
    AgentEdgeResolvedTradeLedgerEntry[]
  >();
  for (const trade of uniqueRecentResolvedTrades(snapshot)) {
    resolvedBySource.set(trade.market_source, [
      ...(resolvedBySource.get(trade.market_source) ?? []),
      trade,
    ]);
  }

  const openRowsBySource = new Map(
    snapshot.market_exposure_digest.by_source.map((row) => [row.id, row]),
  );
  const sourceIds = new Set<string>([
    ...openRowsBySource.keys(),
    ...resolvedBySource.keys(),
  ]);
  const sources = [...sourceIds]
    .sort((a, b) => a.localeCompare(b))
    .map((sourceId) =>
      sourceRowFromOpenExposure(
        openRowsBySource.get(sourceId),
        sourceId,
        snapshot.market_exposure_digest.top_markets,
        resolvedBySource.get(sourceId) ?? [],
      ),
    );

  const blockedSourceCount = sources.filter(
    (source) => source.status === "blocked",
  ).length;
  const stressRules = snapshot.agent_edge_trade_ledger.rules
    .map(buildStressRule)
    .sort((a, b) => {
      if (b.resolved_trades !== a.resolved_trades) {
        return b.resolved_trades - a.resolved_trades;
      }
      if (b.worst_case_net_pnl_usd !== a.worst_case_net_pnl_usd) {
        return b.worst_case_net_pnl_usd - a.worst_case_net_pnl_usd;
      }
      return `${a.agent_id}-${a.min_edge}`.localeCompare(
        `${b.agent_id}-${b.min_edge}`,
      );
    });
  const stressTestedRules = stressRules.filter(
    (rule) => rule.resolved_trades > 0,
  );
  const unavailable = snapshot.source !== "live";
  const status: PaperTradingLiquidityReviewStatus = unavailable
    ? "unavailable"
    : blockedSourceCount > 0
      ? "blocked"
      : sources.length > 0
        ? "collecting"
        : "collecting";

  return {
    schema_version: "1",
    generated_at: generatedAt,
    status,
    status_label: statusLabel(status),
    message: unavailable
      ? "Liquidity review requires live source data."
      : blockedSourceCount > 0
        ? "Source-level liquidity and slippage evidence is missing for paper strategies with live activity."
        : "No live source activity needs liquidity review yet.",
    next_required_action: unavailable
      ? "Restore live prediction data before source-level liquidity review."
      : blockedSourceCount > 0
        ? "Persist source-level spread, depth, fee, and fill-size snapshots before any capital review."
        : "Keep collecting paper signals until source-level liquidity evidence is needed.",
    paper_only: true,
    real_money_execution_allowed: false,
    capital_review_allowed: false,
    execution_recommendation: "paper_only_until_liquidity_evidence",
    source: snapshot.source,
    rules: PAPER_TRADING_LIQUIDITY_RULES,
    source_count: sources.length,
    blocked_source_count: blockedSourceCount,
    live_open_signals: snapshot.market_exposure_digest.open_live_signals,
    unique_open_markets: snapshot.market_exposure_digest.unique_open_markets,
    open_exposure_usd: snapshot.market_exposure_digest.total_open_exposure_usd,
    open_expected_pnl_usd:
      snapshot.market_exposure_digest.total_open_expected_pnl_usd,
    recent_resolved_trades: sources.reduce(
      (sum, source) => sum + source.recent_resolved_trades,
      0,
    ),
    recent_resolved_net_pnl_usd: round2(
      sources.reduce(
        (sum, source) => sum + source.recent_resolved_net_pnl_usd,
        0,
      ),
    ),
    stress_scenario_count:
      PAPER_TRADING_LIQUIDITY_RULES.execution_stress_scenarios.length,
    stress_tested_rule_count: stressTestedRules.length,
    stress_surviving_rule_count: stressRules.filter(
      (rule) => rule.status === "survives_stress",
    ).length,
    stress_fragile_rule_count: stressRules.filter(
      (rule) => rule.status === "fragile_profit",
    ).length,
    stress_loss_rule_count: stressRules.filter(
      (rule) => rule.status === "loss_making",
    ).length,
    stress_evidence_counts_as_proof: false,
    stress_rules: stressRules,
    sources,
  };
}
