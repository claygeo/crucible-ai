import { createClient } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agents";
import {
  DEFAULT_TRADING_CONTROLS,
  PAPER_TRADING_CONFIG,
  type TradeSide,
  type TradingControls,
} from "@/lib/trading";

type UnknownRecord = Record<string, unknown>;
type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

type DueMarketRecord = {
  id: string;
  source: string;
  source_id: string;
  question: string;
  category: string | null;
  url: string | null;
  status: string;
  closes_at: string | null;
  outcome_yes_price: unknown;
  raw: unknown;
};

type LivePredictionRecord = {
  id: string;
  agent_id: string;
  market_id: string;
  probability: unknown;
  market_price_at_forecast: unknown;
  created_at: string;
};

export type ResolutionCatchupProviderStatus =
  | "resolved"
  | "open"
  | "ambiguous"
  | "unsupported"
  | "unavailable";

export type ResolutionCatchupProviderCheck = {
  provider: string;
  status: ResolutionCatchupProviderStatus;
  status_label: string;
  source_market_id: string | null;
  source_market_slug: string | null;
  resolved_outcome: "YES" | "NO" | null;
  resolved_at: string | null;
  api_url: string | null;
  message: string;
};

export type ResolutionCatchupTradePreview = {
  prediction_id: string;
  agent_id: string;
  agent_name: string;
  market_id: string;
  market_question: string;
  side: TradeSide;
  probability: number;
  market_price: number;
  edge: number;
  abs_edge: number;
  stake_usd: number;
  profit_if_correct_usd: number;
  projected_pnl_usd: number;
  resolved_outcome: "YES" | "NO";
  resolved_at: string;
  created_at: string;
};

export type ResolutionCatchupMarketPreview = {
  market_id: string;
  market_question: string;
  market_source: string;
  market_url: string | null;
  market_status: string;
  market_closes_at: string | null;
  unscored_prediction_count: number;
  eligible_trade_count: number;
  projected_pnl_usd: number;
  provider_resolution: ResolutionCatchupProviderCheck;
};

export type ResolutionCatchupPreview = {
  status:
    | "resolver_lag"
    | "provider_pending"
    | "clear"
    | "unconfigured"
    | "error";
  status_label: string;
  generated_at: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  controls: TradingControls;
  checked_market_limit: number;
  due_market_count: number;
  unscored_live_prediction_count: number;
  provider_resolved_market_count: number;
  provider_open_market_count: number;
  provider_unavailable_market_count: number;
  eligible_trade_count: number;
  projected_resolved_stake_usd: number;
  projected_resolved_pnl_usd: number;
  projected_win_count: number;
  projected_loss_count: number;
  markets: ResolutionCatchupMarketPreview[];
  top_projected_trades: ResolutionCatchupTradePreview[];
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 10_000) / 10_000;
const clampProbability = (value: number) =>
  Math.min(0.9999, Math.max(0.0001, value));

function validEntryPrice(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (
    value < PAPER_TRADING_CONFIG.minEntryPrice ||
    value > PAPER_TRADING_CONFIG.maxEntryPrice
  ) {
    return null;
  }
  return value;
}

function marketUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function slugFromMarket(value: DueMarketRecord): string | null {
  if (isRecord(value.raw)) {
    const rawSlug = stringValue(value.raw.slug);
    if (rawSlug) return rawSlug;
  }
  const url = marketUrl(value.url);
  if (!url) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

function isoFromMillis(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function unconfiguredPreview(
  controls: TradingControls,
  limit: number,
): ResolutionCatchupPreview {
  return {
    status: "unconfigured",
    status_label: "Unconfigured",
    generated_at: new Date().toISOString(),
    message: "Supabase environment variables are unavailable.",
    next_required_action:
      "Restore Supabase read access before reviewing catch-up resolution evidence.",
    paper_only: true,
    real_money_execution_allowed: false,
    controls,
    checked_market_limit: limit,
    due_market_count: 0,
    unscored_live_prediction_count: 0,
    provider_resolved_market_count: 0,
    provider_open_market_count: 0,
    provider_unavailable_market_count: 0,
    eligible_trade_count: 0,
    projected_resolved_stake_usd: 0,
    projected_resolved_pnl_usd: 0,
    projected_win_count: 0,
    projected_loss_count: 0,
    markets: [],
    top_projected_trades: [],
  };
}

function errorPreview(
  controls: TradingControls,
  limit: number,
  message: string,
): ResolutionCatchupPreview {
  return {
    status: "error",
    status_label: "Error",
    generated_at: new Date().toISOString(),
    message,
    next_required_action:
      "Fix catch-up preview data access before trusting resolver lag evidence.",
    paper_only: true,
    real_money_execution_allowed: false,
    controls,
    checked_market_limit: limit,
    due_market_count: 0,
    unscored_live_prediction_count: 0,
    provider_resolved_market_count: 0,
    provider_open_market_count: 0,
    provider_unavailable_market_count: 0,
    eligible_trade_count: 0,
    projected_resolved_stake_usd: 0,
    projected_resolved_pnl_usd: 0,
    projected_win_count: 0,
    projected_loss_count: 0,
    markets: [],
    top_projected_trades: [],
  };
}

async function fetchWithTimeout(
  fetcher: Fetcher,
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, {
      cache: "no-store",
      headers: { "user-agent": "eivra-resolution-catchup-preview/0.1" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function providerUnavailable(
  market: DueMarketRecord,
  apiUrl: string | null,
  message: string,
): ResolutionCatchupProviderCheck {
  return {
    provider: market.source,
    status: "unavailable",
    status_label: "Provider unavailable",
    source_market_id: null,
    source_market_slug: slugFromMarket(market),
    resolved_outcome: null,
    resolved_at: null,
    api_url: apiUrl,
    message,
  };
}

async function fetchManifoldResolution(
  market: DueMarketRecord,
  fetcher: Fetcher,
  timeoutMs: number,
): Promise<ResolutionCatchupProviderCheck> {
  const idUrl = `https://api.manifold.markets/v0/market/${encodeURIComponent(
    market.source_id,
  )}`;
  let response = await fetchWithTimeout(fetcher, idUrl, timeoutMs);
  let apiUrl = idUrl;

  if (!response.ok) {
    const slug = slugFromMarket(market);
    if (!slug) {
      return providerUnavailable(
        market,
        idUrl,
        `Manifold returned HTTP ${response.status} and no slug fallback is available.`,
      );
    }
    apiUrl = `https://api.manifold.markets/v0/slug/${encodeURIComponent(slug)}`;
    response = await fetchWithTimeout(fetcher, apiUrl, timeoutMs);
  }

  if (!response.ok) {
    return providerUnavailable(
      market,
      apiUrl,
      `Manifold returned HTTP ${response.status}.`,
    );
  }

  const body = (await response.json()) as UnknownRecord;
  const sourceMarketId = stringValue(body.id);
  const sourceMarketSlug = slugFromMarket(market);
  if (body.isResolved !== true) {
    return {
      provider: market.source,
      status: "open",
      status_label: "Provider open",
      source_market_id: sourceMarketId,
      source_market_slug: sourceMarketSlug,
      resolved_outcome: null,
      resolved_at: null,
      api_url: apiUrl,
      message: "Manifold still reports this market as unresolved.",
    };
  }

  const resolution = stringValue(body.resolution);
  if (resolution !== "YES" && resolution !== "NO") {
    return {
      provider: market.source,
      status: "ambiguous",
      status_label: "Provider ambiguous",
      source_market_id: sourceMarketId,
      source_market_slug: sourceMarketSlug,
      resolved_outcome: null,
      resolved_at: isoFromMillis(body.resolutionTime),
      api_url: apiUrl,
      message: `Manifold resolved this market as ${resolution ?? "unknown"}, not YES/NO.`,
    };
  }

  return {
    provider: market.source,
    status: "resolved",
    status_label: `Provider resolved ${resolution}`,
    source_market_id: sourceMarketId,
    source_market_slug: sourceMarketSlug,
    resolved_outcome: resolution,
    resolved_at: isoFromMillis(body.resolutionTime) ?? new Date().toISOString(),
    api_url: apiUrl,
    message: `Manifold reports this market resolved ${resolution}.`,
  };
}

async function fetchPolymarketResolution(
  market: DueMarketRecord,
  fetcher: Fetcher,
  timeoutMs: number,
): Promise<ResolutionCatchupProviderCheck> {
  const apiUrl = `https://gamma-api.polymarket.com/markets/${encodeURIComponent(
    market.source_id,
  )}`;
  const response = await fetchWithTimeout(fetcher, apiUrl, timeoutMs);
  if (!response.ok) {
    return providerUnavailable(
      market,
      apiUrl,
      `Polymarket Gamma returned HTTP ${response.status}.`,
    );
  }

  const body = (await response.json()) as UnknownRecord;
  if (body.closed !== true) {
    return {
      provider: market.source,
      status: "open",
      status_label: "Provider open",
      source_market_id: market.source_id,
      source_market_slug: slugFromMarket(market),
      resolved_outcome: null,
      resolved_at: null,
      api_url: apiUrl,
      message: "Polymarket still reports this market as unresolved.",
    };
  }

  let firstOutcomePrice: number | null = null;
  if (typeof body.outcomePrices === "string") {
    try {
      const prices = JSON.parse(body.outcomePrices) as unknown[];
      firstOutcomePrice = numberValue(prices[0], Number.NaN);
    } catch {
      firstOutcomePrice = null;
    }
  } else if (Array.isArray(body.outcomePrices)) {
    firstOutcomePrice = numberValue(body.outcomePrices[0], Number.NaN);
  }

  const outcome =
    firstOutcomePrice === 1 ? "YES" : firstOutcomePrice === 0 ? "NO" : null;
  if (!outcome) {
    return {
      provider: market.source,
      status: "ambiguous",
      status_label: "Provider ambiguous",
      source_market_id: market.source_id,
      source_market_slug: slugFromMarket(market),
      resolved_outcome: null,
      resolved_at: stringValue(body.endDate),
      api_url: apiUrl,
      message:
        "Polymarket closed this market without a clear binary outcome price.",
    };
  }

  return {
    provider: market.source,
    status: "resolved",
    status_label: `Provider resolved ${outcome}`,
    source_market_id: market.source_id,
    source_market_slug: slugFromMarket(market),
    resolved_outcome: outcome,
    resolved_at: stringValue(body.endDate) ?? new Date().toISOString(),
    api_url: apiUrl,
    message: `Polymarket reports this market resolved ${outcome}.`,
  };
}

async function fetchProviderResolution(
  market: DueMarketRecord,
  fetcher: Fetcher,
  timeoutMs: number,
): Promise<ResolutionCatchupProviderCheck> {
  try {
    if (market.source === "manifold") {
      return fetchManifoldResolution(market, fetcher, timeoutMs);
    }
    if (market.source === "polymarket") {
      return fetchPolymarketResolution(market, fetcher, timeoutMs);
    }
    return {
      provider: market.source,
      status: "unsupported",
      status_label: "Provider unsupported",
      source_market_id: market.source_id,
      source_market_slug: slugFromMarket(market),
      resolved_outcome: null,
      resolved_at: null,
      api_url: null,
      message: `Provider ${market.source} is not supported for catch-up preview.`,
    };
  } catch (error) {
    return providerUnavailable(
      market,
      null,
      error instanceof Error
        ? `Provider check failed: ${error.message}`
        : "Provider check failed.",
    );
  }
}

function stakeForTrade(
  side: TradeSide,
  edge: number,
  entryPrice: number,
  controls: TradingControls,
): number {
  if (controls.stake_mode === "flat") return controls.flat_stake_usd;

  const denominator = side === "YES" ? 1 - entryPrice : entryPrice;
  const fullKelly = denominator > 0 ? Math.abs(edge) / denominator : 0;
  const rawStake =
    PAPER_TRADING_CONFIG.bankrollUsd *
    PAPER_TRADING_CONFIG.kellyFraction *
    fullKelly;
  return round2(
    Math.min(
      controls.max_stake_usd,
      Math.max(PAPER_TRADING_CONFIG.minStakeUsd, rawStake),
    ),
  );
}

function buildTradePreview(
  market: DueMarketRecord,
  prediction: LivePredictionRecord,
  provider: ResolutionCatchupProviderCheck,
  controls: TradingControls,
): ResolutionCatchupTradePreview | null {
  if (provider.status !== "resolved" || !provider.resolved_outcome) return null;
  if (!provider.resolved_at) return null;
  if (Date.parse(prediction.created_at) >= Date.parse(provider.resolved_at)) {
    return null;
  }
  if (controls.agent_id && prediction.agent_id !== controls.agent_id) {
    return null;
  }
  if (controls.category && market.category !== controls.category) return null;

  const probability = clampProbability(numberValue(prediction.probability));
  const marketPrice = validEntryPrice(
    numberValue(
      prediction.market_price_at_forecast,
      numberValue(market.outcome_yes_price, 0.5),
    ),
  );
  if (marketPrice === null) return null;

  const edge = probability - marketPrice;
  const absEdge = Math.abs(edge);
  if (!Number.isFinite(absEdge) || absEdge < controls.min_edge) return null;

  const side: TradeSide = edge >= 0 ? "YES" : "NO";
  if (controls.side && controls.side !== side) return null;

  const stakeUsd = stakeForTrade(side, edge, marketPrice, controls);
  const profitIfCorrectUsd =
    side === "YES"
      ? stakeUsd * ((1 - marketPrice) / marketPrice)
      : stakeUsd * (marketPrice / (1 - marketPrice));
  const won =
    side === "YES"
      ? provider.resolved_outcome === "YES"
      : provider.resolved_outcome === "NO";
  const projectedPnlUsd = won ? profitIfCorrectUsd : -stakeUsd;
  const agent = AGENTS.find((item) => item.id === prediction.agent_id);

  return {
    prediction_id: prediction.id,
    agent_id: prediction.agent_id,
    agent_name: agent?.name ?? prediction.agent_id,
    market_id: market.id,
    market_question: market.question,
    side,
    probability: round4(probability),
    market_price: round4(marketPrice),
    edge: round4(edge),
    abs_edge: round4(absEdge),
    stake_usd: stakeUsd,
    profit_if_correct_usd: round2(profitIfCorrectUsd),
    projected_pnl_usd: round2(projectedPnlUsd),
    resolved_outcome: provider.resolved_outcome,
    resolved_at: provider.resolved_at,
    created_at: prediction.created_at,
  };
}

function statusForPreview(args: {
  dueMarkets: number;
  providerResolvedMarkets: number;
  providerOpenMarkets: number;
}): Pick<
  ResolutionCatchupPreview,
  "status" | "status_label" | "message" | "next_required_action"
> {
  if (args.providerResolvedMarkets > 0) {
    return {
      status: "resolver_lag",
      status_label: "Resolver lag",
      message:
        "Provider-resolved live markets are still unscored inside Eivra.",
      next_required_action:
        "Run or restore the Eivra resolver, then publish a fresh paper snapshot.",
    };
  }
  if (args.dueMarkets > 0 || args.providerOpenMarkets > 0) {
    return {
      status: "provider_pending",
      status_label: "Provider pending",
      message:
        "Due live markets exist, but checked providers have not resolved them yet.",
      next_required_action: "Keep collecting and recheck provider resolution.",
    };
  }
  return {
    status: "clear",
    status_label: "Clear",
    message: "No due unscored live markets were found.",
    next_required_action: "Continue daily paper-only collection.",
  };
}

export async function buildResolutionCatchupPreview(
  options: {
    controls?: TradingControls;
    limit?: number;
    fetcher?: Fetcher;
    timeoutMs?: number;
  } = {},
): Promise<ResolutionCatchupPreview> {
  const controls = options.controls ?? DEFAULT_TRADING_CONTROLS;
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey =
    readEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) return unconfiguredPreview(controls, limit);

  const sb = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: dueMarkets, error: marketsError } = await sb
    .from("markets")
    .select(
      "id, source, source_id, question, category, url, status, closes_at, outcome_yes_price, raw",
    )
    .in("status", ["open", "pending_resolution"])
    .or("closes_at.lt.now(),closes_at.is.null")
    .limit(limit);

  if (marketsError) {
    return errorPreview(
      controls,
      limit,
      `Failed to load due markets: ${marketsError.message}`,
    );
  }

  const markets = ((dueMarkets ?? []) as DueMarketRecord[]).filter(
    (market) => market.id && market.source && market.source_id,
  );
  if (markets.length === 0) {
    const status = statusForPreview({
      dueMarkets: 0,
      providerResolvedMarkets: 0,
      providerOpenMarkets: 0,
    });
    return {
      ...unconfiguredPreview(controls, limit),
      ...status,
      generated_at: new Date().toISOString(),
    };
  }

  const marketIds = markets.map((market) => market.id);
  const { data: predictions, error: predictionsError } = await sb
    .from("predictions")
    .select(
      "id, agent_id, market_id, probability, market_price_at_forecast, created_at",
    )
    .eq("is_backfill", false)
    .eq("abstained", false)
    .in("market_id", marketIds);

  if (predictionsError) {
    return errorPreview(
      controls,
      limit,
      `Failed to load live predictions: ${predictionsError.message}`,
    );
  }

  const predictionRows = (predictions ?? []) as LivePredictionRecord[];
  const predictionIds = predictionRows.map((prediction) => prediction.id);
  const scoredPredictionIds = new Set<string>();
  if (predictionIds.length > 0) {
    const { data: scores, error: scoresError } = await sb
      .from("scores")
      .select("prediction_id")
      .in("prediction_id", predictionIds);
    if (scoresError) {
      return errorPreview(
        controls,
        limit,
        `Failed to load score coverage: ${scoresError.message}`,
      );
    }
    for (const score of (scores ?? []) as Array<{ prediction_id: string }>) {
      scoredPredictionIds.add(score.prediction_id);
    }
  }

  const unscoredPredictions = predictionRows.filter(
    (prediction) => !scoredPredictionIds.has(prediction.id),
  );
  const predictionsByMarket = new Map<string, LivePredictionRecord[]>();
  for (const prediction of unscoredPredictions) {
    const rows = predictionsByMarket.get(prediction.market_id) ?? [];
    rows.push(prediction);
    predictionsByMarket.set(prediction.market_id, rows);
  }

  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  const providerChecks = await Promise.all(
    markets.map((market) =>
      fetchProviderResolution(market, fetcher, timeoutMs),
    ),
  );
  const providerByMarket = new Map<string, ResolutionCatchupProviderCheck>();
  markets.forEach((market, index) => {
    providerByMarket.set(market.id, providerChecks[index]);
  });

  const tradePreviews: ResolutionCatchupTradePreview[] = [];
  const marketPreviews = markets.map((market) => {
    const provider = providerByMarket.get(market.id)!;
    const marketPredictions = predictionsByMarket.get(market.id) ?? [];
    const marketTrades = marketPredictions
      .map((prediction) =>
        buildTradePreview(market, prediction, provider, controls),
      )
      .filter((trade): trade is ResolutionCatchupTradePreview =>
        Boolean(trade),
      );
    tradePreviews.push(...marketTrades);
    return {
      market_id: market.id,
      market_question: market.question,
      market_source: market.source,
      market_url: market.url,
      market_status: market.status,
      market_closes_at: market.closes_at,
      unscored_prediction_count: marketPredictions.length,
      eligible_trade_count: marketTrades.length,
      projected_pnl_usd: round2(
        marketTrades.reduce((sum, trade) => sum + trade.projected_pnl_usd, 0),
      ),
      provider_resolution: provider,
    };
  });

  const providerResolvedMarketCount = marketPreviews.filter(
    (market) => market.provider_resolution.status === "resolved",
  ).length;
  const providerOpenMarketCount = marketPreviews.filter(
    (market) => market.provider_resolution.status === "open",
  ).length;
  const providerUnavailableMarketCount = marketPreviews.filter((market) =>
    ["unavailable", "unsupported", "ambiguous"].includes(
      market.provider_resolution.status,
    ),
  ).length;
  const status = statusForPreview({
    dueMarkets: markets.length,
    providerResolvedMarkets: providerResolvedMarketCount,
    providerOpenMarkets: providerOpenMarketCount,
  });
  const sortedTrades = tradePreviews
    .slice()
    .sort((a, b) => b.projected_pnl_usd - a.projected_pnl_usd);
  const projectedStakeUsd = tradePreviews.reduce(
    (sum, trade) => sum + trade.stake_usd,
    0,
  );
  const projectedPnlUsd = tradePreviews.reduce(
    (sum, trade) => sum + trade.projected_pnl_usd,
    0,
  );

  return {
    ...status,
    generated_at: new Date().toISOString(),
    paper_only: true,
    real_money_execution_allowed: false,
    controls,
    checked_market_limit: limit,
    due_market_count: markets.length,
    unscored_live_prediction_count: unscoredPredictions.length,
    provider_resolved_market_count: providerResolvedMarketCount,
    provider_open_market_count: providerOpenMarketCount,
    provider_unavailable_market_count: providerUnavailableMarketCount,
    eligible_trade_count: tradePreviews.length,
    projected_resolved_stake_usd: round2(projectedStakeUsd),
    projected_resolved_pnl_usd: round2(projectedPnlUsd),
    projected_win_count: tradePreviews.filter(
      (trade) => trade.projected_pnl_usd > 0,
    ).length,
    projected_loss_count: tradePreviews.filter(
      (trade) => trade.projected_pnl_usd < 0,
    ).length,
    markets: marketPreviews.sort(
      (a, b) =>
        b.eligible_trade_count - a.eligible_trade_count ||
        b.projected_pnl_usd - a.projected_pnl_usd ||
        a.market_question.localeCompare(b.market_question),
    ),
    top_projected_trades: sortedTrades.slice(0, 10),
  };
}
