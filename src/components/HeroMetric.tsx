import { signed, num } from "@/lib/format";
import { AGENTS } from "@/lib/agents";
import type { LiveAgentStats } from "@/lib/data";
import { Tooltip } from "@/components/Tooltip";

/**
 * Hero metric on the homepage.
 *
 * Per PLAN.md: "Agent calibration delta vs. market consensus, last 30 days"
 * Operationally: how much better/worse is the best agent's Brier than the
 * market-anchored "Echo" agent (the one that just shadows market price).
 *
 * If best agent has Brier 0.18 and Echo has Brier 0.22 → delta = -0.04 (Lower
 * Brier is better, so the best agent is "more calibrated" by 0.04).
 */
export function HeroMetric({ stats }: { stats: LiveAgentStats[] }) {
  const echo = stats.find((s) => s.agent_id === "echo");
  // 'Best agent vs market baseline' only makes sense if we EXCLUDE Echo
  // itself from the 'best' candidates — Echo IS the market baseline. If the
  // raw lowest-Brier is Echo (the market won this month), we need a
  // dedicated narrative for that case.
  const nonEchoStats = stats.filter((s) => s.agent_id !== "echo" && s.agent_id !== "ensemble");
  const bestNonEcho = [...nonEchoStats].sort((a, b) => a.brier_30d - b.brier_30d)[0];
  const lowestOverall = [...stats].sort((a, b) => a.brier_30d - b.brier_30d)[0];
  if (!echo || !bestNonEcho || !lowestOverall) return null;
  const delta = bestNonEcho.brier_30d - echo.brier_30d;
  const bestAgent = AGENTS.find((a) => a.id === bestNonEcho.agent_id);
  const beatsMarket = delta < 0;
  // % improvement/gap vs market baseline — more readable to a first-time visitor than raw delta
  const pctVsMarket = echo.brier_30d > 0
    ? Math.round(Math.abs(delta) / echo.brier_30d * 100)
    : 0;
  // Special case: the market baseline itself has the lowest Brier this month.
  // No agent has beaten it. Frame the panel as 'market still on top.'
  const marketWonOutright = lowestOverall.agent_id === "echo";

  const isTight = pctVsMarket < 5;
  // Win-rate reversal: reasoning agent beats Echo on directional calls even while trailing on Brier
  const winRateDelta = bestNonEcho.win_rate_30d - echo.win_rate_30d;
  const winRateReversed = winRateDelta > 0;
  // When gap rounds to 0 (sub-0.5% difference), show "<1%" instead of "0%"
  const pctDisplay = pctVsMarket === 0 ? "<1" : String(pctVsMarket);

  if (marketWonOutright) {
    return (
      <div className="panel panel-live px-7 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
            {isTight
              ? "This month, the race is razor-thin"
              : "This month, the market is still on top"}
          </div>
          <div className="text-text-primary text-lg sm:text-xl leading-snug">
            {isTight ? (
              <>
                <span className="text-accent font-semibold">{bestAgent?.name}</span>{" "}
                is within{" "}
                <span className="text-warn font-semibold">{pctDisplay}%</span>{" "}
                of market consensus on Brier — a gap smaller than sampling noise.
                {winRateReversed ? (
                  <> But on directional accuracy,{" "}
                    <span className="text-positive font-semibold">{bestAgent?.name} leads</span>:{" "}
                    <span className="text-positive">{(bestNonEcho.win_rate_30d * 100).toFixed(1)}%</span>{" "}
                    vs Echo&apos;s{" "}
                    <span className="text-text-secondary">{(echo.win_rate_30d * 100).toFixed(1)}%</span>{" "}
                    win rate.
                  </>
                ) : (
                  <> Prediction-market prices (Echo) hold a{" "}
                    <span className="text-warn">{signed(delta, 4)} Brier</span> edge right now.
                  </>
                )}
              </>
            ) : (
              <>
                <span className="text-text-secondary font-semibold">No agent</span> has
                beaten the market baseline this month. The best non-baseline agent —{" "}
                <span className="text-accent font-semibold">{bestAgent?.name}</span> —
                trails market-prior (Echo) by{" "}
                <span className="text-rose-400">{pctVsMarket}%</span>{" "}
                on Brier.
              </>
            )}
          </div>
          <div className="mono text-[11px] text-text-muted leading-relaxed">
            <Tooltip tip="Brier score: mean squared error between predicted probability and outcome (0 or 1). Range 0–1. Lower is better — 0 is perfect, 0.25 is chance.">
              Brier
            </Tooltip>
            {" "}
            <span className="text-text-primary">{num(bestNonEcho.brier_30d, 4)}</span>
            {" "}vs market{" "}
            <span className="text-text-secondary">{num(echo.brier_30d, 4)}</span>
            {" · "}
            <Tooltip tip="Brier delta: best non-baseline agent's Brier minus Echo's (market-anchor). Positive = market is still ahead.">
              delta
            </Tooltip>
            {" "}
            <span className={isTight ? "text-warn" : "text-rose-400"}>
              {signed(delta, 4)}
            </span>
            {winRateReversed && (
              <>
                {" · "}
                <Tooltip tip="Win rate: fraction of resolved predictions where the agent's stated probability was on the correct side of 50%.">
                  win rate
                </Tooltip>
                {" "}
                <span className="text-positive">{(bestNonEcho.win_rate_30d * 100).toFixed(1)}%</span>
                {" "}vs market{" "}
                <span className="text-text-secondary">{(echo.win_rate_30d * 100).toFixed(1)}%</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
          <div className={`heading text-4xl sm:text-5xl tabular-nums ${isTight ? "text-warn" : "text-rose-400"}`}>
            +{pctDisplay}%
          </div>
          <div className="mono text-[11px] text-text-muted uppercase tracking-wider">
            {isTight ? "gap vs market baseline" : "behind market baseline"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel panel-live px-7 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
          {isTight && beatsMarket
            ? "This month, a reasoning agent leads market consensus — slim but real"
            : `This month, the best agent ${beatsMarket ? "beats" : "trails"} the market`}
        </div>
        <div className="text-text-primary text-lg sm:text-xl leading-snug">
          {isTight && beatsMarket ? (
            <>
              <span className="text-accent font-semibold">{bestAgent?.name}</span>{" "}
              holds a{" "}
              <span className="text-positive">{pctDisplay}% Brier edge</span>{" "}
              over market consensus after{" "}
              <span className="text-text-primary">{bestNonEcho.total_scored.toLocaleString()}</span>{" "}
              resolved markets — a live margin that updates every 12 hours.
            </>
          ) : (
            <>
              <span className="text-accent font-semibold">{bestAgent?.name}</span> is
              the most accurate agent this month,{" "}
              {beatsMarket
                ? <><span className="text-positive">{pctDisplay}% better Brier</span> than</>
                : `${pctDisplay}% behind`
              }{" "}the market baseline (Echo, which just mirrors prediction-market prices).
            </>
          )}
        </div>
        <div className="mono text-[11px] text-text-muted leading-relaxed">
          <Tooltip tip="Brier score: mean squared error between predicted probability and outcome (0 or 1). Range 0–1. Lower is better — 0 is perfect, 0.25 is chance.">
            Brier
          </Tooltip>
          {" "}
          <span className="text-text-primary">{num(bestNonEcho.brier_30d, 4)}</span>
          {" "}vs market{" "}
          <span className="text-text-secondary">{num(echo.brier_30d, 4)}</span>
          {" · "}
          <Tooltip tip="Brier delta: best non-baseline agent's Brier minus Echo's (market-anchor) Brier. Negative = beats the market. Lower Brier is better.">
            delta
          </Tooltip>
          {" "}
          <span className={beatsMarket ? "text-positive" : "text-rose-400"}>
            {signed(delta, 4)}
          </span>
          {" · "}
          <Tooltip tip="Win rate: fraction of resolved predictions where the agent's stated probability was on the correct side of 50%. A coin flip scores 50%.">
            win rate
          </Tooltip>
          {" "}
          <span className="text-text-primary">{(bestNonEcho.win_rate_30d * 100).toFixed(1)}%</span>
          {" "}vs market{" "}
          <span className="text-text-secondary">{(echo.win_rate_30d * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
        <div
          className={`heading text-4xl sm:text-5xl tabular-nums ${
            beatsMarket ? "text-positive" : "text-rose-400"
          }`}
        >
          {beatsMarket ? "+" : ""}{pctDisplay}%
        </div>
        <div className="mono text-[11px] text-text-muted uppercase tracking-wider">
          {beatsMarket
            ? (isTight ? "Brier edge vs market baseline" : "better Brier than market")
            : "behind market baseline"}
        </div>
      </div>
    </div>
  );
}
