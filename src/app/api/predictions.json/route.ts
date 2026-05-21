import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agents";
import { cleanReasoning } from "@/lib/format";
import { DEMO_PREDICTIONS, DEMO_MARKETS } from "@/lib/demo-data";

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

  let source: "live" | "demo" = "demo";

  type PredRow = {
    id: string;
    agent_id: string;
    market_id: string;
    probability: number;
    confidence: string;
    reasoning: string;
    abstained: boolean;
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

  let predRows: PredRow[] = [];
  let marketMap: Map<string, MarketRow> = new Map();

  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: preds, error: predErr } = await sb
        .from("predictions")
        .select(
          "id, agent_id, market_id, probability, confidence, reasoning, abstained, market_price_at_forecast, is_backfill, created_at"
        )
        .eq("abstained", false)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!predErr && preds && preds.length > 0) {
        predRows = (preds as Array<Record<string, unknown>>).map((p) => ({
          id: p.id as string,
          agent_id: p.agent_id as string,
          market_id: p.market_id as string,
          probability: Number(p.probability),
          confidence: (p.confidence as string) ?? "medium",
          reasoning: cleanReasoning((p.reasoning as string) ?? ""),
          abstained: Boolean(p.abstained),
          market_price_at_forecast: Number(p.market_price_at_forecast ?? 0.5),
          is_backfill: Boolean(p.is_backfill),
          created_at: p.created_at as string,
        }));

        const marketIds = [...new Set(predRows.map((p) => p.market_id))];
        const { data: markets } = await sb
          .from("markets")
          .select("id, source, question, category, url, status, resolved_outcome, resolved_at")
          .in("id", marketIds);

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
    const recent = DEMO_PREDICTIONS.filter((p) => !p.abstained)
      .slice(-limit)
      .reverse();
    predRows = recent.map((p) => ({
      id: `demo-${p.agent_id}-${p.market_id}`,
      agent_id: p.agent_id,
      market_id: p.market_id,
      probability: p.probability,
      confidence: p.confidence ?? "medium",
      reasoning: p.reasoning,
      abstained: Boolean(p.abstained),
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

  const predictions = predRows.map((p) => {
    const agent = agentById[p.agent_id];
    const market = marketMap.get(p.market_id);
    return {
      id: p.id,
      agent_id: p.agent_id,
      agent_name: agent?.name ?? p.agent_id,
      agent_model: agent?.model ?? "unknown",
      market_id: p.market_id,
      market_question: market?.question ?? "",
      market_source: market?.source ?? "unknown",
      market_category: market?.category ?? "other",
      market_url: market?.url ?? "",
      market_status: market?.status ?? "open",
      market_resolved_outcome: market?.resolved_outcome ?? null,
      market_resolved_at: market?.resolved_at ?? null,
      probability: p.probability,
      market_price_at_forecast: p.market_price_at_forecast,
      edge: Math.round((p.probability - p.market_price_at_forecast) * 1000) / 1000,
      confidence: p.confidence,
      reasoning: p.reasoning,
      is_backfill: p.is_backfill,
      created_at: p.created_at,
    };
  });

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      source,
      schema_version: "1",
      description:
        "Eivra agent predictions feed. `edge` = agent probability minus prevailing market price at forecast time (positive = agent thinks market underprices YES). Abstained predictions are excluded. Use ?limit=N (max 200) for a different window.",
      count: predictions.length,
      predictions,
    },
    {
      headers: {
        "cache-control": "public, s-maxage=30, stale-while-revalidate=120",
        "access-control-allow-origin": "*",
      },
    }
  );
}
