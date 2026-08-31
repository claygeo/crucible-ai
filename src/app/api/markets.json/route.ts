import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agents";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  const rawLimit = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(
    Math.max(1, rawLimit ? parseInt(rawLimit, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT),
    MAX_LIMIT
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      {
        generated_at: new Date().toISOString(),
        source: "unavailable",
        schema_version: "1",
        count: 0,
        markets: [],
      },
      { status: 503 }
    );
  }

  const sb = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pull live forecasts (is_backfill=false) joined to market metadata in one round-trip.
  // Filter to non-abstained predictions only.
  const { data, error } = await sb
    .from("predictions")
    .select(
      "agent_id, market_id, probability, market_price_at_forecast, created_at, markets!inner(id, question, source, category, closes_at, url, outcome_yes_price, status)"
    )
    .eq("is_backfill", false)
    .eq("abstained", false)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      {
        generated_at: new Date().toISOString(),
        source: "live",
        schema_version: "1",
        description: "No live forecasts; archived run — the pipeline is decommissioned.",
        count: 0,
        markets: [],
      },
      {
        headers: {
          "cache-control": "public, s-maxage=30, stale-while-revalidate=120",
          "access-control-allow-origin": "*",
        },
      }
    );
  }

  type PredRow = {
    agent_id: string;
    probability: number;
    market_price_at_forecast: number;
    created_at: string;
    markets: {
      id: string;
      question: string;
      source: string;
      category: string | null;
      closes_at: string;
      url: string | null;
      outcome_yes_price: number;
      status: string;
    };
  };

  // Group predictions by market. Keep only open markets.
  const byMarket = new Map<
    string,
    {
      market: PredRow["markets"];
      preds: Array<{ agent_id: string; probability: number; created_at: string }>;
    }
  >();

  for (const row of data as unknown as PredRow[]) {
    const mkt = row.markets;
    if (!mkt || mkt.status !== "open") continue;
    const existing = byMarket.get(mkt.id);
    const pred = {
      agent_id: row.agent_id,
      probability: Number(row.probability),
      created_at: row.created_at,
    };
    if (existing) {
      existing.preds.push(pred);
    } else {
      byMarket.set(mkt.id, { market: mkt, preds: [pred] });
    }
  }

  // Build output rows with derived stats.
  const markets = Array.from(byMarket.values())
    .map(({ market, preds }) => {
      // Exclude synthetic ensemble from consensus + spread (it's a mean of the others).
      const indPreds = preds.filter((p) => p.agent_id !== "ensemble");
      const probs = indPreds.map((p) => p.probability);
      const marketPrice = Math.round(Number(market.outcome_yes_price) * 1000) / 1000;
      const consensus =
        probs.length > 0
          ? Math.round((probs.reduce((a, b) => a + b, 0) / probs.length) * 1000) / 1000
          : null;
      const spread =
        probs.length >= 2
          ? Math.round((Math.max(...probs) - Math.min(...probs)) * 1000) / 1000
          : 0;
      const delta =
        consensus !== null
          ? Math.round((consensus - marketPrice) * 1000) / 1000
          : null;
      const absDelta = delta !== null ? Math.abs(delta) : 0;
      const lockedAt = preds.reduce(
        (earliest, p) => (p.created_at < earliest ? p.created_at : earliest),
        preds[0].created_at
      );

      return {
        market_id: market.id,
        question: market.question,
        source: market.source,
        category: market.category ?? "other",
        closes_at: market.closes_at,
        url: market.url,
        market_price: marketPrice,
        agent_consensus: consensus,
        delta,
        _abs_delta: absDelta,
        spread,
        agent_count: indPreds.length,
        forecasts: indPreds
          .map((p) => {
            const agent = AGENTS.find((a) => a.id === p.agent_id);
            return {
              agent_id: p.agent_id,
              agent_name: agent?.name ?? p.agent_id,
              probability: Math.round(p.probability * 1000) / 1000,
              delta_from_market:
                Math.round((p.probability - marketPrice) * 1000) / 1000,
            };
          })
          .sort((a, b) => b.probability - a.probability),
        locked_at: lockedAt,
      };
    })
    // Biggest AI-vs-market disagreements first.
    .sort((a, b) => b._abs_delta - a._abs_delta)
    .slice(0, limit)
    // Strip internal sort key before serializing.
    .map(({ _abs_delta: _, ...rest }) => rest);

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      source: "live",
      schema_version: "1",
      description:
        "Markets open at archive time with Eivra agent consensus forecasts vs last-known market price. " +
        "`delta` = agent_consensus − market_price (positive = agents collectively think YES is underpriced; negative = agents think YES is overpriced). " +
        "Sorted by abs(delta) — biggest AI-vs-market disagreements first. " +
        "`spread` = max − min individual agent probability (synthetic ensemble excluded). " +
        "Forecasts are locked at submission and never updated on the same market. " +
        "Use ?limit=N (max 200).",
      count: markets.length,
      markets,
    },
    {
      headers: {
        "cache-control": "public, s-maxage=30, stale-while-revalidate=120",
        "access-control-allow-origin": "*",
      },
    }
  );
}
