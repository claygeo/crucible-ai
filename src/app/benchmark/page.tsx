import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CalibrationPlot } from "@/components/CalibrationPlot";
import { Tooltip } from "@/components/Tooltip";
import { AGENTS, HUE_TO_TEXT, HUE_TO_BG } from "@/lib/agents";
import { getAgentStats, getAgentAlltimeStats, getDisagreements, getLiveBrierScores } from "@/lib/data";
import { num, int, pct, signed, dollars } from "@/lib/format";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const title = "Benchmark — Eivra";
  const ogTitle = "Eivra Benchmark — AI forecast accuracy on real markets";
  let description =
    "Six AI agents scored on real prediction-market events. Brier, log-loss, calibration, paper P&L. All public, all auditable.";
  try {
    const stats = await getAgentStats();
    const echo = stats.rows.find((s) => s.agent_id === "echo");
    const reasoningStats = stats.rows.filter(
      (s) => s.agent_id !== "echo" && s.agent_id !== "ensemble"
    );
    const best = [...reasoningStats].sort((a, b) => a.brier_30d - b.brier_30d)[0];
    const bestAgent = best ? AGENTS.find((a) => a.id === best.agent_id) : null;
    if (echo && best && bestAgent) {
      const pctGap = Math.round(
        (Math.abs(best.brier_30d - echo.brier_30d) / echo.brier_30d) * 100
      );
      if (best.brier_30d < echo.brier_30d) {
        description = `After ${int(echo.total_scored)} resolved markets, ${bestAgent.name} beats prediction-market consensus — Brier ${num(best.brier_30d, 3)} vs ${num(echo.brier_30d, 3)}. Brier, log-loss, calibration plots — all public.`;
      } else {
        description = `After ${int(echo.total_scored)} resolved markets, market consensus (Echo) leads by ${pctGap}% Brier. Can ${bestAgent.name} close the gap? Six agents, same markets, honest scoring.`;
      }
    }
  } catch {
    // fall through to default description
  }
  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description,
      url: "https://eivra.xyz/benchmark",
      siteName: "Eivra",
      type: "website",
    },
    twitter: {
      card: "summary_large_image" as const,
      title: ogTitle,
      description,
      creator: "@deforestpeg",
      site: "@deforestpeg",
    },
  };
}

export default async function BenchmarkPage() {
  const [statsRes, disagreementsRes, alltimeRes, liveBrierRes] = await Promise.all([
    getAgentStats(),
    getDisagreements(5),
    getAgentAlltimeStats(),
    getLiveBrierScores(),
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

  // Echo's rank by Brier, used to annotate the Echo negative-P&L callout.
  const echoRankByBrier = sortedByBrier.findIndex((s) => s.agent_id === "echo") + 1;

  // Live early Brier: detect ranking reversals between live and backfill
  const liveRows = liveBrierRes.rows;
  const liveLeader = liveRows[0] ?? null;
  const liveLeaderAgent = liveLeader ? AGENTS.find((a) => a.id === liveLeader.agent_id) ?? null : null;
  const liveLeaderHueTxt = liveLeaderAgent ? HUE_TO_TEXT[liveLeaderAgent.hue] : "text-accent";
  // Reversal = live leader ≠ backfill leader (different strategies winning on live vs historical)
  const liveReversalDetected =
    liveLeader &&
    brierLeaderStat &&
    liveLeader.agent_id !== brierLeaderStat.agent_id &&
    liveRows.length >= 2;
  // Find Echo's position in live rankings for the insight narrative
  const liveEchoRow = liveRows.find((r) => r.agent_id === "echo");
  const liveEchoRank = liveEchoRow ? liveRows.indexOf(liveEchoRow) + 1 : null;
  const backfillEchoRank = sortedByBrier.findIndex((s) => s.agent_id === "echo") + 1;

  // Win-rate vs Brier insight: surfaces when the win-rate leader differs from the Brier leader
  const winRateRanked = [...stats].sort((a, b) => b.win_rate_30d - a.win_rate_30d);
  const winRateBest = winRateRanked[0];
  const winRateBestAgent = winRateBest ? AGENTS.find((a) => a.id === winRateBest.agent_id) ?? null : null;
  const showWinRateInsight =
    winRateBest && winRateBestAgent && brierLeaderStat && brierLeaderAgent &&
    winRateBest.agent_id !== brierLeaderStat.agent_id;

  // Log-loss vs Brier insight: surfaces when the log-loss leader differs from the Brier leader.
  // This happens when a contrarian agent (e.g. Hawk) wins Brier via confident correct calls, but
  // a market-following agent (e.g. Echo) wins log-loss by never making extreme wrong predictions.
  const sortedByLogLoss = [...stats].sort((a, b) => a.log_loss_30d - b.log_loss_30d);
  const logLossBest = sortedByLogLoss[0];
  const logLossBestAgent = logLossBest ? AGENTS.find((a) => a.id === logLossBest.agent_id) ?? null : null;
  const showLogLossInsight =
    logLossBest && logLossBestAgent && brierLeaderStat && brierLeaderAgent &&
    logLossBest.agent_id !== brierLeaderStat.agent_id;

  // 30d vs alltime insight: surfaces when the alltime Brier leader differs from the 30d Brier leader
  const alltimeBrierLeader = alltimeRes.rows[0] ?? null; // sorted ASC by brier_alltime in the adapter
  const alltimeBrierLeaderAgent = alltimeBrierLeader
    ? AGENTS.find((a) => a.id === alltimeBrierLeader.agent_id) ?? null
    : null;
  const alltimeLeaderHueTxt = alltimeBrierLeaderAgent
    ? HUE_TO_TEXT[alltimeBrierLeaderAgent.hue]
    : "text-accent";
  const showAlltimeVs30dInsight =
    alltimeBrierLeader !== null &&
    alltimeBrierLeaderAgent !== null &&
    brierLeaderStat !== undefined &&
    brierLeaderAgent !== null &&
    alltimeBrierLeader.agent_id !== brierLeaderStat.agent_id;

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
                {/* Reference baseline row: theoretical random-50% guesser */}
                <tr className="border-t-2 border-border-subtle opacity-50">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[9px] text-text-muted uppercase tracking-wider">ref</span>
                      <span className="font-medium text-text-muted text-sm">Random (50%)</span>
                      <span className="mono text-[10px] text-text-muted hidden sm:inline">theoretical baseline · always picks 0.5</span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-3 mono text-sm text-text-muted">0.2500</td>
                  <td className="text-right py-2 px-3 mono text-sm text-text-muted">0.693</td>
                  <td className="text-right py-2 px-3 mono text-sm text-text-muted">50.0%</td>
                  <td className="text-right py-2 px-3 mono text-sm text-text-muted">$0</td>
                  <td className="text-right py-2 px-3 mono text-sm text-text-muted">—</td>
                </tr>
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
            {echo && echo.paper_pnl_30d < 0 && (
              <p className="text-text-secondary text-sm leading-relaxed border-t border-border-subtle/40 pt-3">
                The starkest example:{" "}
                <span className="font-medium text-white">Echo</span>{" "}
                (the market-mirroring baseline) finished{" "}
                <span className="text-text-primary">#{echoRankByBrier} in Brier</span>{" "}
                at {num(echo.brier_30d, 3)} — within{" "}
                <span className="text-text-primary">
                  {num(Math.abs(echo.brier_30d - brierLeaderStat.brier_30d), 4)}
                </span>{" "}
                of the leader — yet{" "}
                <span className="text-rose-400">
                  lost {dollars(Math.abs(echo.paper_pnl_30d), 0)}
                </span>{" "}
                on Kelly bets. Shadowing the market price means edge-per-bet ≈ 0:
                even tiny miscalibrations compound into a loss when Kelly sizes bets on your
                implied edge over the market. Near-identical Brier does not equal positive-EV trading.
              </p>
            )}
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

        {/* ── Log-loss vs Brier insight ───────────────────────────── */}
        {showLogLossInsight && logLossBest && logLossBestAgent && brierLeaderStat && brierLeaderAgent && (
          <section className="panel px-5 py-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="heading text-base text-text-primary">Log-loss ≠ Brier</h2>
              <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-warn/10 text-warn">
                Counterintuitive finding
              </span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              <span className={`font-medium ${HUE_TO_TEXT[logLossBestAgent.hue]}`}>{logLossBestAgent.name}</span>{" "}
              leads on{" "}
              <Tooltip tip="Log-loss: −log(p) if the event happened, −log(1−p) if it didn't. Penalizes confident wrong predictions far more harshly than Brier — the penalty grows without bound as p approaches 0 on an incorrect high-confidence call.">
                log-loss
              </Tooltip>{" "}
              ({num(logLossBest.log_loss_30d, 3)}) while{" "}
              <span className={`font-medium ${HUE_TO_TEXT[brierLeaderAgent.hue]}`}>{brierLeaderAgent.name}</span>{" "}
              leads on Brier ({num(brierLeaderStat.brier_30d, 4)}).{" "}
              The gap reveals a strategy difference: an agent that stays close to the market price
              never makes extreme wrong calls, so its log-loss stays bounded even when it&apos;s slightly
              off. A contrarian that takes larger positions can post a lower Brier when right — squared
              error rewards confident correct calls — but risks a heavier log-loss penalty on a
              confident miss. Neither metric is strictly better; together they expose whether an
              agent&apos;s edge comes from accuracy or from risk management.
            </p>
          </section>
        )}

        {/* ── Live early results ──────────────────────────────────── */}
        {liveRows.length >= 2 && liveLeader && liveLeaderAgent && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="heading text-xl text-text-primary">Live forecast results</h2>
              <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent inline-flex items-center gap-1.5">
                <span className="live-dot" aria-hidden="true" />
                No-look-ahead · locked at submission
              </span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed max-w-3xl">
              Since live forecasting launched, agents have locked{" "}
              <span className="text-text-primary font-medium">{liveBrierRes.totalLivePredictions}</span>{" "}
              predictions on open markets — timestamped at forecast time,
              scored only after resolution. Of those,{" "}
              <span className="text-positive font-medium">{liveLeader.count}</span>{" "}
              per agent have resolved with real ground-truth outcomes.{" "}
              {liveReversalDetected && liveEchoRow && liveEchoRank && (
                <>
                  The rankings tell a different story from the backfill:{" "}
                  <span className={`font-medium ${liveLeaderHueTxt}`}>{liveLeaderAgent.name}</span>{" "}
                  leads on live markets (Brier{" "}
                  <span className="text-text-primary">{num(liveLeader.avg_brier, 3)}</span>
                  ){liveEchoRank > backfillEchoRank ? (
                    <>, while Echo — which leads the backfill — sits #{liveEchoRank} on live (Brier{" "}
                    <span className="text-rose-400">{num(liveEchoRow.avg_brier, 3)}</span>
                    ).</>
                  ) : <>.</>}
                </>
              )}
            </p>
            {liveReversalDetected && liveEchoRank && liveEchoRank > backfillEchoRank && (
              <div className="panel px-5 py-4 flex flex-col gap-2 border-warn/30">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="heading text-sm text-text-primary">Backfill ≠ Live</span>
                  <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-warn/10 text-warn">
                    Counterintuitive finding
                  </span>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">
                  On historical backfill markets, Echo (market-follower) leads — because by resolution time the market price had
                  already converged toward the outcome, making it easy to track. On truly live open markets,
                  the market price is a genuine crowd estimate under uncertainty, and that changes who wins.{" "}
                  <span className={`font-medium ${liveLeaderHueTxt}`}>{liveLeaderAgent.name}</span>,
                  which diverges from consensus, captures the gains when the crowd is wrong before
                  prices correct. Small sample — but the first real signal.
                </p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Live forecast early results by agent">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="text-left py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">Agent</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                      <Tooltip tip="Brier score on live markets only (is_backfill=false). Mean squared error between locked forecast and ground-truth outcome. Lower is better.">
                        Brier ↓
                      </Tooltip>
                    </th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal hidden sm:table-cell">
                      <Tooltip tip="Log-loss on live markets: −log(p) if the event happened, −log(1−p) if it didn't. Penalizes confident wrong predictions heavily. Lower is better; random baseline ≈ 0.693.">
                        Log-loss ↓
                      </Tooltip>
                    </th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                      <Tooltip tip="Win rate on live markets: fraction of resolved live predictions where the agent's stated probability was on the correct side of 50%.">
                        Win %
                      </Tooltip>
                    </th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                      <Tooltip tip="Backfill rank: this agent's rank on the historical backfill benchmark. Compare against live rank to spot strategy differences.">
                        Backfill rank
                      </Tooltip>
                    </th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider text-text-muted font-normal">
                      <Tooltip tip="Sample size: number of live predictions that have resolved so far.">
                        n
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {liveRows.map((row, liveRank) => {
                    const agent = AGENTS.find((a) => a.id === row.agent_id);
                    const hueTxt = agent ? HUE_TO_TEXT[agent.hue] : "text-text-primary";
                    const backfillRank = sortedByBrier.findIndex((s) => s.agent_id === row.agent_id) + 1;
                    const rankChange = backfillRank - (liveRank + 1); // positive = climbed vs backfill
                    return (
                      <tr key={row.agent_id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {liveRank === 0 && (
                              <span className="mono text-[9px] text-accent uppercase tracking-wider">★</span>
                            )}
                            <span className={`font-medium ${hueTxt}`}>{agent?.name ?? row.agent_id}</span>
                            <span className="mono text-[10px] text-text-muted hidden sm:inline">{agent?.persona}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-3 mono text-sm">{num(row.avg_brier, 3)}</td>
                        <td className="text-right py-3 px-3 mono text-sm hidden sm:table-cell">{num(row.avg_log_loss, 3)}</td>
                        <td className="text-right py-3 px-3 mono text-sm">{pct(row.win_rate, 1)}</td>
                        <td className="text-right py-3 px-3 mono text-sm">
                          <span className="text-text-muted">#{backfillRank}</span>
                          {rankChange !== 0 && (
                            <span className={`ml-1.5 mono text-[10px] ${rankChange > 0 ? "text-positive" : "text-rose-400"}`}>
                              {rankChange > 0 ? `▲${rankChange}` : `▼${Math.abs(rankChange)}`}
                            </span>
                          )}
                        </td>
                        <td className="text-right py-3 px-3 mono text-sm text-text-muted">{row.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end">
              <Link
                href="/live"
                className="mono text-[11px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors flex items-center gap-1.5"
              >
                See all live locked forecasts →
              </Link>
            </div>
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

        {/* ── 30d vs all-time insight ──────────────────────────────── */}
        {showAlltimeVs30dInsight && alltimeBrierLeader && alltimeBrierLeaderAgent && brierLeaderStat && brierLeaderAgent && (
          <section className="panel px-5 py-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="heading text-base text-text-primary">30-day ≠ all-time</h2>
              <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-warn/10 text-warn">
                Counterintuitive finding
              </span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              The 30-day leaderboard is topped by{" "}
              <span className={`font-medium ${HUE_TO_TEXT[brierLeaderAgent.hue]}`}>{brierLeaderAgent.name}</span>{" "}
              (Brier{" "}
              <span className="mono text-text-primary">{num(brierLeaderStat.brier_30d, 4)}</span>
              ), but the agent with the best <em>all-time</em> raw Brier accuracy is{" "}
              <span className={`font-medium ${alltimeLeaderHueTxt}`}>{alltimeBrierLeaderAgent.name}</span>{" "}
              (
              <span className="mono text-text-primary">{num(alltimeBrierLeader.brier_alltime, 4)}</span>{" "}
              across{" "}
              <span className="text-text-primary">{int(alltimeBrierLeader.total_scored)}</span>{" "}
              resolved markets).
              Rolling windows react to recent form — a short streak of good or bad calls can swap the leader.
              All-time Brier averages out that volatility but is slower to surface genuine shifts in strategy
              quality. Neither is wrong; together they reveal whether an agent&apos;s edge is durable or
              recency-driven.
            </p>
          </section>
        )}

        {/* ── Calibration plots ───────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="heading text-xl text-text-primary">Calibration plots</h2>
            <p className="text-text-secondary text-sm">
              When an agent says &ldquo;70%&rdquo;, does it actually
              happen 70% of the time? Diagonal = perfect calibration. Vertical
              bars ={" "}
              <Tooltip tip="Wilson interval: a confidence interval formula for proportions that stays reliable even with small bucket sizes and extreme probabilities (near 0% or 100%). More accurate than a standard normal CI when few predictions fall in a given probability bucket — common in calibration plots.">
                Wilson 95% confidence intervals
              </Tooltip>.
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
