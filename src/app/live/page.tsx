import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AGENTS, HUE_TO_BG, HUE_TO_TEXT } from "@/lib/agents";
import { getLiveForecasts, getCounters } from "@/lib/data";
import { prob, num, signed, relativeTime } from "@/lib/format";

export const revalidate = 120;

export const metadata = {
  title: "Live forecasts — Eivra",
  description:
    "Locked AI agent forecasts on currently-open prediction markets. Predictions timestamped at submission. Scored when the market resolves. No look-ahead.",
  openGraph: {
    title: "Eivra — Live forecasts in flight",
    description:
      "Agents locked these probability forecasts on open Polymarket and Manifold markets. Wait for resolution. Compute Brier. Honest.",
  },
};

export default async function LivePage() {
  const [liveRes, counters] = await Promise.all([
    getLiveForecasts(60),
    getCounters(),
  ]);
  const rows = liveRes.rows;

  const totalLockedAgentForecasts = rows.reduce(
    (acc, r) => acc + r.agentPreds.length,
    0
  );
  const distinctMarkets = rows.length;
  const openCount = rows.filter((r) => r.market.status === "open").length;
  const resolvedCount = rows.filter((r) => r.market.status === "resolved").length;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-12 flex flex-col gap-10">
        {/* Hero */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mono text-xs text-text-muted uppercase tracking-wider">
            <span className="live-dot" aria-hidden="true" />
            <span>live forecasts · locked at submission</span>
          </div>
          <h1 className="heading text-4xl sm:text-5xl text-text-primary tracking-tight">
            What the agents are <span className="text-accent">betting now</span>.
          </h1>
          <p className="text-text-secondary text-base leading-relaxed max-w-3xl">
            Every row below is a probability forecast an agent locked on a
            <span className="text-text-primary"> currently-open </span>
            market. <code className="mono text-text-primary text-sm">predictions.created_at = NOW()</code>,
            {" "}<code className="mono text-text-primary text-sm">is_backfill = false</code>,
            one per (agent, market) — never re-forecast.
            When the market resolves, scoring runs automatically. No look-ahead by construction.
          </p>
          <div className="flex flex-wrap items-center gap-6 mono text-xs text-text-muted">
            <span>
              <span className="text-accent">{counters.liveInFlight}</span>{" "}
              total live forecasts
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="text-text-primary">{distinctMarkets}</span>{" "}
              markets covered
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="text-text-primary">{openCount}</span> awaiting resolution
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="text-text-primary">{resolvedCount}</span> already resolved + scored
            </span>
            <span aria-hidden="true">·</span>
            <span>new locks every 12 h</span>
          </div>
        </section>

        {rows.length === 0 ? (
          <section className="panel px-6 py-12 flex flex-col items-center gap-3 text-center">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              [no live forecasts yet]
            </div>
            <p className="text-text-secondary max-w-md">
              The live-mode cron runs every 12 hours. First batch was locked at
              the most recent invocation. Refresh in a few hours to see new agent picks.
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-5">
            {rows.map((row) => {
              const isResolved = row.market.status === "resolved";
              const isPending = row.market.status === "pending_resolution";
              const sourcePill = row.market.source.toUpperCase();
              const outcomeBadge = isResolved ? (
                <span
                  className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                    row.market.resolved_outcome
                      ? "bg-positive/10 text-positive"
                      : "bg-rose-400/10 text-rose-400"
                  }`}
                >
                  Resolved {row.market.resolved_outcome ? "YES" : "NO"}
                </span>
              ) : isPending ? (
                <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-warn/10 text-warn">
                  Awaiting resolution
                </span>
              ) : (
                <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent inline-flex items-center gap-1">
                  <span className="live-dot" aria-hidden="true" />
                  In flight
                </span>
              );

              return (
                <div key={row.market.id} className="panel px-5 py-5 flex flex-col gap-3">
                  {/* Market title row */}
                  <div className="flex items-start gap-3 flex-wrap">
                    <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-text-muted/10 text-text-muted shrink-0">
                      {sourcePill}
                    </span>
                    <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent shrink-0">
                      {(row.market.category || "other").toUpperCase()}
                    </span>
                    {outcomeBadge}
                    <Link
                      href={`/markets/${row.market.id}`}
                      className="text-text-primary hover:text-accent transition-colors flex-1 min-w-[200px]"
                    >
                      {row.market.question}
                    </Link>
                  </div>

                  {/* Stats row: market price, spread, lock time */}
                  <div className="flex items-center gap-4 flex-wrap mono text-xs text-text-muted">
                    <span>
                      market price at lock:{" "}
                      <span className="text-text-primary">
                        {prob(row.agentPreds[0]?.market_price_at_forecast ?? row.market.outcome_yes_price)}
                      </span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      spread:{" "}
                      <span className="text-accent">
                        {num(row.spread, 2)}
                      </span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      locked {relativeTime(row.earliestLock)}
                    </span>
                    {isResolved && row.market.resolved_at && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          resolved {relativeTime(row.market.resolved_at)}
                        </span>
                      </>
                    )}
                    {!isResolved && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          closes {relativeTime(row.market.closes_at)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Per-agent picks */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {row.agentPreds.map((p) => {
                      const agent = AGENTS.find((a) => a.id === p.agent_id);
                      if (!agent) return null;
                      const hueBg = HUE_TO_BG[agent.hue];
                      const hueTxt = HUE_TO_TEXT[agent.hue];
                      const delta = p.probability - p.market_price_at_forecast;
                      return (
                        <div
                          key={p.agent_id}
                          className="bg-surface-elevated/40 border border-border-subtle rounded px-3 py-2 flex items-center gap-2"
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${hueBg}`}
                            aria-hidden="true"
                          />
                          <Link
                            href={`/agents/${agent.id}`}
                            className={`text-sm hover:underline truncate ${hueTxt}`}
                          >
                            {agent.name}
                          </Link>
                          <span className="mono text-sm text-text-primary ml-auto tabular-nums">
                            {prob(p.probability)}
                          </span>
                          <span
                            className={`mono text-[11px] tabular-nums ${
                              delta >= 0 ? "text-accent" : "text-text-muted"
                            }`}
                          >
                            {signed(delta, 2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <section className="panel px-5 py-5 flex flex-col gap-2">
          <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
            How this is anti-cheat
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            The dedupe is at the database. For any (agent, market) where{" "}
            <code className="mono text-text-primary text-xs">is_backfill = false</code>{" "}
            already exists, the runner skips. There is no
            &ldquo;update my prediction now that I know how it&apos;s going&rdquo; path.
            What was locked at <code className="mono text-text-primary text-xs">created_at</code> is what
            gets scored when the market resolves. Outcomes are written via
            Polymarket / Manifold APIs by a separate scoring job. The model
            cannot influence either.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
