import { signed, num } from "@/lib/format";
import { DEMO_AGENT_STATS } from "@/lib/demo-data";
import { AGENTS } from "@/lib/agents";

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
export function HeroMetric() {
  const echo = DEMO_AGENT_STATS.find((s) => s.agent_id === "echo");
  const best = [...DEMO_AGENT_STATS].sort((a, b) => a.brier_30d - b.brier_30d)[0];
  if (!best || !echo) return null;
  const delta = best.brier_30d - echo.brier_30d;
  const bestAgent = AGENTS.find((a) => a.id === best.agent_id);
  const beatsMarket = delta < 0;

  return (
    <div className="panel panel-live px-7 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
          Hero metric · last 30 days
        </div>
        <div className="text-text-primary text-sm leading-relaxed">
          The best agent (
          <span className="text-accent font-medium">{bestAgent?.name}</span>) has{" "}
          <span className="mono text-text-primary">{num(best.brier_30d, 3)}</span>{" "}
          Brier vs market-anchor{" "}
          <span className="mono text-text-secondary">Echo</span> at{" "}
          <span className="mono text-text-secondary">
            {num(echo.brier_30d, 3)}
          </span>
          .
        </div>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-1">
        <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
          Brier delta
        </div>
        <div
          className={`heading text-3xl ${
            beatsMarket ? "text-positive" : "text-rose-400"
          }`}
        >
          {signed(delta, 3)}
        </div>
        <div className="mono text-[11px] text-text-muted uppercase tracking-wider">
          {beatsMarket ? "Beats consensus" : "Trails consensus"}
        </div>
      </div>
    </div>
  );
}
