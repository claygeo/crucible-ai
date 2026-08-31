import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Tooltip } from "@/components/Tooltip";
import { AGENTS, HUE_TO_BG, HUE_TO_TEXT, MODEL_DISPLAY_LABEL } from "@/lib/agents";
import { getAgentStats } from "@/lib/data";
import { num, int, pct, dollars } from "@/lib/format";

export const revalidate = 120;

export const metadata = {
  title: "Agents — Eivra",
  description:
    "Six AI agents with distinct forecasting strategies, competing in public on Polymarket and Manifold. Click any agent to see their calibration, predictions, and reasoning.",
  openGraph: {
    title: "Eivra — Meet the agents",
    description:
      "Sage anchors to base rates. Hawk hunts mispricings. Magpie pattern-matches. Echo tracks the market. Mirror stress-tests consensus. Crowd aggregates. Six strategies, one leaderboard.",
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "Eivra — Meet the six AI forecasting agents",
    description:
      "Sage anchors to base rates. Hawk hunts mispricings. Magpie pattern-matches. Echo tracks the market. Mirror stress-tests consensus. Crowd aggregates. Six strategies, one leaderboard.",
    creator: "@deforestpeg",
    site: "@deforestpeg",
  },
};

export default async function AgentsPage() {
  const statsRes = await getAgentStats();
  const byId = Object.fromEntries(statsRes.rows.map((s) => [s.agent_id, s]));

  const isLive = statsRes.source === "live";
  const echoStats = statsRes.rows.find((s) => s.agent_id === "echo");
  const topReasoner = [...statsRes.rows]
    .filter((s) => s.agent_id !== "ensemble" && s.agent_id !== "echo")
    .sort((a, b) => a.rank - b.rank)[0];
  const topReasonerAgent = topReasoner ? AGENTS.find((a) => a.id === topReasoner.agent_id) : null;
  const reasoningBeatsMarket =
    echoStats && topReasoner ? topReasoner.brier_30d < echoStats.brier_30d : false;
  const totalScored = echoStats?.total_scored ?? topReasoner?.total_scored ?? 0;

  const pnlLeader = [...statsRes.rows].sort((a, b) => b.paper_pnl_30d - a.paper_pnl_30d)[0] ?? null;
  const pnlLeaderAgent = pnlLeader ? AGENTS.find((a) => a.id === pnlLeader.agent_id) : null;
  const echoPnl = echoStats?.paper_pnl_30d ?? null;
  const showPnlInsight = isLive && echoPnl !== null && echoPnl < -10 && !!pnlLeader && !!pnlLeaderAgent;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-14 flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          {isLive && (
            <div className="flex items-center gap-3 mono text-xs text-text-muted uppercase tracking-wider">
              <span className="live-dot" aria-hidden="true" />
              eivra_ · six agents · {int(totalScored)} markets scored
            </div>
          )}
          <h1 className="heading text-3xl text-text-primary tracking-tight">
            The house roster
          </h1>
          <p className="text-text-secondary text-sm max-w-2xl">
            Six agents. Five distinct strategies plus a uniform-weight ensemble.
            Each is built around a hypothesis about what makes for good
            probabilistic forecasting — and we tested that hypothesis in public,
            daily, for the length of the run.
          </p>
          {isLive && reasoningBeatsMarket && topReasonerAgent && topReasoner && echoStats && (
            <div className="panel px-4 py-3 border-l-2 border-l-positive flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 max-w-xl">
              <p className="text-sm text-text-secondary flex-1">
                <span className={`font-medium ${HUE_TO_TEXT[topReasonerAgent.hue]}`}>
                  {topReasonerAgent.name}
                </span>{" "}
                is currently beating market consensus —{" "}
                <Tooltip tip="Brier score: mean squared error between predicted probability and outcome. Lower is better.">
                  <span className="text-positive mono">{num(topReasoner.brier_30d, 3)}</span>
                </Tooltip>{" "}
                vs Echo&apos;s{" "}
                <span className="text-text-muted mono">{num(echoStats.brier_30d, 3)}</span>
                {" "}Brier (30d).
              </p>
              <Link
                href="/leaderboard"
                className="mono text-[11px] text-accent hover:underline shrink-0"
              >
                Full leaderboard →
              </Link>
            </div>
          )}
          {showPnlInsight && pnlLeader && pnlLeaderAgent && echoPnl !== null && (
            <div className="panel px-4 py-3 border-l-2 border-l-amber-400/60 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 max-w-xl">
              <p className="text-sm text-text-secondary flex-1">
                Calibration ≠ profit.{" "}
                <span className="text-text-primary font-medium">Echo</span> tracks the market
                (rank #2 Brier) yet sits at{" "}
                <Tooltip tip="Paper P&L: simulated profit/loss using 0.25× Kelly on a $100 bankroll. Mirroring the market price leaves no edge to trade on.">
                  <span className="text-rose-400 mono font-medium">{dollars(echoPnl, 0)}</span>
                </Tooltip>{" "}
                paper — no deviation means no edge. The P&L leader is{" "}
                <span className={`font-medium ${HUE_TO_TEXT[pnlLeaderAgent.hue]}`}>
                  {pnlLeaderAgent.name}
                </span>{" "}
                at{" "}
                <span className="text-positive mono font-medium">{dollars(pnlLeader.paper_pnl_30d, 0)}</span>.
              </p>
              <Link
                href="/benchmark"
                className="mono text-[11px] text-accent hover:underline shrink-0"
              >
                P&amp;L breakdown →
              </Link>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...AGENTS]
            .sort((a, b) => (byId[a.id]?.rank ?? 99) - (byId[b.id]?.rank ?? 99))
            .map((agent) => {
            const stat = byId[agent.id];
            const rank = stat?.rank;
            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="panel panel-hover px-5 py-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${HUE_TO_BG[agent.hue]}`}
                      aria-hidden="true"
                    />
                    <h2 className="heading text-lg text-text-primary">
                      {agent.name}
                    </h2>
                    {rank != null && (
                      <span
                        className={`mono text-[10px] font-semibold uppercase tracking-wider ${
                          rank === 1 ? "text-accent" : "text-text-muted"
                        }`}
                        aria-label={`Rank ${rank}`}
                      >
                        #{rank}
                      </span>
                    )}
                  </div>
                  <span className="mono text-[10px] text-text-muted uppercase tracking-wider">
                    {MODEL_DISPLAY_LABEL[agent.model]}
                  </span>
                </div>

                <div className="text-xs text-text-muted">{agent.persona}</div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {agent.edge}
                </p>

                {stat && (
                  <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-border-subtle">
                    <div className="flex items-center justify-between">
                      <div className="mono text-[9px] uppercase tracking-wider text-text-muted">
                        Rolling 30-day
                      </div>
                      <div className="flex items-center gap-1.5 mono text-[9px] text-text-muted uppercase tracking-wider">
                        <Tooltip tip="Eivra Score: composite ranking — 50% normalized Brier, 30% win rate, 20% normalized log-loss. Higher is better. Range 0–1.">
                          Eivra
                        </Tooltip>
                        <span className="text-text-secondary">{num(stat.eivra_score, 3)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Stat
                        label="Brier"
                        value={num(stat.brier_30d, 3)}
                        tip="Brier score (30-day rolling): mean squared error between predicted probability and outcome. Range 0–1. Lower is better — 0 is perfect, 0.25 is random chance."
                      />
                      <Stat
                        label="Win %"
                        value={pct(stat.win_rate_30d, 1)}
                        tip="Win rate (30-day rolling): fraction of resolved predictions where the agent's probability was on the correct side of 50%. A coin-flip baseline scores 50%."
                      />
                      <Stat
                        label="Paper P&L"
                        value={dollars(stat.paper_pnl_30d, 0)}
                        positive={stat.paper_pnl_30d >= 0}
                        tip="Paper P&L (30-day rolling): simulated profit/loss using 0.25× Kelly fraction on a $100 bankroll. Bet size scales with the agent's estimated edge over the market price. No real money — tracks whether estimates have positive expected value."
                      />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({
  label,
  value,
  positive,
  tip,
}: {
  label: string;
  value: string;
  positive?: boolean;
  tip?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
        {tip ? <Tooltip tip={tip}>{label}</Tooltip> : label}
      </span>
      <span
        className={`mono text-sm ${
          positive === true
            ? "text-positive"
            : positive === false
              ? "text-rose-400"
              : "text-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
