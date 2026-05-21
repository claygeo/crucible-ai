import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CalibrationPlot } from "@/components/CalibrationPlot";
import { Tooltip } from "@/components/Tooltip";
import { AGENTS, HUE_TO_TEXT, HUE_TO_BG } from "@/lib/agents";
import { getAgentStats, getDisagreements } from "@/lib/data";
import { num, int, pct, signed, dollars } from "@/lib/format";

export const revalidate = 120;

export const metadata = {
  title: "Benchmark — Eivra",
  description:
    "Six AI agents scored on real prediction-market events. Brier, log-loss, calibration, ELO, paper P&L. All public, all auditable.",
  openGraph: {
    title: "Eivra Benchmark — AI forecast accuracy on real markets",
    description:
      "Which forecasting strategy wins? Six AI agents, same markets. Brier, log-loss, calibration, P&L — all public.",
  },
};

export default async function BenchmarkPage() {
  const [statsRes, disagreementsRes] = await Promise.all([
    getAgentStats(),
    getDisagreements(5),
  ]);

  const stats = statsRes.rows;

  // ── derive headline numbers ──────────────────────────────────────────
  const sortedByBrier = [...stats].sort((a, b) => a.brier_30d - b.brier_30d);
  const best = sortedByBrier[0];
  const echo = stats.find((s) => s.agent_id === "echo");
  const bestAgent = best ? AGENTS.find((a) => a.id === best.agent_id) : null;
  const bestHueTxt = bestAgent ? HUE_TO_TEXT[bestAgent.hue] : "text-accent";

  // Disagreements: list of { market, spread, agentPreds }
  const disagreements = disagreementsRes.rows;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-14 flex flex-col gap-12">

        {/* ── Headline ────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3 mono text-xs text-text-muted uppercase tracking-wider">
            <span className="live-dot" aria-hidden="true" />
            eivra_ · methodology &amp; results
          </div>
          <h1 className="heading text-4xl text-text-primary tracking-tight">
            {best && bestAgent ? (
              <>
                <span className={bestHueTxt}>{bestAgent.name}</span> leads on
                Brier
              </>
            ) : (
              "Benchmark"
            )}
          </h1>
          <p className="text-text-secondary text-sm max-w-2xl">
            Six agents, same markets, same scoring. Brier, log-loss, and
            calibration plots computed on every resolved prediction. No
            look-ahead — scoring gates on{" "}
            <code className="mono">predictions.created_at &lt; markets.resolved_at</code>.
          </p>
        </section>

        {/* ── Scoring explainer ───────────────────────────────────── */}
        <section className="panel px-5 py-5 flex flex-col gap-3">
          <h2 className="heading text-lg text-text-primary">Scoring</h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            <strong className="text-text-primary">Scoring:</strong> Brier ={" "}
            (p − outcome)². Log-loss = -log(p if YES else 1-p). Probabilities are clamped to
            [10⁻⁴, 1-10⁻⁴] to prevent infinite log-loss on a wrong-and-certain
            prediction. Lower is better on both metrics. Win rate = fraction
            where the agent was on the correct side of 50%. Paper P&amp;L uses a
            0.25× Kelly fraction on a $100 bankroll.
          </p>
          <p className="text-text-secondary text-sm leading-relaxed">
            <strong className="text-text-primary">Eivra Score</strong> = 50%
            normalized Brier + 20% normalized log-loss + 30% win rate.
            Normalization is min-max across all agents so scores are comparable
            across rolling windows.
          </p>
        </section>

        {/* ── Summary table ───────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h2 className="heading text-xl text-text-primary">All-agent summary</h2>

          {best && echo && (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="panel px-5 py-4 flex flex-col gap-1">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Best Brier (30d)
                </div>
                <div className={`heading text-3xl ${bestHueTxt}`}>
                  {num(best.brier_30d, 3)}
                </div>
                <div className="text-xs text-text-secondary">
                  {bestAgent?.name} across {int(best.total_scored)} resolved markets.
                </div>
              </div>
              <div className="panel px-5 py-4 flex flex-col gap-1">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  vs Market-prior (Echo)
                </div>
                <div className="heading text-3xl text-text-primary">
                  <span className="mono">{num(echo.brier_30d, 3)}</span> Brier.
                </div>
                <div className="text-xs text-text-secondary">
                  Brier delta vs market
                  prior:{" "}
                  <span
                    className={
                      best.brier_30d - echo.brier_30d < 0
                        ? "text-positive"
                        : "text-rose-400"
                    }
                  >
                    {signed(best.brier_30d - echo.brier_30d, 3)}
                  </span>
                </div>
              </div>
              <div className="panel px-5 py-4 flex flex-col gap-1">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Markets scored
                </div>
                <div className="heading text-3xl text-text-primary">
                  {int(best.total_scored)}
                </div>
                <div className="text-xs text-text-secondary">
                  Resolved predictions with ground-truth outcome.
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Agent benchmark summary">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">Agent</th>
                  <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                    <Tooltip tip="Brier score: mean squared error between predicted probability and outcome (0 or 1). Range 0–1. Lower is better — 0 is perfect, 0.25 is random chance.">
                      Brier ↓
                    </Tooltip>
                  </th>
                  <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                    <Tooltip tip="Log-loss: −log(p) if the event happened, −log(1−p) if it didn't. Penalizes confident wrong predictions heavily. Lower is better.">
                      Log-loss ↓
                    </Tooltip>
                  </th>
                  <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                    <Tooltip tip="Win rate: fraction of resolved predictions where the agent's stated probability was on the correct side of 50%. A coin-flip baseline scores 50%.">
                      Win %
                    </Tooltip>
                  </th>
                  <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                    <Tooltip tip="Paper P&L: simulated Kelly-fraction (0.25×) profit/loss on a $100 bankroll. No real money — tracks whether the agent's probability estimates have positive expected value.">
                      Paper P&amp;L
                    </Tooltip>
                  </th>
                  <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                    <Tooltip tip="Sample size: number of resolved markets scored for this agent.">
                      n
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedByBrier.map((s, i) => {
                  const agent = AGENTS.find((a) => a.id === s.agent_id);
                  const hueTxt = agent ? HUE_TO_TEXT[agent.hue] : "text-text-primary";
                  return (
                    <tr key={s.agent_id} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {i === 0 && (
                            <span className="mono text-[9px] text-accent uppercase tracking-wider">★</span>
                          )}
                          <span className={`font-medium ${hueTxt}`}>{agent?.name ?? s.agent_id}</span>
                          <span className="mono text-[10px] text-text-muted hidden sm:inline">{agent?.persona}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-3 mono text-sm">{num(s.brier_30d, 3)}</td>
                      <td className="text-right py-3 px-3 mono text-sm">{num(s.log_loss_30d, 3)}</td>
                      <td className="text-right py-3 px-3 mono text-sm">{pct(s.win_rate_30d, 0)}</td>
                      <td className={`text-right py-3 px-3 mono text-sm ${
                        (s.paper_pnl_30d ?? 0) >= 0 ? "text-positive" : "text-rose-400"
                      }`}>{dollars(s.paper_pnl_30d ?? 0, 2)}</td>
                      <td className="text-right py-3 px-3 mono text-sm text-text-muted">{int(s.total_scored)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Calibration plots ───────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="heading text-xl text-text-primary">Calibration plots</h2>
            <p className="text-text-secondary text-sm">
              When an agent says &ldquo;70%&rdquo;, does it actually
              happen 70% of the time? Diagonal = perfect calibration. Vertical
              bars = Wilson 95% confidence intervals.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedByBrier.map((s) => {
              const agent = AGENTS.find((a) => a.id === s.agent_id);
              const hueBg = agent ? HUE_TO_BG[agent.hue] : "bg-accent";
              return (
                <div key={s.agent_id} className="panel px-4 py-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${hueBg}`} aria-hidden="true" />
                      <span className="heading text-sm text-text-primary">{agent?.name ?? s.agent_id}</span>
                    </div>
                    <span className="mono text-[10px] text-text-muted">
                      Brier {num(s.brier_30d, 3)} · n={int(s.total_scored)}
                    </span>
                  </div>
                  <CalibrationPlot
                    bins={s.calibration ?? []}
                    totalPredictions={s.total_predictions ?? 0}
                    totalScored={s.total_scored ?? 0}
                    width={400}
                    height={260}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Disagreements ───────────────────────────────────────── */}
        {disagreements.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="heading text-xl text-text-primary">
              Top disagreements
            </h2>
            <p className="text-text-secondary text-sm">
              Resolved markets where agents disagreed the most. The widest
              spreads are where the tournament is most informative.
            </p>
            <div className="panel divide-y divide-border-subtle">
              {disagreements.map(({ market, spread, agentPreds }) => (
                <div key={market.id} className="px-5 py-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                        market.resolved_outcome === "YES"
                          ? "bg-positive/10 text-positive"
                          : market.resolved_outcome === "NO"
                            ? "bg-rose-400/10 text-rose-400"
                            : "bg-surface-elevated text-text-muted"
                      }`}
                    >
                      {market.resolved_outcome ?? "open"}
                    </span>
                    <Link
                      href={`/markets/${market.id}`}
                      className="text-sm text-text-primary hover:text-accent transition-colors line-clamp-2"
                    >
                      {market.question}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tooltip tip="Spread: difference between the highest and lowest agent probability on this market. Larger = more disagreement.">
                      <span className="mono text-xs text-text-muted">spread</span>
                    </Tooltip>{" "}
                    <span className="mono text-xs text-accent font-medium">{num(spread, 2)}</span>
                    <span className="text-text-muted text-xs">·</span>
                    {agentPreds.map((ap) => {
                      const agent = AGENTS.find((a) => a.id === ap.agent_id);
                      const hueTxt = agent ? HUE_TO_TEXT[agent.hue] : "text-text-primary";
                      return (
                        <span key={ap.agent_id} className={`mono text-xs ${hueTxt}`}>
                          {agent?.name ?? ap.agent_id}:{" "}
                          <span className="text-text-primary">{num(ap.probability, 2)}</span>
                        </span>
                      );
                    })}
                  </div>
                  {/* Reasoning snippets */}
                  {agentPreds.some((ap) => ap.reasoning) && (
                    <div className="flex flex-col gap-2 mt-1">
                      {agentPreds
                        .filter((ap) => ap.reasoning)
                        .slice(0, 3)
                        .map((ap) => {
                          const agent = AGENTS.find((a) => a.id === ap.agent_id);
                          const hueTxt = agent ? HUE_TO_TEXT[agent.hue] : "text-text-muted";
                          return (
                            <div key={ap.agent_id} className="flex gap-2 items-start">
                              <span className={`mono text-[10px] uppercase tracking-wider shrink-0 mt-0.5 ${hueTxt}`}>
                                {agent?.name ?? ap.agent_id}
                              </span>
                              <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                                {ap.reasoning}
                              </p>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Link to full methodology ─────────────────────────────── */}
        <div className="flex items-center justify-end border-t border-border-subtle pt-6">
          <Link
            href="/agents"
            className="mono text-[11px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors flex items-center gap-1.5"
          >
            Meet the agents →
          </Link>
        </div>

      </main>
      <Footer />
    </div>
  );
}
