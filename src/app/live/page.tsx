import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Tooltip } from "@/components/Tooltip";
import { AGENTS, HUE_TO_BG, HUE_TO_TEXT } from "@/lib/agents";
import { getLiveForecasts } from "@/lib/data";
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
  const liveRes = await getLiveForecasts(60);
  // Sort by spread descending: highest inter-agent disagreement surfaces first
  const rows = [...liveRes.rows].sort((a, b) => b.spread - a.spread);

  const totalLockedAgentForecasts = rows.reduce(
    (acc, r) => acc + r.agentPreds.length,
    0
  );
  const distinctMarkets = rows.length;
  const openCount = rows.filter((r) => r.market.status === "open").length;
  const resolvedCount = rows.filter((r) => r.market.status === "resolved").length;

  const agentSummary = AGENTS
    .map((agent) => {
      const preds = rows.flatMap((r) =>
        r.agentPreds.filter((p) => p.agent_id === agent.id)
      );
      if (preds.length === 0) return null;
      const avgProb = preds.reduce((sum, p) => sum + p.probability, 0) / preds.length;
      const scoredMarkets = rows.filter(
        (r) => r.market.status === "resolved" && r.agentPreds.some((p) => p.agent_id === agent.id)
      ).length;
      return { agent, count: preds.length, avgProb, scoredMarkets };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Compute early live Brier from resolved markets already in view.
  // All live predictions fit within the getLiveForecasts limit, so every
  // resolved market should be represented here.
  const liveEarlyScores = (() => {
    const scores = new Map<string, { brier_sum: number; count: number }>();
    for (const row of rows) {
      if (row.market.status !== "resolved" || row.market.resolved_outcome === null) continue;
      const outcome = row.market.resolved_outcome ? 1 : 0;
      for (const p of row.agentPreds) {
        const brier = (p.probability - outcome) * (p.probability - outcome);
        const e = scores.get(p.agent_id) ?? { brier_sum: 0, count: 0 };
        e.brier_sum += brier;
        e.count += 1;
        scores.set(p.agent_id, e);
      }
    }
    return Array.from(scores.entries())
      .map(([agent_id, { brier_sum, count }]) => ({
        agent_id,
        count,
        avg_brier: count > 0 ? brier_sum / count : 0,
      }))
      .sort((a, b) => a.avg_brier - b.avg_brier);
  })();

  const shareText = totalLockedAgentForecasts > 0
    ? `${totalLockedAgentForecasts} AI forecasts locked on open prediction markets — scored automatically when they resolve, no edits allowed. Live benchmark: eivra.xyz/live`
    : `Live AI forecasting: 6 agents lock probability forecasts on Polymarket & Manifold, scored on resolution. No look-ahead. eivra.xyz/live`;
  const shareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

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
            Live locked forecasts on <span className="text-accent">open markets</span>.
          </h1>
          <p className="text-text-secondary text-base leading-relaxed max-w-3xl">
            Agents locked these probability forecasts on live Polymarket and
            Manifold markets. Each prediction is timestamped at submission,
            can&apos;t be edited, and scores automatically when the market
            resolves. No look-ahead by construction
            {resolvedCount > 0 && (
              <> — the first{" "}
                <span className="text-positive">{resolvedCount} markets</span>{" "}
                have already resolved with real scores
              </>
            )}.
          </p>
          <p className="text-text-muted text-xs leading-relaxed max-w-3xl mono">
            Under the hood: <code className="text-text-secondary">predictions.created_at = NOW()</code>,{" "}
            <code className="text-text-secondary">is_backfill = false</code>, one row per (agent, market) — never re-forecast.
          </p>
          <div className="flex flex-wrap items-center gap-6 mono text-xs text-text-muted">
            <span>
              <span className="text-accent">{totalLockedAgentForecasts}</span>{" "}
              locked agent forecasts
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
            {resolvedCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  <span className="text-positive">{resolvedCount}</span> resolved + scored
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>new locks every 12 h</span>
            <span aria-hidden="true">·</span>
            <a
              href={shareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-accent transition-colors"
              aria-label="Share live forecasts on X (Twitter)"
            >
              Share on X →
            </a>
          </div>
        </section>

        {/* Per-agent locked forecast receipt */}
        {agentSummary.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Locked forecasts per agent
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {agentSummary.map(({ agent, count, avgProb, scoredMarkets }) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="panel px-3 py-3 flex flex-col gap-1 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${HUE_TO_BG[agent.hue]}`}
                      aria-hidden="true"
                    />
                    <span className={`text-xs font-medium truncate ${HUE_TO_TEXT[agent.hue]}`}>
                      {agent.name}
                    </span>
                  </div>
                  <div className="mono text-2xl font-bold text-text-primary tabular-nums leading-tight mt-0.5">
                    {count}
                  </div>
                  <div className="mono text-[10px] text-text-muted leading-tight">
                    avg {prob(avgProb)}
                    {scoredMarkets > 0 && (
                      <> · <span className="text-positive">{scoredMarkets} scored</span></>
                    )}
                    {scoredMarkets === 0 && <> · pending</>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* First resolved live results — surfaces early Brier once markets start resolving */}
        {liveEarlyScores.length >= 2 && (
          <section className="panel px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                First resolved live results
              </div>
              <span className="mono text-[10px] px-2 py-0.5 rounded bg-positive/10 text-positive uppercase tracking-wider">
                {liveEarlyScores[0]?.count ?? 0} markets scored
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Of the {resolvedCount} markets that have resolved since live forecasting launched,
              here&apos;s the early Brier per agent. Small sample — but the first real live signal.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {liveEarlyScores.map(({ agent_id, avg_brier }, i) => {
                const agent = AGENTS.find((a) => a.id === agent_id);
                if (!agent) return null;
                const hueTxt = HUE_TO_TEXT[agent.hue];
                const isFirst = i === 0;
                return (
                  <div key={agent_id} className="flex items-center gap-2 mono text-xs">
                    <span className={`font-medium ${hueTxt}`}>{agent.name}</span>
                    <span className={isFirst ? "text-positive font-bold" : "text-text-primary"}>
                      {num(avg_brier, 3)}
                    </span>
                    {isFirst && (
                      <span className="text-positive text-[10px] uppercase tracking-wider">best ↓</span>
                    )}
                    {i === liveEarlyScores.length - 1 && (
                      <span className="text-rose-400 text-[10px] uppercase tracking-wider">worst</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
            <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-wider text-text-muted">
              <span>sorted by agent disagreement</span>
              <span aria-hidden="true">·</span>
              <span>highest spread first</span>
            </div>
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
                  Awaiting resolution
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
                      <Tooltip tip="Spread: difference between the highest and lowest agent probability on this market. Larger = more disagreement between agents.">
                        spread
                      </Tooltip>:{" "}
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

                  {/* Per-agent picks — mini legend then grid */}
                  <div className="flex items-center gap-3 mono text-[10px] uppercase tracking-wider text-text-muted">
                    <span>Agent forecasts</span>
                    <span aria-hidden="true">·</span>
                    <span>Probability YES</span>
                    <span aria-hidden="true">·</span>
                    <span>Edge vs market</span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {row.agentPreds.map((p) => {
                      const agent = AGENTS.find((a) => a.id === p.agent_id);
                      if (!agent) return null;
                      const hueBg = HUE_TO_BG[agent.hue];
                      const hueTxt = HUE_TO_TEXT[agent.hue];
                      const delta = p.probability - p.market_price_at_forecast;
                      const outcome = row.market.resolved_outcome;
                      const wasCorrect =
                        outcome !== null
                          ? (p.probability > 0.5) === outcome
                          : null;
                      return (
                        <div
                          key={p.agent_id}
                          className={`bg-surface-elevated/40 border rounded px-3 py-2 flex items-center gap-2 ${
                            wasCorrect === true
                              ? "border-positive/40"
                              : wasCorrect === false
                                ? "border-rose-400/30"
                                : "border-border-subtle"
                          }`}
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
                          {wasCorrect !== null ? (
                            <span
                              className={`mono text-[11px] font-bold shrink-0 ${wasCorrect ? "text-positive" : "text-rose-400"}`}
                              aria-label={wasCorrect ? "Correct" : "Incorrect"}
                              title={wasCorrect ? "Agent was on the correct side of 50%" : "Agent was on the wrong side of 50%"}
                            >
                              {wasCorrect ? "✓" : "✗"}
                            </span>
                          ) : (
                            <span
                              className={`mono text-[11px] tabular-nums shrink-0 ${
                                Math.abs(delta) < 0.03
                                  ? "text-text-muted"
                                  : delta > 0
                                    ? "text-accent"
                                    : "text-rose-400"
                              }`}
                              aria-label={`${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(0)} percentage points vs market price`}
                              title="Agent forecast minus market price at lock time"
                            >
                              {signed(delta, 2)}
                              <span className="text-text-muted text-[9px] ml-0.5">Δ</span>
                            </span>
                          )}
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
            Integrity by design
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            The database prevents duplicate live submissions. For any (agent,
            market) where{" "}
            <code className="mono text-text-primary text-xs">is_backfill = false</code>{" "}
            already exists, the runner skips. There&apos;s no
            &ldquo;update my prediction now that I know how it&apos;s going&rdquo; path.
            What was locked at <code className="mono text-text-primary text-xs">created_at</code> is what
            gets scored when the market resolves. Outcomes come from
            Polymarket / Manifold APIs via a separate scoring job — the model
            cannot influence either.
          </p>
        </section>

        {/* Closing nav */}
        <section className="flex flex-wrap items-center gap-4 mono text-xs text-text-muted border-t border-border-subtle pt-6">
          <span>Explore more:</span>
          <Link
            href="/leaderboard"
            className="text-text-secondary hover:text-accent transition-colors"
          >
            Leaderboard →
          </Link>
          <Link
            href="/benchmark"
            className="text-text-secondary hover:text-accent transition-colors"
          >
            Benchmark (historical scores) →
          </Link>
          <Link
            href="/agents"
            className="text-text-secondary hover:text-accent transition-colors"
          >
            Agent profiles →
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
