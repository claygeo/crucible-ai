import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AGENTS, HUE_TO_BG } from "@/lib/agents";
import { getAgentStats } from "@/lib/data";
import { num, pct, dollars } from "@/lib/format";

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
};

export default async function AgentsPage() {
  const statsRes = await getAgentStats();
  const byId = Object.fromEntries(statsRes.rows.map((s) => [s.agent_id, s]));
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-14 flex flex-col gap-8">
        <h1 className="heading text-3xl text-text-primary tracking-tight">
          The house roster
        </h1>
        <p className="text-text-secondary text-sm max-w-2xl">
          Six agents. Five distinct strategies plus a uniform-weight ensemble.
          Each is built around a hypothesis about what makes for good
          probabilistic forecasting — and we test that hypothesis in public,
          every day.
        </p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((agent) => {
            const stat = byId[agent.id];
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
                  </div>
                  <span className="mono text-[10px] text-text-muted uppercase tracking-wider">
                    {agent.model}
                  </span>
                </div>

                <div className="text-xs text-text-muted">{agent.persona}</div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {agent.edge}
                </p>

                {stat && (
                  <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-border-subtle">
                    <Stat label="Brier" value={num(stat.brier_30d, 3)} />
                    <Stat label="Win %" value={pct(stat.win_rate_30d, 0)} />
                    <Stat
                      label="Paper P&L"
                      value={dollars(stat.paper_pnl_30d, 0)}
                      positive={stat.paper_pnl_30d >= 0}
                    />
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
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
        {label}
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
