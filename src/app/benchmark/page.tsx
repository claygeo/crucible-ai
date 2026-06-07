import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CalibrationPlot } from "@/components/CalibrationPlot";
import { Tooltip } from "@/components/Tooltip";
import { AGENTS, HUE_TO_TEXT, HUE_TO_BG } from "@/lib/agents";
import { getAgentStats, getAgentAlltimeStats, getDisagreements } from "@/lib/data";
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
  const [statsRes, disagreementsRes, alltimeRes] = await Promise.all([
    getAgentStats(),
    getDisagreements(5),
    getAgentAlltimeStats(),
  ]);

  const stats = statsRes.rows;

  // ── derive headline numbers ──────────────────────────────────────────
  const sortedByBrier = [...stats].sort((a, b) => a.brier_30d - b.brier_30d);
  const echo = stats.find((s) => s.agent_id === "echo");
  // Best reasoning agent = best Brier excluding market-prior (echo) and synthetic ensemble
  const reasoningStats = stats.filter(
    (s) => s.agent_id !== "echo" && s.agent_id !== "ensemble"
  );
  const bestReasoning = [...reasoningStats].sort(
    (a, b) => a.brier_30d - b.brier_30d
  )[0];
  const bestReasoningAgent = bestReasoning
    ? AGENTS.find((a) => a.id === bestReasoning.agent_id)
    : null;
  const bestReasoningHueTxt = bestReasoningAgent
    ? HUE_TO_TEXT[bestReasoningAgent.hue]
    : "text-accent";
  const reasoningBeatsMarket =
    echo && bestReasoning && bestReasoning.brier_30d < echo.brier_30d;

  // Disagreements: list of { market, spread, agentPreds }
  const disagreements = disagreementsRes.rows;

  // Share-on-X link: build tweet text from live state so the message is always accurate
  const shareText = (() => {
    if (!echo || !bestReasoning || !bestReasoningAgent) {
      return `Live AI forecasting benchmark: 6 agents, real prediction markets, honest scoring. eivra.xyz`;
    }
    if (reasoningBeatsMarket) {
      return `Public AI benchmark: after ${int(echo.total_scored)} resolved markets, ${bestReasoningAgent.name} beats the market baseline (Brier ${num(bestReasoning.brier_30d, 3)} vs ${num(echo.brier_30d, 3)}). Can reasoning agents beat the crowd? eivra.xyz`;
    }
    return `Public AI benchmark: after ${int(echo.total_scored)} resolved markets, the market-prior still leads. Can AI reasoning beat prediction-market consensus? eivra.xyz`;
  })();
  const shareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  // P&L divergence insight: sort by P&L to expose accuracy-vs-profit gap
  const pnlRanked = [...stats].sort((a, b) => (b.paper_pnl_30d ?? 0) - (a.paper_pnl_30d ?? 0));
  const pnlBest = pnlRanked[0];
  const pnlBestAgent = pnlBest ? AGENTS.find((a) => a.id === pnlBest.agent_id) ?? null : null;
  // Compare best P&L agent against the accuracy leader (best Brier) — not against worst P&L
  const brierLeaderStat = sortedByBrier[0];
  const brierLeaderAgent = brierLeaderStat ? AGENTS.find((a) => a.id === brierLeaderStat.agent_id) ?? null : null;
  // Only show if best P&L agent ≠ best Brier agent (otherwise the finding is trivial)
  const showPnlInsight =
    pnlBest && pnlBestAgent && brierLeaderStat && brierLeaderAgent &&
    pnlBest.agent_id !== brierLeaderStat.agent_id;

  // Win-rate vs Brier insight: surfaces when the win-rate leader differs from the Brier leader
  const winRateRanked = [...stats].sort((a, b) => b.win_rate_30d - a.win_rate_30d);
  const winRateBest = winRateRanked[0];
  const winRateBestAgent = winRateBest ? AGENTS.find((a) => a.id === winRateBest.agent_id) ?? null : null;
  const showWinRateInsight =
    winRateBest && winRateBestAgent && brierLeaderStat && brierLeaderAgent &&
    winRateBest.agent_id !== brierLeaderStat.agent_id;

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
            {reasoningBeatsMarket && bestReasoningAgent ? (
              <>
                <span className={bestReasoningHueTxt}>{bestReasoningAgent.name}</span>{" "}
                beats the market-prior
              </>
            ) : (
              <>Market-prior holds <span className="text-text-muted">·</span> reasoning agents close behind</>
            )}
          </h1>
          <p className="text-text-primary text-base max-w-3xl font-medium">
            Echo mirrors the market price — it&apos;s the baseline.{" "}
            {echo && bestReasoning && bestReasoningAgent ? (
              reasoningBeatsMarket ? (
                <>
                  After{" "}
                  <span className="text-text-primary">{int(echo.total_scored)}</span>{" "}
                  resolved markets,{" "}
                  <span className={bestReasoningHueTxt}>{bestReasoningAgent.name}</span>{" "}
                  has opened a lead over crowd-money consensus.
                </>
              ) : (
                <>
                  After{" "}
                  <span className="text-text-primary">{int(echo.total_scored)}</span>{" "}
                  resolved markets, the gap is{" "}
                  <span className="text-warn font-semibold">
                    {num(Math.abs(bestReasoning.brier_30d - echo.brier_30d), 4)} Brier
                  </span>{" "}
                  ({Math.round(Math.abs(bestReasoning.brier_30d - echo.brier_30d) / echo.brier_30d * 100)}%){" "}
                  — can{" "}
                  <span className={bestReasoningHueTxt}>{bestReasoningAgent.name}</span>{" "}
                  close it?
                </>
              )
            ) : (
              <>Can reasoning agents beat it?</>
            )}{" "}
            Here&apos;s the 30-day breakdown.
          </p>
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

          {echo && bestReasoning && bestReasoningAgent && (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="panel px-5 py-4 flex flex-col gap-1">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Market-prior · Echo (baseline)
                </div>
                <div className="heading text-3xl text-white">
                  {num(echo.brier_30d, 4)}
                </div>
                <div className="text-xs text-text-secondary">
                  Brier. Echo mirrors the market price — this is the bar to beat.
                </div>
              </div>
              <div className="panel px-5 py-4 flex flex-col gap-1">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Best reasoning agent
                </div>
                <div className={`heading text-3xl ${bestReasoningHueTxt}`}>
                  {num(bestReasoning.brier_30d, 4)}
                </div>
                <div className="text-xs text-text-secondary">
                  {bestReasoningAgent.name} · delta vs market-prior:{" "}
                  <span
                    className={
                      bestReasoning.brier_30d - echo.brier_30d < 0
                        ? "text-positive"
                        : "text-rose-400"
                    }
                  >
                    {signed(bestReasoning.brier_30d - echo.brier_30d, 4)}
                  </span>
                </div>
              </div>
              <div className="panel px-5 py-4 flex flex-col gap-1">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Markets scored
                </div>
                <div className="heading text-3xl text-text-primary">
                  {int(echo.total_scored)}
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
                      <td className="text-right py-3 px-3 mono text-sm">{num(s.brier_30d, 4)}</td>
                      <td className="text-right py-3 px-3 mono text-sm">{num(s.log_loss_30d, 3)}</td>
                      <td className="text-right py-3 px-3 mono text-sm">{pct(s.win_rate_30d, 1)}</td>
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
          <div className="flex items-center justify-end">
            <a
              href={shareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-[11px] uppercase tracking-wider text-text-muted hover:text-accent transition-colors flex items-center gap-1.5"
              aria-label="Share this result on X (Twitter)"
            >
              Share this result on X →
            </a>
          </div>
        </section>

        {/* ── P&L vs accuracy insight ─────────────────────────────── */}
        {showPnlInsight && pnlBest && pnlBestAgent && brierLeaderStat && brierLeaderAgent && (
          <section className="panel px-5 py-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="heading text-base text-text-primary">Accuracy ≠ P&amp;L</h2>
              <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-warn/10 text-warn">
                Counterintuitive finding
              </span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              <span className={`font-medium ${HUE_TO_TEXT[pnlBestAgent.hue]}`}>{pnlBestAgent.name}</span>{" "}
              leads on paper P&amp;L{" "}
              (<span className="text-positive">{dollars(pnlBest.paper_pnl_30d, 0)}</span>) despite a weaker Brier
              ({num(pnlBest.brier_30d, 3)}) than{" "}
              <span className={`font-medium ${HUE_TO_TEXT[brierLeaderAgent.hue]}`}>{brierLeaderAgent.name}</span>,
              which leads on Brier ({num(brierLeaderStat.brier_30d, 3)}) but{" "}
              {brierLeaderStat.paper_pnl_30d < 0 ? (
                <>lost <span className="text-rose-400">{dollars(Math.abs(brierLeaderStat.paper_pnl_30d), 0)}</span></>
              ) : (
                <>gained <span className="text-positive">{dollars(brierLeaderStat.paper_pnl_30d, 0)}</span></>
              )}{" "}
              on Kelly bets.
              Kelly rewards <em>beating the market price</em>, not just calibration:
              an agent that shadows consensus has near-zero edge per bet, so small mispricings compound into a loss.
              An agent that diverges from the market earns outsized wins when the crowd is wrong — even if its overall accuracy is lower.
            </p>
          </section>
        )}

        {/* ── Win rate vs Brier insight ───────────────────────────── */}
        {showWinRateInsight && winRateBest && winRateBestAgent && brierLeaderStat && brierLeaderAgent && (
          <section className="panel px-5 py-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="heading text-base text-text-primary">Win rate ≠ Brier</h2>
              <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-warn/10 text-warn">
                Counterintuitive finding
              </span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              <span className={`font-medium ${HUE_TO_TEXT[winRateBestAgent.hue]}`}>{winRateBestAgent.name}</span>{" "}
              wins more often than{" "}
              <span className={`font-medium ${HUE_TO_TEXT[brierLeaderAgent.hue]}`}>{brierLeaderAgent.name}</span>{" "}
              (
              <span className="text-text-primary">{pct(winRateBest.win_rate_30d, 1)}</span>{" "}
              vs{" "}
              <span className="text-text-primary">{pct(brierLeaderStat.win_rate_30d, 1)}</span>
              ) — but trails on Brier (
              <span className="text-rose-400">{num(winRateBest.brier_30d, 4)}</span>{" "}
              vs{" "}
              <span className="text-positive">{num(brierLeaderStat.brier_30d, 4)}</span>
              ).{" "}
              Win rate only checks <em>direction</em>: was the agent&apos;s probability above 50% when the event happened?
              Brier also penalises <em>confidence</em>: predicting 0.9 on a coin-flip costs four times more than predicting 0.6.
              An agent can be right more often in direction while still being slightly over-confident on its calls — and Brier catches that gap where win rate does not.
            </p>
          </section>
        )}

        {/* ── All-time standings ──────────────────────────────────── */}
        {alltimeRes.rows.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="heading text-xl text-text-primary">All-time standings</h2>
              <p className="text-text-secondary text-sm">
                Full-history Brier and log-loss across all{" "}
                <span className="text-text-primary">
                  {int(Math.max(...alltimeRes.rows.map((r) => r.total_scored)))}
                </span>{" "}
                resolved markets. More statistically robust than the 30-day
                window — the signal that accumulates over time.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Agent all-time standings">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="text-left py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">Agent</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                      <Tooltip tip="All-time Brier score: mean squared error between predicted probability and outcome across every scored prediction. Lower is better — 0 is perfect, 0.25 is chance.">
                        Brier ↓
                      </Tooltip>
                    </th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                      <Tooltip tip="All-time log-loss: −log(p) if the event happened, −log(1−p) if it didn't. Penalizes confident wrong predictions heavily. Lower is better.">
                        Log-loss ↓
                      </Tooltip>
                    </th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                      <Tooltip tip="All-time paper P&L: cumulative simulated Kelly-fraction (0.25×) profit/loss on a $100 bankroll from every scored prediction.">
                        Paper P&amp;L
                      </Tooltip>
                    </th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                      <Tooltip tip="Total markets scored: number of resolved predictions with ground-truth outcome.">
                        n
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {alltimeRes.rows.map((s, i) => {
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
                        <td className="text-right py-3 px-3 mono text-sm">{num(s.brier_alltime, 4)}</td>
                        <td className="text-right py-3 px-3 mono text-sm">{num(s.log_loss_alltime, 3)}</td>
                        <td className={`text-right py-3 px-3 mono text-sm ${
                          s.paper_pnl_alltime >= 0 ? "text-positive" : "text-rose-400"
                        }`}>{dollars(s.paper_pnl_alltime, 2)}</td>
                        <td className="text-right py-3 px-3 mono text-sm text-text-muted">{int(s.total_scored)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

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
                      Brier {num(s.brier_30d, 4)} · n={int(s.total_scored)}
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
