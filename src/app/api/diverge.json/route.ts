import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agents";
import { DEMO_PREDICTIONS, DEMO_MARKETS } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

type PredRow = {
  market_id: string;
  agent_id: string;
  probability: number;
  market_price_at_forecast: number;
  is_backfill: boolean;
  created_at: string;
};

type MarketRow = {
  id: string;
  source: string;
  question: string;
  category: string;
  url: string;
  status: string;
  resolved_outcome: boolean | null;
  resolved_at: string | null;
};

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const rawLimit = params.get("limit");
  const scope = params.get("scope") ?? "all";

  const limit = Math.min(
    Math.max(1, rawLimit ? parseInt(rawLimit, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT),
    MAX_LIMIT
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let predRows: PredRow[] = [];
  let marketMap = new Map<string, MarketRow>();
  let source: "live" | "demo" = "demo";

  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      let query = sb
        .from("predictions")
        .select(
          "market_id, agent_id, probability, market_price_at_forecast, is_backfill, created_at"
        )
        .eq("abstained", false);

      if (scope === "live") query = query.eq("is_backfill", false);
      else if (scope === "backfill") query = query.eq("is_backfill", true);

      const { data: preds, error } = await query;

      if (!error && preds && preds.length > 0) {
        predRows = (preds as Array<Record<string, unknown>>).map((p) => ({
          market_id: p.market_id as string,
          agent_id: p.agent_id as string,
          probability: Number(p.probability),
          market_price_at_forecast: Number(p.market_price_at_forecast ?? 0.5),
          is_backfill: Boolean(p.is_backfill),
          created_at: p.created_at as string,
        }));

        // Compute spread per market, pick top N market IDs
        const topMarketIds = getTopMarketIds(predRows, limit);

        const { data: markets } = await sb
          .from("markets")
          .select(
            "id, source, question, category, url, status, resolved_outcome, resolved_at"
          )
          .in("id", topMarketIds);

        for (const m of (markets ?? []) as Array<Record<string, unknown>>) {
          marketMap.set(m.id as string, {
            id: m.id as string,
            source: (m.source as string) ?? "unknown",
            question: (m.question as string) ?? "",
            category: (m.category as string) ?? "other",
            url: (m.url as string) ?? "",
            status: (m.status as string) ?? "open",
            resolved_outcome:
              m.resolved_outcome == null ? null : Boolean(m.resolved_outcome),
            resolved_at: (m.resolved_at as string) ?? null,
          });
        }

        source = "live";
      }
    } catch {
      // fall through to demo
    }
  }

  if (source === "demo") {
    predRows = DEMO_PREDICTIONS.filter((p) => !p.abstained).map((p) => ({
      market_id: p.market_id,
      agent_id: p.agent_id,
      probability: p.probability,
      market_price_at_forecast: p.market_price_at_forecast,
      is_backfill: true,
      created_at: p.created_at,
    }));
    for (const m of DEMO_MARKETS) {
      marketMap.set(m.id, {
        id: m.id,
        source: m.source,
        question: m.question,
        category: m.category ?? "other",
        url: m.url ?? "",
        status: m.status,
        resolved_outcome: m.resolved_outcome ?? null,
        resolved_at: m.resolved_at ?? null,
      });
    }
  }

  const agentById = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

  // Group predictions by market
  const byMarket = new Map<string, PredRow[]>();
  for (const p of predRows) {
    const list = byMarket.get(p.market_id) ?? [];
    list.push(p);
    byMarket.set(p.market_id, list);
  }

  // Compute spread and sort
  const ranked = Array.from(byMarket.entries())
    .filter(([, preds]) => preds.length >= 2)
    .map(([market_id, preds]) => {
      const probs = preds.map((p) => p.probability);
      const spread = Math.max(...probs) - Math.min(...probs);
      const earliest = preds.reduce((a, b) =>
        a.created_at < b.created_at ? a : b
      );
      return { market_id, spread, preds, earliest_lock: earliest.created_at };
    })
    .sort((a, b) => b.spread - a.spread)
    .slice(0, limit);

  const markets = ranked.map(({ market_id, spread, preds, earliest_lock }) => {
    const market = marketMap.get(market_id);
    const forecasts = preds
      .map((p) => {
        const agent = agentById[p.agent_id];
        return {
          agent_id: p.agent_id,
          agent_name: agent?.name ?? p.agent_id,
          agent_model: agent?.model ?? "unknown",
          probability: p.probability,
          market_price_at_forecast: p.market_price_at_forecast,
          edge: Math.round((p.probability - p.market_price_at_forecast) * 1000) / 1000,
          is_backfill: p.is_backfill,
          locked_at: p.created_at,
        };
      })
      .sort((a, b) => b.probability - a.probability);

    return {
      market_id,
      market_question: market?.question ?? "",
      market_source: market?.source ?? "unknown",
      market_category: market?.category ?? "other",
      market_url: market?.url ?? "",
      market_status: market?.status ?? "open",
      market_resolved_outcome: market?.resolved_outcome ?? null,
      market_resolved_at: market?.resolved_at ?? null,
      spread: Math.round(spread * 1000) / 1000,
      agent_count: preds.length,
      earliest_lock,
      forecasts,
    };
  });

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      source,
      schema_version: "1",
      description:
        "Markets ranked by inter-agent probability spread (max minus min across all non-abstaining agents). High spread = high disagreement. Use ?scope=live for live-mode forecasts only, ?scope=backfill for historical, ?scope=all (default) for both. Use ?limit=N (max 50).",
      scope,
      limit,
      count: markets.length,
      markets,
    },
    {
      headers: {
        "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
        "access-control-allow-origin": "*",
      },
    }
  );
}

function getTopMarketIds(preds: PredRow[], limit: number): string[] {
  const byMarket = new Map<string, number[]>();
  for (const p of preds) {
    const list = byMarket.get(p.market_id) ?? [];
    list.push(p.probability);
    byMarket.set(p.market_id, list);
  }
  return Array.from(byMarket.entries())
    .filter(([, probs]) => probs.length >= 2)
    .map(([market_id, probs]) => ({
      market_id,
      spread: Math.max(...probs) - Math.min(...probs),
    }))
    .sort((a, b) => b.spread - a.spread)
    .slice(0, limit)
    .map(({ market_id }) => market_id);
}
