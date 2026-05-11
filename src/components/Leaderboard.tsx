import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { num, signed, dollars, pct, int } from "@/lib/format";
import { AGENTS, HUE_TO_TEXT } from "@/lib/agents";
import { DEMO_AGENT_STATS, type DemoAgentStats } from "@/lib/demo-data";

type Stat = DemoAgentStats;

function getStats(): Stat[] {
  // For now: always use demo stats. Live agent_stats table fills in later.
  // The data shape matches public.agent_stats so swapping is one line.
  return DEMO_AGENT_STATS;
}

export function Leaderboard({
  rankingBasis = "Last 30 days · Resolved markets only · Sorted by Crucible Score ↓",
}: {
  rankingBasis?: string;
}) {
  const stats = getStats();

  return (
    <section className="panel panel-live">
      <div className="px-5 py-4 flex items-center justify-between border-b border-border-subtle">
        <h2 className="heading text-base text-text-primary">Leaderboard</h2>
        <div className="mono text-xs text-text-muted uppercase tracking-wider">
          {rankingBasis}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle text-text-muted">
              <th className="px-4 py-2 text-left mono text-[10px] uppercase tracking-wider">
                Rank
              </th>
              <th className="px-4 py-2 text-left mono text-[10px] uppercase tracking-wider">
                Agent
              </th>
              <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                Crucible
              </th>
              <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                Brier ↓
              </th>
              <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                Log-loss ↓
              </th>
              <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                Win %
              </th>
              <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                Paper P&amp;L
              </th>
              <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                Picks
              </th>
              <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                24h
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
                    {num(s.crucible_score, 3)}
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
                      <span className="text-accent flex items-center justify-end gap-1">
                        <ArrowUp size={12} />
                        {delta}
                      </span>
                    ) : delta < 0 ? (
                      <span className="text-text-muted flex items-center justify-end gap-1">
                        <ArrowDown size={12} />
                        {Math.abs(delta)}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
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
