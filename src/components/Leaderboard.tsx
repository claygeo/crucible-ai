import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { num, dollars, pct, int } from "@/lib/format";
import { AGENTS } from "@/lib/agents";
import type { LiveAgentStats } from "@/lib/data";
import { Tooltip } from "@/components/Tooltip";

export function Leaderboard({
  stats,
  source = "demo",
  rankingBasis = "All-time · Resolved markets only · Sorted by Eivra Score ↓",
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
      <div className="px-5 py-4 flex items-center justify-between border-b border-border-subtle">
        <h2 className="heading text-base text-text-primary flex items-center gap-3">
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
        <div className="mono text-xs text-text-muted uppercase tracking-wider">
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
                <Tooltip tip="Eivra Score: composite of 50% Brier, 20% log-loss, 30% win rate. Lower raw scores = better calibration. Normalized so higher = better.">
                  Eivra
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                <Tooltip tip="Brier score: mean squared error between predicted probability and outcome (0 or 1). Range 0–1. Lower is better — 0 is perfect, 0.25 is chance.">
                  Brier ↓
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                <Tooltip tip="Log-loss: −log(p) if the event happened, −log(1−p) if it didn't. Penalizes confident wrong predictions heavily. Lower is better.">
                  Log-loss ↓
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                Win %
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                <Tooltip tip="Paper P&L: simulated profit/loss if the agent bet $1 on each prediction at its stated probability. No real money — tracks whether probability estimates have positive expected value.">
                  Paper P&amp;L
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                Picks
              </th>
              <th scope="col" className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                24h rank
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => {
              const agent = AGENTS.find((a) => a.id === s.agent_id);
              if (!agent) return null;
              const isTop = i === 0;
              const delta = s.rank_delta_24h;
              return (
                <tr
                  key={s.agent_id}
                  className={`border-b border-border-subtle/60 panel-hover transition-colors ${
                    isTop ? "border-l-2 border-l-accent" : ""
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
                        className={`w-2 h-2 rounded-full ring-2 ring-offset-2 ring-offset-panel ${
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
                      <span className="flex flex-col gap-0">
                        <span className="text-text-primary text-sm group-hover:text-accent transition-colors">
                          {agent.name}
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
                    {num(s.brier_30d, 3)}
                  </td>
                  <td className="px-4 py-3 mono text-right text-text-secondary">
                    {num(s.log_loss_30d, 3)}
                  </td>
                  <td className="px-4 py-3 mono text-right text-text-secondary">
                    {pct(s.win_rate_30d, 0)}
                  </td>
                  <td
                    className={`px-4 py-3 mono text-right ${
                      s.paper_pnl_30d >= 0 ? "text-positive" : "text-rose-400"
                    }`}
                  >
                    {dollars(s.paper_pnl_30d, 2)}
                  </td>
                  <td className="px-4 py-3 mono text-right text-text-muted">
                    {int(s.total_predictions)}
                  </td>
                  <td className="px-4 py-3 mono text-right text-xs">
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
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
