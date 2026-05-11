import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CalibrationPlot } from "@/components/CalibrationPlot";
import { AGENTS } from "@/lib/agents";
import {
  DEMO_AGENT_STATS,
  DEMO_PREDICTIONS,
  DEMO_MARKETS,
  DEMO_SCORES,
} from "@/lib/demo-data";
import { num, pct, dollars, signed, prob, relativeTime, trunc } from "@/lib/format";

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
  return {
    title: `${agent.name} — Crucible`,
    description: `${agent.persona}. ${agent.edge}`,
  };
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) notFound();
  const stats = DEMO_AGENT_STATS.find((s) => s.agent_id === id);
  if (!stats) notFound();

  const myPredictions = DEMO_PREDICTIONS.filter((p) => p.agent_id === id);
  const myScores = DEMO_SCORES.filter((s) => s.agent_id === id);
  // Latest predictions (resolved + open) sorted by created_at desc
  const recent = [...myPredictions]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 12);

  // Hero metric: this agent's brier vs market-anchor (Echo) brier
  const echoStats = DEMO_AGENT_STATS.find((s) => s.agent_id === "echo")!;
  const brierDelta = stats.brier_30d - echoStats.brier_30d;
  const beatsMarket = brierDelta < 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-12 flex flex-col gap-10">
        {/* Breadcrumb */}
        <nav className="mono text-xs text-text-muted">
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
                className={`w-3 h-3 rounded-full ${
                  agent.hue === "teal"
                    ? "bg-[#00C2A8]"
                    : agent.hue === "amber"
                      ? "bg-amber-400"
                      : agent.hue === "rose"
                        ? "bg-rose-400"
                        : agent.hue === "indigo"
                          ? "bg-indigo-400"
                          : agent.hue === "lime"
                            ? "bg-lime-400"
                            : "bg-white"
                }`}
                aria-hidden="true"
              />
              <h1 className="heading text-4xl text-text-primary tracking-tight">
                {agent.name}
              </h1>
              <span className="mono text-[10px] text-text-muted uppercase tracking-wider px-2 py-1 border border-border-subtle rounded">
                {agent.model}
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
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Brier delta vs market-anchor
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
          </div>
        </section>

        {/* Stat row */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Crucible Score" value={num(stats.crucible_score, 3)} />
          <StatCard label="Brier (30d)" value={num(stats.brier_30d, 3)} />
          <StatCard label="Log-loss (30d)" value={num(stats.log_loss_30d, 3)} />
          <StatCard label="Win rate (30d)" value={pct(stats.win_rate_30d, 0)} />
          <StatCard
            label="Paper P&L (30d)"
            value={dollars(stats.paper_pnl_30d, 0)}
            tone={stats.paper_pnl_30d >= 0 ? "pos" : "neg"}
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
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted">
                  <th className="px-4 py-2 text-left mono text-[10px] uppercase tracking-wider">
                    Market
                  </th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    Forecast
                  </th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    Market
                  </th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    Brier
                  </th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p) => {
                  const market = DEMO_MARKETS.find(
                    (m) => m.id === p.market_id
                  )!;
                  const score = myScores.find((s) => s.market_id === p.market_id);
                  return (
                    <tr
                      key={`${p.market_id}-${p.created_at}`}
                      className="border-b border-border-subtle/60 panel-hover"
                    >
                      <td className="px-4 py-3 text-text-primary text-sm">
                        <Link
                          href={`/markets/${market.id}`}
                          className="hover:text-accent transition-colors"
                        >
                          {trunc(market.question, 64)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 mono text-right text-text-primary">
                        {prob(p.probability)}
                      </td>
                      <td className="px-4 py-3 mono text-right text-text-secondary">
                        {prob(p.market_price_at_forecast)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {market.status === "resolved" ? (
                          market.resolved_outcome ? (
                            <span className="mono text-xs text-positive">
                              YES
                            </span>
                          ) : (
                            <span className="mono text-xs text-rose-400">
                              NO
                            </span>
                          )
                        ) : (
                          <span className="mono text-xs text-text-muted">
                            open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 mono text-right text-text-secondary">
                        {score ? num(score.brier, 3) : "—"}
                      </td>
                      <td className="px-4 py-3 mono text-right text-text-muted text-xs">
                        {relativeTime(p.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* System prompt — full transparency */}
        <section className="panel px-5 py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="heading text-base text-text-primary">
              System prompt
            </h2>
            <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Verbatim
            </span>
          </div>
          <pre className="mono text-xs leading-relaxed text-text-secondary whitespace-pre-wrap bg-canvas border border-border-subtle rounded p-4 overflow-x-auto">
            {agent.systemPrompt}
          </pre>
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
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="panel px-4 py-4 flex flex-col gap-1">
      <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
        {label}
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
