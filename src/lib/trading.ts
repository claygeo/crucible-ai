import { createClient } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agents";
import { DEMO_MARKETS, DEMO_PREDICTIONS } from "@/lib/demo-data";
import { cleanReasoning } from "@/lib/format";

export type TradingSource = "live" | "demo";
export type TradeSide = "YES" | "NO";
export type StakeMode = "kelly_capped" | "flat";
export type TradingSample = "all" | "live_only" | "backfill";

export type PaperTradingConfig = {
  bankrollUsd: number;
  minEdge: number;
  minEntryPrice: number;
  maxEntryPrice: number;
  kellyFraction: number;
  maxStakeUsd: number;
  maxOpenExposureUsd: number;
  minStakeUsd: number;
  flatStakeUsd: number;
  maxRows: number;
  topOpenSignals: number;
  dailyWindowDays: number;
};

export const PAPER_TRADING_CONFIG: PaperTradingConfig = {
  bankrollUsd: 5_000,
  minEdge: 0.05,
  minEntryPrice: 0.02,
  maxEntryPrice: 0.98,
  kellyFraction: 0.25,
  maxStakeUsd: 100,
  maxOpenExposureUsd: 500,
  minStakeUsd: 5,
  flatStakeUsd: 25,
  maxRows: 5_000,
  topOpenSignals: 16,
  dailyWindowDays: 30,
};

export const TRADING_SAMPLE_OPTIONS = ["live_only", "all", "backfill"] as const;
export const TRADING_STAKE_MODE_OPTIONS = ["kelly_capped", "flat"] as const;
export const TRADING_SIDE_OPTIONS = ["all", "YES", "NO"] as const;
export const TRADING_CATEGORY_OPTIONS = [
  "all",
  "politics",
  "sports",
  "ai-tech",
  "crypto",
  "other",
] as const;
export const TRADING_MIN_EDGE_OPTIONS = [0.05, 0.1, 0.15, 0.2] as const;

export const PAPER_TRADING_PROOF_RULES = {
  requiredLiveDays: 30,
  requiredResolvedTrades: 30,
  minResolvedNetPnlUsd: 1,
  minRoiOnStake: 0,
  maxDrawdownUsd: 500,
};

export const PAPER_TRADING_ATTRIBUTION_RULES = {
  minimumResolvedTradesForAttributionReview:
    PAPER_TRADING_PROOF_RULES.requiredResolvedTrades,
  topPnlShareConcentrationThreshold: 0.6,
  topTradeShareConcentrationThreshold: 0.6,
};

export type TradingControls = {
  sample: TradingSample;
  agent_id: string | null;
  category: string | null;
  side: TradeSide | null;
  min_edge: number;
  stake_mode: StakeMode;
  flat_stake_usd: number;
  max_stake_usd: number;
  max_open_exposure_usd: number;
};

export type TradingParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined | null>;

export const DEFAULT_TRADING_CONTROLS: TradingControls = {
  sample: "live_only",
  agent_id: null,
  category: null,
  side: null,
  min_edge: 0.1,
  stake_mode: "kelly_capped",
  flat_stake_usd: PAPER_TRADING_CONFIG.flatStakeUsd,
  max_stake_usd: PAPER_TRADING_CONFIG.maxStakeUsd,
  max_open_exposure_usd: PAPER_TRADING_CONFIG.maxOpenExposureUsd,
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

type MarketStatus =
  | "open"
  | "pending_resolution"
  | "resolved"
  | "disputed"
  | "voided";

type PredictionMarketRow = {
  id: string;
  agent_id: string;
  market_id: string;
  probability: number;
  confidence: string;
  reasoning: string;
  market_price_at_forecast: number;
  is_backfill: boolean;
  created_at: string;
  market: {
    id: string;
    source: string;
    question: string;
    category: string;
    url: string | null;
    status: MarketStatus;
    resolved_outcome: boolean | null;
    resolved_at: string | null;
    closes_at: string | null;
    outcome_yes_price: number;
  };
};

export type PaperTrade = {
  prediction_id: string;
  agent_id: string;
  agent_name: string;
  market_id: string;
  market_question: string;
  market_source: string;
  market_category: string;
  market_url: string | null;
  market_status: MarketStatus;
  market_closes_at: string | null;
  side: TradeSide;
  probability: number;
  market_price: number;
  edge: number;
  abs_edge: number;
  stake_usd: number;
  max_loss_usd: number;
  profit_if_correct_usd: number;
  expected_pnl_usd: number;
  resolved_outcome: boolean | null;
  resolved_at: string | null;
  created_at: string;
  is_backfill: boolean;
  confidence: string;
  reasoning: string;
  won: boolean | null;
  pnl_usd: number | null;
};

export type AgentTradingSummary = {
  rank: number;
  agent_id: string;
  agent_name: string;
  trades: number;
  live_trades: number;
  backfill_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  stake_usd: number;
  net_pnl_usd: number;
  roi_on_stake: number;
  avg_edge: number;
  avg_stake_usd: number;
  avg_expected_pnl_usd: number;
  max_drawdown_usd: number;
};

export type ScenarioSummary = {
  id: string;
  label: string;
  min_edge: number;
  stake_mode: StakeMode;
  trades: number;
  wins: number;
  win_rate: number;
  stake_usd: number;
  net_pnl_usd: number;
  roi_on_stake: number;
  avg_edge: number;
  avg_stake_usd: number;
  max_loss_per_trade_usd: number;
};

export type TradingTotals = {
  eligible_predictions: number;
  resolved_trades: number;
  open_signals: number;
  resolved_stake_usd: number;
  resolved_net_pnl_usd: number;
  resolved_roi_on_stake: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
  live_resolved_trades: number;
  backfill_resolved_trades: number;
};

export type ResolutionWatchSignal = {
  prediction_id: string;
  market_id: string;
  market_question: string;
  market_source: string;
  market_url: string | null;
  market_status: MarketStatus;
  agent_id: string;
  agent_name: string;
  side: TradeSide;
  stake_usd: number;
  expected_pnl_usd: number;
  market_closes_at: string | null;
  created_at: string;
  close_status: "overdue" | "closing_next_7d" | "future" | "unknown_close";
  tradability_status: "tradable" | "needs_review";
  days_until_close: number | null;
  age_days: number;
};

export type TradingResolutionWatch = {
  status: "waiting_resolution" | "overdue_resolution" | "no_open_live_signals";
  status_label: string;
  open_live_signals: number;
  overdue_live_signals: number;
  tradable_open_live_signals: number;
  review_required_live_signals: number;
  closing_next_7d_signals: number;
  unknown_close_live_signals: number;
  next_close_at: string | null;
  oldest_opened_at: string | null;
  total_open_exposure_usd: number;
  total_open_expected_pnl_usd: number;
  tradable_open_exposure_usd: number;
  tradable_open_expected_pnl_usd: number;
  review_required_open_exposure_usd: number;
  review_required_open_expected_pnl_usd: number;
  signals: ResolutionWatchSignal[];
};

export type PaperTradingWouldTradeSignal = {
  prediction_id: string;
  market_id: string;
  market_question: string;
  market_source: string;
  market_url: string | null;
  agent_id: string;
  agent_name: string;
  side: TradeSide;
  probability: number;
  market_price: number;
  edge: number;
  abs_edge: number;
  stake_usd: number;
  max_loss_usd: number;
  profit_if_correct_usd: number;
  expected_pnl_usd: number;
  market_closes_at: string | null;
  created_at: string;
  close_status: ResolutionWatchSignal["close_status"];
  tradability_status: ResolutionWatchSignal["tradability_status"];
  days_until_close: number | null;
  age_days: number;
};

export type PaperTradingWouldTradeStrategy = {
  rank: number;
  strategy_id: string;
  strategy_label: string;
  sample: TradingSample;
  min_edge: number;
  stake_mode: StakeMode;
  proof_status: ProofGateStatus;
  proof_status_label: string;
  open_signals: number;
  tradable_signals: number;
  review_required_signals: number;
  open_exposure_usd: number;
  tradable_open_exposure_usd: number;
  open_expected_pnl_usd: number;
  tradable_open_expected_pnl_usd: number;
  avg_edge: number;
  top_signals: PaperTradingWouldTradeSignal[];
  paper_only: true;
  real_money_execution_allowed: false;
};

export type PaperTradingWouldTradeFeed = {
  schema_version: "1";
  generated_at: string;
  status: "blocked" | "collecting" | "no_live_signals";
  status_label: string;
  message: string;
  execution_recommendation: "paper_watch_only";
  capital_review_allowed: false;
  paper_only: true;
  real_money_execution_allowed: false;
  selected_strategy_id: string;
  selected_strategy: PaperTradingWouldTradeStrategy | null;
  global_resolution_status: TradingResolutionWatch["status"];
  global_resolution_status_label: string;
  global_open_live_signals: number;
  global_review_required_live_signals: number;
  global_overdue_live_signals: number;
  global_unknown_close_live_signals: number;
  global_review_required_signals: ResolutionWatchSignal[];
  unique_open_signals: number;
  unique_tradable_signals: number;
  unique_review_required_signals: number;
  unique_open_exposure_usd: number;
  unique_tradable_open_exposure_usd: number;
  unique_open_expected_pnl_usd: number;
  unique_tradable_open_expected_pnl_usd: number;
  top_strategies: PaperTradingWouldTradeStrategy[];
};

export type PaperTradingMarketExposureSignal = {
  prediction_id: string;
  agent_id: string;
  agent_name: string;
  side: TradeSide;
  stake_usd: number;
  expected_pnl_usd: number;
  edge: number;
  abs_edge: number;
  created_at: string;
  close_status: ResolutionWatchSignal["close_status"];
  tradability_status: ResolutionWatchSignal["tradability_status"];
};

export type PaperTradingMarketExposureRow = {
  market_id: string;
  market_question: string;
  market_source: string;
  market_category: string;
  market_url: string | null;
  market_closes_at: string | null;
  signal_count: number;
  agent_count: number;
  agents: string[];
  sides: TradeSide[];
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
  exposure_share: number;
  expected_pnl_share: number;
  max_abs_edge: number;
  avg_abs_edge: number;
  review_required_signals: number;
  tradable_signals: number;
  top_signals: PaperTradingMarketExposureSignal[];
};

export type PaperTradingExposureBreakdownRow = {
  id: string;
  label: string;
  market_count: number;
  signal_count: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
  exposure_share: number;
};

export type PaperTradingMarketExposureDigest = {
  schema_version: "1";
  generated_at: string;
  status: "no_open_live_signals" | "observing" | "concentrated";
  status_label: string;
  message: string;
  paper_only: true;
  real_money_execution_allowed: false;
  concentration_review_only: true;
  concentration_threshold: number;
  open_live_signals: number;
  unique_open_markets: number;
  multi_signal_markets: number;
  multi_agent_markets: number;
  review_required_markets: number;
  total_open_exposure_usd: number;
  total_open_expected_pnl_usd: number;
  top_market_exposure_usd: number;
  top_market_expected_pnl_usd: number;
  top_market_exposure_share: number;
  top_market_signal_share: number;
  by_source: PaperTradingExposureBreakdownRow[];
  by_category: PaperTradingExposureBreakdownRow[];
  top_markets: PaperTradingMarketExposureRow[];
};

export type ProofGateStatus =
  | "collecting"
  | "candidate"
  | "not_qualified"
  | "control_only";

export type StrategyProofGate = {
  strategy_id: string;
  strategy_label: string;
  status: ProofGateStatus;
  status_label: string;
  rules: typeof PAPER_TRADING_PROOF_RULES;
  calendar_days_observed: number;
  active_ticket_days: number;
  resolved_trades: number;
  open_signals: number;
  resolved_net_pnl_usd: number;
  resolved_roi_on_stake: number;
  max_drawdown_usd: number;
  avg_daily_pnl_usd: number;
  positive_days: number;
  losing_days: number;
  first_ticket_at: string | null;
  latest_ticket_at: string | null;
  blockers: string[];
};

export type ExposureLedgerEntry = {
  prediction_id: string;
  market_id: string;
  market_question: string;
  agent_id: string;
  agent_name: string;
  side: TradeSide;
  created_at: string;
  resolved_at: string | null;
  stake_usd: number;
  expected_pnl_usd: number;
  pnl_usd: number | null;
  missed_pnl_usd: number | null;
  open_exposure_before_usd: number;
  open_exposure_after_usd: number;
  status: "accepted" | "skipped_exposure_cap";
  reason: string | null;
};

export type ExposureLedgerSummary = {
  max_open_exposure_usd: number;
  accepted_trades: number;
  skipped_trades: number;
  accepted_open_signals: number;
  skipped_open_signals: number;
  accepted_resolved_trades: number;
  skipped_resolved_trades: number;
  skipped_profitable_resolved_trades: number;
  skipped_loss_resolved_trades: number;
  accepted_resolved_net_pnl_usd: number;
  skipped_resolved_net_pnl_usd: number;
  current_open_exposure_usd: number;
  peak_open_exposure_usd: number;
  skipped_exposure_usd: number;
  accepted_expected_open_pnl_usd: number;
  skipped_expected_open_pnl_usd: number;
  recent_entries: ExposureLedgerEntry[];
};

export type StrategyVariantSummary = {
  id: string;
  label: string;
  description: string;
  is_custom: boolean;
  sample: TradingSample;
  min_edge: number;
  stake_mode: StakeMode;
  flat_stake_usd: number;
  max_stake_usd: number;
  agent_ids: string[];
  category: string | null;
  side: TradeSide | null;
  resolved_trades: number;
  open_signals: number;
  wins: number;
  losses: number;
  win_rate: number;
  stake_usd: number;
  net_pnl_usd: number;
  roi_on_stake: number;
  avg_edge: number;
  avg_stake_usd: number;
  max_drawdown_usd: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
  exposure_ledger: ExposureLedgerSummary;
  proof_gate: StrategyProofGate;
};

export type AgentEdgeRuleSummary = {
  strategy_id: string;
  strategy_label: string;
  agent_id: string;
  agent_name: string;
  min_edge: number;
  stake_mode: StakeMode;
  proof_status: ProofGateStatus;
  proof_status_label: string;
  resolved_trades: number;
  open_signals: number;
  skipped_trades: number;
  skipped_open_signals: number;
  skipped_resolved_trades: number;
  skipped_profitable_resolved_trades: number;
  skipped_loss_resolved_trades: number;
  skipped_resolved_net_pnl_usd: number;
  skipped_expected_open_pnl_usd: number;
  missed_pnl_counts_as_proof: false;
  resolved_net_pnl_usd: number;
  resolved_roi_on_stake: number;
  avg_edge: number;
  avg_stake_usd: number;
  max_drawdown_usd: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
};

export type AgentEdgeOpenSignalWatchlistRule = {
  strategy_id: string;
  strategy_label: string;
  agent_id: string;
  agent_name: string;
  min_edge: number;
  stake_mode: StakeMode;
  proof_status: ProofGateStatus;
  proof_status_label: string;
  open_signals: number;
  tradable_signals: number;
  review_required_signals: number;
  open_exposure_usd: number;
  tradable_open_exposure_usd: number;
  open_expected_pnl_usd: number;
  tradable_open_expected_pnl_usd: number;
  avg_abs_edge: number;
  next_close_at: string | null;
  oldest_opened_at: string | null;
  top_open_signals: PaperTradingWouldTradeSignal[];
};

export type AgentEdgeOpenSignalWatchlist = {
  schema_version: "1";
  generated_at: string;
  status: "watching" | "blocked" | "no_open_signals" | "unavailable";
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  execution_recommendation: "paper_watch_only";
  rule_count: number;
  rules_with_open_signals: number;
  rules_with_tradable_signals: number;
  rules_needing_review: number;
  total_open_signals: number;
  total_tradable_signals: number;
  total_review_required_signals: number;
  total_open_exposure_usd: number;
  total_tradable_open_exposure_usd: number;
  total_open_expected_pnl_usd: number;
  total_tradable_open_expected_pnl_usd: number;
  next_close_at: string | null;
  oldest_opened_at: string | null;
  rules: AgentEdgeOpenSignalWatchlistRule[];
};

export type AgentEdgeProofRunwayRule = {
  strategy_id: string;
  strategy_label: string;
  agent_id: string;
  agent_name: string;
  min_edge: number;
  stake_mode: StakeMode;
  proof_status: ProofGateStatus;
  proof_status_label: string;
  status:
    | "sample_complete"
    | "sample_reachable"
    | "collecting"
    | "blocked"
    | "starved";
  status_label: string;
  next_required_action: string;
  resolved_trades: number;
  required_resolved_trades: number;
  resolved_trades_remaining: number;
  open_signals: number;
  tradable_open_signals: number;
  review_required_signals: number;
  closing_next_7d_signals: number;
  pending_resolution_capacity: number;
  sample_gap_after_open: number;
  can_reach_required_sample_with_open: boolean;
  next_close_at: string | null;
  oldest_opened_at: string | null;
  top_open_signals: PaperTradingWouldTradeSignal[];
};

export type AgentEdgeProofRunway = {
  schema_version: "1";
  generated_at: string;
  status:
    | "sample_complete"
    | "sample_reachable"
    | "collecting"
    | "blocked"
    | "starved"
    | "unavailable";
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  execution_recommendation: "paper_watch_only";
  required_resolved_trades: number;
  rule_count: number;
  sample_complete_rule_count: number;
  sample_reachable_rule_count: number;
  collecting_rule_count: number;
  blocked_rule_count: number;
  starved_rule_count: number;
  total_resolved_trades: number;
  total_resolved_trades_remaining: number;
  total_open_signals: number;
  total_tradable_open_signals: number;
  total_review_required_signals: number;
  total_closing_next_7d_signals: number;
  total_pending_resolution_capacity: number;
  total_sample_gap_after_open: number;
  minimum_sample_gap_after_open: number | null;
  best_rule_strategy_id: string | null;
  next_close_at: string | null;
  rules: AgentEdgeProofRunwayRule[];
};

export type AgentEdgeResolvedTradeLedgerEntry = {
  prediction_id: string;
  market_id: string;
  market_question: string;
  market_source: string;
  market_url: string | null;
  agent_id: string;
  agent_name: string;
  side: TradeSide;
  probability: number;
  market_price: number;
  edge: number;
  abs_edge: number;
  stake_usd: number;
  pnl_usd: number;
  roi_on_stake: number;
  won: boolean;
  created_at: string;
  resolved_at: string | null;
};

export type AgentEdgeResolvedTradeLedgerRule = {
  strategy_id: string;
  strategy_label: string;
  agent_id: string;
  agent_name: string;
  min_edge: number;
  resolved_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  stake_usd: number;
  net_pnl_usd: number;
  roi_on_stake: number;
  avg_entry_price: number;
  avg_probability: number;
  avg_model_probability_correct: number;
  avg_abs_edge: number;
  avg_profit_if_correct_usd: number;
  avg_loss_if_wrong_usd: number;
  avg_pnl_per_trade_usd: number;
  payoff_ratio: number | null;
  break_even_win_rate: number | null;
  win_rate_edge: number | null;
  model_probability_edge_to_break_even: number | null;
  above_break_even: boolean;
  latest_resolved_at: string | null;
  recent_resolved_trades: AgentEdgeResolvedTradeLedgerEntry[];
};

export type AgentEdgeResolvedTradeLedger = {
  schema_version: "1";
  generated_at: string;
  status: "available" | "collecting" | "unavailable";
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  rule_count: number;
  resolved_rule_count: number;
  profitable_rule_count: number;
  above_break_even_rule_count: number;
  below_break_even_rule_count: number;
  total_resolved_trades: number;
  total_net_pnl_usd: number;
  latest_resolved_at: string | null;
  rules: AgentEdgeResolvedTradeLedgerRule[];
};

export type AgentEdgeProfitAttributionStatus =
  | "diversified"
  | "concentrated"
  | "collecting"
  | "unavailable";

export type AgentEdgeProfitAttributionGroup = {
  id: string;
  label: string;
  resolved_trades: number;
  wins: number;
  losses: number;
  stake_usd: number;
  net_pnl_usd: number;
  roi_on_stake: number;
  avg_pnl_per_trade_usd: number;
  pnl_share: number;
  trade_share: number;
};

export type AgentEdgeProfitAttributionMarket =
  AgentEdgeProfitAttributionGroup & {
    market_id: string;
    market_question: string;
    market_source: string;
    market_category: string;
    market_url: string | null;
  };

export type AgentEdgeProfitAttributionRule = {
  strategy_id: string;
  strategy_label: string;
  agent_id: string;
  agent_name: string;
  min_edge: number;
  status: AgentEdgeProfitAttributionStatus;
  status_label: string;
  resolved_trades: number;
  required_resolved_trades: number;
  net_pnl_usd: number;
  stake_usd: number;
  roi_on_stake: number;
  distinct_sources: number;
  distinct_categories: number;
  distinct_markets: number;
  top_source_pnl_share: number;
  top_category_pnl_share: number;
  top_market_pnl_share: number;
  top_market_trade_share: number;
  concentration_flags: string[];
  by_source: AgentEdgeProfitAttributionGroup[];
  by_category: AgentEdgeProfitAttributionGroup[];
  top_markets: AgentEdgeProfitAttributionMarket[];
};

export type AgentEdgeProfitAttribution = {
  schema_version: "1";
  generated_at: string;
  status: AgentEdgeProfitAttributionStatus;
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  profit_attribution_review_only: true;
  rules: typeof PAPER_TRADING_ATTRIBUTION_RULES;
  rule_count: number;
  resolved_rule_count: number;
  profitable_rule_count: number;
  concentrated_rule_count: number;
  diversified_rule_count: number;
  total_resolved_trades: number;
  total_net_pnl_usd: number;
  top_rule_strategy_id: string | null;
  top_rule_label: string | null;
  rules_by_strategy: AgentEdgeProfitAttributionRule[];
};

export type DailyEvidenceSnapshot = {
  date: string;
  sample: TradingSample;
  locked_trades: number;
  resolved_trades: number;
  open_signals: number;
  wins: number;
  losses: number;
  total_risk_usd: number;
  resolved_stake_usd: number;
  net_pnl_usd: number;
  cumulative_pnl_usd: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
};

export type StrategyDailyEvidenceSeries = {
  strategy_id: string;
  strategy_label: string;
  sample: TradingSample;
  is_custom: boolean;
  proof_status: ProofGateStatus;
  proof_status_label: string;
  days: DailyEvidenceSnapshot[];
};

export type PaperTradingStrategyRegistryEntry = {
  id: string;
  label: string;
  description: string;
  is_custom: boolean;
  sample: TradingSample;
  min_edge: number;
  stake_mode: StakeMode;
  flat_stake_usd: number;
  max_stake_usd: number;
  max_open_exposure_usd: number;
  agent_ids: string[];
  category: string | null;
  side: TradeSide | null;
  proof_scope: "live_candidate" | "control";
  paper_only: true;
  real_money_execution_allowed: false;
};

export type PaperTradingStrategyRegistry = {
  schema_version: "1";
  generated_at: string;
  paper_only: true;
  real_money_execution_allowed: false;
  config: typeof PAPER_TRADING_CONFIG;
  proof_rules: typeof PAPER_TRADING_PROOF_RULES;
  agent_edge_gates: number[];
  strategy_count: number;
  live_strategy_count: number;
  control_strategy_count: number;
  configurable_controls: {
    samples: readonly string[];
    stake_modes: readonly string[];
    sides: readonly string[];
    categories: readonly string[];
    min_edges: readonly number[];
    default_controls: TradingControls;
  };
  selected_strategy: PaperTradingStrategyRegistryEntry;
  entries: PaperTradingStrategyRegistryEntry[];
};

export type TradingSnapshot = {
  generated_at: string;
  source: TradingSource;
  schema_version: "1";
  config: typeof PAPER_TRADING_CONFIG;
  controls: TradingControls;
  strategy_registry: PaperTradingStrategyRegistry;
  would_trade_today: PaperTradingWouldTradeFeed;
  market_exposure_digest: PaperTradingMarketExposureDigest;
  totals: TradingTotals;
  live_totals: TradingTotals;
  backfill_totals: TradingTotals;
  resolution_watch: TradingResolutionWatch;
  selected_strategy: StrategyVariantSummary;
  proof_gates: StrategyProofGate[];
  selected_exposure_ledger: ExposureLedgerSummary;
  selected_open_signals: PaperTrade[];
  selected_recent_resolved: PaperTrade[];
  selected_daily_series: StrategyDailyEvidenceSeries;
  selected_daily_snapshots: DailyEvidenceSnapshot[];
  agent_summaries: AgentTradingSummary[];
  live_agent_summaries: AgentTradingSummary[];
  scenario_summaries: ScenarioSummary[];
  agent_edge_matrix: AgentEdgeRuleSummary[];
  agent_edge_watchlist: AgentEdgeOpenSignalWatchlist;
  agent_edge_runway: AgentEdgeProofRunway;
  agent_edge_trade_ledger: AgentEdgeResolvedTradeLedger;
  agent_edge_attribution: AgentEdgeProfitAttribution;
  strategy_variants: StrategyVariantSummary[];
  strategy_daily_series: StrategyDailyEvidenceSeries[];
  daily_snapshots: DailyEvidenceSnapshot[];
  live_daily_snapshots: DailyEvidenceSnapshot[];
  open_signals: PaperTrade[];
  recent_resolved: PaperTrade[];
};

type StrategyDefinition = {
  id: string;
  label: string;
  description: string;
  sample: TradingSample;
  minEdge: number;
  stakeMode: StakeMode;
  flatStakeUsd?: number;
  maxStakeUsd?: number;
  maxOpenExposureUsd?: number;
  agentIds?: string[];
  category?: string;
  side?: TradeSide;
  isCustom?: boolean;
};

type StrategyEvaluation = {
  summary: StrategyVariantSummary;
  acceptedTrades: PaperTrade[];
  ledger: ExposureLedgerSummary;
  dailySeries: StrategyDailyEvidenceSeries;
};

export const AGENT_EDGE_GATES = [0.05, 0.1] as const;

function edgeGateId(minEdge: number): string {
  return String(Math.round(minEdge * 100)).padStart(2, "0");
}

function edgeGateLabel(minEdge: number): string {
  return `${Math.round(minEdge * 100)}pp`;
}

const AGENT_EDGE_STRATEGY_DEFINITIONS: StrategyDefinition[] = AGENTS.flatMap(
  (agent) =>
    AGENT_EDGE_GATES.map((minEdge) => ({
      id: `${agent.id}-live-edge-${edgeGateId(minEdge)}`,
      label: `${agent.name} live, edge >= ${edgeGateLabel(minEdge)}`,
      description: `${agent.name} only. Tests whether ${agent.persona.toLowerCase()} produces tradable live edge at ${edgeGateLabel(minEdge)}.`,
      sample: "live_only" as TradingSample,
      minEdge,
      stakeMode: "kelly_capped" as StakeMode,
      agentIds: [agent.id],
    })),
);

const STRATEGY_DEFINITIONS: StrategyDefinition[] = [
  ...AGENT_EDGE_STRATEGY_DEFINITIONS,
  {
    id: "all-live-edge-10",
    label: "All agents live, edge >= 10pp",
    description:
      "Broad live strategy with a stricter edge gate across the house roster.",
    sample: "live_only",
    minEdge: 0.1,
    stakeMode: "kelly_capped",
  },
  {
    id: "crypto-live-edge-05",
    label: "Crypto live, edge >= 5pp",
    description: "Category-specific strategy for crypto markets.",
    sample: "live_only",
    minEdge: 0.05,
    stakeMode: "kelly_capped",
    category: "crypto",
  },
  {
    id: "sports-live-edge-10",
    label: "Sports live, edge >= 10pp",
    description:
      "Sports markets only. Keeps fast-resolving edge separate from politics.",
    sample: "live_only",
    minEdge: 0.1,
    stakeMode: "kelly_capped",
    category: "sports",
  },
  {
    id: "mirror-backfill-sanity",
    label: "Mirror backfill sanity",
    description:
      "Historical control. Useful for comparison, not a live-trading proof.",
    sample: "backfill",
    minEdge: 0.1,
    stakeMode: "kelly_capped",
    agentIds: ["mirror"],
  },
];

function readParam(source: TradingParamSource, key: string): string | null {
  if (source instanceof URLSearchParams) return source.get(key);
  const value = source[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function numberParam(
  source: TradingParamSource,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = readParam(source, key);
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function includesOption<T extends readonly string[]>(
  options: T,
  value: string | null,
): value is T[number] {
  return value !== null && options.includes(value);
}

export function parseTradingControls(
  source: TradingParamSource = {},
): TradingControls {
  const sampleRaw = readParam(source, "sample");
  const stakeModeRaw = readParam(source, "stake_mode");
  const sideRaw = readParam(source, "side");
  const categoryRaw = readParam(source, "category");
  const agentRaw = readParam(source, "agent");
  const agent = AGENTS.find((a) => a.id === agentRaw);

  return {
    sample: includesOption(TRADING_SAMPLE_OPTIONS, sampleRaw)
      ? sampleRaw
      : DEFAULT_TRADING_CONTROLS.sample,
    agent_id: agent ? agent.id : null,
    category:
      includesOption(TRADING_CATEGORY_OPTIONS, categoryRaw) &&
      categoryRaw !== "all"
        ? categoryRaw
        : null,
    side:
      includesOption(TRADING_SIDE_OPTIONS, sideRaw) && sideRaw !== "all"
        ? sideRaw
        : null,
    min_edge: round4(
      numberParam(
        source,
        "min_edge",
        DEFAULT_TRADING_CONTROLS.min_edge,
        0.01,
        0.5,
      ),
    ),
    stake_mode: includesOption(TRADING_STAKE_MODE_OPTIONS, stakeModeRaw)
      ? stakeModeRaw
      : DEFAULT_TRADING_CONTROLS.stake_mode,
    flat_stake_usd: round2(
      numberParam(
        source,
        "ticket_usd",
        DEFAULT_TRADING_CONTROLS.flat_stake_usd,
        PAPER_TRADING_CONFIG.minStakeUsd,
        PAPER_TRADING_CONFIG.maxStakeUsd,
      ),
    ),
    max_stake_usd: round2(
      numberParam(
        source,
        "max_stake_usd",
        DEFAULT_TRADING_CONTROLS.max_stake_usd,
        PAPER_TRADING_CONFIG.minStakeUsd,
        PAPER_TRADING_CONFIG.maxStakeUsd,
      ),
    ),
    max_open_exposure_usd: round2(
      numberParam(
        source,
        "max_open_exposure_usd",
        DEFAULT_TRADING_CONTROLS.max_open_exposure_usd,
        PAPER_TRADING_CONFIG.maxStakeUsd,
        PAPER_TRADING_CONFIG.bankrollUsd,
      ),
    ),
  };
}

export function tradingControlsToQuery(controls: TradingControls): string {
  const params = new URLSearchParams();
  params.set("sample", controls.sample);
  params.set("agent", controls.agent_id ?? "all");
  params.set("category", controls.category ?? "all");
  params.set("side", controls.side ?? "all");
  params.set("min_edge", String(controls.min_edge));
  params.set("stake_mode", controls.stake_mode);
  params.set("ticket_usd", String(controls.flat_stake_usd));
  params.set("max_stake_usd", String(controls.max_stake_usd));
  params.set("max_open_exposure_usd", String(controls.max_open_exposure_usd));
  return params.toString();
}

function strategyFromControls(controls: TradingControls): StrategyDefinition {
  const agent = controls.agent_id
    ? AGENTS.find((a) => a.id === controls.agent_id)
    : null;
  const sampleLabel =
    controls.sample === "live_only"
      ? "live"
      : controls.sample === "backfill"
        ? "backfill"
        : "all";
  const agentLabel = agent?.name ?? "All agents";
  const categoryLabel = controls.category ? `, ${controls.category}` : "";
  const sideLabel = controls.side ? `, ${controls.side}` : "";

  return {
    id: "selected-query",
    label: `${agentLabel} ${sampleLabel}, edge >= ${Math.round(
      controls.min_edge * 100,
    )}pp${categoryLabel}${sideLabel}`,
    description:
      "URL-configured paper strategy. Changes analytics only; no orders are created.",
    sample: controls.sample,
    minEdge: controls.min_edge,
    stakeMode: controls.stake_mode,
    flatStakeUsd: controls.flat_stake_usd,
    maxStakeUsd: controls.max_stake_usd,
    maxOpenExposureUsd: controls.max_open_exposure_usd,
    agentIds: controls.agent_id ? [controls.agent_id] : undefined,
    category: controls.category ?? undefined,
    side: controls.side ?? undefined,
    isCustom: true,
  };
}

function strategyRegistryEntry(
  strategy: StrategyDefinition,
): PaperTradingStrategyRegistryEntry {
  const strategyConfig = configForStrategy(strategy);

  return {
    id: strategy.id,
    label: strategy.label,
    description: strategy.description,
    is_custom: Boolean(strategy.isCustom),
    sample: strategy.sample,
    min_edge: strategy.minEdge,
    stake_mode: strategy.stakeMode,
    flat_stake_usd: strategyConfig.flatStakeUsd,
    max_stake_usd: strategyConfig.maxStakeUsd,
    max_open_exposure_usd: strategyConfig.maxOpenExposureUsd,
    agent_ids: strategy.agentIds ?? [],
    category: strategy.category ?? null,
    side: strategy.side ?? null,
    proof_scope: strategy.sample === "live_only" ? "live_candidate" : "control",
    paper_only: true,
    real_money_execution_allowed: false,
  };
}

export function buildPaperTradingStrategyRegistry(
  controls: TradingControls = DEFAULT_TRADING_CONTROLS,
  generatedAt = new Date().toISOString(),
): PaperTradingStrategyRegistry {
  const selectedStrategy = strategyRegistryEntry(
    strategyFromControls(controls),
  );
  const entries = STRATEGY_DEFINITIONS.map(strategyRegistryEntry);
  const liveStrategyCount = entries.filter(
    (entry) => entry.proof_scope === "live_candidate",
  ).length;

  return {
    schema_version: "1",
    generated_at: generatedAt,
    paper_only: true,
    real_money_execution_allowed: false,
    config: PAPER_TRADING_CONFIG,
    proof_rules: PAPER_TRADING_PROOF_RULES,
    agent_edge_gates: [...AGENT_EDGE_GATES],
    strategy_count: entries.length,
    live_strategy_count: liveStrategyCount,
    control_strategy_count: entries.length - liveStrategyCount,
    configurable_controls: {
      samples: TRADING_SAMPLE_OPTIONS,
      stake_modes: TRADING_STAKE_MODE_OPTIONS,
      sides: TRADING_SIDE_OPTIONS,
      categories: TRADING_CATEGORY_OPTIONS,
      min_edges: TRADING_MIN_EDGE_OPTIONS,
      default_controls: DEFAULT_TRADING_CONTROLS,
    },
    selected_strategy: selectedStrategy,
    entries,
  };
}

const clampProbability = (n: number) => Math.min(0.9999, Math.max(0.0001, n));

function validEntryPrice(n: number, config: PaperTradingConfig): number | null {
  if (!Number.isFinite(n)) return null;
  if (n < config.minEntryPrice || n > config.maxEntryPrice) {
    return null;
  }
  return n;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

function stakeForTrade(
  side: TradeSide,
  edge: number,
  entryPrice: number,
  stakeMode: StakeMode,
  config: PaperTradingConfig,
): number {
  if (stakeMode === "flat") return config.flatStakeUsd;

  const denominator = side === "YES" ? 1 - entryPrice : entryPrice;
  const fullKelly = denominator > 0 ? Math.abs(edge) / denominator : 0;
  const rawStake = config.bankrollUsd * config.kellyFraction * fullKelly;

  return round2(
    Math.min(config.maxStakeUsd, Math.max(config.minStakeUsd, rawStake)),
  );
}

function buildTrade(
  row: PredictionMarketRow,
  opts: { minEdge: number; stakeMode: StakeMode; config?: PaperTradingConfig },
): PaperTrade | null {
  const config = opts.config ?? PAPER_TRADING_CONFIG;
  const probability = clampProbability(Number(row.probability));
  const marketPrice = validEntryPrice(
    Number(row.market_price_at_forecast ?? row.market.outcome_yes_price ?? 0.5),
    config,
  );
  if (marketPrice === null) return null;
  const edge = probability - marketPrice;
  const absEdge = Math.abs(edge);

  if (!Number.isFinite(absEdge) || absEdge < opts.minEdge) return null;
  if (row.market.status === "voided" || row.market.status === "disputed")
    return null;

  const side: TradeSide = edge >= 0 ? "YES" : "NO";
  const stakeUsd = stakeForTrade(
    side,
    edge,
    marketPrice,
    opts.stakeMode,
    config,
  );
  const profitIfCorrectUsd =
    side === "YES"
      ? stakeUsd * ((1 - marketPrice) / marketPrice)
      : stakeUsd * (marketPrice / (1 - marketPrice));
  const modelProbCorrect = side === "YES" ? probability : 1 - probability;
  const expectedPnlUsd =
    modelProbCorrect * profitIfCorrectUsd + (1 - modelProbCorrect) * -stakeUsd;

  const isResolved =
    row.market.status === "resolved" && row.market.resolved_outcome !== null;
  const won = isResolved
    ? side === "YES"
      ? Boolean(row.market.resolved_outcome)
      : !Boolean(row.market.resolved_outcome)
    : null;
  const pnlUsd = won === null ? null : won ? profitIfCorrectUsd : -stakeUsd;

  const agent = AGENTS.find((a) => a.id === row.agent_id);

  return {
    prediction_id: row.id,
    agent_id: row.agent_id,
    agent_name: agent?.name ?? row.agent_id,
    market_id: row.market_id,
    market_question: row.market.question,
    market_source: row.market.source,
    market_category: row.market.category ?? "other",
    market_url: row.market.url,
    market_status: row.market.status,
    market_closes_at: row.market.closes_at,
    side,
    probability: round4(probability),
    market_price: round4(marketPrice),
    edge: round4(edge),
    abs_edge: round4(absEdge),
    stake_usd: stakeUsd,
    max_loss_usd: stakeUsd,
    profit_if_correct_usd: round2(profitIfCorrectUsd),
    expected_pnl_usd: round2(expectedPnlUsd),
    resolved_outcome: row.market.resolved_outcome,
    resolved_at: row.market.resolved_at,
    created_at: row.created_at,
    is_backfill: row.is_backfill,
    confidence: row.confidence,
    reasoning: cleanReasoning(row.reasoning).slice(0, 500),
    won,
    pnl_usd: pnlUsd === null ? null : round2(pnlUsd),
  };
}

function summarizeAgent(
  agentId: string,
  trades: PaperTrade[],
  rank: number,
): AgentTradingSummary | null {
  const mine = trades
    .filter((t) => t.agent_id === agentId && t.pnl_usd !== null)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  if (mine.length === 0) return null;

  const stakeUsd = mine.reduce((sum, t) => sum + t.stake_usd, 0);
  const netPnlUsd = mine.reduce((sum, t) => sum + (t.pnl_usd ?? 0), 0);
  const wins = mine.filter((t) => t.won).length;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of mine) {
    equity += t.pnl_usd ?? 0;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }

  const agent = AGENTS.find((a) => a.id === agentId);

  return {
    rank,
    agent_id: agentId,
    agent_name: agent?.name ?? agentId,
    trades: mine.length,
    live_trades: mine.filter((t) => !t.is_backfill).length,
    backfill_trades: mine.filter((t) => t.is_backfill).length,
    wins,
    losses: mine.length - wins,
    win_rate: wins / mine.length,
    stake_usd: round2(stakeUsd),
    net_pnl_usd: round2(netPnlUsd),
    roi_on_stake: stakeUsd > 0 ? round4(netPnlUsd / stakeUsd) : 0,
    avg_edge: round4(
      mine.reduce((sum, t) => sum + t.abs_edge, 0) / mine.length,
    ),
    avg_stake_usd: round2(stakeUsd / mine.length),
    avg_expected_pnl_usd: round2(
      mine.reduce((sum, t) => sum + t.expected_pnl_usd, 0) / mine.length,
    ),
    max_drawdown_usd: round2(Math.abs(maxDrawdown)),
  };
}

function summarizeScenario(
  rows: PredictionMarketRow[],
  scenario: {
    id: string;
    label: string;
    minEdge: number;
    stakeMode: StakeMode;
  },
): ScenarioSummary {
  const trades = rows
    .map((row) =>
      buildTrade(row, {
        minEdge: scenario.minEdge,
        stakeMode: scenario.stakeMode,
      }),
    )
    .filter((t): t is PaperTrade => Boolean(t))
    .filter((t) => t.pnl_usd !== null);

  const stakeUsd = trades.reduce((sum, t) => sum + t.stake_usd, 0);
  const netPnlUsd = trades.reduce((sum, t) => sum + (t.pnl_usd ?? 0), 0);
  const wins = trades.filter((t) => t.won).length;
  const maxLossPerTrade = trades.reduce(
    (max, t) => Math.max(max, t.max_loss_usd),
    0,
  );

  return {
    id: scenario.id,
    label: scenario.label,
    min_edge: scenario.minEdge,
    stake_mode: scenario.stakeMode,
    trades: trades.length,
    wins,
    win_rate: trades.length > 0 ? wins / trades.length : 0,
    stake_usd: round2(stakeUsd),
    net_pnl_usd: round2(netPnlUsd),
    roi_on_stake: stakeUsd > 0 ? round4(netPnlUsd / stakeUsd) : 0,
    avg_edge:
      trades.length > 0
        ? round4(trades.reduce((sum, t) => sum + t.abs_edge, 0) / trades.length)
        : 0,
    avg_stake_usd: trades.length > 0 ? round2(stakeUsd / trades.length) : 0,
    max_loss_per_trade_usd: round2(maxLossPerTrade),
  };
}

function inSample(trade: PaperTrade, sample: TradingSample): boolean {
  if (sample === "live_only") return !trade.is_backfill;
  if (sample === "backfill") return trade.is_backfill;
  return true;
}

function summarizeTotals(trades: PaperTrade[]): TradingTotals {
  const resolvedTrades = trades.filter((t) => t.pnl_usd !== null);
  const openTrades = trades.filter((t) => t.pnl_usd === null);
  const resolvedStakeUsd = resolvedTrades.reduce(
    (sum, t) => sum + t.stake_usd,
    0,
  );
  const resolvedNetPnlUsd = resolvedTrades.reduce(
    (sum, t) => sum + (t.pnl_usd ?? 0),
    0,
  );
  const openExposureUsd = openTrades.reduce((sum, t) => sum + t.stake_usd, 0);
  const openExpectedPnlUsd = openTrades.reduce(
    (sum, t) => sum + t.expected_pnl_usd,
    0,
  );

  return {
    eligible_predictions: trades.length,
    resolved_trades: resolvedTrades.length,
    open_signals: openTrades.length,
    resolved_stake_usd: round2(resolvedStakeUsd),
    resolved_net_pnl_usd: round2(resolvedNetPnlUsd),
    resolved_roi_on_stake:
      resolvedStakeUsd > 0 ? round4(resolvedNetPnlUsd / resolvedStakeUsd) : 0,
    open_exposure_usd: round2(openExposureUsd),
    open_expected_pnl_usd: round2(openExpectedPnlUsd),
    live_resolved_trades: resolvedTrades.filter((t) => !t.is_backfill).length,
    backfill_resolved_trades: resolvedTrades.filter((t) => t.is_backfill)
      .length,
  };
}

function dayDelta(from: Date, toIso: string): number | null {
  const fromTs = from.getTime();
  const toTs = Date.parse(toIso);
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) return null;
  return round2((toTs - fromTs) / (24 * 60 * 60 * 1000));
}

function classifyOpenLiveTrade(
  trade: PaperTrade,
  now: Date,
): Pick<
  ResolutionWatchSignal,
  "close_status" | "tradability_status" | "days_until_close" | "age_days"
> {
  const nowTs = now.getTime();
  const weekFromNowTs = nowTs + 7 * 24 * 60 * 60 * 1000;
  const closeTs = trade.market_closes_at
    ? Date.parse(trade.market_closes_at)
    : NaN;
  const ageDays = dayDelta(new Date(trade.created_at), now.toISOString()) ?? 0;
  const closeStatus: ResolutionWatchSignal["close_status"] = !Number.isFinite(
    closeTs,
  )
    ? "unknown_close"
    : closeTs < nowTs
      ? "overdue"
      : closeTs <= weekFromNowTs
        ? "closing_next_7d"
        : "future";
  const tradabilityStatus: ResolutionWatchSignal["tradability_status"] =
    closeStatus === "overdue" || closeStatus === "unknown_close"
      ? "needs_review"
      : "tradable";

  return {
    close_status: closeStatus,
    tradability_status: tradabilityStatus,
    days_until_close: trade.market_closes_at
      ? dayDelta(now, trade.market_closes_at)
      : null,
    age_days: Math.max(0, ageDays),
  };
}

function resolutionStatusRank(
  status: ResolutionWatchSignal["close_status"],
): number {
  if (status === "overdue") return 0;
  if (status === "closing_next_7d") return 1;
  if (status === "unknown_close") return 2;
  return 3;
}

function buildResolutionWatch(
  liveTrades: PaperTrade[],
  now = new Date(),
): TradingResolutionWatch {
  const openLiveTrades = liveTrades.filter((trade) => trade.pnl_usd === null);
  const nowTs = now.getTime();
  const signals = openLiveTrades.map((trade): ResolutionWatchSignal => {
    const classification = classifyOpenLiveTrade(trade, now);

    return {
      prediction_id: trade.prediction_id,
      market_id: trade.market_id,
      market_question: trade.market_question,
      market_source: trade.market_source,
      market_url: trade.market_url,
      market_status: trade.market_status,
      agent_id: trade.agent_id,
      agent_name: trade.agent_name,
      side: trade.side,
      stake_usd: trade.stake_usd,
      expected_pnl_usd: trade.expected_pnl_usd,
      market_closes_at: trade.market_closes_at,
      created_at: trade.created_at,
      ...classification,
    };
  });

  const overdueCount = signals.filter(
    (signal) => signal.close_status === "overdue",
  ).length;
  const closingSoonCount = signals.filter(
    (signal) => signal.close_status === "closing_next_7d",
  ).length;
  const unknownCloseCount = signals.filter(
    (signal) => signal.close_status === "unknown_close",
  ).length;
  const tradableSignals = signals.filter(
    (signal) => signal.tradability_status === "tradable",
  );
  const reviewRequiredSignals = signals.filter(
    (signal) => signal.tradability_status === "needs_review",
  );
  const futureCloseTimes = signals
    .map((signal) =>
      signal.market_closes_at ? Date.parse(signal.market_closes_at) : NaN,
    )
    .filter((ts) => Number.isFinite(ts) && ts >= nowTs)
    .sort((a, b) => a - b);
  const openedTimes = signals
    .map((signal) => Date.parse(signal.created_at))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const sortedSignals = signals
    .slice()
    .sort(
      (a, b) =>
        resolutionStatusRank(a.close_status) -
          resolutionStatusRank(b.close_status) ||
        (a.days_until_close ?? Number.POSITIVE_INFINITY) -
          (b.days_until_close ?? Number.POSITIVE_INFINITY) ||
        Date.parse(a.created_at) - Date.parse(b.created_at),
    )
    .slice(0, 12);
  const status: TradingResolutionWatch["status"] =
    signals.length === 0
      ? "no_open_live_signals"
      : overdueCount > 0
        ? "overdue_resolution"
        : "waiting_resolution";

  return {
    status,
    status_label:
      status === "no_open_live_signals"
        ? "No open live signals"
        : status === "overdue_resolution"
          ? "Overdue"
          : "Waiting",
    open_live_signals: signals.length,
    overdue_live_signals: overdueCount,
    tradable_open_live_signals: tradableSignals.length,
    review_required_live_signals: reviewRequiredSignals.length,
    closing_next_7d_signals: closingSoonCount,
    unknown_close_live_signals: unknownCloseCount,
    next_close_at:
      futureCloseTimes.length > 0
        ? new Date(futureCloseTimes[0]).toISOString()
        : null,
    oldest_opened_at:
      openedTimes.length > 0 ? new Date(openedTimes[0]).toISOString() : null,
    total_open_exposure_usd: round2(
      openLiveTrades.reduce((sum, trade) => sum + trade.stake_usd, 0),
    ),
    total_open_expected_pnl_usd: round2(
      openLiveTrades.reduce((sum, trade) => sum + trade.expected_pnl_usd, 0),
    ),
    tradable_open_exposure_usd: round2(
      tradableSignals.reduce((sum, signal) => sum + signal.stake_usd, 0),
    ),
    tradable_open_expected_pnl_usd: round2(
      tradableSignals.reduce((sum, signal) => sum + signal.expected_pnl_usd, 0),
    ),
    review_required_open_exposure_usd: round2(
      reviewRequiredSignals.reduce((sum, signal) => sum + signal.stake_usd, 0),
    ),
    review_required_open_expected_pnl_usd: round2(
      reviewRequiredSignals.reduce(
        (sum, signal) => sum + signal.expected_pnl_usd,
        0,
      ),
    ),
    signals: sortedSignals,
  };
}

function buildWouldTradeSignal(
  trade: PaperTrade,
  now: Date,
): PaperTradingWouldTradeSignal {
  return {
    prediction_id: trade.prediction_id,
    market_id: trade.market_id,
    market_question: trade.market_question,
    market_source: trade.market_source,
    market_url: trade.market_url,
    agent_id: trade.agent_id,
    agent_name: trade.agent_name,
    side: trade.side,
    probability: trade.probability,
    market_price: trade.market_price,
    edge: trade.edge,
    abs_edge: trade.abs_edge,
    stake_usd: trade.stake_usd,
    max_loss_usd: trade.max_loss_usd,
    profit_if_correct_usd: trade.profit_if_correct_usd,
    expected_pnl_usd: trade.expected_pnl_usd,
    market_closes_at: trade.market_closes_at,
    created_at: trade.created_at,
    ...classifyOpenLiveTrade(trade, now),
  };
}

function wouldTradeSignalSort(
  a: PaperTradingWouldTradeSignal,
  b: PaperTradingWouldTradeSignal,
): number {
  const tradabilityDelta =
    (a.tradability_status === "tradable" ? 0 : 1) -
    (b.tradability_status === "tradable" ? 0 : 1);
  if (tradabilityDelta !== 0) return tradabilityDelta;
  if (b.expected_pnl_usd !== a.expected_pnl_usd) {
    return b.expected_pnl_usd - a.expected_pnl_usd;
  }
  if (b.abs_edge !== a.abs_edge) return b.abs_edge - a.abs_edge;
  return (
    (a.days_until_close ?? Number.POSITIVE_INFINITY) -
    (b.days_until_close ?? Number.POSITIVE_INFINITY)
  );
}

function wouldTradeStrategySort(
  a: PaperTradingWouldTradeStrategy,
  b: PaperTradingWouldTradeStrategy,
): number {
  if (b.tradable_open_expected_pnl_usd !== a.tradable_open_expected_pnl_usd) {
    return b.tradable_open_expected_pnl_usd - a.tradable_open_expected_pnl_usd;
  }
  if (b.tradable_signals !== a.tradable_signals) {
    return b.tradable_signals - a.tradable_signals;
  }
  if (b.open_expected_pnl_usd !== a.open_expected_pnl_usd) {
    return b.open_expected_pnl_usd - a.open_expected_pnl_usd;
  }
  return a.strategy_label.localeCompare(b.strategy_label);
}

function buildWouldTradeStrategy(
  evaluation: StrategyEvaluation,
  now: Date,
): PaperTradingWouldTradeStrategy {
  const summary = evaluation.summary;
  const signals = evaluation.acceptedTrades
    .filter((trade) => !trade.is_backfill && trade.pnl_usd === null)
    .map((trade) => buildWouldTradeSignal(trade, now))
    .sort(wouldTradeSignalSort);
  const tradableSignals = signals.filter(
    (signal) => signal.tradability_status === "tradable",
  );
  const reviewRequiredSignals = signals.filter(
    (signal) => signal.tradability_status === "needs_review",
  );
  const avgEdge =
    signals.length > 0
      ? round4(
          signals.reduce((sum, signal) => sum + signal.abs_edge, 0) /
            signals.length,
        )
      : 0;

  return {
    rank: 0,
    strategy_id: summary.id,
    strategy_label: summary.label,
    sample: summary.sample,
    min_edge: summary.min_edge,
    stake_mode: summary.stake_mode,
    proof_status: summary.proof_gate.status,
    proof_status_label: summary.proof_gate.status_label,
    open_signals: signals.length,
    tradable_signals: tradableSignals.length,
    review_required_signals: reviewRequiredSignals.length,
    open_exposure_usd: round2(
      signals.reduce((sum, signal) => sum + signal.stake_usd, 0),
    ),
    tradable_open_exposure_usd: round2(
      tradableSignals.reduce((sum, signal) => sum + signal.stake_usd, 0),
    ),
    open_expected_pnl_usd: round2(
      signals.reduce((sum, signal) => sum + signal.expected_pnl_usd, 0),
    ),
    tradable_open_expected_pnl_usd: round2(
      tradableSignals.reduce((sum, signal) => sum + signal.expected_pnl_usd, 0),
    ),
    avg_edge: avgEdge,
    top_signals: signals.slice(0, 5),
    paper_only: true,
    real_money_execution_allowed: false,
  };
}

function buildWouldTradeTodayFeed(
  evaluations: StrategyEvaluation[],
  selectedEvaluation: StrategyEvaluation,
  resolutionWatch: TradingResolutionWatch,
  generatedAt: string,
): PaperTradingWouldTradeFeed {
  const now = new Date(generatedAt);
  const liveEvaluations = [selectedEvaluation, ...evaluations].filter(
    (evaluation) => evaluation.summary.sample === "live_only",
  );
  const uniqueSignals = new Map<string, PaperTradingWouldTradeSignal>();

  for (const evaluation of liveEvaluations) {
    for (const trade of evaluation.acceptedTrades) {
      if (trade.is_backfill || trade.pnl_usd !== null) continue;
      const signal = buildWouldTradeSignal(trade, now);
      const existing = uniqueSignals.get(signal.prediction_id);
      if (!existing || signal.expected_pnl_usd > existing.expected_pnl_usd) {
        uniqueSignals.set(signal.prediction_id, signal);
      }
    }
  }

  const uniqueOpenSignals = [...uniqueSignals.values()];
  const uniqueTradableSignals = uniqueOpenSignals.filter(
    (signal) => signal.tradability_status === "tradable",
  );
  const uniqueReviewRequiredSignals = uniqueOpenSignals.filter(
    (signal) => signal.tradability_status === "needs_review",
  );
  const rankedStrategies = liveEvaluations
    .map((evaluation) => buildWouldTradeStrategy(evaluation, now))
    .filter((strategy) => strategy.open_signals > 0)
    .sort(wouldTradeStrategySort)
    .map((strategy, index) => ({ ...strategy, rank: index + 1 }));
  const topStrategies = rankedStrategies.slice(0, 8);
  const selectedStrategy =
    rankedStrategies.find(
      (strategy) => strategy.strategy_id === selectedEvaluation.summary.id,
    ) ?? null;
  const globalReviewRequiredSignals = resolutionWatch.signals.filter(
    (signal) => signal.tradability_status === "needs_review",
  );
  const status: PaperTradingWouldTradeFeed["status"] =
    uniqueOpenSignals.length === 0
      ? "no_live_signals"
      : resolutionWatch.review_required_live_signals > 0 ||
          uniqueReviewRequiredSignals.length > 0
        ? "blocked"
        : "collecting";

  return {
    schema_version: "1",
    generated_at: generatedAt,
    status,
    status_label:
      status === "blocked"
        ? "Blocked"
        : status === "collecting"
          ? "Paper watchlist"
          : "No live signals",
    message:
      resolutionWatch.review_required_live_signals > 0
        ? `${resolutionWatch.review_required_live_signals} global live paper market${
            resolutionWatch.review_required_live_signals === 1 ? "" : "s"
          } need resolution review before any would-trade watchlist is trusted.`
        : status === "blocked"
          ? `${uniqueReviewRequiredSignals.length} live paper signal${
              uniqueReviewRequiredSignals.length === 1 ? "" : "s"
            } need resolution review before open EV is trusted.`
          : status === "collecting"
            ? "Live paper candidates are ranked for observation only; execution remains disabled until the 30-day proof gate passes capital review."
            : "No live paper candidates are currently open under the lab rules.",
    execution_recommendation: "paper_watch_only",
    capital_review_allowed: false,
    paper_only: true,
    real_money_execution_allowed: false,
    selected_strategy_id: selectedEvaluation.summary.id,
    selected_strategy: selectedStrategy,
    global_resolution_status: resolutionWatch.status,
    global_resolution_status_label: resolutionWatch.status_label,
    global_open_live_signals: resolutionWatch.open_live_signals,
    global_review_required_live_signals:
      resolutionWatch.review_required_live_signals,
    global_overdue_live_signals: resolutionWatch.overdue_live_signals,
    global_unknown_close_live_signals:
      resolutionWatch.unknown_close_live_signals,
    global_review_required_signals: globalReviewRequiredSignals,
    unique_open_signals: uniqueOpenSignals.length,
    unique_tradable_signals: uniqueTradableSignals.length,
    unique_review_required_signals: uniqueReviewRequiredSignals.length,
    unique_open_exposure_usd: round2(
      uniqueOpenSignals.reduce((sum, signal) => sum + signal.stake_usd, 0),
    ),
    unique_tradable_open_exposure_usd: round2(
      uniqueTradableSignals.reduce((sum, signal) => sum + signal.stake_usd, 0),
    ),
    unique_open_expected_pnl_usd: round2(
      uniqueOpenSignals.reduce(
        (sum, signal) => sum + signal.expected_pnl_usd,
        0,
      ),
    ),
    unique_tradable_open_expected_pnl_usd: round2(
      uniqueTradableSignals.reduce(
        (sum, signal) => sum + signal.expected_pnl_usd,
        0,
      ),
    ),
    top_strategies: topStrategies,
  };
}

const MARKET_CONCENTRATION_THRESHOLD = 0.35;

function marketExposureSignal(
  trade: PaperTrade,
  now: Date,
): PaperTradingMarketExposureSignal {
  const classification = classifyOpenLiveTrade(trade, now);

  return {
    prediction_id: trade.prediction_id,
    agent_id: trade.agent_id,
    agent_name: trade.agent_name,
    side: trade.side,
    stake_usd: trade.stake_usd,
    expected_pnl_usd: trade.expected_pnl_usd,
    edge: trade.edge,
    abs_edge: trade.abs_edge,
    created_at: trade.created_at,
    close_status: classification.close_status,
    tradability_status: classification.tradability_status,
  };
}

function exposureBreakdownRows(
  markets: PaperTradingMarketExposureRow[],
  key: "market_source" | "market_category",
  totalExposureUsd: number,
): PaperTradingExposureBreakdownRow[] {
  const byKey = new Map<string, PaperTradingMarketExposureRow[]>();
  for (const market of markets) {
    const value = market[key];
    byKey.set(value, [...(byKey.get(value) ?? []), market]);
  }

  return [...byKey.entries()]
    .map(([id, rows]) => {
      const openExposureUsd = round2(
        rows.reduce((sum, row) => sum + row.open_exposure_usd, 0),
      );
      return {
        id,
        label: id,
        market_count: rows.length,
        signal_count: rows.reduce((sum, row) => sum + row.signal_count, 0),
        open_exposure_usd: openExposureUsd,
        open_expected_pnl_usd: round2(
          rows.reduce((sum, row) => sum + row.open_expected_pnl_usd, 0),
        ),
        exposure_share:
          totalExposureUsd > 0 ? round4(openExposureUsd / totalExposureUsd) : 0,
      };
    })
    .sort(
      (a, b) =>
        b.open_exposure_usd - a.open_exposure_usd ||
        b.signal_count - a.signal_count ||
        a.label.localeCompare(b.label),
    );
}

function buildMarketExposureDigest(
  liveTrades: PaperTrade[],
  generatedAt: string,
): PaperTradingMarketExposureDigest {
  const now = new Date(generatedAt);
  const openLiveTrades = liveTrades.filter((trade) => trade.pnl_usd === null);
  const totalOpenExposureUsd = round2(
    openLiveTrades.reduce((sum, trade) => sum + trade.stake_usd, 0),
  );
  const totalOpenExpectedPnlUsd = round2(
    openLiveTrades.reduce((sum, trade) => sum + trade.expected_pnl_usd, 0),
  );
  const byMarket = new Map<string, PaperTrade[]>();

  for (const trade of openLiveTrades) {
    byMarket.set(trade.market_id, [
      ...(byMarket.get(trade.market_id) ?? []),
      trade,
    ]);
  }

  const markets = [...byMarket.entries()]
    .map(([marketId, trades]): PaperTradingMarketExposureRow => {
      const first = trades[0];
      const signals = trades
        .map((trade) => marketExposureSignal(trade, now))
        .sort(
          (a, b) =>
            b.expected_pnl_usd - a.expected_pnl_usd ||
            b.abs_edge - a.abs_edge ||
            Date.parse(a.created_at) - Date.parse(b.created_at),
        );
      const openExposureUsd = round2(
        trades.reduce((sum, trade) => sum + trade.stake_usd, 0),
      );
      const openExpectedPnlUsd = round2(
        trades.reduce((sum, trade) => sum + trade.expected_pnl_usd, 0),
      );
      const agents = [
        ...new Set(trades.map((trade) => trade.agent_name)),
      ].sort();
      const sides = [...new Set(trades.map((trade) => trade.side))].sort();
      const reviewRequiredSignals = signals.filter(
        (signal) => signal.tradability_status === "needs_review",
      ).length;

      return {
        market_id: marketId,
        market_question: first.market_question,
        market_source: first.market_source,
        market_category: first.market_category,
        market_url: first.market_url,
        market_closes_at: first.market_closes_at,
        signal_count: trades.length,
        agent_count: agents.length,
        agents,
        sides,
        open_exposure_usd: openExposureUsd,
        open_expected_pnl_usd: openExpectedPnlUsd,
        exposure_share:
          totalOpenExposureUsd > 0
            ? round4(openExposureUsd / totalOpenExposureUsd)
            : 0,
        expected_pnl_share:
          totalOpenExpectedPnlUsd > 0
            ? round4(openExpectedPnlUsd / totalOpenExpectedPnlUsd)
            : 0,
        max_abs_edge: round4(
          trades.reduce((max, trade) => Math.max(max, trade.abs_edge), 0),
        ),
        avg_abs_edge:
          trades.length > 0
            ? round4(
                trades.reduce((sum, trade) => sum + trade.abs_edge, 0) /
                  trades.length,
              )
            : 0,
        review_required_signals: reviewRequiredSignals,
        tradable_signals: signals.length - reviewRequiredSignals,
        top_signals: signals.slice(0, 6),
      };
    })
    .sort(
      (a, b) =>
        b.open_exposure_usd - a.open_exposure_usd ||
        b.signal_count - a.signal_count ||
        b.open_expected_pnl_usd - a.open_expected_pnl_usd ||
        a.market_question.localeCompare(b.market_question),
    );

  const topMarket = markets[0] ?? null;
  const topMarketExposureShare = topMarket?.exposure_share ?? 0;
  const status: PaperTradingMarketExposureDigest["status"] =
    openLiveTrades.length === 0
      ? "no_open_live_signals"
      : topMarketExposureShare >= MARKET_CONCENTRATION_THRESHOLD
        ? "concentrated"
        : "observing";

  return {
    schema_version: "1",
    generated_at: generatedAt,
    status,
    status_label:
      status === "concentrated"
        ? "Concentrated"
        : status === "observing"
          ? "Observing"
          : "No open live signals",
    message:
      status === "concentrated"
        ? `Top market carries ${(topMarketExposureShare * 100).toFixed(
            1,
          )}% of open live paper exposure; treat ticket count as concentrated evidence.`
        : status === "observing"
          ? "Open live paper exposure is grouped by market so repeated agent bets are visible before review."
          : "No open live paper exposure is currently grouped by market.",
    paper_only: true,
    real_money_execution_allowed: false,
    concentration_review_only: true,
    concentration_threshold: MARKET_CONCENTRATION_THRESHOLD,
    open_live_signals: openLiveTrades.length,
    unique_open_markets: markets.length,
    multi_signal_markets: markets.filter((market) => market.signal_count > 1)
      .length,
    multi_agent_markets: markets.filter((market) => market.agent_count > 1)
      .length,
    review_required_markets: markets.filter(
      (market) => market.review_required_signals > 0,
    ).length,
    total_open_exposure_usd: totalOpenExposureUsd,
    total_open_expected_pnl_usd: totalOpenExpectedPnlUsd,
    top_market_exposure_usd: topMarket?.open_exposure_usd ?? 0,
    top_market_expected_pnl_usd: topMarket?.open_expected_pnl_usd ?? 0,
    top_market_exposure_share: topMarketExposureShare,
    top_market_signal_share:
      openLiveTrades.length > 0 && topMarket
        ? round4(topMarket.signal_count / openLiveTrades.length)
        : 0,
    by_source: exposureBreakdownRows(
      markets,
      "market_source",
      totalOpenExposureUsd,
    ),
    by_category: exposureBreakdownRows(
      markets,
      "market_category",
      totalOpenExposureUsd,
    ),
    top_markets: markets.slice(0, 12),
  };
}

function summarizeAgentsForTrades(trades: PaperTrade[]): AgentTradingSummary[] {
  const resolvedTrades = trades.filter((t) => t.pnl_usd !== null);
  return AGENTS.map((agent) => summarizeAgent(agent.id, resolvedTrades, 0))
    .filter((s): s is AgentTradingSummary => Boolean(s))
    .sort((a, b) => b.net_pnl_usd - a.net_pnl_usd)
    .map((summary, index) => ({ ...summary, rank: index + 1 }));
}

function configForStrategy(strategy: StrategyDefinition): PaperTradingConfig {
  return {
    ...PAPER_TRADING_CONFIG,
    flatStakeUsd: strategy.flatStakeUsd ?? PAPER_TRADING_CONFIG.flatStakeUsd,
    maxStakeUsd: strategy.maxStakeUsd ?? PAPER_TRADING_CONFIG.maxStakeUsd,
    maxOpenExposureUsd:
      strategy.maxOpenExposureUsd ?? PAPER_TRADING_CONFIG.maxOpenExposureUsd,
  };
}

function rawTradesForStrategy(
  rows: PredictionMarketRow[],
  strategy: StrategyDefinition,
): PaperTrade[] {
  const strategyConfig = configForStrategy(strategy);

  return rows
    .map((row) =>
      buildTrade(row, {
        minEdge: strategy.minEdge,
        stakeMode: strategy.stakeMode,
        config: strategyConfig,
      }),
    )
    .filter((t): t is PaperTrade => Boolean(t))
    .filter((t) => inSample(t, strategy.sample))
    .filter((t) => !strategy.agentIds || strategy.agentIds.includes(t.agent_id))
    .filter(
      (t) => !strategy.category || t.market_category === strategy.category,
    )
    .filter((t) => !strategy.side || t.side === strategy.side);
}

function tradeResolutionTs(trade: PaperTrade, createdTs: number): number {
  if (trade.pnl_usd === null) return Number.POSITIVE_INFINITY;
  if (!trade.resolved_at) return createdTs;
  const resolvedTs = Date.parse(trade.resolved_at);
  if (!Number.isFinite(resolvedTs)) return createdTs;
  return Math.max(createdTs, resolvedTs);
}

function applyExposureCap(
  trades: PaperTrade[],
  maxOpenExposureUsd: number,
): {
  acceptedTrades: PaperTrade[];
  ledger: ExposureLedgerSummary;
} {
  const sorted = trades
    .filter((trade) => Number.isFinite(Date.parse(trade.created_at)))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const acceptedTrades: PaperTrade[] = [];
  const entries: ExposureLedgerEntry[] = [];
  const active: Array<{
    predictionId: string;
    stakeUsd: number;
    closesAt: number;
  }> = [];
  let peakOpenExposure = 0;
  let skippedExposureUsd = 0;
  let skippedExpectedOpenPnlUsd = 0;
  let skippedOpenSignals = 0;
  let skippedResolvedTrades = 0;
  let skippedProfitableResolvedTrades = 0;
  let skippedLossResolvedTrades = 0;
  let skippedResolvedNetPnlUsd = 0;

  for (const trade of sorted) {
    const createdTs = Date.parse(trade.created_at);
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].closesAt <= createdTs) active.splice(i, 1);
    }

    const exposureBefore = active.reduce((sum, item) => sum + item.stakeUsd, 0);
    const exposureAfter = exposureBefore + trade.stake_usd;
    const wouldExceedCap = exposureAfter > maxOpenExposureUsd;

    if (wouldExceedCap) {
      skippedExposureUsd += trade.stake_usd;
      if (trade.pnl_usd === null) {
        skippedOpenSignals += 1;
        skippedExpectedOpenPnlUsd += trade.expected_pnl_usd;
      } else {
        skippedResolvedTrades += 1;
        skippedResolvedNetPnlUsd += trade.pnl_usd;
        if (trade.pnl_usd > 0) {
          skippedProfitableResolvedTrades += 1;
        } else if (trade.pnl_usd < 0) {
          skippedLossResolvedTrades += 1;
        }
      }
      entries.push({
        prediction_id: trade.prediction_id,
        market_id: trade.market_id,
        market_question: trade.market_question,
        agent_id: trade.agent_id,
        agent_name: trade.agent_name,
        side: trade.side,
        created_at: trade.created_at,
        resolved_at: trade.resolved_at,
        stake_usd: trade.stake_usd,
        expected_pnl_usd: trade.expected_pnl_usd,
        pnl_usd: trade.pnl_usd,
        missed_pnl_usd: trade.pnl_usd,
        open_exposure_before_usd: round2(exposureBefore),
        open_exposure_after_usd: round2(exposureBefore),
        status: "skipped_exposure_cap",
        reason: "Would exceed selected paper exposure cap.",
      });
      continue;
    }

    acceptedTrades.push(trade);
    const closesAt = tradeResolutionTs(trade, createdTs);
    if (closesAt > createdTs) {
      active.push({
        predictionId: trade.prediction_id,
        stakeUsd: trade.stake_usd,
        closesAt,
      });
    }
    peakOpenExposure = Math.max(peakOpenExposure, exposureAfter);
    entries.push({
      prediction_id: trade.prediction_id,
      market_id: trade.market_id,
      market_question: trade.market_question,
      agent_id: trade.agent_id,
      agent_name: trade.agent_name,
      side: trade.side,
      created_at: trade.created_at,
      resolved_at: trade.resolved_at,
      stake_usd: trade.stake_usd,
      expected_pnl_usd: trade.expected_pnl_usd,
      pnl_usd: trade.pnl_usd,
      missed_pnl_usd: null,
      open_exposure_before_usd: round2(exposureBefore),
      open_exposure_after_usd: round2(exposureAfter),
      status: "accepted",
      reason: null,
    });
  }

  const acceptedOpenSignals = acceptedTrades.filter(
    (trade) => trade.pnl_usd === null,
  );
  const acceptedResolvedTrades = acceptedTrades.filter(
    (trade) => trade.pnl_usd !== null,
  );
  const acceptedResolvedNetPnlUsd = acceptedResolvedTrades.reduce(
    (sum, trade) => sum + (trade.pnl_usd ?? 0),
    0,
  );

  return {
    acceptedTrades,
    ledger: {
      max_open_exposure_usd: round2(maxOpenExposureUsd),
      accepted_trades: acceptedTrades.length,
      skipped_trades: entries.filter(
        (entry) => entry.status === "skipped_exposure_cap",
      ).length,
      accepted_open_signals: acceptedOpenSignals.length,
      skipped_open_signals: skippedOpenSignals,
      accepted_resolved_trades: acceptedResolvedTrades.length,
      skipped_resolved_trades: skippedResolvedTrades,
      skipped_profitable_resolved_trades: skippedProfitableResolvedTrades,
      skipped_loss_resolved_trades: skippedLossResolvedTrades,
      accepted_resolved_net_pnl_usd: round2(acceptedResolvedNetPnlUsd),
      skipped_resolved_net_pnl_usd: round2(skippedResolvedNetPnlUsd),
      current_open_exposure_usd: round2(
        acceptedOpenSignals.reduce((sum, trade) => sum + trade.stake_usd, 0),
      ),
      peak_open_exposure_usd: round2(peakOpenExposure),
      skipped_exposure_usd: round2(skippedExposureUsd),
      accepted_expected_open_pnl_usd: round2(
        acceptedOpenSignals.reduce(
          (sum, trade) => sum + trade.expected_pnl_usd,
          0,
        ),
      ),
      skipped_expected_open_pnl_usd: round2(skippedExpectedOpenPnlUsd),
      recent_entries: entries
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 24),
    },
  };
}

function tradesForStrategy(
  rows: PredictionMarketRow[],
  strategy: StrategyDefinition,
): {
  acceptedTrades: PaperTrade[];
  ledger: ExposureLedgerSummary;
} {
  const strategyConfig = configForStrategy(strategy);
  return applyExposureCap(
    rawTradesForStrategy(rows, strategy),
    strategyConfig.maxOpenExposureUsd,
  );
}

function summarizeStrategyFromTrades(
  strategy: StrategyDefinition,
  trades: PaperTrade[],
  ledger: ExposureLedgerSummary,
): StrategyVariantSummary {
  const resolvedTrades = trades
    .filter((t) => t.pnl_usd !== null)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const openTrades = trades.filter((t) => t.pnl_usd === null);
  const stakeUsd = resolvedTrades.reduce((sum, t) => sum + t.stake_usd, 0);
  const netPnlUsd = resolvedTrades.reduce(
    (sum, t) => sum + (t.pnl_usd ?? 0),
    0,
  );
  const wins = resolvedTrades.filter((t) => t.won).length;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const trade of resolvedTrades) {
    equity += trade.pnl_usd ?? 0;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }

  const summary: Omit<StrategyVariantSummary, "proof_gate"> = {
    id: strategy.id,
    label: strategy.label,
    description: strategy.description,
    is_custom: Boolean(strategy.isCustom),
    sample: strategy.sample,
    min_edge: strategy.minEdge,
    stake_mode: strategy.stakeMode,
    flat_stake_usd: strategy.flatStakeUsd ?? PAPER_TRADING_CONFIG.flatStakeUsd,
    max_stake_usd: strategy.maxStakeUsd ?? PAPER_TRADING_CONFIG.maxStakeUsd,
    agent_ids: strategy.agentIds ?? [],
    category: strategy.category ?? null,
    side: strategy.side ?? null,
    resolved_trades: resolvedTrades.length,
    open_signals: openTrades.length,
    wins,
    losses: resolvedTrades.length - wins,
    win_rate: resolvedTrades.length > 0 ? wins / resolvedTrades.length : 0,
    stake_usd: round2(stakeUsd),
    net_pnl_usd: round2(netPnlUsd),
    roi_on_stake: stakeUsd > 0 ? round4(netPnlUsd / stakeUsd) : 0,
    avg_edge:
      resolvedTrades.length > 0
        ? round4(
            resolvedTrades.reduce((sum, t) => sum + t.abs_edge, 0) /
              resolvedTrades.length,
          )
        : 0,
    avg_stake_usd:
      resolvedTrades.length > 0 ? round2(stakeUsd / resolvedTrades.length) : 0,
    max_drawdown_usd: round2(Math.abs(maxDrawdown)),
    open_exposure_usd: round2(
      openTrades.reduce((sum, t) => sum + t.stake_usd, 0),
    ),
    open_expected_pnl_usd: round2(
      openTrades.reduce((sum, t) => sum + t.expected_pnl_usd, 0),
    ),
    exposure_ledger: ledger,
  };

  return {
    ...summary,
    proof_gate: buildProofGate(strategy, summary, trades),
  };
}

function isAgentEdgeVariant(strategy: StrategyVariantSummary): boolean {
  return (
    strategy.sample === "live_only" &&
    !strategy.is_custom &&
    strategy.agent_ids.length === 1 &&
    strategy.category === null &&
    strategy.side === null &&
    AGENT_EDGE_GATES.includes(
      strategy.min_edge as (typeof AGENT_EDGE_GATES)[number],
    )
  );
}

function buildAgentEdgeMatrix(
  strategies: StrategyVariantSummary[],
): AgentEdgeRuleSummary[] {
  const agentRank = new Map(AGENTS.map((agent, index) => [agent.id, index]));

  return strategies
    .filter(isAgentEdgeVariant)
    .map((strategy) => {
      const agentId = strategy.agent_ids[0];
      const agent = AGENTS.find((item) => item.id === agentId);

      return {
        strategy_id: strategy.id,
        strategy_label: strategy.label,
        agent_id: agentId,
        agent_name: agent?.name ?? agentId,
        min_edge: strategy.min_edge,
        stake_mode: strategy.stake_mode,
        proof_status: strategy.proof_gate.status,
        proof_status_label: strategy.proof_gate.status_label,
        resolved_trades: strategy.resolved_trades,
        open_signals: strategy.open_signals,
        skipped_trades: strategy.exposure_ledger.skipped_trades,
        skipped_open_signals: strategy.exposure_ledger.skipped_open_signals,
        skipped_resolved_trades:
          strategy.exposure_ledger.skipped_resolved_trades,
        skipped_profitable_resolved_trades:
          strategy.exposure_ledger.skipped_profitable_resolved_trades,
        skipped_loss_resolved_trades:
          strategy.exposure_ledger.skipped_loss_resolved_trades,
        skipped_resolved_net_pnl_usd:
          strategy.exposure_ledger.skipped_resolved_net_pnl_usd,
        skipped_expected_open_pnl_usd:
          strategy.exposure_ledger.skipped_expected_open_pnl_usd,
        missed_pnl_counts_as_proof: false as const,
        resolved_net_pnl_usd: strategy.net_pnl_usd,
        resolved_roi_on_stake: strategy.roi_on_stake,
        avg_edge: strategy.avg_edge,
        avg_stake_usd: strategy.avg_stake_usd,
        max_drawdown_usd: strategy.max_drawdown_usd,
        open_exposure_usd: strategy.open_exposure_usd,
        open_expected_pnl_usd: strategy.open_expected_pnl_usd,
      };
    })
    .sort(
      (a, b) =>
        (agentRank.get(a.agent_id) ?? 999) -
          (agentRank.get(b.agent_id) ?? 999) || a.min_edge - b.min_edge,
    );
}

function earliestNullableDate(values: Array<string | null>): string | null {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null
  );
}

function buildAgentEdgeOpenSignalWatchlist(
  evaluations: StrategyEvaluation[],
  generatedAt: string,
): AgentEdgeOpenSignalWatchlist {
  const now = new Date(generatedAt);
  const rules = evaluations
    .filter(({ summary }) => isAgentEdgeVariant(summary))
    .map(({ summary, acceptedTrades }) => {
      const agentId = summary.agent_ids[0] ?? "unknown";
      const agent = AGENTS.find((item) => item.id === agentId);
      const signals = acceptedTrades
        .filter((trade) => !trade.is_backfill && trade.pnl_usd === null)
        .map((trade) => buildWouldTradeSignal(trade, now))
        .sort(wouldTradeSignalSort);
      const tradableSignals = signals.filter(
        (signal) => signal.tradability_status === "tradable",
      );
      const reviewRequiredSignals = signals.filter(
        (signal) => signal.tradability_status === "needs_review",
      );
      const openExposureUsd = signals.reduce(
        (sum, signal) => sum + signal.stake_usd,
        0,
      );
      const tradableOpenExposureUsd = tradableSignals.reduce(
        (sum, signal) => sum + signal.stake_usd,
        0,
      );
      const openExpectedPnlUsd = signals.reduce(
        (sum, signal) => sum + signal.expected_pnl_usd,
        0,
      );
      const tradableOpenExpectedPnlUsd = tradableSignals.reduce(
        (sum, signal) => sum + signal.expected_pnl_usd,
        0,
      );

      return {
        strategy_id: summary.id,
        strategy_label: summary.label,
        agent_id: agentId,
        agent_name: signals[0]?.agent_name ?? agent?.name ?? agentId,
        min_edge: summary.min_edge,
        stake_mode: summary.stake_mode,
        proof_status: summary.proof_gate.status,
        proof_status_label: summary.proof_gate.status_label,
        open_signals: signals.length,
        tradable_signals: tradableSignals.length,
        review_required_signals: reviewRequiredSignals.length,
        open_exposure_usd: round2(openExposureUsd),
        tradable_open_exposure_usd: round2(tradableOpenExposureUsd),
        open_expected_pnl_usd: round2(openExpectedPnlUsd),
        tradable_open_expected_pnl_usd: round2(tradableOpenExpectedPnlUsd),
        avg_abs_edge:
          signals.length > 0
            ? round4(
                signals.reduce((sum, signal) => sum + signal.abs_edge, 0) /
                  signals.length,
              )
            : 0,
        next_close_at: earliestNullableDate(
          signals.map((signal) => signal.market_closes_at),
        ),
        oldest_opened_at: earliestNullableDate(
          signals.map((signal) => signal.created_at),
        ),
        top_open_signals: signals.slice(0, 8),
      };
    })
    .sort((a, b) => {
      if (
        b.tradable_open_expected_pnl_usd !== a.tradable_open_expected_pnl_usd
      ) {
        return (
          b.tradable_open_expected_pnl_usd - a.tradable_open_expected_pnl_usd
        );
      }
      if (b.tradable_signals !== a.tradable_signals) {
        return b.tradable_signals - a.tradable_signals;
      }
      if (b.open_expected_pnl_usd !== a.open_expected_pnl_usd) {
        return b.open_expected_pnl_usd - a.open_expected_pnl_usd;
      }
      return `${a.agent_id}-${a.min_edge}`.localeCompare(
        `${b.agent_id}-${b.min_edge}`,
      );
    });
  const totalOpenSignals = rules.reduce(
    (sum, rule) => sum + rule.open_signals,
    0,
  );
  const totalTradableSignals = rules.reduce(
    (sum, rule) => sum + rule.tradable_signals,
    0,
  );
  const totalReviewRequiredSignals = rules.reduce(
    (sum, rule) => sum + rule.review_required_signals,
    0,
  );
  const status: AgentEdgeOpenSignalWatchlist["status"] =
    rules.length === 0
      ? "unavailable"
      : totalOpenSignals === 0
        ? "no_open_signals"
        : totalReviewRequiredSignals > 0
          ? "blocked"
          : "watching";

  return {
    schema_version: "1",
    generated_at: generatedAt,
    status,
    status_label:
      status === "watching"
        ? "Watching"
        : status === "blocked"
          ? "Needs review"
          : status === "no_open_signals"
            ? "No open signals"
            : "Unavailable",
    message:
      status === "watching"
        ? "Canonical agent-edge live signals are being tracked for paper-only tradability."
        : status === "blocked"
          ? "At least one canonical agent-edge live signal needs resolution review before open EV is trusted."
          : status === "no_open_signals"
            ? "No canonical agent-edge live paper signals are currently open."
            : "No canonical agent-edge watchlist is available.",
    next_required_action:
      status === "watching"
        ? "Keep observing open signals until markets resolve into the proof ledger."
        : status === "blocked"
          ? "Review overdue or unknown-close live paper markets before trusting open EV."
          : status === "no_open_signals"
            ? "Wait for live forecasts to exceed an agent-edge threshold."
            : "Capture the canonical agent-edge strategy registry before auditing open signals.",
    paper_only: true,
    real_money_execution_allowed: false,
    execution_recommendation: "paper_watch_only",
    rule_count: rules.length,
    rules_with_open_signals: rules.filter((rule) => rule.open_signals > 0)
      .length,
    rules_with_tradable_signals: rules.filter(
      (rule) => rule.tradable_signals > 0,
    ).length,
    rules_needing_review: rules.filter(
      (rule) => rule.review_required_signals > 0,
    ).length,
    total_open_signals: totalOpenSignals,
    total_tradable_signals: totalTradableSignals,
    total_review_required_signals: totalReviewRequiredSignals,
    total_open_exposure_usd: round2(
      rules.reduce((sum, rule) => sum + rule.open_exposure_usd, 0),
    ),
    total_tradable_open_exposure_usd: round2(
      rules.reduce((sum, rule) => sum + rule.tradable_open_exposure_usd, 0),
    ),
    total_open_expected_pnl_usd: round2(
      rules.reduce((sum, rule) => sum + rule.open_expected_pnl_usd, 0),
    ),
    total_tradable_open_expected_pnl_usd: round2(
      rules.reduce((sum, rule) => sum + rule.tradable_open_expected_pnl_usd, 0),
    ),
    next_close_at: earliestNullableDate(
      rules.map((rule) => rule.next_close_at),
    ),
    oldest_opened_at: earliestNullableDate(
      rules.map((rule) => rule.oldest_opened_at),
    ),
    rules,
  };
}

function agentEdgeRunwayRuleStatusLabel(
  status: AgentEdgeProofRunwayRule["status"],
): string {
  if (status === "sample_complete") return "Sample complete";
  if (status === "sample_reachable") return "Sample reachable";
  if (status === "blocked") return "Needs review";
  if (status === "starved") return "Starved";
  return "Collecting";
}

function agentEdgeRunwayRuleAction(
  status: AgentEdgeProofRunwayRule["status"],
  resolvedTradesRemaining: number,
  sampleGapAfterOpen: number,
): string {
  if (status === "sample_complete") {
    return "Evaluate realized P&L, ROI, break-even edge, and drawdown before any capital review.";
  }
  if (status === "sample_reachable") {
    return `Wait for ${resolvedTradesRemaining} open paper tickets to resolve into the proof ledger.`;
  }
  if (status === "blocked") {
    return "Review overdue or unknown-close open paper markets before trusting this rule's runway.";
  }
  if (status === "starved") {
    return `Collect ${resolvedTradesRemaining} new qualifying live paper tickets for this rule.`;
  }
  return `Collect ${sampleGapAfterOpen} more qualifying live paper tickets after current opens resolve.`;
}

function buildAgentEdgeProofRunway(
  evaluations: StrategyEvaluation[],
  generatedAt: string,
): AgentEdgeProofRunway {
  const now = new Date(generatedAt);
  const requiredResolvedTrades =
    PAPER_TRADING_PROOF_RULES.requiredResolvedTrades;
  const rules = evaluations
    .filter(({ summary }) => isAgentEdgeVariant(summary))
    .map(({ summary, acceptedTrades }) => {
      const agentId = summary.agent_ids[0] ?? "unknown";
      const agent = AGENTS.find((item) => item.id === agentId);
      const resolvedTrades = acceptedTrades.filter(
        (trade) => !trade.is_backfill && trade.pnl_usd !== null,
      );
      const openSignals = acceptedTrades
        .filter((trade) => !trade.is_backfill && trade.pnl_usd === null)
        .map((trade) => buildWouldTradeSignal(trade, now))
        .sort(wouldTradeSignalSort);
      const tradableOpenSignals = openSignals.filter(
        (signal) => signal.tradability_status === "tradable",
      );
      const reviewRequiredSignals = openSignals.filter(
        (signal) => signal.tradability_status === "needs_review",
      );
      const closingNext7dSignals = openSignals.filter(
        (signal) => signal.close_status === "closing_next_7d",
      );
      const resolvedTradesRemaining = Math.max(
        0,
        requiredResolvedTrades - resolvedTrades.length,
      );
      const pendingResolutionCapacity = tradableOpenSignals.length;
      const sampleGapAfterOpen = Math.max(
        0,
        resolvedTradesRemaining - pendingResolutionCapacity,
      );
      const canReachRequiredSampleWithOpen =
        resolvedTrades.length + pendingResolutionCapacity >=
        requiredResolvedTrades;
      const status: AgentEdgeProofRunwayRule["status"] =
        resolvedTrades.length >= requiredResolvedTrades
          ? "sample_complete"
          : reviewRequiredSignals.length > 0
            ? "blocked"
            : canReachRequiredSampleWithOpen
              ? "sample_reachable"
              : openSignals.length > 0
                ? "collecting"
                : "starved";

      return {
        strategy_id: summary.id,
        strategy_label: summary.label,
        agent_id: agentId,
        agent_name: openSignals[0]?.agent_name ?? agent?.name ?? agentId,
        min_edge: summary.min_edge,
        stake_mode: summary.stake_mode,
        proof_status: summary.proof_gate.status,
        proof_status_label: summary.proof_gate.status_label,
        status,
        status_label: agentEdgeRunwayRuleStatusLabel(status),
        next_required_action: agentEdgeRunwayRuleAction(
          status,
          resolvedTradesRemaining,
          sampleGapAfterOpen,
        ),
        resolved_trades: resolvedTrades.length,
        required_resolved_trades: requiredResolvedTrades,
        resolved_trades_remaining: resolvedTradesRemaining,
        open_signals: openSignals.length,
        tradable_open_signals: tradableOpenSignals.length,
        review_required_signals: reviewRequiredSignals.length,
        closing_next_7d_signals: closingNext7dSignals.length,
        pending_resolution_capacity: pendingResolutionCapacity,
        sample_gap_after_open: sampleGapAfterOpen,
        can_reach_required_sample_with_open: canReachRequiredSampleWithOpen,
        next_close_at: earliestNullableDate(
          tradableOpenSignals.map((signal) => signal.market_closes_at),
        ),
        oldest_opened_at: earliestNullableDate(
          openSignals.map((signal) => signal.created_at),
        ),
        top_open_signals: openSignals.slice(0, 6),
      };
    })
    .sort((a, b) => {
      const statusRank = new Map<AgentEdgeProofRunwayRule["status"], number>([
        ["sample_complete", 0],
        ["sample_reachable", 1],
        ["collecting", 2],
        ["blocked", 3],
        ["starved", 4],
      ]);
      const rankDelta =
        (statusRank.get(a.status) ?? 99) - (statusRank.get(b.status) ?? 99);
      if (rankDelta !== 0) return rankDelta;
      if (a.sample_gap_after_open !== b.sample_gap_after_open) {
        return a.sample_gap_after_open - b.sample_gap_after_open;
      }
      if (b.pending_resolution_capacity !== a.pending_resolution_capacity) {
        return b.pending_resolution_capacity - a.pending_resolution_capacity;
      }
      const aClose = Date.parse(a.next_close_at ?? "");
      const bClose = Date.parse(b.next_close_at ?? "");
      if (Number.isFinite(aClose) && Number.isFinite(bClose)) {
        return aClose - bClose;
      }
      if (Number.isFinite(aClose)) return -1;
      if (Number.isFinite(bClose)) return 1;
      return `${a.agent_id}-${a.min_edge}`.localeCompare(
        `${b.agent_id}-${b.min_edge}`,
      );
    });
  const sampleCompleteRuleCount = rules.filter(
    (rule) => rule.status === "sample_complete",
  ).length;
  const sampleReachableRuleCount = rules.filter(
    (rule) => rule.status === "sample_reachable",
  ).length;
  const collectingRuleCount = rules.filter(
    (rule) => rule.status === "collecting",
  ).length;
  const blockedRuleCount = rules.filter(
    (rule) => rule.status === "blocked",
  ).length;
  const starvedRuleCount = rules.filter(
    (rule) => rule.status === "starved",
  ).length;
  const status: AgentEdgeProofRunway["status"] =
    rules.length === 0
      ? "unavailable"
      : blockedRuleCount > 0
        ? "blocked"
        : sampleCompleteRuleCount > 0
          ? "sample_complete"
          : sampleReachableRuleCount > 0
            ? "sample_reachable"
            : collectingRuleCount > 0
              ? "collecting"
              : "starved";
  const minimumSampleGapAfterOpen =
    rules.length > 0
      ? Math.min(...rules.map((rule) => rule.sample_gap_after_open))
      : null;
  const bestRule = rules[0] ?? null;

  return {
    schema_version: "1",
    generated_at: generatedAt,
    status,
    status_label:
      status === "sample_complete"
        ? "Sample complete"
        : status === "sample_reachable"
          ? "Sample reachable"
          : status === "blocked"
            ? "Needs review"
            : status === "starved"
              ? "Starved"
              : status === "collecting"
                ? "Collecting"
                : "Unavailable",
    message:
      status === "sample_complete"
        ? "At least one canonical agent-edge rule has enough resolved tickets for profitability review."
        : status === "sample_reachable"
          ? "At least one canonical agent-edge rule can reach the resolved-ticket sample if current tradable open tickets resolve."
          : status === "blocked"
            ? "At least one canonical agent-edge rule has open paper markets needing resolution review."
            : status === "starved"
              ? "Canonical agent-edge rules do not currently have open paper tickets feeding the proof sample."
              : status === "collecting"
                ? "Canonical agent-edge rules are collecting open paper tickets, but no rule can reach the proof sample from current opens yet."
                : "No canonical agent-edge runway is available.",
    next_required_action:
      status === "sample_complete"
        ? "Run the profitability guard before treating any rule as proven."
        : status === "sample_reachable"
          ? "Watch the reachable rules as their current open tickets resolve into the ledger."
          : status === "blocked"
            ? "Clear review-required open markets before trusting rule-level runway."
            : status === "starved"
              ? "Wait for new live forecasts to qualify under agent-edge thresholds."
              : status === "collecting"
                ? "Keep collecting daily captures until open-ticket capacity closes the sample gap."
                : "Capture the canonical agent-edge strategy registry before auditing proof runway.",
    paper_only: true,
    real_money_execution_allowed: false,
    execution_recommendation: "paper_watch_only",
    required_resolved_trades: requiredResolvedTrades,
    rule_count: rules.length,
    sample_complete_rule_count: sampleCompleteRuleCount,
    sample_reachable_rule_count: sampleReachableRuleCount,
    collecting_rule_count: collectingRuleCount,
    blocked_rule_count: blockedRuleCount,
    starved_rule_count: starvedRuleCount,
    total_resolved_trades: rules.reduce(
      (sum, rule) => sum + rule.resolved_trades,
      0,
    ),
    total_resolved_trades_remaining: rules.reduce(
      (sum, rule) => sum + rule.resolved_trades_remaining,
      0,
    ),
    total_open_signals: rules.reduce((sum, rule) => sum + rule.open_signals, 0),
    total_tradable_open_signals: rules.reduce(
      (sum, rule) => sum + rule.tradable_open_signals,
      0,
    ),
    total_review_required_signals: rules.reduce(
      (sum, rule) => sum + rule.review_required_signals,
      0,
    ),
    total_closing_next_7d_signals: rules.reduce(
      (sum, rule) => sum + rule.closing_next_7d_signals,
      0,
    ),
    total_pending_resolution_capacity: rules.reduce(
      (sum, rule) => sum + rule.pending_resolution_capacity,
      0,
    ),
    total_sample_gap_after_open: rules.reduce(
      (sum, rule) => sum + rule.sample_gap_after_open,
      0,
    ),
    minimum_sample_gap_after_open: minimumSampleGapAfterOpen,
    best_rule_strategy_id: bestRule?.strategy_id ?? null,
    next_close_at: earliestNullableDate(
      rules.map((rule) => rule.next_close_at),
    ),
    rules,
  };
}

function resolvedAtForLedger(
  trade: PaperTrade | null | undefined,
): string | null {
  if (!trade) return null;
  return trade.resolved_at ?? trade.created_at ?? null;
}

function buildAgentEdgeTradeEntry(
  trade: PaperTrade,
): AgentEdgeResolvedTradeLedgerEntry {
  const pnlUsd = trade.pnl_usd ?? 0;
  return {
    prediction_id: trade.prediction_id,
    market_id: trade.market_id,
    market_question: trade.market_question,
    market_source: trade.market_source,
    market_url: trade.market_url,
    agent_id: trade.agent_id,
    agent_name: trade.agent_name,
    side: trade.side,
    probability: trade.probability,
    market_price: trade.market_price,
    edge: trade.edge,
    abs_edge: trade.abs_edge,
    stake_usd: trade.stake_usd,
    pnl_usd: pnlUsd,
    roi_on_stake: trade.stake_usd > 0 ? round4(pnlUsd / trade.stake_usd) : 0,
    won: trade.won === true,
    created_at: trade.created_at,
    resolved_at: trade.resolved_at,
  };
}

function averageResolvedTradeValue(
  trades: PaperTrade[],
  selector: (trade: PaperTrade) => number,
): number {
  if (trades.length === 0) return 0;
  return round4(
    trades.reduce((sum, trade) => sum + selector(trade), 0) / trades.length,
  );
}

function attributionStatusLabel(status: AgentEdgeProfitAttributionStatus) {
  if (status === "diversified") return "Diversified";
  if (status === "concentrated") return "Concentrated";
  if (status === "collecting") return "Collecting";
  return "Unavailable";
}

function attributionGroupRow(
  id: string,
  label: string,
  trades: PaperTrade[],
  totalResolvedTrades: number,
  totalPositivePnlUsd: number,
): AgentEdgeProfitAttributionGroup {
  const stakeUsd = trades.reduce((sum, trade) => sum + trade.stake_usd, 0);
  const netPnlUsd = trades.reduce(
    (sum, trade) => sum + (trade.pnl_usd ?? 0),
    0,
  );
  const wins = trades.filter((trade) => trade.won).length;
  const losses = trades.filter((trade) => trade.won === false).length;
  return {
    id,
    label,
    resolved_trades: trades.length,
    wins,
    losses,
    stake_usd: round2(stakeUsd),
    net_pnl_usd: round2(netPnlUsd),
    roi_on_stake: stakeUsd > 0 ? round4(netPnlUsd / stakeUsd) : 0,
    avg_pnl_per_trade_usd:
      trades.length > 0 ? round2(netPnlUsd / trades.length) : 0,
    pnl_share:
      totalPositivePnlUsd > 0
        ? round4(Math.max(0, netPnlUsd) / totalPositivePnlUsd)
        : 0,
    trade_share:
      totalResolvedTrades > 0 ? round4(trades.length / totalResolvedTrades) : 0,
  };
}

function attributionRows(
  trades: PaperTrade[],
  key: (trade: PaperTrade) => string,
  label: (trade: PaperTrade) => string,
): AgentEdgeProfitAttributionGroup[] {
  const byKey = new Map<string, PaperTrade[]>();
  for (const trade of trades) {
    const id = key(trade);
    byKey.set(id, [...(byKey.get(id) ?? []), trade]);
  }
  const totalPositivePnlUsd = [...byKey.values()].reduce(
    (sum, groupTrades) =>
      sum +
      Math.max(
        0,
        groupTrades.reduce(
          (groupSum, trade) => groupSum + (trade.pnl_usd ?? 0),
          0,
        ),
      ),
    0,
  );
  return [...byKey.entries()]
    .map(([id, groupTrades]) =>
      attributionGroupRow(
        id,
        label(groupTrades[0]),
        groupTrades,
        trades.length,
        totalPositivePnlUsd,
      ),
    )
    .sort(
      (a, b) =>
        b.pnl_share - a.pnl_share ||
        b.net_pnl_usd - a.net_pnl_usd ||
        b.resolved_trades - a.resolved_trades ||
        a.label.localeCompare(b.label),
    );
}

function attributionMarketRows(
  trades: PaperTrade[],
): AgentEdgeProfitAttributionMarket[] {
  return attributionRows(
    trades,
    (trade) => trade.market_id,
    (trade) => trade.market_question,
  ).map((row): AgentEdgeProfitAttributionMarket => {
    const trade = trades.find((item) => item.market_id === row.id);
    return {
      ...row,
      market_id: row.id,
      market_question: trade?.market_question ?? row.label,
      market_source: trade?.market_source ?? "unknown",
      market_category: trade?.market_category ?? "other",
      market_url: trade?.market_url ?? null,
    };
  });
}

function concentrationFlags(args: {
  rule: AgentEdgeProfitAttributionRule;
  topSource: AgentEdgeProfitAttributionGroup | null;
  topCategory: AgentEdgeProfitAttributionGroup | null;
  topMarket: AgentEdgeProfitAttributionMarket | null;
}): string[] {
  const flags: string[] = [];
  const pnlThreshold =
    PAPER_TRADING_ATTRIBUTION_RULES.topPnlShareConcentrationThreshold;
  const tradeThreshold =
    PAPER_TRADING_ATTRIBUTION_RULES.topTradeShareConcentrationThreshold;
  if (args.rule.resolved_trades < args.rule.required_resolved_trades) {
    return flags;
  }
  if (args.rule.net_pnl_usd <= 0) return flags;
  if (args.topSource && args.topSource.pnl_share >= pnlThreshold) {
    flags.push(
      `Top source ${args.topSource.label} contributes ${(args.topSource.pnl_share * 100).toFixed(0)}% of positive P&L.`,
    );
  }
  if (args.topCategory && args.topCategory.pnl_share >= pnlThreshold) {
    flags.push(
      `Top category ${args.topCategory.label} contributes ${(args.topCategory.pnl_share * 100).toFixed(0)}% of positive P&L.`,
    );
  }
  if (args.topMarket && args.topMarket.pnl_share >= pnlThreshold) {
    flags.push(
      `Top market contributes ${(args.topMarket.pnl_share * 100).toFixed(0)}% of positive P&L.`,
    );
  }
  if (args.topMarket && args.topMarket.trade_share >= tradeThreshold) {
    flags.push(
      `Top market contributes ${(args.topMarket.trade_share * 100).toFixed(0)}% of resolved tickets.`,
    );
  }
  return flags;
}

function buildAgentEdgeProfitAttribution(
  evaluations: StrategyEvaluation[],
  generatedAt: string,
): AgentEdgeProfitAttribution {
  const rulesByStrategy = evaluations
    .filter(({ summary }) => isAgentEdgeVariant(summary))
    .map(({ summary, acceptedTrades }) => {
      const agentId = summary.agent_ids[0] ?? "unknown";
      const agent = AGENTS.find((item) => item.id === agentId);
      const resolvedTrades = acceptedTrades.filter(
        (trade) => trade.pnl_usd !== null,
      );
      const stakeUsd = resolvedTrades.reduce(
        (sum, trade) => sum + trade.stake_usd,
        0,
      );
      const netPnlUsd = resolvedTrades.reduce(
        (sum, trade) => sum + (trade.pnl_usd ?? 0),
        0,
      );
      const bySource = attributionRows(
        resolvedTrades,
        (trade) => trade.market_source,
        (trade) => trade.market_source,
      );
      const byCategory = attributionRows(
        resolvedTrades,
        (trade) => trade.market_category,
        (trade) => trade.market_category,
      );
      const marketRows = attributionMarketRows(resolvedTrades);
      const topSource = bySource[0] ?? null;
      const topCategory = byCategory[0] ?? null;
      const topMarket = marketRows[0] ?? null;
      const baseRule = {
        strategy_id: summary.id,
        strategy_label: summary.label,
        agent_id: agentId,
        agent_name: resolvedTrades[0]?.agent_name ?? agent?.name ?? agentId,
        min_edge: summary.min_edge,
        status: "collecting" as AgentEdgeProfitAttributionStatus,
        status_label: "Collecting",
        resolved_trades: resolvedTrades.length,
        required_resolved_trades:
          PAPER_TRADING_ATTRIBUTION_RULES.minimumResolvedTradesForAttributionReview,
        net_pnl_usd: round2(netPnlUsd),
        stake_usd: round2(stakeUsd),
        roi_on_stake: stakeUsd > 0 ? round4(netPnlUsd / stakeUsd) : 0,
        distinct_sources: bySource.length,
        distinct_categories: byCategory.length,
        distinct_markets: marketRows.length,
        top_source_pnl_share: topSource?.pnl_share ?? 0,
        top_category_pnl_share: topCategory?.pnl_share ?? 0,
        top_market_pnl_share: topMarket?.pnl_share ?? 0,
        top_market_trade_share: topMarket?.trade_share ?? 0,
        concentration_flags: [],
        by_source: bySource,
        by_category: byCategory,
        top_markets: marketRows.slice(0, 10),
      };
      const flags = concentrationFlags({
        rule: baseRule,
        topSource,
        topCategory,
        topMarket,
      });
      const status: AgentEdgeProfitAttributionStatus =
        resolvedTrades.length === 0 ||
        resolvedTrades.length <
          PAPER_TRADING_ATTRIBUTION_RULES.minimumResolvedTradesForAttributionReview
          ? "collecting"
          : flags.length > 0
            ? "concentrated"
            : "diversified";

      return {
        ...baseRule,
        status,
        status_label: attributionStatusLabel(status),
        concentration_flags: flags,
      };
    })
    .sort((a, b) => {
      if (b.resolved_trades !== a.resolved_trades) {
        return b.resolved_trades - a.resolved_trades;
      }
      if (b.net_pnl_usd !== a.net_pnl_usd) return b.net_pnl_usd - a.net_pnl_usd;
      return `${a.agent_id}-${a.min_edge}`.localeCompare(
        `${b.agent_id}-${b.min_edge}`,
      );
    });
  const totalResolvedTrades = rulesByStrategy.reduce(
    (sum, rule) => sum + rule.resolved_trades,
    0,
  );
  const totalNetPnlUsd = rulesByStrategy.reduce(
    (sum, rule) => sum + rule.net_pnl_usd,
    0,
  );
  const concentratedRules = rulesByStrategy.filter(
    (rule) => rule.status === "concentrated",
  );
  const diversifiedRules = rulesByStrategy.filter(
    (rule) => rule.status === "diversified",
  );
  const topRule = rulesByStrategy[0] ?? null;
  const status: AgentEdgeProfitAttributionStatus =
    rulesByStrategy.length === 0
      ? "unavailable"
      : concentratedRules.length > 0
        ? "concentrated"
        : diversifiedRules.length > 0
          ? "diversified"
          : "collecting";

  return {
    schema_version: "1",
    generated_at: generatedAt,
    status,
    status_label: attributionStatusLabel(status),
    message:
      status === "unavailable"
        ? "No canonical agent-edge attribution rules are available."
        : status === "concentrated"
          ? "At least one agent-edge rule has concentrated resolved P&L that needs review."
          : status === "diversified"
            ? "At least one agent-edge rule has enough resolved tickets without concentration flags."
            : "Agent-edge profit attribution is collecting resolved tickets.",
    next_required_action:
      status === "unavailable"
        ? "Capture the canonical agent-edge strategy registry before attribution review."
        : status === "concentrated"
          ? "Inspect concentrated source, category, or market P&L before treating a rule as repeatable."
          : status === "diversified"
            ? "Review diversified agent-edge rules; execution remains disabled."
            : "Wait for more live paper markets to resolve before judging profit concentration.",
    paper_only: true,
    real_money_execution_allowed: false,
    profit_attribution_review_only: true,
    rules: PAPER_TRADING_ATTRIBUTION_RULES,
    rule_count: rulesByStrategy.length,
    resolved_rule_count: rulesByStrategy.filter(
      (rule) => rule.resolved_trades > 0,
    ).length,
    profitable_rule_count: rulesByStrategy.filter(
      (rule) => rule.net_pnl_usd > 0,
    ).length,
    concentrated_rule_count: concentratedRules.length,
    diversified_rule_count: diversifiedRules.length,
    total_resolved_trades: totalResolvedTrades,
    total_net_pnl_usd: round2(totalNetPnlUsd),
    top_rule_strategy_id: topRule?.strategy_id ?? null,
    top_rule_label: topRule?.strategy_label ?? null,
    rules_by_strategy: rulesByStrategy,
  };
}

function buildAgentEdgeTradeLedger(
  evaluations: StrategyEvaluation[],
  generatedAt: string,
): AgentEdgeResolvedTradeLedger {
  const rules = evaluations
    .filter(({ summary }) => isAgentEdgeVariant(summary))
    .map(({ summary, acceptedTrades }) => {
      const agentId = summary.agent_ids[0] ?? "unknown";
      const agent = AGENTS.find((item) => item.id === agentId);
      const resolvedTrades = acceptedTrades
        .filter((trade) => trade.pnl_usd !== null)
        .sort(
          (a, b) =>
            (Date.parse(resolvedAtForLedger(b) ?? "") || 0) -
            (Date.parse(resolvedAtForLedger(a) ?? "") || 0),
        );
      const stakeUsd = resolvedTrades.reduce(
        (sum, trade) => sum + trade.stake_usd,
        0,
      );
      const netPnlUsd = resolvedTrades.reduce(
        (sum, trade) => sum + (trade.pnl_usd ?? 0),
        0,
      );
      const wins = resolvedTrades.filter((trade) => trade.won).length;
      const losses = resolvedTrades.filter(
        (trade) => trade.won === false,
      ).length;
      const winRate =
        resolvedTrades.length > 0 ? round4(wins / resolvedTrades.length) : 0;
      const avgModelProbabilityCorrect = averageResolvedTradeValue(
        resolvedTrades,
        (trade) =>
          trade.side === "YES" ? trade.probability : 1 - trade.probability,
      );
      const avgProfitIfCorrectUsd = averageResolvedTradeValue(
        resolvedTrades,
        (trade) => trade.profit_if_correct_usd,
      );
      const avgLossIfWrongUsd = averageResolvedTradeValue(
        resolvedTrades,
        (trade) => trade.stake_usd,
      );
      const payoffRatio =
        avgLossIfWrongUsd > 0
          ? round4(avgProfitIfCorrectUsd / avgLossIfWrongUsd)
          : null;
      const breakEvenWinRate =
        avgProfitIfCorrectUsd + avgLossIfWrongUsd > 0
          ? round4(
              avgLossIfWrongUsd / (avgProfitIfCorrectUsd + avgLossIfWrongUsd),
            )
          : null;
      const winRateEdge =
        breakEvenWinRate === null ? null : round4(winRate - breakEvenWinRate);
      const modelProbabilityEdgeToBreakEven =
        breakEvenWinRate === null
          ? null
          : round4(avgModelProbabilityCorrect - breakEvenWinRate);

      return {
        strategy_id: summary.id,
        strategy_label: summary.label,
        agent_id: agentId,
        agent_name: resolvedTrades[0]?.agent_name ?? agent?.name ?? agentId,
        min_edge: summary.min_edge,
        resolved_trades: resolvedTrades.length,
        wins,
        losses,
        win_rate: winRate,
        stake_usd: round2(stakeUsd),
        net_pnl_usd: round2(netPnlUsd),
        roi_on_stake: stakeUsd > 0 ? round4(netPnlUsd / stakeUsd) : 0,
        avg_entry_price: averageResolvedTradeValue(
          resolvedTrades,
          (trade) => trade.market_price,
        ),
        avg_probability: averageResolvedTradeValue(
          resolvedTrades,
          (trade) => trade.probability,
        ),
        avg_model_probability_correct: avgModelProbabilityCorrect,
        avg_abs_edge: averageResolvedTradeValue(
          resolvedTrades,
          (trade) => trade.abs_edge,
        ),
        avg_profit_if_correct_usd: round2(avgProfitIfCorrectUsd),
        avg_loss_if_wrong_usd: round2(avgLossIfWrongUsd),
        avg_pnl_per_trade_usd:
          resolvedTrades.length > 0
            ? round2(netPnlUsd / resolvedTrades.length)
            : 0,
        payoff_ratio: payoffRatio,
        break_even_win_rate: breakEvenWinRate,
        win_rate_edge: winRateEdge,
        model_probability_edge_to_break_even: modelProbabilityEdgeToBreakEven,
        above_break_even: winRateEdge !== null && winRateEdge > 0,
        latest_resolved_at: resolvedAtForLedger(resolvedTrades[0] ?? null),
        recent_resolved_trades: resolvedTrades
          .slice(0, 12)
          .map(buildAgentEdgeTradeEntry),
      };
    })
    .sort((a, b) => {
      if (b.resolved_trades !== a.resolved_trades) {
        return b.resolved_trades - a.resolved_trades;
      }
      if (b.net_pnl_usd !== a.net_pnl_usd) return b.net_pnl_usd - a.net_pnl_usd;
      return `${a.agent_id}-${a.min_edge}`.localeCompare(
        `${b.agent_id}-${b.min_edge}`,
      );
    });
  const totalResolvedTrades = rules.reduce(
    (sum, rule) => sum + rule.resolved_trades,
    0,
  );
  const totalNetPnlUsd = rules.reduce((sum, rule) => sum + rule.net_pnl_usd, 0);
  const aboveBreakEvenRules = rules.filter((rule) => rule.above_break_even);
  const belowBreakEvenRules = rules.filter(
    (rule) => rule.resolved_trades > 0 && !rule.above_break_even,
  );
  const latestResolvedAt =
    rules
      .map((rule) => rule.latest_resolved_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const status: AgentEdgeResolvedTradeLedger["status"] =
    rules.length === 0
      ? "unavailable"
      : totalResolvedTrades > 0
        ? "available"
        : "collecting";

  return {
    schema_version: "1",
    generated_at: generatedAt,
    status,
    status_label:
      status === "available"
        ? "Available"
        : status === "collecting"
          ? "Collecting"
          : "Unavailable",
    message:
      status === "available"
        ? "Resolved agent-edge paper tickets are available for audit."
        : status === "collecting"
          ? "Canonical agent-edge rules have not resolved paper tickets yet."
          : "No canonical agent-edge rule ledger is available.",
    next_required_action:
      status === "available"
        ? "Inspect resolved tickets before trusting any profitable-rule summary."
        : status === "collecting"
          ? "Wait for live paper markets to resolve before judging realized profitability."
          : "Capture the canonical agent-edge strategy registry before auditing resolved tickets.",
    paper_only: true,
    real_money_execution_allowed: false,
    rule_count: rules.length,
    resolved_rule_count: rules.filter((rule) => rule.resolved_trades > 0)
      .length,
    profitable_rule_count: rules.filter((rule) => rule.net_pnl_usd > 0).length,
    above_break_even_rule_count: aboveBreakEvenRules.length,
    below_break_even_rule_count: belowBreakEvenRules.length,
    total_resolved_trades: totalResolvedTrades,
    total_net_pnl_usd: round2(totalNetPnlUsd),
    latest_resolved_at: latestResolvedAt,
    rules,
  };
}

function dayKey(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  return parsed.toISOString().slice(0, 10);
}

function buildDailySnapshots(
  trades: PaperTrade[],
  sample: TradingSample,
): DailyEvidenceSnapshot[] {
  const filtered = trades
    .filter((trade) => inSample(trade, sample))
    .filter((trade) => Number.isFinite(Date.parse(trade.created_at)));
  if (filtered.length === 0) return [];

  const latestTs = Math.max(
    ...filtered.map((trade) => Date.parse(trade.created_at)),
  );
  const cutoffTs =
    latestTs - (PAPER_TRADING_CONFIG.dailyWindowDays - 1) * 24 * 60 * 60 * 1000;
  const recent = filtered.filter(
    (trade) => Date.parse(trade.created_at) >= cutoffTs,
  );

  const byDay = new Map<string, PaperTrade[]>();
  for (const trade of recent) {
    const key = dayKey(trade.created_at);
    const dayTrades = byDay.get(key) ?? [];
    dayTrades.push(trade);
    byDay.set(key, dayTrades);
  }

  let cumulativePnl = 0;
  const snapshots = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayTrades]) => {
      const resolved = dayTrades.filter((trade) => trade.pnl_usd !== null);
      const open = dayTrades.filter((trade) => trade.pnl_usd === null);
      const netPnl = resolved.reduce(
        (sum, trade) => sum + (trade.pnl_usd ?? 0),
        0,
      );
      cumulativePnl += netPnl;
      const wins = resolved.filter((trade) => trade.won).length;
      const resolvedStake = resolved.reduce(
        (sum, trade) => sum + trade.stake_usd,
        0,
      );
      const totalRisk = dayTrades.reduce(
        (sum, trade) => sum + trade.stake_usd,
        0,
      );
      const openExposure = open.reduce(
        (sum, trade) => sum + trade.stake_usd,
        0,
      );
      const openExpectedPnl = open.reduce(
        (sum, trade) => sum + trade.expected_pnl_usd,
        0,
      );

      return {
        date,
        sample,
        locked_trades: dayTrades.length,
        resolved_trades: resolved.length,
        open_signals: open.length,
        wins,
        losses: resolved.length - wins,
        total_risk_usd: round2(totalRisk),
        resolved_stake_usd: round2(resolvedStake),
        net_pnl_usd: round2(netPnl),
        cumulative_pnl_usd: round2(cumulativePnl),
        open_exposure_usd: round2(openExposure),
        open_expected_pnl_usd: round2(openExpectedPnl),
      };
    });

  return snapshots.reverse();
}

function buildStrategyDailySeries(
  strategy: StrategyDefinition,
  trades: PaperTrade[],
  proofGate: StrategyProofGate,
): StrategyDailyEvidenceSeries {
  return {
    strategy_id: strategy.id,
    strategy_label: strategy.label,
    sample: strategy.sample,
    is_custom: Boolean(strategy.isCustom),
    proof_status: proofGate.status,
    proof_status_label: proofGate.status_label,
    days: buildDailySnapshots(trades, strategy.sample),
  };
}

function evaluateStrategy(
  rows: PredictionMarketRow[],
  strategy: StrategyDefinition,
): StrategyEvaluation {
  const { acceptedTrades, ledger } = tradesForStrategy(rows, strategy);
  const summary = summarizeStrategyFromTrades(strategy, acceptedTrades, ledger);
  return {
    summary,
    acceptedTrades,
    ledger,
    dailySeries: buildStrategyDailySeries(
      strategy,
      acceptedTrades,
      summary.proof_gate,
    ),
  };
}

function calendarSpanDays(trades: PaperTrade[]): {
  firstTicketAt: string | null;
  latestTicketAt: string | null;
  days: number;
} {
  const timestamps = trades
    .map((trade) => Date.parse(trade.created_at))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (timestamps.length === 0) {
    return { firstTicketAt: null, latestTicketAt: null, days: 0 };
  }

  const first = timestamps[0];
  const latest = timestamps[timestamps.length - 1];
  return {
    firstTicketAt: new Date(first).toISOString(),
    latestTicketAt: new Date(latest).toISOString(),
    days: Math.max(1, Math.floor((latest - first) / (24 * 60 * 60 * 1000)) + 1),
  };
}

function buildProofGate(
  strategy: StrategyDefinition,
  summary: Omit<StrategyVariantSummary, "proof_gate">,
  trades: PaperTrade[],
): StrategyProofGate {
  const span = calendarSpanDays(trades);
  const dailySnapshots = buildDailySnapshots(trades, strategy.sample);
  const avgDailyPnl =
    dailySnapshots.length > 0
      ? dailySnapshots.reduce((sum, day) => sum + day.net_pnl_usd, 0) /
        dailySnapshots.length
      : 0;
  const positiveDays = dailySnapshots.filter(
    (day) => day.net_pnl_usd > 0,
  ).length;
  const losingDays = dailySnapshots.filter((day) => day.net_pnl_usd < 0).length;
  const blockers: string[] = [];

  if (strategy.sample !== "live_only") {
    blockers.push("Not live-only evidence.");
    return {
      status: "control_only",
      strategy_id: strategy.id,
      strategy_label: strategy.label,
      status_label: "Control only",
      rules: PAPER_TRADING_PROOF_RULES,
      calendar_days_observed: span.days,
      active_ticket_days: dailySnapshots.length,
      resolved_trades: summary.resolved_trades,
      open_signals: summary.open_signals,
      resolved_net_pnl_usd: summary.net_pnl_usd,
      resolved_roi_on_stake: summary.roi_on_stake,
      max_drawdown_usd: summary.max_drawdown_usd,
      avg_daily_pnl_usd: round2(avgDailyPnl),
      positive_days: positiveDays,
      losing_days: losingDays,
      first_ticket_at: span.firstTicketAt,
      latest_ticket_at: span.latestTicketAt,
      blockers,
    };
  }

  if (span.days < PAPER_TRADING_PROOF_RULES.requiredLiveDays) {
    blockers.push(
      `${PAPER_TRADING_PROOF_RULES.requiredLiveDays - span.days} more live calendar days needed.`,
    );
  }
  if (
    summary.resolved_trades < PAPER_TRADING_PROOF_RULES.requiredResolvedTrades
  ) {
    blockers.push(
      `${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades - summary.resolved_trades} more resolved live trades needed.`,
    );
  }

  const enoughEvidence =
    span.days >= PAPER_TRADING_PROOF_RULES.requiredLiveDays &&
    summary.resolved_trades >= PAPER_TRADING_PROOF_RULES.requiredResolvedTrades;
  if (enoughEvidence) {
    if (summary.net_pnl_usd < PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd) {
      blockers.push("Resolved paper P&L is not positive.");
    }
    if (summary.roi_on_stake <= PAPER_TRADING_PROOF_RULES.minRoiOnStake) {
      blockers.push("Resolved ROI is not positive.");
    }
    if (summary.max_drawdown_usd > PAPER_TRADING_PROOF_RULES.maxDrawdownUsd) {
      blockers.push("Max drawdown is above the paper risk cap.");
    }
  }

  const status: ProofGateStatus = enoughEvidence
    ? blockers.length === 0
      ? "candidate"
      : "not_qualified"
    : "collecting";

  return {
    status,
    strategy_id: strategy.id,
    strategy_label: strategy.label,
    status_label:
      status === "candidate"
        ? "Candidate"
        : status === "not_qualified"
          ? "Not qualified"
          : "Collecting",
    rules: PAPER_TRADING_PROOF_RULES,
    calendar_days_observed: span.days,
    active_ticket_days: dailySnapshots.length,
    resolved_trades: summary.resolved_trades,
    open_signals: summary.open_signals,
    resolved_net_pnl_usd: summary.net_pnl_usd,
    resolved_roi_on_stake: summary.roi_on_stake,
    max_drawdown_usd: summary.max_drawdown_usd,
    avg_daily_pnl_usd: round2(avgDailyPnl),
    positive_days: positiveDays,
    losing_days: losingDays,
    first_ticket_at: span.firstTicketAt,
    latest_ticket_at: span.latestTicketAt,
    blockers,
  };
}

async function loadPredictionRows(): Promise<{
  source: TradingSource;
  rows: PredictionMarketRow[];
}> {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey =
    readEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await sb
        .from("predictions")
        .select(
          "id, agent_id, market_id, probability, confidence, reasoning, market_price_at_forecast, is_backfill, created_at, markets!inner(id, source, question, category, url, status, resolved_outcome, resolved_at, closes_at, outcome_yes_price)",
        )
        .eq("abstained", false)
        .order("created_at", { ascending: false })
        .limit(PAPER_TRADING_CONFIG.maxRows);

      if (!error && data && data.length > 0) {
        const rows = (data as Array<Record<string, unknown>>).map((p) => {
          const market = p.markets as Record<string, unknown>;
          return {
            id: p.id as string,
            agent_id: p.agent_id as string,
            market_id: p.market_id as string,
            probability: Number(p.probability),
            confidence: (p.confidence as string) ?? "medium",
            reasoning: (p.reasoning as string) ?? "",
            market_price_at_forecast: Number(p.market_price_at_forecast ?? 0.5),
            is_backfill: p.is_backfill === false ? false : true,
            created_at: p.created_at as string,
            market: {
              id: market.id as string,
              source: (market.source as string) ?? "unknown",
              question: (market.question as string) ?? "",
              category: (market.category as string) ?? "other",
              url: (market.url as string | null) ?? null,
              status: ((market.status as string) ?? "open") as MarketStatus,
              resolved_outcome:
                market.resolved_outcome == null
                  ? null
                  : Boolean(market.resolved_outcome),
              resolved_at: (market.resolved_at as string | null) ?? null,
              closes_at: (market.closes_at as string | null) ?? null,
              outcome_yes_price: Number(market.outcome_yes_price ?? 0.5),
            },
          };
        });
        return { source: "live", rows };
      }
    } catch {
      // Fall through to demo data.
    }
  }

  const markets = new Map(DEMO_MARKETS.map((m) => [m.id, m]));
  const rows: PredictionMarketRow[] = [];
  for (const p of DEMO_PREDICTIONS.filter((pred) => !pred.abstained)) {
    const m = markets.get(p.market_id);
    if (!m) continue;
    rows.push({
      id: `demo-${p.agent_id}-${p.market_id}-${p.created_at}`,
      agent_id: p.agent_id,
      market_id: p.market_id,
      probability: p.probability,
      confidence: p.confidence ?? "medium",
      reasoning: p.reasoning,
      market_price_at_forecast: p.market_price_at_forecast,
      is_backfill: true,
      created_at: p.created_at,
      market: {
        id: m.id,
        source: m.source,
        question: m.question,
        category: m.category ?? "other",
        url: m.url ?? null,
        status: m.status as MarketStatus,
        resolved_outcome: m.resolved_outcome ?? null,
        resolved_at: m.resolved_at ?? null,
        closes_at: m.closes_at ?? null,
        outcome_yes_price: m.outcome_yes_price,
      },
    });
  }

  return { source: "demo", rows };
}

export async function getTradingSnapshot(
  controls: TradingControls = DEFAULT_TRADING_CONTROLS,
): Promise<TradingSnapshot> {
  const generatedAt = new Date().toISOString();
  const { source, rows } = await loadPredictionRows();
  const selectedDefinition = strategyFromControls(controls);
  const allTrades = rows
    .map((row) =>
      buildTrade(row, {
        minEdge: PAPER_TRADING_CONFIG.minEdge,
        stakeMode: "kelly_capped",
      }),
    )
    .filter((t): t is PaperTrade => Boolean(t));

  const resolvedTrades = allTrades.filter((t) => t.pnl_usd !== null);
  const liveTrades = allTrades.filter((t) => !t.is_backfill);
  const backfillTrades = allTrades.filter((t) => t.is_backfill);
  const openSignals = allTrades
    .filter((t) => t.pnl_usd === null)
    .sort((a, b) => b.expected_pnl_usd - a.expected_pnl_usd)
    .slice(0, PAPER_TRADING_CONFIG.topOpenSignals);

  const agentSummaries = summarizeAgentsForTrades(allTrades);
  const liveAgentSummaries = summarizeAgentsForTrades(liveTrades);

  const scenarioSummaries = [
    {
      id: "edge-05-kelly",
      label: "Edge >= 5pp, quarter Kelly capped",
      minEdge: 0.05,
      stakeMode: "kelly_capped" as StakeMode,
    },
    {
      id: "edge-10-kelly",
      label: "Edge >= 10pp, quarter Kelly capped",
      minEdge: 0.1,
      stakeMode: "kelly_capped" as StakeMode,
    },
    {
      id: "edge-15-kelly",
      label: "Edge >= 15pp, quarter Kelly capped",
      minEdge: 0.15,
      stakeMode: "kelly_capped" as StakeMode,
    },
    {
      id: "edge-10-flat25",
      label: "Edge >= 10pp, flat $25 tickets",
      minEdge: 0.1,
      stakeMode: "flat" as StakeMode,
    },
  ].map((scenario) => summarizeScenario(rows, scenario));

  const evaluatedStrategies = STRATEGY_DEFINITIONS.map((strategy) =>
    evaluateStrategy(rows, strategy),
  );
  const strategyVariants = evaluatedStrategies.map(({ summary }) => summary);
  const strategyDailySeries = evaluatedStrategies.map(
    ({ dailySeries }) => dailySeries,
  );
  const selectedEvaluation = evaluateStrategy(rows, selectedDefinition);
  const selectedTrades = selectedEvaluation.acceptedTrades;
  const selectedExposureLedger = selectedEvaluation.ledger;
  const selectedOpenSignals = selectedTrades
    .filter((t) => t.pnl_usd === null)
    .sort((a, b) => b.expected_pnl_usd - a.expected_pnl_usd)
    .slice(0, PAPER_TRADING_CONFIG.topOpenSignals);
  const selectedRecentResolved = selectedTrades
    .filter((t) => t.pnl_usd !== null)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 24);
  const selectedStrategy = selectedEvaluation.summary;
  const resolutionWatch = buildResolutionWatch(
    liveTrades,
    new Date(generatedAt),
  );

  return {
    generated_at: generatedAt,
    source,
    schema_version: "1",
    config: PAPER_TRADING_CONFIG,
    controls,
    strategy_registry: buildPaperTradingStrategyRegistry(controls, generatedAt),
    would_trade_today: buildWouldTradeTodayFeed(
      evaluatedStrategies,
      selectedEvaluation,
      resolutionWatch,
      generatedAt,
    ),
    market_exposure_digest: buildMarketExposureDigest(liveTrades, generatedAt),
    totals: summarizeTotals(allTrades),
    live_totals: summarizeTotals(liveTrades),
    backfill_totals: summarizeTotals(backfillTrades),
    resolution_watch: resolutionWatch,
    selected_strategy: selectedStrategy,
    proof_gates: [selectedStrategy, ...strategyVariants].map(
      (strategy) => strategy.proof_gate,
    ),
    selected_exposure_ledger: selectedExposureLedger,
    selected_open_signals: selectedOpenSignals,
    selected_recent_resolved: selectedRecentResolved,
    selected_daily_series: selectedEvaluation.dailySeries,
    selected_daily_snapshots: selectedEvaluation.dailySeries.days,
    agent_summaries: agentSummaries,
    live_agent_summaries: liveAgentSummaries,
    scenario_summaries: scenarioSummaries,
    agent_edge_matrix: buildAgentEdgeMatrix(strategyVariants),
    agent_edge_watchlist: buildAgentEdgeOpenSignalWatchlist(
      evaluatedStrategies,
      generatedAt,
    ),
    agent_edge_runway: buildAgentEdgeProofRunway(
      evaluatedStrategies,
      generatedAt,
    ),
    agent_edge_trade_ledger: buildAgentEdgeTradeLedger(
      evaluatedStrategies,
      generatedAt,
    ),
    agent_edge_attribution: buildAgentEdgeProfitAttribution(
      evaluatedStrategies,
      generatedAt,
    ),
    strategy_variants: strategyVariants,
    strategy_daily_series: strategyDailySeries,
    daily_snapshots: buildDailySnapshots(allTrades, "all"),
    live_daily_snapshots: buildDailySnapshots(allTrades, "live_only"),
    open_signals: openSignals,
    recent_resolved: resolvedTrades
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 24),
  };
}
