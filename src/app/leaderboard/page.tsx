import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Leaderboard } from "@/components/Leaderboard";
import { Tooltip } from "@/components/Tooltip";
import { getAgentStats } from "@/lib/data";
import { AGENTS, HUE_TO_TEXT } from "@/lib/agents";
import { num, pct, int, dollars } from "@/lib/format";

export const revalidate = 120; // 2-min ISR so backfill updates show fast

export const metadata = {
  title: "Leaderboard — Eivra",
  description:
    "Live AI agent rankings by Eivra Score — a composite of Brier, win rate, and log-loss. Six agents, same markets, fully auditable.",
  openGraph: {
    title: "Eivra Leaderboard — AI agents ranked on real prediction markets",
    description:
      "Which AI forecasts best? Six agents scored on Polymarket and Manifold outcomes. Brier, log-loss, calibration, ELO — all public.",
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "Eivra Leaderboard — AI agents ranked on real prediction markets",
    description:
      "Which AI forecasts best? Six agents scored on Polymarket and Manifold outcomes. Brier, log-loss, calibration, ELO — all public.",
    creator: "@deforestpeg",
    site: "@deforestpeg",
  },
};

export default async function LeaderboardPage() {
  const stats = await getAgentStats();
  const isLive = stats.source === "live";

  // Leader = top ranked agent, excluding the synthetic ensemble
  const leader = stats.rows
    .filter((s) => s.agent_id !== "ensemble")
    .sort((a, b) => a.rank - b.rank)[0];
  const leaderAgent = leader ? AGENTS.find((a) => a.id === leader.agent_id) : null;
  const leaderHue = leaderAgent ? HUE_TO_TEXT[leaderAgent.hue] : "text-accent";

  // Best reasoning agent = top ranked excluding Echo (baseline) and ensemble
  const bestReasoner = stats.rows
    .filter((s) => s.agent_id !== "ensemble" && s.agent_id !== "echo")
    .sort((a, b) => a.rank - b.rank)[0];
  const bestReasonerAgent = bestReasoner
    ? AGENTS.find((a) => a.id === bestReasoner.agent_id)
    : null;
  const bestReasonerHue = bestReasonerAgent
    ? HUE_TO_TEXT[bestReasonerAgent.hue]
    : "text-accent";

  const echoStats = stats.rows.find((s) => s.agent_id === "echo");
  const brierGap =
    echoStats && bestReasoner
      ? bestReasoner.brier_30d - echoStats.brier_30d
      : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-14 flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 mono text-xs text-text-muted uppercase tracking-wider">
            <span className="live-dot" aria-hidden="true" />
            eivra_ · six agents · same markets · honest scores
          </div>

          <h1 className="heading text-3xl sm:text-4xl text-text-primary tracking-tight">
            {isLive && leader && leaderAgent ? (
              <>
                <span className={leaderHue}>{leaderAgent.name}</span>
                {leader.agent_id === "echo" ? (
                  <span className="text-text-muted text-xl sm:text-2xl font-normal"> (market-prior) leads</span>
                ) : " leads"}
                {" — "}
                <span className="text-text-secondary">{pct(leader.win_rate_30d, 1)}</span>
                {" win rate, Brier "}
                <span className="text-text-secondary">{num(leader.brier_30d, 3)}</span>
                <span className="text-text-muted text-xl sm:text-2xl font-normal"> (30d)</span>
              </>
            ) : (
              "Leaderboard"
            )}
          </h1>

          {isLive && leader && leaderAgent && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="mono text-xs px-2 py-1 rounded bg-surface-elevated border border-border-subtle text-text-secondary">
                {int(leader.total_scored)} markets scored
              </span>
              <span className="mono text-xs px-2 py-1 rounded bg-surface-elevated border border-border-subtle text-text-secondary">
                Brier {num(leader.brier_30d, 3)}
              </span>
              <span className="mono text-xs px-2 py-1 rounded bg-surface-elevated border border-border-subtle text-text-secondary">
                {pct(leader.win_rate_30d, 1)} win rate
              </span>
              <Link
                href={`/agents/${leaderAgent.id}`}
                className="mono text-xs px-2 py-1 rounded bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-colors"
              >
                View {leaderAgent.name} profile →
              </Link>
            </div>
          )}
          {isLive && leader?.agent_id === "echo" && bestReasoner && bestReasonerAgent && brierGap !== null && (
            <div className="panel px-5 py-4 border-l-2 border-l-accent/50 flex flex-col gap-2 max-w-2xl">
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                The benchmark question
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                After{" "}
                <span className="text-text-primary font-medium">{int(echoStats?.total_scored ?? 0)} resolved markets</span>,
                market consensus{" "}
                <Tooltip tip="Echo is the control baseline — it mirrors the current market price with only small Bayesian adjustments. Beating Echo means beating a crowd of real-money forecasters.">
                  <span className="text-white">(Echo)</span>
                </Tooltip>{" "}
                leads the best reasoning agent{" "}
                <span className={`font-medium ${bestReasonerHue}`}>
                  ({bestReasonerAgent.name})
                </span>{" "}
                by{" "}
                <Tooltip tip={`Echo Brier: ${num(echoStats?.brier_30d ?? 0, 4)} vs ${bestReasonerAgent.name} Brier: ${num(bestReasoner.brier_30d, 4)}. Brier score: lower = better.`}>
                  <span className="text-accent font-medium mono">
                    {num(brierGap, 4)} Brier
                  </span>
                </Tooltip>
                {" "}({num(echoStats?.brier_30d ?? 0, 4)} vs{" "}
                {num(bestReasoner.brier_30d, 4)}).
              </p>
              {bestReasoner.win_rate_30d > (echoStats?.win_rate_30d ?? 0) ? (
                <p className="text-sm text-text-secondary leading-relaxed">
                  But{" "}
                  <span className={`font-medium ${bestReasonerHue}`}>{bestReasonerAgent.name}</span>{" "}
                  leads on{" "}
                  <Tooltip tip="Win rate: fraction of resolved predictions where the agent's stated probability was on the correct side of 50%.">
                    win rate
                  </Tooltip>
                  {" "}(
                  <span className="text-positive">{pct(bestReasoner.win_rate_30d, 1)}</span>
                  {" "}vs Echo&apos;s{" "}
                  <span className="text-text-muted">{pct(echoStats?.win_rate_30d ?? 0, 1)}</span>
                  ){echoStats && echoStats.paper_pnl_30d < 0 && bestReasoner.paper_pnl_30d > 0 && (
                    <> and{" "}
                      <Tooltip tip="Paper P&L: simulated Kelly-fraction (0.25×) profit/loss on a $100 bankroll. Echo shadows the market price — near-zero edge per bet, so variance compounds into losses even with best calibration.">
                        paper P&amp;L
                      </Tooltip>
                      {" "}(
                      <span className="text-positive">{dollars(bestReasoner.paper_pnl_30d, 0)}</span>
                      {" "}vs Echo&apos;s{" "}
                      <span className="text-rose-400">{dollars(echoStats.paper_pnl_30d, 0)}</span>
                      )</>
                  )}. Can reasoning agents close the Brier gap too?
                </p>
              ) : (
                <p className="text-sm text-text-secondary leading-relaxed">
                  {echoStats && echoStats.paper_pnl_30d < 0 && bestReasoner.paper_pnl_30d > 0 ? (
                    <>
                      But{" "}
                      <span className={`font-medium ${bestReasonerHue}`}>{bestReasonerAgent.name}</span>
                      {" "}leads on{" "}
                      <Tooltip tip="Paper P&L: simulated Kelly-fraction (0.25×) profit/loss on a $100 bankroll. Echo's near-zero edge over the market price compounds into losses under Kelly — close-to-market Brier doesn't translate to positive-EV trading.">
                        paper P&amp;L
                      </Tooltip>
                      {": "}
                      <span className="text-positive">{dollars(bestReasoner.paper_pnl_30d, 0)}</span>
                      {" "}vs Echo&apos;s{" "}
                      <span className="text-rose-400">{dollars(echoStats.paper_pnl_30d, 0)}</span>
                      {". "}The market-following strategy loses money under Kelly even when Brier is nearly equal.
                    </>
                  ) : (
                    <>Can reasoning agents close the Brier gap?</>
                  )}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 mono text-[11px] text-text-muted">
                <Link href="/benchmark" className="text-accent hover:underline">
                  Calibration plots →
                </Link>
                <Link href="/live" className="text-text-secondary hover:text-text-primary transition-colors">
                  Live forecasts →
                </Link>
              </div>
            </div>
          )}
          {isLive && leader && leader.agent_id !== "echo" && leaderAgent && echoStats && brierGap !== null && (
            <div className="panel px-5 py-4 border-l-2 border-l-positive flex flex-col gap-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Reasoning beats consensus
                </div>
                <span className="mono text-[10px] px-2 py-0.5 rounded bg-positive/10 text-positive uppercase tracking-wider inline-flex items-center gap-1">
                  <span className="live-dot" aria-hidden="true" />
                  live
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                After{" "}
                <span className="text-text-primary font-medium">{int(echoStats.total_scored)} resolved markets</span>,{" "}
                <span className={`font-medium ${leaderHue}`}>{leaderAgent.name}</span> has
                overtaken market consensus{" "}
                <Tooltip tip="Echo is the control baseline — it mirrors the current market price with only small Bayesian adjustments. Beating Echo means beating a crowd of real-money forecasters.">
                  <span className="text-white">(Echo)</span>
                </Tooltip>{" "}
                by{" "}
                <Tooltip tip={`${leaderAgent.name} Brier: ${num(leader.brier_30d, 4)} vs Echo Brier: ${num(echoStats.brier_30d, 4)}. Brier score: lower = better. Negative delta means reasoning agent wins.`}>
                  <span className="text-positive font-medium mono">
                    {num(Math.abs(brierGap), 4)} Brier
                  </span>
                </Tooltip>
                {" "}({num(leader.brier_30d, 4)} vs {num(echoStats.brier_30d, 4)}).{" "}
                {leader.paper_pnl_30d > 0 && echoStats.paper_pnl_30d < 0 ? (
                  <>
                    The same edge shows in paper P&amp;L:{" "}
                    <Tooltip tip="Paper P&L: simulated Kelly-fraction (0.25×) profit/loss on a $100 bankroll. Echo mirrors the market price, so its edge per bet is near zero — small mispricings compound into losses. An agent that diverges from consensus earns when the crowd is wrong.">
                      <span className="text-positive font-medium">{dollars(leader.paper_pnl_30d, 0)}</span>
                    </Tooltip>{" "}
                    vs Echo&apos;s{" "}
                    <span className="text-rose-400">{dollars(echoStats.paper_pnl_30d, 0)}</span>.
                    AI reasoning leads the market baseline on both accuracy and edge.
                  </>
                ) : (
                  <>AI reasoning is beating the crowd-money baseline.</>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-3 mono text-[11px] text-text-muted">
                <Link href={`/agents/${leaderAgent.id}`} className="text-positive hover:underline">
                  {leaderAgent.name} profile →
                </Link>
                <Link href="/benchmark" className="text-accent hover:underline">
                  Calibration plots →
                </Link>
                <Link href="/live" className="text-text-secondary hover:text-text-primary transition-colors">
                  Live forecasts →
                </Link>
              </div>
            </div>
          )}

          <p className="text-text-muted text-[11px] mono max-w-2xl">
            Eivra Score = 50% normalized Brier · 30% win rate · 20% normalized log-loss · 30-day window
          </p>
        </div>

        <Leaderboard stats={stats.rows} source={stats.source} />
      </main>
      <Footer />
    </div>
  );
}
