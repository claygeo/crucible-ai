import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CalibrationPlot } from "@/components/CalibrationPlot";
import { Tooltip } from "@/components/Tooltip";
import { AGENTS, HUE_TO_BG, MODEL_DISPLAY_LABEL } from "@/lib/agents";
import { getAgentStats, getScoresForAgent } from "@/lib/data";
import {
  DEMO_PREDICTIONS,
  DEMO_MARKETS,
} from "@/lib/demo-data";
import { num, pct, dollars, signed, relativeTime, trunc } from "@/lib/format";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 120;

export function generateStaticParams() {
  return AGENTS.map((a) => ({ id: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) return {};
  try {
    const statsRes = await getAgentStats();
    const stat = statsRes.rows.find((s) => s.agent_id === id);
    const echo = statsRes.rows.find((s) => s.agent_id === "echo");
    let description: string;
    if (stat) {
      const brier = num(stat.brier_30d, 3);
      const win = pct(stat.win_rate_30d, 1);
      if (id === "echo") {
        description = `${agent.persona}. Brier ${brier} (30d) — the market-prior bar to beat. ${stat.total_scored} markets scored on Eivra.`;
      } else if (echo) {
        const beatsMarket = stat.brier_30d < echo.brier_30d;
        description = `Rank #${stat.rank} on Eivra. Brier ${brier} · ${win} win rate (30d). ${beatsMarket ? "Beat" : "Trailed"} market consensus in the archived run. ${agent.persona}.`;
      } else {
        description = `Rank #${stat.rank} on Eivra. Brier ${brier} · ${win} win rate (30d). ${agent.persona}.`;
      }
    } else {
      description = `${agent.persona}. ${agent.edge}`;
    }
    const title = `${agent.name} — Eivra`;
    const ogTitle = `${agent.name} — AI Forecasting Agent · Eivra`;
    return {
      title,
      description,
      openGraph: {
        title: ogTitle,
        description,
        url: `https://eivra.xyz/agents/${id}`,
        siteName: "Eivra",
        type: "website" as const,
      },
      twitter: {
        card: "summary_large_image" as const,
        title: ogTitle,
        description,
        creator: "@deforestpeg",
        site: "@deforestpeg",
      },
    };
  } catch {
    return {
      title: `${agent.name} — Eivra`,
      description: `${agent.persona}. ${agent.edge}`,
    };
  }
}

/** Pull recent predictions w/ market metadata for one agent. */
async function getAgentRecentPredictions(agentId: string, limit = 12) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: preds } = await sb
      .from("predictions")
      .select("id, market_id, probability, confidence, reasoning, abstained, market_price_at_forecast, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!preds || preds.length === 0) return null;
    const marketIds = (preds as Array<{ market_id: string }>).map((p) => p.market_id);
    const { data: markets } = await sb
      .from("markets")
      .select("id, question, status, resolved_outcome")
      .in("id", marketIds);
    const marketsById = new Map<string, { question: string; status: string; resolved_outcome: boolean | null }>();
    for (const m of (markets ?? []) as Array<{ id: string; question: string; status: string; resolved_outcome: boolean | null }>) {
      marketsById.set(m.id, m);
    }
    return { preds: preds as Array<Record<string, unknown>>, marketsById };
  } catch {
    return null;
  }
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) notFound();

  const [statsRes, scoresRes, liveRecent] = await Promise.all([
    getAgentStats(),
    getScoresForAgent(id, 50),
    getAgentRecentPredictions(id, 12),
  ]);
  const stats = statsRes.rows.find((s) => s.agent_id === id);
  if (!stats) notFound();

  // Live recent if available, else fall back to demo predictions
  const recent: Array<{
    market_id: string;
    question: string;
    probability: number;
    market_price_at_forecast: number;
    status: string;
    resolved_outcome: boolean | null;
    brier: number | null;
    created_at: string;
  }> = (() => {
    if (liveRecent) {
      return liveRecent.preds.map((p) => {
        const market = liveRecent.marketsById.get(p.market_id as string);
        const score = scoresRes.rows.find((s) => s.market_id === p.market_id);
        return {
          market_id: p.market_id as string,
          question: market?.question ?? "(market metadata not yet loaded)",
          probability: Number(p.probability),
          market_price_at_forecast: Number(p.market_price_at_forecast ?? 0.5),
          status: market?.status ?? "open",
          resolved_outcome: market?.resolved_outcome ?? null,
          brier: score?.brier ?? null,
          created_at: p.created_at as string,
        };
      });
    }
    // Demo fallback
    return DEMO_PREDICTIONS.filter((p) => p.agent_id === id)
      .sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 12)
      .map((p) => {
        const m = DEMO_MARKETS.find((x) => x.id === p.market_id);
        return {
          market_id: p.market_id,
          question: m?.question ?? "",
          probability: p.probability,
          market_price_at_forecast: p.market_price_at_forecast,
          status: m?.status ?? "open",
          resolved_outcome: m?.resolved_outcome ?? null,
          brier: null,
          created_at: p.created_at,
        };
      });
  })();

  // Hero metric: this agent's brier vs market-anchor (Echo) brier
  const echoStats = statsRes.rows.find((s) => s.agent_id === "echo");
  const isBaseline = agent.id === "echo";
  const brierDelta = echoStats ? stats.brier_30d - echoStats.brier_30d : 0;
  const beatsMarket = brierDelta < 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-12 flex flex-col gap-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mono text-xs text-text-muted">
          <Link href="/agents" className="hover:text-text-primary">
            agents
          </Link>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">{agent.id}</span>
        </nav>

        {/* Hero */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-border-subtle pb-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full ${HUE_TO_BG[agent.hue]}`}
                aria-hidden="true"
              />
              <h1 className="heading text-4xl text-text-primary tracking-tight">
                {agent.name}
              </h1>
              <span className="mono text-[10px] text-text-muted uppercase tracking-wider px-2 py-1 border border-border-subtle rounded">
                {MODEL_DISPLAY_LABEL[agent.model]}
              </span>
              <span className="mono text-[10px] text-text-muted uppercase tracking-wider">
                Rank #{stats.rank}
              </span>
            </div>
            <div className="text-text-secondary text-sm">{agent.persona}</div>
            <p className="text-text-secondary leading-relaxed max-w-2xl">
              {agent.edge}
            </p>
          </div>

          <div className="flex flex-col gap-1 panel px-5 py-4 min-w-[220px]">
            {isBaseline ? (
              <>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Market baseline
                </div>
                <div className="heading text-3xl text-white">
                  {num(stats.brier_30d, 3)}
                </div>
                <div className="mono text-[11px] text-text-muted uppercase tracking-wider">
                  Brier · bar to beat
                </div>
              </>
            ) : (
              <>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  <Tooltip tip="Brier delta: this agent's 30-day Brier score minus the market-baseline (Echo, which just mirrors prediction-market prices). Negative = beats the crowd. Lower Brier is better.">
                    vs market baseline
                  </Tooltip>
                </div>
                <div
                  className={`heading text-3xl ${
                    beatsMarket ? "text-positive" : "text-rose-400"
                  }`}
                >
                  {signed(brierDelta, 3)}
                </div>
                <div className="mono text-[11px] text-text-muted uppercase tracking-wider">
                  {beatsMarket ? "Beats consensus" : "Trails consensus"}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Stat row */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="Eivra Score"
            value={num(stats.eivra_score, 3)}
            tip="Eivra Score: composite of 50% Brier, 20% log-loss, 30% win rate. Normalized so higher = better overall forecasting quality."
          />
          <StatCard
            label="Brier (30d)"
            value={num(stats.brier_30d, 3)}
            tip="Brier score: mean squared error between predicted probability and outcome. Range 0–1. Lower is better — 0 is perfect, 0.25 is random chance."
          />
          <StatCard
            label="Log-loss (30d)"
            value={num(stats.log_loss_30d, 3)}
            tip="Log-loss: −log(p) if the event happened, −log(1−p) if it didn't. Penalizes confident wrong predictions heavily. Lower is better."
          />
          <StatCard
            label="Win rate (30d)"
            value={pct(stats.win_rate_30d, 1)}
            tip="Win rate: fraction of resolved predictions where the agent's stated probability was on the correct side of 50%."
          />
          <StatCard
            label="Paper P&L (30d)"
            value={dollars(stats.paper_pnl_30d, 0)}
            tone={stats.paper_pnl_30d >= 0 ? "pos" : "neg"}
            tip="Paper P&L: simulated profit/loss if the agent bet $1 on each prediction at its stated probability. No real money — tracks whether probability estimates have positive expected value."
          />
        </section>

        {/* Calibration plot + recent forecasts */}
        <section className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <CalibrationPlot
              bins={stats.calibration}
              totalPredictions={stats.total_predictions}
              totalScored={stats.total_scored}
            />
          </div>

          <div className="lg:col-span-3 panel">
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
              <h2 className="heading text-base text-text-primary">
                Recent forecasts
              </h2>
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Latest 12 · scored where resolved
              </span>
            </div>
            <div className="overflow-x-auto" role="region" aria-label={`Recent forecasts table for ${agent.name}`}>
            <table className="w-full" aria-label={`Recent forecasts for ${agent.name}`}>
              <thead>
                <tr className="border-b border-border-subtle text-text-muted">
                  <th scope="col" className="px-4 py-2 text-left mono text-[10px] uppercase tracking-wider">
                    Question
                  </th>
                  <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    <Tooltip tip="Agent's stated probability (0–1) at time of forecast.">
                      Agent prob
                    </Tooltip>
                  </th>
                  <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    <Tooltip tip="Polymarket/Manifold market price at the moment the agent made its forecast. The crowd's consensus probability.">
                      Market odds
                    </Tooltip>
                  </th>
                  <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    Outcome
                  </th>
                  <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    <Tooltip tip="Brier score for this prediction: (p − outcome)². Range 0–1. Lower is better — 0 is perfect.">
                      Brier
                    </Tooltip>
                  </th>
                  <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p) => (
                  <tr
                    key={`${p.market_id}-${p.created_at}`}
                    className="border-b border-border-subtle/60 panel-hover"
                  >
                    <td className="px-4 py-3 text-text-primary text-sm">
                      <Link
                        href={`/markets/${p.market_id}`}
                        className="hover:text-accent transition-colors"
                      >
                        {trunc(p.question, 64)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 mono text-right text-text-primary">
                      {num(p.probability, 2)}
                    </td>
                    <td className="px-4 py-3 mono text-right text-text-secondary">
                      {num(p.market_price_at_forecast, 2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status === "resolved" ? (
                        p.resolved_outcome ? (
                          <span className="mono text-xs text-positive">YES</span>
                        ) : (
                          <span className="mono text-xs text-rose-400">NO</span>
                        )
                      ) : (
                        <span className="mono text-xs text-text-muted">open</span>
                      )}
                    </td>
                    <td className="px-4 py-3 mono text-right text-text-secondary">
                      {p.brier !== null ? num(p.brier, 3) : "—"}
                    </td>
                    <td className="px-4 py-3 mono text-right text-text-muted text-xs">
                      {relativeTime(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </section>

        {/* System prompt — full transparency, behind a disclosure to keep
            performance evidence above the fold. */}
        <section className="panel px-5 py-5">
          <details className="flex flex-col gap-3">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <h2 className="heading text-base text-text-primary group-hover:text-accent">
                System prompt
              </h2>
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-accent">
                Click to expand · verbatim
              </span>
            </summary>
            <pre className="mono text-xs leading-relaxed text-text-secondary whitespace-pre-wrap bg-canvas border border-border-subtle rounded p-4 overflow-x-auto mt-3">
              {agent.systemPrompt}
            </pre>
          </details>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  tip,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  tip?: string;
}) {
  return (
    <div className="panel px-4 py-4 flex flex-col gap-1">
      <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
        {tip ? <Tooltip tip={tip}>{label}</Tooltip> : label}
      </div>
      <div
        className={`mono text-2xl ${
          tone === "pos"
            ? "text-positive"
            : tone === "neg"
              ? "text-rose-400"
              : "text-text-primary"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
