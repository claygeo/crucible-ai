import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { num, dollars, pct, int } from "@/lib/format";
import { AGENTS, HUE_TO_BG } from "@/lib/agents";
import type { LiveAgentStats } from "@/lib/data";
import { Tooltip } from "@/components/Tooltip";

export function Leaderboard({
  stats,
  source = "demo",
  rankingBasis = "30-day window · resolved markets · Eivra Score ↑",
}: {
  stats: LiveAgentStats[];
  source?: "live" | "demo";
  rankingBasis?: string;
}) {
  if (stats.length === 0) {
    return (
      <section className="panel panel-live">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="heading text-base text-text-primary">Leaderboard</h2>
        </div>
        <div className="px-5 py-8 text-text-muted text-sm mono">
          [WARMING UP] No scored predictions yet. First scores in ~6h.
        </div>
      </section>
    );
  }

  return (
    <section className="panel panel-live">
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-border-subtle">
        <h2 className="heading text-base text-text-primary flex items-center gap-3 shrink-0">
          Leaderboard
          <span
            className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
              source === "live"
                ? "bg-positive/10 text-positive"
                : "bg-warn/10 text-warn"
            }`}
          >
            {source}
          </span>
        </h2>
        <div className="mono text-xs text-text-muted uppercase tracking-wider hidden sm:block truncate">
          {rankingBasis}
        </div>
      </div>

      <div className="overflow-x-auto" role="region" aria-label="Agent leaderboard table">
        <table className="w-full" aria-label="Agent leaderboard">
          <thead>
            <tr className="border-b border-border-subtle text-text-muted">
              <th scope="col" className="px-4 py-2 text-left mono text-[10px] uppercase tracking-wider">
                Rank
              </th>
              <th scope="col" className="px-4 py-2 text-left mono text-[10px] uppercase tracking-wider">
                Agent
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                <Tooltip tip="Eivra Score: composite ranking — 50% normalized Brier, 30% win rate, 20% normalized log-loss. Higher = better.">
                  Eivra ↑
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                <Tooltip tip="Brier score: mean squared error between predicted probability and outcome (0 or 1). Range 0–1. Lower is better — 0 is perfect, 0.25 is chance.">
                  Brier ↓
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider hidden sm:table-cell">
                <Tooltip tip="Log-loss: −log(p) if the event happened, −log(1−p) if it didn't. Penalizes confident wrong predictions heavily. Lower is better.">
                  Log-loss ↓
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                <Tooltip tip="Win rate: fraction of resolved predictions where the agent's stated probability was on the correct side of 50%. A coin-flip baseline scores 50%.">
                  Win %
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider hidden md:table-cell">
                <Tooltip tip="Paper P&L: simulated profit/loss if the agent bet $1 on each prediction at its stated probability. No real money — tracks whether probability estimates have positive expected value.">
                  Paper P&amp;L
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider hidden md:table-cell">
                <Tooltip tip="Picks: total number of predictions this agent has made, including markets still open. Scored count may be lower.">
                  Picks
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider hidden sm:table-cell">
                <Tooltip tip="24-hour rank change: how many places this agent's rank has moved since yesterday. ↑ = improved, ↓ = fell.">
                  24h rank
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Find the best-ranked reasoning agent (not Echo baseline, not synthetic ensemble).
              // stats is rank-sorted, so the first qualifying entry is the top reasoner.
              const topReasoningId = stats.find((s) => {
                const a = AGENTS.find((ag) => ag.id === s.agent_id);
                return a && !a.synthetic && s.agent_id !== "echo";
              })?.agent_id;
              return stats.map((s) => {
              const agent = AGENTS.find((a) => a.id === s.agent_id);
              if (!agent) return null;
              const isBaseline = agent.id === "echo";
              const isEnsemble = agent.synthetic;
              // Highlight the top-ranked reasoning agent (not baseline, not ensemble)
              const isTopReasoning = !isBaseline && !isEnsemble && agent.id === topReasoningId;
              const delta = s.rank_delta_24h;
              return (
                <tr
                  key={s.agent_id}
                  className={`border-b border-border-subtle/60 panel-hover transition-colors ${
                    isTopReasoning ? "border-l-2 border-l-accent" : isBaseline ? "border-l-2 border-l-border-subtle" : ""
                  }`}
                >
                  <td className="px-4 py-3 mono text-text-secondary">
                    {String(s.rank).padStart(2, "0")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/agents/${agent.id}`}
                      className="flex items-center gap-3 group"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ring-2 ring-offset-2 ring-offset-panel ${HUE_TO_BG[agent.hue]}`}
                        aria-hidden="true"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="text-text-primary text-sm group-hover:text-accent transition-colors">
                            {agent.name}
                          </span>
                          {isBaseline && (
                            <span
                              className="mono text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-border-subtle/80 text-text-muted leading-none"
                              title="Echo mirrors the market price — it's the control baseline, not a reasoning agent"
                            >
                              baseline
                            </span>
                          )}
                          {isEnsemble && (
                            <span
                              className="mono text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-border-subtle/80 text-text-muted leading-none"
                              title="Crowd is a uniform-weight average of all non-abstaining agents"
                            >
                              ensemble
                            </span>
                          )}
                        </span>
                        <span className="text-text-muted text-xs">
                          {agent.persona}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 mono text-right text-text-primary">
                    {num(s.eivra_score, 3)}
                  </td>
                  <td className="px-4 py-3 mono text-right text-text-secondary">
                    {num(s.brier_30d, 4)}
                  </td>
                  <td className="px-4 py-3 mono text-right text-text-secondary hidden sm:table-cell">
                    {num(s.log_loss_30d, 3)}
                  </td>
                  <td className="px-4 py-3 mono text-right text-text-secondary">
                    {pct(s.win_rate_30d, 1)}
                  </td>
                  <td
                    className={`px-4 py-3 mono text-right hidden md:table-cell ${
                      s.paper_pnl_30d >= 0 ? "text-positive" : "text-rose-400"
                    }`}
                  >
                    {dollars(s.paper_pnl_30d, 2)}
                  </td>
                  <td className="px-4 py-3 mono text-right text-text-muted hidden md:table-cell">
                    {int(s.total_predictions)}
                  </td>
                  <td className="px-4 py-3 mono text-right text-xs hidden sm:table-cell">
                    {delta > 0 ? (
                      <span className="text-accent flex items-center justify-end gap-1" aria-label={`Rose ${delta} place${delta === 1 ? "" : "s"}`}>
                        <ArrowUp size={12} aria-hidden="true" />
                        {delta}
                      </span>
                    ) : delta < 0 ? (
                      <span className="text-text-muted flex items-center justify-end gap-1" aria-label={`Fell ${Math.abs(delta)} place${Math.abs(delta) === 1 ? "" : "s"}`}>
                        <ArrowDown size={12} aria-hidden="true" />
                        {Math.abs(delta)}
                      </span>
                    ) : (
                      <span className="text-text-muted" aria-label="No change">—</span>
                    )}
                  </td>
                </tr>
              );
            });
            })()}
          </tbody>
        </table>
      </div>
    </section>
  );
}
