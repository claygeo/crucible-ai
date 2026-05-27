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

type MarketStatus = "open" | "pending_resolution" | "resolved" | "disputed" | "voided";

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
  agent_id: string;
  agent_name: string;
  side: TradeSide;
  stake_usd: number;
  expected_pnl_usd: number;
  market_closes_at: string | null;
  created_at: string;
  close_status: "overdue" | "closing_next_7d" | "future" | "unknown_close";
  days_until_close: number | null;
  age_days: number;
};

export type TradingResolutionWatch = {
  status: "waiting_resolution" | "overdue_resolution" | "no_open_live_signals";
  status_label: string;
  open_live_signals: number;
  overdue_live_signals: number;
  closing_next_7d_signals: number;
  unknown_close_live_signals: number;
  next_close_at: string | null;
  oldest_opened_at: string | null;
  total_open_exposure_usd: number;
  total_open_expected_pnl_usd: number;
  signals: ResolutionWatchSignal[];
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
  resolved_net_pnl_usd: number;
  resolved_roi_on_stake: number;
  avg_edge: number;
  avg_stake_usd: number;
  max_drawdown_usd: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
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

export type TradingSnapshot = {
  generated_at: string;
  source: TradingSource;
  schema_version: "1";
  config: typeof PAPER_TRADING_CONFIG;
  controls: TradingControls;
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

const AGENT_EDGE_GATES = [0.05, 0.1] as const;

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
    }))
);

const STRATEGY_DEFINITIONS: StrategyDefinition[] = [
  ...AGENT_EDGE_STRATEGY_DEFINITIONS,
  {
    id: "all-live-edge-10",
    label: "All agents live, edge >= 10pp",
    description: "Broad live strategy with a stricter edge gate across the house roster.",
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
    description: "Sports markets only. Keeps fast-resolving edge separate from politics.",
    sample: "live_only",
    minEdge: 0.1,
    stakeMode: "kelly_capped",
    category: "sports",
  },
  {
    id: "mirror-backfill-sanity",
    label: "Mirror backfill sanity",
    description: "Historical control. Useful for comparison, not a live-trading proof.",
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
  max: number
): number {
  const raw = readParam(source, key);
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function includesOption<T extends readonly string[]>(
  options: T,
  value: string | null
): value is T[number] {
  return value !== null && options.includes(value);
}

export function parseTradingControls(
  source: TradingParamSource = {}
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
      includesOption(TRADING_CATEGORY_OPTIONS, categoryRaw) && categoryRaw !== "all"
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
        0.5
      )
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
        PAPER_TRADING_CONFIG.maxStakeUsd
      )
    ),
    max_stake_usd: round2(
      numberParam(
        source,
        "max_stake_usd",
        DEFAULT_TRADING_CONTROLS.max_stake_usd,
        PAPER_TRADING_CONFIG.minStakeUsd,
        PAPER_TRADING_CONFIG.maxStakeUsd
      )
    ),
    max_open_exposure_usd: round2(
      numberParam(
        source,
        "max_open_exposure_usd",
        DEFAULT_TRADING_CONTROLS.max_open_exposure_usd,
        PAPER_TRADING_CONFIG.maxStakeUsd,
        PAPER_TRADING_CONFIG.bankrollUsd
      )
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
      controls.min_edge * 100
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

const clampProbability = (n: number) => Math.min(0.9999, Math.max(0.0001, n));

function validEntryPrice(n: number, config: PaperTradingConfig): number | null {
  if (!Number.isFinite(n)) return null;
  if (
    n < config.minEntryPrice ||
    n > config.maxEntryPrice
  ) {
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
  config: PaperTradingConfig
): number {
  if (stakeMode === "flat") return config.flatStakeUsd;

  const denominator = side === "YES" ? 1 - entryPrice : entryPrice;
  const fullKelly = denominator > 0 ? Math.abs(edge) / denominator : 0;
  const rawStake =
    config.bankrollUsd *
    config.kellyFraction *
    fullKelly;

  return round2(
    Math.min(
      config.maxStakeUsd,
      Math.max(config.minStakeUsd, rawStake)
    )
  );
}

function buildTrade(
  row: PredictionMarketRow,
  opts: { minEdge: number; stakeMode: StakeMode; config?: PaperTradingConfig }
): PaperTrade | null {
  const config = opts.config ?? PAPER_TRADING_CONFIG;
  const probability = clampProbability(Number(row.probability));
  const marketPrice = validEntryPrice(
    Number(row.market_price_at_forecast ?? row.market.outcome_yes_price ?? 0.5),
    config
  );
  if (marketPrice === null) return null;
  const edge = probability - marketPrice;
  const absEdge = Math.abs(edge);

  if (!Number.isFinite(absEdge) || absEdge < opts.minEdge) return null;
  if (row.market.status === "voided" || row.market.status === "disputed") return null;

  const side: TradeSide = edge >= 0 ? "YES" : "NO";
  const stakeUsd = stakeForTrade(
    side,
    edge,
    marketPrice,
    opts.stakeMode,
    config
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
  const pnlUsd =
    won === null ? null : won ? profitIfCorrectUsd : -stakeUsd;

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
  rank: number
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
    avg_edge: round4(mine.reduce((sum, t) => sum + t.abs_edge, 0) / mine.length),
    avg_stake_usd: round2(stakeUsd / mine.length),
    avg_expected_pnl_usd: round2(
      mine.reduce((sum, t) => sum + t.expected_pnl_usd, 0) / mine.length
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
  }
): ScenarioSummary {
  const trades = rows
    .map((row) =>
      buildTrade(row, {
        minEdge: scenario.minEdge,
        stakeMode: scenario.stakeMode,
      })
    )
    .filter((t): t is PaperTrade => Boolean(t))
    .filter((t) => t.pnl_usd !== null);

  const stakeUsd = trades.reduce((sum, t) => sum + t.stake_usd, 0);
  const netPnlUsd = trades.reduce((sum, t) => sum + (t.pnl_usd ?? 0), 0);
  const wins = trades.filter((t) => t.won).length;
  const maxLossPerTrade = trades.reduce(
    (max, t) => Math.max(max, t.max_loss_usd),
    0
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
  const resolvedStakeUsd = resolvedTrades.reduce((sum, t) => sum + t.stake_usd, 0);
  const resolvedNetPnlUsd = resolvedTrades.reduce(
    (sum, t) => sum + (t.pnl_usd ?? 0),
    0
  );
  const openExposureUsd = openTrades.reduce((sum, t) => sum + t.stake_usd, 0);
  const openExpectedPnlUsd = openTrades.reduce(
    (sum, t) => sum + t.expected_pnl_usd,
    0
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
    backfill_resolved_trades: resolvedTrades.filter((t) => t.is_backfill).length,
  };
}

function dayDelta(from: Date, toIso: string): number | null {
  const fromTs = from.getTime();
  const toTs = Date.parse(toIso);
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) return null;
  return round2((toTs - fromTs) / (24 * 60 * 60 * 1000));
}

function resolutionStatusRank(
  status: ResolutionWatchSignal["close_status"]
): number {
  if (status === "overdue") return 0;
  if (status === "closing_next_7d") return 1;
  if (status === "unknown_close") return 2;
  return 3;
}

function buildResolutionWatch(
  liveTrades: PaperTrade[],
  now = new Date()
): TradingResolutionWatch {
  const openLiveTrades = liveTrades.filter((trade) => trade.pnl_usd === null);
  const nowTs = now.getTime();
  const weekFromNowTs = nowTs + 7 * 24 * 60 * 60 * 1000;
  const signals = openLiveTrades.map((trade): ResolutionWatchSignal => {
    const closeTs = trade.market_closes_at ? Date.parse(trade.market_closes_at) : NaN;
    const ageDays = dayDelta(new Date(trade.created_at), now.toISOString()) ?? 0;
    const closeStatus: ResolutionWatchSignal["close_status"] =
      !Number.isFinite(closeTs)
        ? "unknown_close"
        : closeTs < nowTs
          ? "overdue"
          : closeTs <= weekFromNowTs
            ? "closing_next_7d"
            : "future";

    return {
      prediction_id: trade.prediction_id,
      market_id: trade.market_id,
      market_question: trade.market_question,
      agent_id: trade.agent_id,
      agent_name: trade.agent_name,
      side: trade.side,
      stake_usd: trade.stake_usd,
      expected_pnl_usd: trade.expected_pnl_usd,
      market_closes_at: trade.market_closes_at,
      created_at: trade.created_at,
      close_status: closeStatus,
      days_until_close: trade.market_closes_at
        ? dayDelta(now, trade.market_closes_at)
        : null,
      age_days: Math.max(0, ageDays),
    };
  });

  const overdueCount = signals.filter(
    (signal) => signal.close_status === "overdue"
  ).length;
  const closingSoonCount = signals.filter(
    (signal) => signal.close_status === "closing_next_7d"
  ).length;
  const unknownCloseCount = signals.filter(
    (signal) => signal.close_status === "unknown_close"
  ).length;
  const futureCloseTimes = signals
    .map((signal) =>
      signal.market_closes_at ? Date.parse(signal.market_closes_at) : NaN
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
        Date.parse(a.created_at) - Date.parse(b.created_at)
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
    closing_next_7d_signals: closingSoonCount,
    unknown_close_live_signals: unknownCloseCount,
    next_close_at:
      futureCloseTimes.length > 0
        ? new Date(futureCloseTimes[0]).toISOString()
        : null,
    oldest_opened_at:
      openedTimes.length > 0 ? new Date(openedTimes[0]).toISOString() : null,
    total_open_exposure_usd: round2(
      openLiveTrades.reduce((sum, trade) => sum + trade.stake_usd, 0)
    ),
    total_open_expected_pnl_usd: round2(
      openLiveTrades.reduce((sum, trade) => sum + trade.expected_pnl_usd, 0)
    ),
    signals: sortedSignals,
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
  strategy: StrategyDefinition
): PaperTrade[] {
  const strategyConfig = configForStrategy(strategy);

  return rows
    .map((row) =>
      buildTrade(row, {
        minEdge: strategy.minEdge,
        stakeMode: strategy.stakeMode,
        config: strategyConfig,
      })
    )
    .filter((t): t is PaperTrade => Boolean(t))
    .filter((t) => inSample(t, strategy.sample))
    .filter((t) => !strategy.agentIds || strategy.agentIds.includes(t.agent_id))
    .filter((t) => !strategy.category || t.market_category === strategy.category)
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
  maxOpenExposureUsd: number
): {
  acceptedTrades: PaperTrade[];
  ledger: ExposureLedgerSummary;
} {
  const sorted = trades
    .filter((trade) => Number.isFinite(Date.parse(trade.created_at)))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const acceptedTrades: PaperTrade[] = [];
  const entries: ExposureLedgerEntry[] = [];
  const active: Array<{ predictionId: string; stakeUsd: number; closesAt: number }> = [];
  let peakOpenExposure = 0;
  let skippedExposureUsd = 0;
  let skippedExpectedOpenPnlUsd = 0;
  let skippedOpenSignals = 0;

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
      open_exposure_before_usd: round2(exposureBefore),
      open_exposure_after_usd: round2(exposureAfter),
      status: "accepted",
      reason: null,
    });
  }

  const acceptedOpenSignals = acceptedTrades.filter((trade) => trade.pnl_usd === null);
  const acceptedResolvedTrades = acceptedTrades.filter(
    (trade) => trade.pnl_usd !== null
  );

  return {
    acceptedTrades,
    ledger: {
      max_open_exposure_usd: round2(maxOpenExposureUsd),
      accepted_trades: acceptedTrades.length,
      skipped_trades: entries.filter(
        (entry) => entry.status === "skipped_exposure_cap"
      ).length,
      accepted_open_signals: acceptedOpenSignals.length,
      skipped_open_signals: skippedOpenSignals,
      accepted_resolved_trades: acceptedResolvedTrades.length,
      current_open_exposure_usd: round2(
        acceptedOpenSignals.reduce((sum, trade) => sum + trade.stake_usd, 0)
      ),
      peak_open_exposure_usd: round2(peakOpenExposure),
      skipped_exposure_usd: round2(skippedExposureUsd),
      accepted_expected_open_pnl_usd: round2(
        acceptedOpenSignals.reduce((sum, trade) => sum + trade.expected_pnl_usd, 0)
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
  strategy: StrategyDefinition
): {
  acceptedTrades: PaperTrade[];
  ledger: ExposureLedgerSummary;
} {
  const strategyConfig = configForStrategy(strategy);
  return applyExposureCap(
    rawTradesForStrategy(rows, strategy),
    strategyConfig.maxOpenExposureUsd
  );
}

function summarizeStrategyFromTrades(
  strategy: StrategyDefinition,
  trades: PaperTrade[],
  ledger: ExposureLedgerSummary
): StrategyVariantSummary {
  const resolvedTrades = trades
    .filter((t) => t.pnl_usd !== null)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const openTrades = trades.filter((t) => t.pnl_usd === null);
  const stakeUsd = resolvedTrades.reduce((sum, t) => sum + t.stake_usd, 0);
  const netPnlUsd = resolvedTrades.reduce((sum, t) => sum + (t.pnl_usd ?? 0), 0);
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
              resolvedTrades.length
          )
        : 0,
    avg_stake_usd:
      resolvedTrades.length > 0 ? round2(stakeUsd / resolvedTrades.length) : 0,
    max_drawdown_usd: round2(Math.abs(maxDrawdown)),
    open_exposure_usd: round2(openTrades.reduce((sum, t) => sum + t.stake_usd, 0)),
    open_expected_pnl_usd: round2(
      openTrades.reduce((sum, t) => sum + t.expected_pnl_usd, 0)
    ),
    exposure_ledger: ledger,
  };

  return {
    ...summary,
    proof_gate: buildProofGate(strategy, summary, trades),
  };
}

function isAgentEdgeVariant(
  strategy: StrategyVariantSummary
): boolean {
  return (
    strategy.sample === "live_only" &&
    !strategy.is_custom &&
    strategy.agent_ids.length === 1 &&
    strategy.category === null &&
    strategy.side === null &&
    AGENT_EDGE_GATES.includes(strategy.min_edge as (typeof AGENT_EDGE_GATES)[number])
  );
}

function buildAgentEdgeMatrix(
  strategies: StrategyVariantSummary[]
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
          (agentRank.get(b.agent_id) ?? 999) ||
        a.min_edge - b.min_edge
    );
}

function dayKey(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  return parsed.toISOString().slice(0, 10);
}

function buildDailySnapshots(
  trades: PaperTrade[],
  sample: TradingSample
): DailyEvidenceSnapshot[] {
  const filtered = trades
    .filter((trade) => inSample(trade, sample))
    .filter((trade) => Number.isFinite(Date.parse(trade.created_at)));
  if (filtered.length === 0) return [];

  const latestTs = Math.max(...filtered.map((trade) => Date.parse(trade.created_at)));
  const cutoffTs =
    latestTs - (PAPER_TRADING_CONFIG.dailyWindowDays - 1) * 24 * 60 * 60 * 1000;
  const recent = filtered.filter((trade) => Date.parse(trade.created_at) >= cutoffTs);

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
      const netPnl = resolved.reduce((sum, trade) => sum + (trade.pnl_usd ?? 0), 0);
      cumulativePnl += netPnl;
      const wins = resolved.filter((trade) => trade.won).length;
      const resolvedStake = resolved.reduce((sum, trade) => sum + trade.stake_usd, 0);
      const totalRisk = dayTrades.reduce((sum, trade) => sum + trade.stake_usd, 0);
      const openExposure = open.reduce((sum, trade) => sum + trade.stake_usd, 0);
      const openExpectedPnl = open.reduce(
        (sum, trade) => sum + trade.expected_pnl_usd,
        0
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
  proofGate: StrategyProofGate
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
  strategy: StrategyDefinition
): StrategyEvaluation {
  const { acceptedTrades, ledger } = tradesForStrategy(rows, strategy);
  const summary = summarizeStrategyFromTrades(strategy, acceptedTrades, ledger);
  return {
    summary,
    acceptedTrades,
    ledger,
    dailySeries: buildStrategyDailySeries(strategy, acceptedTrades, summary.proof_gate),
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
  trades: PaperTrade[]
): StrategyProofGate {
  const span = calendarSpanDays(trades);
  const dailySnapshots = buildDailySnapshots(trades, strategy.sample);
  const avgDailyPnl =
    dailySnapshots.length > 0
      ? dailySnapshots.reduce((sum, day) => sum + day.net_pnl_usd, 0) /
        dailySnapshots.length
      : 0;
  const positiveDays = dailySnapshots.filter((day) => day.net_pnl_usd > 0).length;
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
      `${PAPER_TRADING_PROOF_RULES.requiredLiveDays - span.days} more live calendar days needed.`
    );
  }
  if (summary.resolved_trades < PAPER_TRADING_PROOF_RULES.requiredResolvedTrades) {
    blockers.push(
      `${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades - summary.resolved_trades} more resolved live trades needed.`
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await sb
        .from("predictions")
        .select(
          "id, agent_id, market_id, probability, confidence, reasoning, market_price_at_forecast, is_backfill, created_at, markets!inner(id, source, question, category, url, status, resolved_outcome, resolved_at, closes_at, outcome_yes_price)"
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
  controls: TradingControls = DEFAULT_TRADING_CONTROLS
): Promise<TradingSnapshot> {
  const { source, rows } = await loadPredictionRows();
  const selectedDefinition = strategyFromControls(controls);
  const allTrades = rows
    .map((row) =>
      buildTrade(row, {
        minEdge: PAPER_TRADING_CONFIG.minEdge,
        stakeMode: "kelly_capped",
      })
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
    evaluateStrategy(rows, strategy)
  );
  const strategyVariants = evaluatedStrategies.map(({ summary }) => summary);
  const strategyDailySeries = evaluatedStrategies.map(
    ({ dailySeries }) => dailySeries
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

  return {
    generated_at: new Date().toISOString(),
    source,
    schema_version: "1",
    config: PAPER_TRADING_CONFIG,
    controls,
    totals: summarizeTotals(allTrades),
    live_totals: summarizeTotals(liveTrades),
    backfill_totals: summarizeTotals(backfillTrades),
    resolution_watch: buildResolutionWatch(liveTrades),
    selected_strategy: selectedStrategy,
    proof_gates: [selectedStrategy, ...strategyVariants].map(
      (strategy) => strategy.proof_gate
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
