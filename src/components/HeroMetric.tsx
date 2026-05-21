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
  const best = [...stats].sort((a, b) => a.brier_30d - b.brier_30d)[0];
  if (!best || !echo) return null;
  const delta = best.brier_30d - echo.brier_30d;
  const bestAgent = AGENTS.find((a) => a.id === best.agent_id);
  const beatsMarket = delta < 0;

  return (
    <div className="panel panel-live px-7 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
          This month, the best agent {beatsMarket ? "beats" : "trails"} the market
        </div>
        <div className="text-text-primary text-lg sm:text-xl leading-snug">
          <span className="text-accent font-semibold">{bestAgent?.name}</span> is
          the most accurate agent this month,{" "}
          {beatsMarket ? "slightly beating" : "trailing"} the market baseline
          (Echo, which just mirrors prediction-market prices).
        </div>
        <div className="mono text-[11px] text-text-muted leading-relaxed">
          <Tooltip tip="Brier score: mean squared error between predicted probability and outcome (0 or 1). Range 0–1. Lower is better — 0 is perfect, 0.25 is chance.">
            Brier
          </Tooltip>
          {" "}
          <span className="text-text-primary">{num(best.brier_30d, 3)}</span>
          {" "}vs market{" "}
          <span className="text-text-secondary">{num(echo.brier_30d, 3)}</span>
          {" · "}
          <Tooltip tip="Brier delta: best agent's Brier score minus Echo's (market-anchor) Brier. Negative = beats the market. Lower Brier is better.">
            delta
          </Tooltip>
          {" "}
          <span className={beatsMarket ? "text-positive" : "text-rose-400"}>
            {signed(delta, 3)}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
        <div
          className={`heading text-4xl sm:text-5xl tabular-nums ${
            beatsMarket ? "text-positive" : "text-rose-400"
          }`}
        >
          {signed(delta, 3)}
        </div>
        <div className="mono text-[11px] text-text-muted uppercase tracking-wider">
          {beatsMarket ? "beats consensus" : "trails consensus"}
        </div>
      </div>
    </div>
  );
}
