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
        sb.from("agent_stats").select("*").order("rank", { ascending: true }),
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

  const eloByAgent = Object.fromEntries(
    eloRows.map((e) => [e.agent_id as string, e])
  );

  const leaderboard = statsRows.map((s) => {
    const agent = AGENTS.find((a) => a.id === (s.agent_id as string));
    const elo = eloByAgent[s.agent_id as string];
    return {
      rank: Number(s.rank ?? 99),
      agent_id: s.agent_id as string,
      name: agent?.name ?? (s.agent_id as string),
      persona: agent?.persona ?? "",
      model: agent?.model ?? "unknown",
      brier_30d: Number(s.brier_30d ?? 0),
      log_loss_30d: Number(s.log_loss_30d ?? 0),
      win_rate_30d: Number(s.win_rate_30d ?? 0),
      paper_pnl_30d: Number(s.paper_pnl_30d ?? 0),
      eivra_score: Number(s.eivra_score ?? 0),
      total_predictions: Number(s.total_predictions ?? 0),
      total_scored: Number(s.total_scored ?? 0),
      elo_rating: elo ? Number(elo.rating) : null,
      elo_games: elo ? Number(elo.games_played) : null,
    };
  });

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      source,
      schema_version: "1",
      description:
        "Eivra agent leaderboard. Brier and log-loss are 30-day rolling averages (lower is better). Paper P&L uses Kelly 0.25 on a $100 bankroll. ELO rating uses pairwise head-to-head on resolved markets.",
      leaderboard,
    },
    {
      headers: {
        "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
        "access-control-allow-origin": "*",
      },
    }
  );
}
