/**
 * Data adapter: prefer live Supabase, fall back to demo data.
 *
 * Server-only. Use from server components or API routes. Each function:
 *   1. Tries Supabase via service-role client (or anon for read-only)
 *   2. If query fails OR returns no rows, falls back to deterministic demo
 *   3. Always returns the same shape regardless of source
 *
 * The site stays alive even if Supabase goes down or returns empty.
 */

import { createClient } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agents";
import { cleanReasoning } from "@/lib/format";
import {
  DEMO_AGENT_STATS,
  DEMO_EUREKA_CARDS,
  DEMO_MARKETS,
  DEMO_PREDICTIONS,
  DEMO_SCORES,
  type DemoAgentStats,
  type DemoEurekaCard,
  type DemoMarket,
  type DemoPrediction,
  type DemoScore,
} from "@/lib/demo-data";

// ────────────────────────────────────────────────────────────────────────────
// Supabase client — server-only, anon key (public-read RLS is enabled)
// ────────────────────────────────────────────────────────────────────────────

let _client: ReturnType<typeof createClient> | null = null;
function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function sb() {
  if (_client) return _client;
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  // Prefer service role on server (bypasses RLS, faster); fall back to anon.
  const key =
    readEnv("SUPABASE_SERVICE_ROLE_KEY") ?? readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  try {
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    _client = null;
  }
  return _client;
}

const FORCE_DEMO =
  (process.env.NEXT_PUBLIC_USE_DEMO_DATA ?? "false").toLowerCase() === "true";

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export type Source = "live" | "demo";

export type LiveMarket = DemoMarket;
export type LiveAgentStats = DemoAgentStats;
export type LiveEurekaCard = DemoEurekaCard;
export type LivePrediction = DemoPrediction & { id?: string };
export type LiveScore = DemoScore;

export async function getAgentStats(): Promise<{
  source: Source;
  rows: LiveAgentStats[];
}> {
  if (FORCE_DEMO) return { source: "demo", rows: DEMO_AGENT_STATS };
  const client = sb();
  if (!client) return { source: "demo", rows: DEMO_AGENT_STATS };
  try {
    const { data, error } = await client
      .from("agent_stats")
      .select("*")
      .order("rank", { ascending: true });
    if (error || !data) throw error;
    if (data.length === 0)
      return { source: "demo", rows: DEMO_AGENT_STATS };
    // Some scored agents (>0 predictions) means we have real data
    const realData = (data as Array<Record<string, unknown>>).filter(
      (s) => Number(s.total_scored) > 0
    );
    if (realData.length === 0)
      return { source: "demo", rows: DEMO_AGENT_STATS };
    const rows: LiveAgentStats[] = realData.map((s) => ({
      agent_id: s.agent_id as string,
      brier_30d: Number(s.brier_30d ?? 0),
      log_loss_30d: Number(s.log_loss_30d ?? 0),
      total_predictions: Number(s.total_predictions ?? 0),
      total_scored: Number(s.total_scored ?? 0),
      win_rate_30d: Number(s.win_rate_30d ?? 0),
      paper_pnl_30d: Number(s.paper_pnl_30d ?? 0),
      eivra_score: Number(s.eivra_score ?? 0),
      rank: Number(s.rank ?? 99),
      rank_delta_24h: Number(s.rank_delta_24h ?? 0),
      calibration: (s.calibration as LiveAgentStats["calibration"]) ?? [],
    }));
    return { source: "live", rows };
  } catch {
    return { source: "demo", rows: DEMO_AGENT_STATS };
  }
}

export type AlltimeStat = {
  agent_id: string;
  brier_alltime: number;
  log_loss_alltime: number;
  paper_pnl_alltime: number;
  total_scored: number;
};

function demoAlltimeRows(): AlltimeStat[] {
  return DEMO_AGENT_STATS.map((s) => ({
    agent_id: s.agent_id,
    brier_alltime: s.brier_30d,
    log_loss_alltime: s.log_loss_30d,
    paper_pnl_alltime: s.paper_pnl_30d,
    total_scored: s.total_scored,
  }));
}

export async function getAgentAlltimeStats(): Promise<{
  source: Source;
  rows: AlltimeStat[];
}> {
  if (FORCE_DEMO) return { source: "demo", rows: demoAlltimeRows() };
  const client = sb();
  if (!client) return { source: "demo", rows: demoAlltimeRows() };
  try {
    const { data, error } = await client
      .from("agent_stats")
      .select("agent_id, brier_alltime, log_loss_alltime, paper_pnl_alltime, total_scored, rank")
      .order("brier_alltime", { ascending: true });
    if (error || !data || data.length === 0) throw new Error("no data");
    const rows = (data as Array<Record<string, unknown>>)
      .filter((s) => Number(s.total_scored) > 0)
      .map((s) => ({
        agent_id: s.agent_id as string,
        brier_alltime: Number(s.brier_alltime ?? 0),
        log_loss_alltime: Number(s.log_loss_alltime ?? 0),
        paper_pnl_alltime: Number(s.paper_pnl_alltime ?? 0),
        total_scored: Number(s.total_scored ?? 0),
      }));
    if (rows.length === 0) throw new Error("no data");
    return { source: "live", rows };
  } catch {
    return { source: "demo", rows: demoAlltimeRows() };
  }
}

export async function getMarkets(opts: {
  status?: "open" | "resolved";
  limit?: number;
} = {}): Promise<{ source: Source; rows: LiveMarket[] }> {
  if (FORCE_DEMO) return { source: "demo", rows: filterDemo(DEMO_MARKETS, opts) };
  const client = sb();
  if (!client) return { source: "demo", rows: filterDemo(DEMO_MARKETS, opts) };
  try {
    let q = client.from("markets").select("*");
    if (opts.status) q = q.eq("status", opts.status);
    q = q
      .order("resolved_at", { ascending: false, nullsFirst: false })
      .limit(opts.limit ?? 200);
    const { data, error } = await q;
    if (error || !data) throw error;
    if (data.length === 0)
      return { source: "demo", rows: filterDemo(DEMO_MARKETS, opts) };
    return { source: "live", rows: rowsToMarkets(data as Array<Record<string, unknown>>) };
  } catch {
    return { source: "demo", rows: filterDemo(DEMO_MARKETS, opts) };
  }
}

export async function getOpenMarketForecastCounts(): Promise<Record<string, number>> {
  if (FORCE_DEMO) return {};
  const client = sb();
  if (!client) return {};
  try {
    const { data, error } = await client
      .from("predictions")
      .select("market_id")
      .eq("is_backfill", false)
      .eq("abstained", false);
    if (error || !data) return {};
    const counts: Record<string, number> = {};
    for (const row of data as Array<{ market_id: string }>) {
      counts[row.market_id] = (counts[row.market_id] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

export async function getMarketById(
  id: string
): Promise<{ source: Source; market: LiveMarket | null }> {
  // Demo markets use ids like "m-001"; live use uuids.
  if (id.startsWith("m-")) {
    const market = DEMO_MARKETS.find((m) => m.id === id) ?? null;
    return { source: "demo", market };
  }
  const client = sb();
  if (!client) return { source: "live", market: null };
  try {
    const { data } = await client.from("markets").select("*").eq("id", id).maybeSingle();
    if (!data) return { source: "live", market: null };
    return {
      source: "live",
      market: rowsToMarkets([data as Record<string, unknown>])[0] ?? null,
    };
  } catch {
    return { source: "live", market: null };
  }
}

export async function getPredictionsForMarket(
  marketDbId: string
): Promise<{ source: Source; rows: LivePrediction[] }> {
  if (marketDbId.startsWith("m-")) {
    return {
      source: "demo",
      rows: DEMO_PREDICTIONS.filter((p) => p.market_id === marketDbId),
    };
  }
  const client = sb();
  if (!client) return { source: "live", rows: [] };
  try {
    const { data } = await client
      .from("predictions")
      .select("*")
      .eq("market_id", marketDbId)
      .order("created_at", { ascending: true });
    if (!data) return { source: "live", rows: [] };
    return {
      source: "live",
      rows: (data as Array<Record<string, unknown>>).map((p) => ({
        id: p.id as string,
        agent_id: p.agent_id as string,
        market_id: p.market_id as string,
        probability: Number(p.probability),
        confidence: (p.confidence as LivePrediction["confidence"]) ?? "medium",
        reasoning: cleanReasoning((p.reasoning as string) ?? ""),
        market_price_at_forecast: Number(p.market_price_at_forecast ?? 0.5),
        created_at: p.created_at as string,
        abstained: Boolean(p.abstained),
        is_backfill: p.is_backfill === false ? false : true,
      })),
    };
  } catch {
    return { source: "live", rows: [] };
  }
}

export async function getRecentPredictions(
  limit = 30
): Promise<{ source: Source; rows: LivePrediction[] }> {
  if (FORCE_DEMO) {
    return {
      source: "demo",
      rows: DEMO_PREDICTIONS.slice(-limit).reverse(),
    };
  }
  const client = sb();
  if (!client)
    return { source: "demo", rows: DEMO_PREDICTIONS.slice(-limit).reverse() };
  try {
    const { data } = await client
      .from("predictions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!data || data.length === 0)
      return { source: "demo", rows: DEMO_PREDICTIONS.slice(-limit).reverse() };
    return {
      source: "live",
      rows: (data as Array<Record<string, unknown>>).map((p) => ({
        id: p.id as string,
        agent_id: p.agent_id as string,
        market_id: p.market_id as string,
        probability: Number(p.probability),
        confidence: (p.confidence as LivePrediction["confidence"]) ?? "medium",
        reasoning: cleanReasoning((p.reasoning as string) ?? ""),
        market_price_at_forecast: Number(p.market_price_at_forecast ?? 0.5),
        created_at: p.created_at as string,
        abstained: Boolean(p.abstained),
      })),
    };
  } catch {
    return { source: "demo", rows: DEMO_PREDICTIONS.slice(-limit).reverse() };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Live forecasts — receipts for the /live page.
// Returns predictions where is_backfill=false, joined to their market info,
// grouped by market. Each market shows all agents' locked forecasts side by
// side, with the lock timestamp + market status (open / pending / resolved).
// ────────────────────────────────────────────────────────────────────────────

export type LiveForecastRow = {
  market: {
    id: string;
    question: string;
    source: string;
    category: string;
    status: "open" | "pending_resolution" | "resolved";
    closes_at: string;
    resolved_at: string | null;
    resolved_outcome: boolean | null;
    outcome_yes_price: number;
    url: string | null;
  };
  agentPreds: Array<{
    agent_id: string;
    probability: number;
    market_price_at_forecast: number;
    reasoning: string;
    created_at: string;
  }>;
  spread: number;
  earliestLock: string;
};

export async function getLiveForecasts(
  limit = 50
): Promise<{ source: Source; rows: LiveForecastRow[] }> {
  const client = sb();
  if (!client || FORCE_DEMO) return { source: "demo", rows: [] };
  try {
    // Pull live predictions (newest first) with market info eager-joined.
    // PostgREST nested select keeps this a single round-trip.
    const { data } = await client
      .from("predictions")
      .select(
        "id, agent_id, market_id, probability, reasoning, market_price_at_forecast, created_at, markets!inner(id, question, source, category, status, closes_at, resolved_at, resolved_outcome, outcome_yes_price, url)"
      )
      .eq("is_backfill", false)
      .eq("abstained", false)
      .order("created_at", { ascending: false })
      .limit(limit * 6); // 6 agents per market, so request the per-market limit's worth
    if (!data || data.length === 0) return { source: "live", rows: [] };

    type Row = {
      agent_id: string;
      market_id: string;
      probability: number;
      reasoning: string;
      market_price_at_forecast: number;
      created_at: string;
      markets: {
        id: string;
        question: string;
        source: string;
        category: string;
        status: "open" | "pending_resolution" | "resolved";
        closes_at: string;
        resolved_at: string | null;
        resolved_outcome: boolean | null;
        outcome_yes_price: number;
        url: string | null;
      };
    };

    const byMarket = new Map<string, LiveForecastRow>();
    for (const row of data as unknown as Row[]) {
      const mkt = row.markets;
      if (!mkt) continue;
      const existing = byMarket.get(mkt.id);
      const pred = {
        agent_id: row.agent_id,
        probability: Number(row.probability),
        market_price_at_forecast: Number(row.market_price_at_forecast ?? 0.5),
        // Strip JSON/code-fence blobs from reasoning before sending to UI
        reasoning: cleanReasoning((row.reasoning ?? "").toString()).slice(0, 600),
        created_at: row.created_at,
      };
      if (existing) {
        existing.agentPreds.push(pred);
        if (row.created_at < existing.earliestLock) {
          existing.earliestLock = row.created_at;
        }
      } else {
        byMarket.set(mkt.id, {
          market: {
            id: mkt.id,
            question: mkt.question,
            source: mkt.source,
            category: mkt.category ?? "other",
            status: mkt.status,
            closes_at: mkt.closes_at,
            resolved_at: mkt.resolved_at,
            resolved_outcome: mkt.resolved_outcome,
            outcome_yes_price: Number(mkt.outcome_yes_price ?? 0.5),
            url: mkt.url,
          },
          agentPreds: [pred],
          spread: 0,
          earliestLock: row.created_at,
        });
      }
    }

    // Compute spread per market (exclude synthetic ensemble — it's a mean of
    // the others, so including it compresses spread artificially).
    for (const row of byMarket.values()) {
      const indPreds = row.agentPreds.filter((p) => p.agent_id !== "ensemble");
      if (indPreds.length === 0) continue;
      const probs = indPreds.map((p) => p.probability);
      row.spread = Math.max(...probs) - Math.min(...probs);
      // Sort agent preds: highest probability first (long-YES at top)
      row.agentPreds.sort((a, b) => b.probability - a.probability);
    }

    const rows = Array.from(byMarket.values()).sort(
      (a, b) => Date.parse(b.earliestLock) - Date.parse(a.earliestLock)
    );
    return { source: "live", rows: rows.slice(0, limit) };
  } catch {
    return { source: "demo", rows: [] };
  }
}

export async function getScoresForAgent(
  agentId: string,
  limit = 50
): Promise<{ source: Source; rows: LiveScore[] }> {
  if (FORCE_DEMO) {
    return {
      source: "demo",
      rows: DEMO_SCORES.filter((s) => s.agent_id === agentId).slice(-limit),
    };
  }
  const client = sb();
  if (!client)
    return {
      source: "demo",
      rows: DEMO_SCORES.filter((s) => s.agent_id === agentId).slice(-limit),
    };
  try {
    const { data } = await client
      .from("scores")
      .select("*")
      .eq("agent_id", agentId)
      .order("scored_at", { ascending: false })
      .limit(limit);
    if (!data || data.length === 0)
      return {
        source: "demo",
        rows: DEMO_SCORES.filter((s) => s.agent_id === agentId).slice(-limit),
      };
    return {
      source: "live",
      rows: (data as Array<Record<string, unknown>>).map((s) => ({
        prediction_id: s.prediction_id as string,
        agent_id: s.agent_id as string,
        market_id: s.market_id as string,
        brier: Number(s.brier),
        log_loss: Number(s.log_loss),
        paper_pnl: Number(s.paper_pnl ?? 0),
        was_correct: Boolean(s.was_correct),
      })),
    };
  } catch {
    return {
      source: "demo",
      rows: DEMO_SCORES.filter((s) => s.agent_id === agentId).slice(-limit),
    };
  }
}

export async function getEurekaCards(
  limit = 3
): Promise<{ source: Source; rows: LiveEurekaCard[] }> {
  if (FORCE_DEMO) return { source: "demo", rows: DEMO_EUREKA_CARDS.slice(0, limit) };
  const client = sb();
  if (!client)
    return { source: "demo", rows: DEMO_EUREKA_CARDS.slice(0, limit) };
  try {
    const { data } = await client
      .from("eureka_cards")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .limit(limit);
    if (!data || data.length === 0)
      return { source: "demo", rows: DEMO_EUREKA_CARDS.slice(0, limit) };
    return {
      source: "live",
      rows: (data as Array<Record<string, unknown>>).map((e) => {
        const arch = (e.evidence as Record<string, unknown> | null)?.archetype as string | undefined;
        const tag: DemoEurekaCard["tag"] =
          arch === "calibration_surprise" ? "calibration"
          : arch === "conviction_gap" || arch === "mispricing_hunter" ? "contrarian"
          : undefined;
        return {
          id: e.id as string,
          headline: e.headline as string,
          body: e.body as string,
          generated_at: e.generated_at as string,
          tag,
        };
      }),
    };
  } catch {
    return { source: "demo", rows: DEMO_EUREKA_CARDS.slice(0, limit) };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function filterDemo(
  arr: DemoMarket[],
  opts: { status?: "open" | "resolved"; limit?: number }
): DemoMarket[] {
  let out = arr;
  if (opts.status) out = out.filter((m) => m.status === opts.status);
  if (opts.limit) out = out.slice(0, opts.limit);
  return out;
}

function rowsToMarkets(rows: Array<Record<string, unknown>>): LiveMarket[] {
  return rows.map((m) => ({
    id: m.id as string,
    source: m.source as LiveMarket["source"],
    source_id: m.source_id as string,
    question: m.question as string,
    category: (m.category as LiveMarket["category"]) ?? "other",
    closes_at: (m.closes_at as string) ?? new Date().toISOString(),
    resolved_at: (m.resolved_at as string) ?? undefined,
    resolved_outcome:
      m.resolved_outcome === null || m.resolved_outcome === undefined
        ? undefined
        : Boolean(m.resolved_outcome),
    outcome_yes_price: Number(m.outcome_yes_price ?? 0.5),
    status: (m.status as LiveMarket["status"]) ?? "open",
    url: (m.url as string) ?? "#",
  }));
}

/** Aggregate stats for the homepage hero counter. */
export async function getCounters(): Promise<{
  source: Source;
  watching: number;
  totalPredictions: number;
  resolved: number;
  liveInFlight: number; // live predictions on markets still open
}> {
  const client = sb();
  if (!client || FORCE_DEMO) {
    return {
      source: "demo",
      watching: DEMO_MARKETS.filter((m) => m.status === "open").length,
      totalPredictions: DEMO_PREDICTIONS.length,
      resolved: DEMO_MARKETS.filter((m) => m.status === "resolved").length,
      liveInFlight: 0,
    };
  }
  try {
    const [openRes, resRes, predRes, liveRes] = await Promise.all([
      client.from("markets").select("id", { count: "exact", head: true }).eq("status", "open"),
      client.from("markets").select("id", { count: "exact", head: true }).eq("status", "resolved"),
      client.from("predictions").select("id", { count: "exact", head: true }),
      // is_backfill=false = locked forecasts on markets that hadn't resolved
      // when the agent made the call. The headline "live in flight" stat.
      client
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("is_backfill", false),
    ]);
    const watching = openRes.count ?? 0;
    const resolved = resRes.count ?? 0;
    const totalPredictions = predRes.count ?? 0;
    const liveInFlight = liveRes.count ?? 0;
    if (totalPredictions === 0) {
      return {
        source: "demo",
        watching: DEMO_MARKETS.filter((m) => m.status === "open").length,
        totalPredictions: DEMO_PREDICTIONS.length,
        resolved: DEMO_MARKETS.filter((m) => m.status === "resolved").length,
        liveInFlight: 0,
      };
    }
    return { source: "live", watching, totalPredictions, resolved, liveInFlight };
  } catch {
    return {
      source: "demo",
      watching: DEMO_MARKETS.filter((m) => m.status === "open").length,
      totalPredictions: DEMO_PREDICTIONS.length,
      resolved: DEMO_MARKETS.filter((m) => m.status === "resolved").length,
      liveInFlight: 0,
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Disagreements — resolved markets sorted by max spread across agent preds.
// Powers the /benchmark "Top disagreements" panel and the homepage drama feed.
// ────────────────────────────────────────────────────────────────────────────

export type DisagreementRow = {
  market: {
    id: string;
    question: string;
    resolved_outcome: "YES" | "NO" | null;
  };
  spread: number;
  agentPreds: Array<{
    agent_id: string;
    probability: number;
    reasoning: string;
  }>;
};

export async function getDisagreements(
  limit = 5
): Promise<{ source: Source; rows: DisagreementRow[] }> {
  const client = sb();
  if (!client || FORCE_DEMO) return { source: "demo", rows: [] };
  try {
    // Pull recent resolved markets, then join predictions client-side. Faster
    // than a SQL join via PostgREST and trivially cacheable by ISR.
    const { data: markets } = await client
      .from("markets")
      .select("id, question, resolved_outcome")
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .limit(60); // window of recent resolutions to scan for high spread
    if (!markets || markets.length === 0) return { source: "live", rows: [] };

    const marketIds = (markets as Array<{ id: string }>).map((m) => m.id);
    const { data: preds } = await client
      .from("predictions")
      .select("agent_id, market_id, probability, reasoning, abstained")
      .in("market_id", marketIds)
      .eq("abstained", false);
    if (!preds) return { source: "live", rows: [] };

    const byMarket = new Map<
      string,
      Array<{ agent_id: string; probability: number; reasoning: string }>
    >();
    for (const p of preds as Array<{
      agent_id: string;
      market_id: string;
      probability: number;
      reasoning: string;
    }>) {
      // Skip synthetic ensemble (it's a mean of the others — counting it
      // would compress spread artificially).
      if (p.agent_id === "ensemble") continue;
      const arr = byMarket.get(p.market_id) ?? [];
      arr.push({
        agent_id: p.agent_id,
        probability: Number(p.probability),
        reasoning: cleanReasoning((p.reasoning ?? "").toString()),
      });
      byMarket.set(p.market_id, arr);
    }

    const rows: DisagreementRow[] = [];
    for (const m of markets as Array<{
      id: string;
      question: string;
      resolved_outcome: boolean | null;
    }>) {
      const ps = byMarket.get(m.id) ?? [];
      if (ps.length < 2) continue; // need at least 2 agents to compute spread
      const probs = ps.map((p) => p.probability);
      const spread = Math.max(...probs) - Math.min(...probs);
      rows.push({
        market: {
          id: m.id,
          question: m.question,
          resolved_outcome:
            m.resolved_outcome === null ? null : m.resolved_outcome ? "YES" : "NO",
        },
        spread,
        agentPreds: ps.sort((a, b) => b.probability - a.probability),
      });
    }

    rows.sort((a, b) => b.spread - a.spread);
    return { source: "live", rows: rows.slice(0, limit) };
  } catch {
    return { source: "demo", rows: [] };
  }
}
