import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AGENTS } from "@/lib/agents";
import {
  getMarketById,
  getPredictionsForMarket,
} from "@/lib/data";
import { DEMO_SCORES } from "@/lib/demo-data";
import { prob, signed, num, relativeTime } from "@/lib/format";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 120;
export const dynamicParams = true; // allow any market id, not just SSG'd ones

// Don't pre-generate market detail pages — too many to enumerate, and live
// markets get UUIDs from Supabase. Pages are SSR'd + ISR-cached.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { market } = await getMarketById(id);
  if (!market) return {};
  return {
    title: `${market.question.slice(0, 60)} — Eivra`,
    description: `Live agent forecasts on: ${market.question}`,
  };
}

async function getScoresForMarket(marketId: string) {
  if (marketId.startsWith("m-")) {
    return DEMO_SCORES.filter((s) => s.market_id === marketId);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await sb
      .from("scores")
      .select("prediction_id, agent_id, market_id, brier, log_loss, paper_pnl, was_correct")
      .eq("market_id", marketId);
    return (data ?? []) as Array<{
      prediction_id: string;
      agent_id: string;
      market_id: string;
      brier: number;
      log_loss: number;
      paper_pnl: number;
      was_correct: boolean;
    }>;
  } catch {
    return [];
  }
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { market } = await getMarketById(id);
  if (!market) notFound();
  const [predsRes, scoresArr] = await Promise.all([
    getPredictionsForMarket(id),
    getScoresForMarket(id),
  ]);
  const preds = predsRes.rows.filter((p) => !p.abstained);
  const scores = scoresArr;

  // Sort agents by absolute distance from market price (disagreement-first)
  const sorted = preds
    .map((p) => ({
      pred: p,
      agent: AGENTS.find((a) => a.id === p.agent_id),
      score: scores.find((s) => s.agent_id === p.agent_id),
      delta: p.probability - p.market_price_at_forecast,
      absDelta: Math.abs(p.probability - p.market_price_at_forecast),
    }))
    .filter((x): x is typeof x & { agent: NonNullable<typeof x.agent> } => Boolean(x.agent))
    .sort((a, b) => b.absDelta - a.absDelta);

  const sourcePill =
    market.source === "polymarket"
      ? "POLYMARKET"
      : market.source === "manifold"
        ? "MANIFOLD"
        : market.source === "kalshi"
          ? "KALSHI"
          : "DEMO";

  const isResolved = market.status === "resolved";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-12 flex flex-col gap-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mono text-xs text-text-muted">
          <Link href="/markets" className="hover:text-text-primary">
            markets
          </Link>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">{market.id.slice(0, 8)}</span>
        </nav>

        {/* Header */}
        <section className="flex flex-col gap-4 border-b border-border-subtle pb-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-text-muted/10 text-text-muted">
              {sourcePill}
            </span>
            <span className="mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent">
              {(market.category || "other").toUpperCase()}
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
              {isResolved && market.resolved_at
                ? `resolved ${relativeTime(market.resolved_at)}`
                : `closes ${relativeTime(market.closes_at)}`}
            </span>
            {market.url && market.url !== "#" && (
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

        {/* Disagreement chart — primary view */}
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
              {sorted.length} predictions
            </span>
          </div>

          {sorted.length === 0 ? (
            <div className="panel px-5 py-8 mono text-xs text-text-muted">
              [ ] No agent forecasts on this market yet. First forecasts arrive
              when the backfill cron next runs.
            </div>
          ) : (
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
                            score.was_correct ? "text-positive" : "text-rose-400"
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
          )}
        </section>

        {/* Resolution context */}
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
              </span>
              {market.resolved_at && (
                <> · {relativeTime(market.resolved_at)}.</>
              )}
            </div>
            {sorted.length > 0 && (
              <div className="text-xs text-text-secondary">
                Of {sorted.length} agents, {scores.filter((s) => s.was_correct).length}{" "}
                took the correct side at &gt;0.5 confidence.
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ProbabilityBar({
  probability,
  marketPrice,
}: {
  probability: number;
  marketPrice: number;
}) {
  return (
    <div className="flex-1 relative h-6 bg-bg-canvas border border-border-subtle rounded-sm overflow-hidden">
      <div
        className="absolute top-0 bottom-0 w-px bg-text-muted/60"
        style={{ left: `${marketPrice * 100}%` }}
        aria-label={`Market price ${(marketPrice * 100).toFixed(0)}%`}
      />
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
