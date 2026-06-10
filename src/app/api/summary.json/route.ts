import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agents";
import { DEMO_AGENT_STATS } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

/**
 * /api/summary.json — benchmark summary endpoint.
 *
 * Answers the core question: does AI reasoning beat market consensus?
 * Returns the leader, the market baseline (Echo), the delta, and the full
 * leaderboard. Designed to be shared on social / referenced in HN posts.
 *
 * CORS-enabled: any origin may read this.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  type StatRow = Record<string, unknown>;
  let statsRows: StatRow[] = [];
  let livePredictions = 0;
  let source: "live" | "demo" = "demo";

  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const [statsRes, liveRes] = await Promise.all([
        sb.from("agent_stats").select("*").order("rank", { ascending: true }),
        sb
          .from("predictions")
          .select("id", { count: "exact", head: true })
          .eq("is_backfill", false),
      ]);
      if (!statsRes.error && statsRes.data && statsRes.data.length > 0) {
        const withScores = (statsRes.data as StatRow[]).filter(
          (s) => Number(s.total_scored ?? 0) > 0
        );
        if (withScores.length > 0) {
          statsRows = withScores;
          livePredictions = liveRes.count ?? 0;
          source = "live";
        }
      }
    } catch {
      // fall through to demo
    }
  }

  if (source === "demo") {
    statsRows = DEMO_AGENT_STATS as unknown as StatRow[];
  }

  const totalScored =
    statsRows.length > 0
      ? Math.max(...statsRows.map((s) => Number(s.total_scored ?? 0)))
      : 0;

  // Core finding: best reasoning agent vs Echo (market-following baseline)
  const echo = statsRows.find((s) => s.agent_id === "echo");
  const reasoningRows = statsRows.filter(
    (s) => s.agent_id !== "echo" && s.agent_id !== "ensemble"
  );
  const bestReasoning = [...reasoningRows].sort(
    (a, b) => Number(a.brier_30d ?? 1) - Number(b.brier_30d ?? 1)
  )[0] ?? null;
  const bestAgent = bestReasoning
    ? AGENTS.find((a) => a.id === bestReasoning.agent_id)
    : null;

  const echosBrier = echo ? Number(echo.brier_30d ?? 0) : null;
  const bestBrier = bestReasoning ? Number(bestReasoning.brier_30d ?? 0) : null;
  const reasoningBeatsMarket =
    echosBrier !== null && bestBrier !== null && bestBrier < echosBrier;
  const brierDelta =
    echosBrier !== null && bestBrier !== null
      ? +((bestBrier - echosBrier).toFixed(4))
      : null;
  const brierDeltaPct =
    echosBrier !== null && echosBrier > 0 && bestBrier !== null
      ? +(((bestBrier - echosBrier) / echosBrier) * 100).toFixed(1)
      : null;

  const leaderboard = statsRows.map((s) => {
    const agent = AGENTS.find((a) => a.id === (s.agent_id as string));
    return {
      rank: Number(s.rank ?? 99),
      agent_id: s.agent_id as string,
      name: agent?.name ?? (s.agent_id as string),
      persona: agent?.persona ?? "",
      brier_30d: Number(s.brier_30d ?? 0),
      log_loss_30d: Number(s.log_loss_30d ?? 0),
      win_rate_30d: Number(s.win_rate_30d ?? 0),
      paper_pnl_30d: Number(s.paper_pnl_30d ?? 0),
      eivra_score: Number(s.eivra_score ?? 0),
      total_predictions: Number(s.total_predictions ?? 0),
      total_scored: Number(s.total_scored ?? 0),
      is_baseline: s.agent_id === "echo",
      is_ensemble: agent?.synthetic ?? false,
    };
  });

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      source,
      schema_version: "1",
      description:
        "Eivra benchmark summary. Central question: does AI reasoning beat prediction-market consensus? " +
        "Echo (is_baseline=true) mirrors the market price — the bar to beat. " +
        "Brier scores are 30-day rolling averages; lower is better (0=perfect, 0.25=random). " +
        "brier_delta = best_reasoning_brier - echo_brier; negative means reasoning leads. " +
        "Full leaderboard at /api/leaderboard.json · predictions at /api/predictions.json",
      benchmark: {
        total_scored: totalScored,
        live_predictions_locked: livePredictions,
        reasoning_beats_market: reasoningBeatsMarket,
        ...(echosBrier !== null && bestReasoning && bestAgent
          ? {
              best_reasoning_agent: {
                agent_id: bestReasoning.agent_id as string,
                name: bestAgent.name,
                brier_30d: bestBrier,
                win_rate_30d: Number(bestReasoning.win_rate_30d ?? 0),
                eivra_score: Number(bestReasoning.eivra_score ?? 0),
                total_scored: Number(bestReasoning.total_scored ?? 0),
              },
              market_baseline: {
                agent_id: "echo",
                brier_30d: echosBrier,
                win_rate_30d: Number(echo?.win_rate_30d ?? 0),
                total_scored: Number(echo?.total_scored ?? 0),
              },
              brier_delta: brierDelta,
              brier_delta_pct: brierDeltaPct,
            }
          : {}),
      },
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
