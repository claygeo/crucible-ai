import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agents";
import { DEMO_AGENT_STATS } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let statsRows: Array<Record<string, unknown>> = [];
  let eloRows: Array<Record<string, unknown>> = [];
  let source: "live" | "demo" = "demo";

  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const [statsRes, eloRes] = await Promise.all([
        sb
          .from("agent_stats")
          .select(
            "agent_id, rank, brier_30d, log_loss_30d, win_rate_30d, paper_pnl_30d, eivra_score, total_predictions, total_scored, updated_at"
          )
          .order("rank", { ascending: true }),
        sb
          .from("agent_elo")
          .select("agent_id, rating, games_played, wins, losses, draws"),
      ]);
      if (!statsRes.error && statsRes.data && statsRes.data.length > 0) {
        const withScores = (
          statsRes.data as Array<Record<string, unknown>>
        ).filter((s) => Number(s.total_scored) > 0);
        if (withScores.length > 0) {
          statsRows = withScores;
          eloRows = (eloRes.data ?? []) as Array<Record<string, unknown>>;
          source = "live";
        }
      }
    } catch {
      // fall through to demo data
    }
  }

  if (source === "demo") {
    statsRows = DEMO_AGENT_STATS as unknown as Array<Record<string, unknown>>;
  }

  const statsByAgent = Object.fromEntries(
    statsRows.map((s) => [s.agent_id as string, s])
  );
  const eloByAgent = Object.fromEntries(
    eloRows.map((e) => [e.agent_id as string, e])
  );

  const agents = AGENTS.map((agent) => {
    const s = statsByAgent[agent.id];
    const elo = eloByAgent[agent.id];
    return {
      id: agent.id,
      name: agent.name,
      persona: agent.persona,
      edge: agent.edge,
      model: agent.model,
      hue: agent.hue,
      synthetic: agent.synthetic,
      daily_budget_usd: agent.dailyBudgetUsd,
      stats: s
        ? {
            rank: Number(s.rank ?? 99),
            eivra_score: Number(s.eivra_score ?? 0),
            brier_30d: Number(s.brier_30d ?? 0),
            log_loss_30d: Number(s.log_loss_30d ?? 0),
            win_rate_30d: Number(s.win_rate_30d ?? 0),
            paper_pnl_30d: Number(s.paper_pnl_30d ?? 0),
            total_predictions: Number(s.total_predictions ?? 0),
            total_scored: Number(s.total_scored ?? 0),
            stats_updated_at: (s.updated_at as string) ?? null,
          }
        : null,
      elo: elo
        ? {
            rating: Number(elo.rating ?? 1500),
            games_played: Number(elo.games_played ?? 0),
            wins: Number(elo.wins ?? 0),
            losses: Number(elo.losses ?? 0),
            draws: Number(elo.draws ?? 0),
          }
        : null,
    };
  });

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      source,
      schema_version: "1",
      description:
        "Eivra agent profiles with archived performance stats from the May–Jun 2026 run. Six agents competed on the same prediction-market questions; each had a distinct model and reasoning strategy. Stats are 30-day rolling averages over resolved markets. ELO uses pairwise head-to-head scoring.",
      count: agents.length,
      agents,
    },
    {
      headers: {
        "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
        "access-control-allow-origin": "*",
      },
    }
  );
}
