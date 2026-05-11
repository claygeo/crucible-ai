import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AGENTS } from "@/lib/agents";
import { DEMO_MARKETS, DEMO_PREDICTIONS, DEMO_SCORES } from "@/lib/demo-data";
import { prob, signed, num, relativeTime } from "@/lib/format";

export function generateStaticParams() {
  return DEMO_MARKETS.map((m) => ({ id: m.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const market = DEMO_MARKETS.find((m) => m.id === id);
  if (!market) return {};
  return {
    title: `${market.question.slice(0, 60)} — Crucible`,
    description: `Live agent forecasts on: ${market.question}`,
  };
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const market = DEMO_MARKETS.find((m) => m.id === id);
  if (!market) notFound();
  const preds = DEMO_PREDICTIONS.filter((p) => p.market_id === id);
  const scores = DEMO_SCORES.filter((s) => s.market_id === id);

  // Sort agents by absolute distance from market price (disagreement-first)
  const sorted = [...preds]
    .map((p) => ({
      pred: p,
      agent: AGENTS.find((a) => a.id === p.agent_id)!,
      score: scores.find((s) => s.agent_id === p.agent_id),
      delta: p.probability - p.market_price_at_forecast,
      absDelta: Math.abs(p.probability - p.market_price_at_forecast),
    }))
    .sort((a, b) => b.absDelta - a.absDelta);

  const sourcePill =
    market.source === "polymarket"
      ? "POLYMARKET"
      : market.source === "manifold"
        ? "MANIFOLD"
        : "KALSHI";

  const isResolved = market.status === "resolved";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-12 flex flex-col gap-10">
        {/* Breadcrumb */}
        <nav className="mono text-xs text-text-muted">
          <Link href="/markets" className="hover:text-text-primary">
            markets
          </Link>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">{market.id}</span>
        </nav>

        {/* Header */}
        <section className="flex flex-col gap-4 border-b border-border-subtle pb-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-text-muted/10 text-text-muted">
              {sourcePill}
            </span>
            <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent">
              {market.category.toUpperCase()}
            </span>
            <span
              className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                isResolved
                  ? market.resolved_outcome
                    ? "bg-positive/10 text-positive"
                    : "bg-rose-400/10 text-rose-400"
                  : "bg-warn/10 text-warn"
              }`}
            >
              {isResolved
                ? `Resolved ${market.resolved_outcome ? "YES" : "NO"}`
                : "Open"}
            </span>
          </div>
          <h1 className="heading text-3xl sm:text-4xl text-text-primary leading-tight tracking-tight max-w-4xl">
            {market.question}
          </h1>
          <div className="flex items-center gap-4 mono text-xs text-text-muted">
            <span>
              market price:{" "}
              <span className="text-text-primary">
                {prob(market.outcome_yes_price)}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {isResolved
                ? `resolved ${relativeTime(market.resolved_at!)}`
                : `closes ${relativeTime(market.closes_at)}`}
            </span>
            {market.url && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={market.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  source ↗
                </a>
              </>
            )}
          </div>
        </section>

        {/* Disagreement chart — primary view per /autoplan review */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="heading text-xl text-text-primary">
                Agent forecasts
              </h2>
              <p className="text-text-secondary text-sm mt-1">
                Sorted by distance from market price. Disagreement is the story.
              </p>
            </div>
            <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
              {preds.length} predictions
            </span>
          </div>

          <div className="panel divide-y divide-border-subtle">
            {sorted.map(({ pred, agent, score, delta }) => {
              const tookYes = pred.probability > pred.market_price_at_forecast;
              return (
                <div key={agent.id} className="px-5 py-4">
                  <div className="flex items-center gap-4 mb-2">
                    <Link
                      href={`/agents/${agent.id}`}
                      className="flex items-center gap-2 group min-w-[140px]"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
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
                      />
                      <span className="text-text-primary text-sm group-hover:text-accent transition-colors">
                        {agent.name}
                      </span>
                    </Link>

                    <ProbabilityBar
                      probability={pred.probability}
                      marketPrice={pred.market_price_at_forecast}
                    />

                    <span className="mono text-sm text-text-primary min-w-[48px] text-right">
                      {prob(pred.probability)}
                    </span>
                    <span
                      className={`mono text-xs min-w-[60px] text-right ${
                        delta >= 0 ? "text-accent" : "text-text-muted"
                      }`}
                    >
                      {signed(delta, 2)}
                    </span>

                    {score && (
                      <span
                        className={`mono text-xs min-w-[70px] text-right ${
                          score.was_correct
                            ? "text-positive"
                            : "text-rose-400"
                        }`}
                      >
                        Brier {num(score.brier, 3)}
                      </span>
                    )}
                  </div>
                  <details className="ml-[156px]">
                    <summary className="mono text-[10px] uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-secondary transition-colors">
                      reasoning · {tookYes ? "long YES" : "long NO"}
                    </summary>
                    <div className="mono text-xs text-text-secondary mt-2 leading-relaxed pl-4 border-l border-border-subtle">
                      {pred.reasoning}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </section>

        {/* Resolution context (when resolved) */}
        {isResolved && (
          <section className="panel px-5 py-5 flex flex-col gap-2">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Resolution
            </div>
            <div className="text-text-primary">
              Market resolved{" "}
              <span
                className={
                  market.resolved_outcome ? "text-positive" : "text-rose-400"
                }
              >
                {market.resolved_outcome ? "YES" : "NO"}
              </span>{" "}
              · {relativeTime(market.resolved_at!)}.
            </div>
            <div className="text-xs text-text-secondary">
              Of {sorted.length} agents, {scores.filter((s) => s.was_correct).length}{" "}
              took the correct side at &gt;0.5 confidence.
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

/**
 * Horizontal bar showing the agent's probability with the market price as a faint anchor.
 * Mono spacing, hairlines only.
 */
function ProbabilityBar({
  probability,
  marketPrice,
}: {
  probability: number;
  marketPrice: number;
}) {
  return (
    <div className="flex-1 relative h-6 bg-bg-canvas border border-border-subtle rounded-sm overflow-hidden">
      {/* Market price tick */}
      <div
        className="absolute top-0 bottom-0 w-px bg-text-muted/60"
        style={{ left: `${marketPrice * 100}%` }}
        aria-label={`Market price ${(marketPrice * 100).toFixed(0)}%`}
      />
      {/* Agent's probability bar */}
      <div
        className="absolute top-0 bottom-0 bg-accent/40"
        style={{
          left: `${Math.min(marketPrice, probability) * 100}%`,
          width: `${Math.abs(probability - marketPrice) * 100}%`,
        }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-accent rounded-sm"
        style={{ left: `calc(${probability * 100}% - 2px)` }}
      />
    </div>
  );
}
