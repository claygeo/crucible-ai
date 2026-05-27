import type {
  AgentEdgeResolvedTradeLedgerEntry,
  PaperTradingExposureBreakdownRow,
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
  proof_policy:
    "Paper P&L is valid analytics evidence, but it is not capital-review evidence until source-level liquidity, spread, fee, and fill-size data is persisted.",
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
  liquidity_fields_available: false;
  slippage_adjusted_pnl_available: false;
  missing_fields: readonly string[];
  blocker: string;
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
  sources: PaperTradingLiquidityReviewSource[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function statusLabel(status: PaperTradingLiquidityReviewStatus): string {
  if (status === "clear") return "Clear";
  if (status === "blocked") return "Blocked";
  if (status === "collecting") return "Collecting";
  return "Unavailable";
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
  resolvedTrades: AgentEdgeResolvedTradeLedgerEntry[],
): PaperTradingLiquidityReviewSource {
  const hasSourceActivity =
    (row?.signal_count ?? 0) > 0 || resolvedTrades.length > 0;
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
    liquidity_fields_available: false,
    slippage_adjusted_pnl_available: false,
    missing_fields: PAPER_TRADING_LIQUIDITY_RULES.required_source_fields,
    blocker:
      "No source-level spread, depth, fee, or fill-size evidence is persisted for these paper tickets.",
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
        resolvedBySource.get(sourceId) ?? [],
      ),
    );

  const blockedSourceCount = sources.filter(
    (source) => source.status === "blocked",
  ).length;
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
    sources,
  };
}
