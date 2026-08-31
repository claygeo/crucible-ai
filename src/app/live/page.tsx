import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Tooltip } from "@/components/Tooltip";
import { AGENTS, HUE_TO_BG, HUE_TO_TEXT } from "@/lib/agents";
import { getLiveForecasts } from "@/lib/data";
import { prob, num, signed, relativeTime } from "@/lib/format";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  try {
    const liveRes = await getLiveForecasts(100);
    const rows = liveRes.rows;
    const totalLocked = rows.reduce((acc, r) => acc + r.agentPreds.length, 0);
    const resolvedCount = rows.filter((r) => r.market.status === "resolved").length;
    const openCount = rows.filter((r) => r.market.status === "open").length;

    let description: string;
    if (totalLocked > 0 && resolvedCount > 0) {
      description = `${totalLocked} AI forecasts locked on ${openCount} markets. ${resolvedCount} resolved with real Brier scores — no editing, no look-ahead. Archived record of the May–Jun 2026 run; the pipeline is decommissioned.`;
    } else if (totalLocked > 0) {
      description = `${totalLocked} AI forecasts locked on ${openCount} prediction markets. Timestamped at submission, scored on resolution, no look-ahead. Archived record of the May–Jun 2026 run; the pipeline is decommissioned.`;
    } else {
      description =
        "Six AI agents locked probability forecasts on open Polymarket and Manifold markets. Timestamped at submission, scored on resolution. Archived record of the May–Jun 2026 run; the pipeline is decommissioned.";
    }

    const title = "Eivra — Archived AI forecasts, locked and scored in public";
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: "https://eivra.xyz/live",
        siteName: "Eivra",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        creator: "@deforestpeg",
        site: "@deforestpeg",
      },
    };
  } catch {
    return {
      title: "Archived forecasts — Eivra",
      description:
        "Six AI agents locked probability forecasts on open Polymarket and Manifold markets, scored on resolution, no look-ahead. Archived record of the May–Jun 2026 run; the pipeline is decommissioned.",
    };
  }
}

export default async function LivePage() {
  const liveRes = await getLiveForecasts(100);
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

  const echoLiveScore = liveEarlyScores.find((s) => s.agent_id === "echo") ?? null;
  const liveLeader = liveEarlyScores[0] ?? null;
  const liveLeaderAgent = liveLeader ? AGENTS.find((a) => a.id === liveLeader.agent_id) ?? null : null;
  const liveLeaderBeatsMarket = !!(
    echoLiveScore &&
    liveLeader &&
    liveLeader.agent_id !== "echo" &&
    liveLeader.avg_brier < echoLiveScore.avg_brier
  );

  const shareText = totalLockedAgentForecasts > 0
    ? `${totalLockedAgentForecasts} AI forecasts locked on open prediction markets — locked at submission, no edits allowed. Archived benchmark run: eivra.xyz/live`
    : `Archived AI forecasting run: 6 agents locked probability forecasts on Polymarket & Manifold, scored on resolution. No look-ahead. eivra.xyz/live`;
  const shareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-12 flex flex-col gap-10">
        {/* Hero */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mono text-xs text-text-muted uppercase tracking-wider">
            <span>archived forecasts · locked at submission</span>
          </div>
          <h1 className="heading text-4xl sm:text-5xl text-text-primary tracking-tight">
            Locked forecasts from the <span className="text-accent">archived run</span>.
          </h1>
          <p className="text-text-secondary text-base leading-relaxed max-w-3xl">
            Agents locked these probability forecasts on live Polymarket and
            Manifold markets during the run. Each prediction was timestamped at
            submission, couldn&apos;t be edited, and was scored when the market
            resolved. Markets still open when the pipeline shut down will never
            be scored. No look-ahead by construction
            {resolvedCount > 0 && (
              <> — the first{" "}
                <span className="text-positive">{resolvedCount} markets</span>{" "}
                resolved with real scores before the run ended
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
            <span>no new locks · archived</span>
            <span aria-hidden="true">·</span>
            <a
              href={shareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-accent transition-colors"
              aria-label="Share archived forecasts on X (Twitter)"
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
              {agentSummary.map(({ agent, count, avgProb, scoredMarkets }) => {
                const agentLiveScore = liveEarlyScores.find((s) => s.agent_id === agent.id) ?? null;
                const isLiveLead = agentLiveScore !== null && liveLeader?.agent_id === agent.id;
                return (
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
                    {agentLiveScore && agentLiveScore.count > 0 && (
                      <div
                        className={`mono text-[10px] leading-tight mt-0.5 ${
                          isLiveLead ? "text-positive font-semibold" : "text-text-muted"
                        }`}
                        title="Brier score on resolved live markets — lower is better"
                      >
                        Brier {num(agentLiveScore.avg_brier, 3)}
                        {isLiveLead && <span className="ml-0.5">↑</span>}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Live results — surfaces Brier once live markets start resolving */}
        {liveEarlyScores.length >= 2 && (
          <section className="panel px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Live results
              </div>
              <span className="mono text-[10px] px-2 py-0.5 rounded bg-positive/10 text-positive uppercase tracking-wider">
                {liveLeader?.count ?? 0} markets scored
              </span>
              {liveLeaderBeatsMarket && (
                <span className="mono text-[10px] px-2 py-0.5 rounded bg-positive/10 text-positive uppercase tracking-wider">
                  reasoning beats market ↑
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {liveLeader?.count ?? resolvedCount} live markets resolved.{" "}
              {liveLeaderAgent && liveLeader && (
                <>
                  <span className={`font-medium ${HUE_TO_TEXT[liveLeaderAgent.hue]}`}>
                    {liveLeaderAgent.name}
                  </span>{" "}
                  leads with{" "}
                  <Tooltip tip="Brier score: mean squared error between predicted probability and outcome (0 or 1). Range 0–1. Lower is better — 0 is perfect, 0.25 is random chance.">
                    Brier
                  </Tooltip>{" "}
                  {num(liveLeader.avg_brier, 3)}
                  {echoLiveScore && liveLeader.agent_id !== "echo" ? (
                    liveLeaderBeatsMarket ? (
                      <> —{" "}
                        <span className="text-positive">
                          {num(echoLiveScore.avg_brier - liveLeader.avg_brier, 3)} ahead
                        </span>{" "}
                        of market consensus (Echo {num(echoLiveScore.avg_brier, 3)}).
                      </>
                    ) : (
                      <> —{" "}
                        <span className="text-rose-400">
                          {num(liveLeader.avg_brier - echoLiveScore.avg_brier, 3)} behind
                        </span>{" "}
                        market consensus (Echo {num(echoLiveScore.avg_brier, 3)}).
                      </>
                    )
                  ) : "."}
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {liveEarlyScores.map(({ agent_id, avg_brier }, i) => {
                const agent = AGENTS.find((a) => a.id === agent_id);
                if (!agent) return null;
                const hueTxt = HUE_TO_TEXT[agent.hue];
                const isFirst = i === 0;
                const isLast = i === liveEarlyScores.length - 1;
                const beatsEcho = !!(echoLiveScore && agent_id !== "echo" && avg_brier < echoLiveScore.avg_brier);
                return (
                  <div key={agent_id} className="flex items-center gap-2 mono text-xs">
                    <span className={`font-medium ${hueTxt}`}>{agent.name}</span>
                    <span className={isFirst ? "text-positive font-bold" : "text-text-primary"}>
                      {num(avg_brier, 3)}
                    </span>
                    {isFirst && !beatsEcho && (
                      <span className="text-positive text-[10px] uppercase tracking-wider">best ↓</span>
                    )}
                    {beatsEcho && (
                      <span className="text-positive text-[10px] uppercase tracking-wider">✓ mkt</span>
                    )}
                    {isLast && (
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
              [archived]
            </div>
            <p className="text-text-secondary max-w-md">
              The live-mode cron was decommissioned 2026-08-22. No new agent
              picks will ever be locked.
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
                  Unresolved (archived)
                </span>
              ) : (
                <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent inline-flex items-center gap-1">
                  Unresolved (archived)
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
                    {row.market.url && (
                      <>
                        <span aria-hidden="true">·</span>
                        <a
                          href={row.market.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-muted hover:text-accent transition-colors"
                          aria-label={`View this market on ${row.market.source}`}
                        >
                          view on {row.market.source} ↗
                        </a>
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
                          className={`bg-surface-elevated/40 border rounded px-3 py-2 flex flex-col gap-1.5 ${
                            wasCorrect === true
                              ? "border-positive/40"
                              : wasCorrect === false
                                ? "border-rose-400/30"
                                : "border-border-subtle"
                          }`}
                        >
                          <div className="flex items-center gap-2">
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
                          {/* Probability bar: 0–100% fill shows forecast at a glance */}
                          <div className="w-full bg-border-subtle/30 rounded-full h-0.5" aria-hidden="true">
                            <div
                              className={`h-0.5 rounded-full opacity-70 ${hueBg}`}
                              style={{ width: `${Math.round(p.probability * 100)}%` }}
                            />
                          </div>
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
            gets scored when the market resolves. Outcomes came from
            Polymarket / Manifold APIs via a separate scoring job — the model
            could influence neither.
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
