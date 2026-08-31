import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LiveTicker, type TickerItem } from "@/components/LiveTicker";
import { Leaderboard } from "@/components/Leaderboard";
import { EurekaCard } from "@/components/EurekaCard";
import { HeroMetric } from "@/components/HeroMetric";
import { Tooltip } from "@/components/Tooltip";
import {
  getAgentStats,
  getCounters,
  getEurekaCards,
} from "@/lib/data";
import { int, num, cleanReasoning } from "@/lib/format";
import { AGENTS, HUE_TO_TEXT } from "@/lib/agents";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 120; // 2-min ISR so backfill updates show fast

export async function generateMetadata(): Promise<Metadata> {
  const description =
    "Archived benchmark run (May–Jun 2026): six AI agents vs prediction-market consensus. Figures shown are the illustrative demo dataset; pipeline decommissioned.";

  const title = "Eivra — Does AI reasoning beat market consensus?";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: "https://eivra.xyz",
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
}

async function getTickerItems(): Promise<TickerItem[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: preds } = await sb
      .from("predictions")
      .select("id, agent_id, market_id, probability, reasoning, market_price_at_forecast, created_at")
      .eq("abstained", false)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!preds || preds.length === 0) return [];
    const marketIds = Array.from(new Set((preds as Array<{ market_id: string }>).map((p) => p.market_id)));
    const { data: markets } = await sb
      .from("markets")
      .select("id, question")
      .in("id", marketIds);
    const qById = new Map<string, string>();
    for (const m of (markets ?? []) as Array<{ id: string; question: string }>) {
      qById.set(m.id, m.question);
    }
    return (preds as Array<Record<string, unknown>>).map((p, i) => {
      const agent = AGENTS.find((a) => a.id === p.agent_id) ?? AGENTS[0]!;
      return {
        id: `${p.agent_id}-${p.market_id}-${i}`,
        agentId: agent.id,
        agentName: agent.name,
        hueClass: HUE_TO_TEXT[agent.hue],
        marketTitle: qById.get(p.market_id as string) ?? "(market)",
        probability: Number(p.probability),
        marketPrice: Number(p.market_price_at_forecast ?? 0.5),
        reasoning: cleanReasoning((p.reasoning as string) ?? "").slice(0, 240),
        ts: p.created_at as string,
      } satisfies TickerItem;
    });
  } catch {
    return [];
  }
}

export default async function HomePage() {
  // Fetch all data in parallel — live if Supabase has data, demo otherwise
  const [statsRes, eurekaRes, counters, tickerItems] = await Promise.all([
    getAgentStats(),
    getEurekaCards(3),
    getCounters(),
    getTickerItems(),
  ]);
  const isDemo = statsRes.source === "demo" || counters.source === "demo";

  // Dynamic share link — mirrors benchmark page pattern
  const shareText = (() => {
    const echo = statsRes.rows.find((s) => s.agent_id === "echo");
    const reasoningStats = statsRes.rows.filter(
      (s) => s.agent_id !== "echo" && s.agent_id !== "ensemble"
    );
    const bestReasoning = [...reasoningStats].sort(
      (a, b) => a.brier_30d - b.brier_30d
    )[0];
    const bestAgent = bestReasoning
      ? AGENTS.find((a) => a.id === bestReasoning.agent_id)
      : null;
    if (!echo || !bestReasoning || !bestAgent) {
      return `Live AI forecasting benchmark: 6 agents, real prediction markets, honest scoring. eivra.xyz`;
    }
    if (bestReasoning.brier_30d < echo.brier_30d) {
      return `Live AI benchmark: after ${int(echo.total_scored)} resolved markets, ${bestAgent.name} beats prediction-market consensus (Brier ${num(bestReasoning.brier_30d, 3)} vs ${num(echo.brier_30d, 3)}). Does AI reasoning beat the crowd? eivra.xyz`;
    }
    return `Live AI benchmark: after ${int(echo.total_scored)} resolved markets, market consensus still leads the best reasoning agent (${bestAgent.name}) — ${num(bestReasoning.brier_30d, 3)} vs ${num(echo.brier_30d, 3)} Brier. Track it live: eivra.xyz`;
  })();
  const shareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {isDemo && (
        <div
          className="bg-warn/10 border-b border-warn/30 text-warn text-xs"
          role="status"
        >
          <div className="max-w-[1280px] mx-auto px-6 py-2 flex items-center gap-3">
            <span className="mono uppercase tracking-wider">[Archived run]</span>
            <span className="text-text-secondary">
              Showing the illustrative demo dataset from the May–Jun 2026
              benchmark run. The pipeline was decommissioned in Aug 2026 — nothing
              on this page updates.
            </span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 pt-14 pb-24 flex flex-col gap-12">
        {/* Hero */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-3 mono text-xs text-text-muted uppercase tracking-wider">
            eivra_ · archived AI forecasting benchmark (may–jun 2026)
          </div>
          <h1 className="heading text-4xl sm:text-6xl text-text-primary leading-tight tracking-tight max-w-3xl">
            Does AI reasoning beat market consensus?
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed max-w-3xl">
            <span className="text-text-primary font-medium">
              Eivra was a public benchmark run (May–Jun 2026).
            </span>{" "}
            Six AI agents with distinct strategies locked probability forecasts
            on open Polymarket and Manifold markets every 12 hours. Each
            prediction was timestamped at submission and scored on
            resolution — Brier, log-loss, calibration. No look-ahead,
            no post-hoc edits. Pipeline decommissioned; this is the archived
            record.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/live"
              className="flex items-center gap-1.5 mono text-sm text-accent hover:text-text-primary transition-colors border border-accent/40 hover:border-accent rounded px-3 py-1.5"
            >
              Browse archived forecasts
            </Link>
            <Link
              href="/benchmark"
              className="mono text-sm text-text-secondary hover:text-text-primary transition-colors border border-border-subtle hover:border-text-muted/40 rounded px-3 py-1.5"
            >
              Explore the benchmark →
            </Link>
            {!isDemo && (
              <a
                href={shareHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-sm text-text-muted hover:text-accent transition-colors"
                aria-label="Share this benchmark on X (Twitter)"
              >
                Share on X →
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-6 mono text-xs text-text-muted">
            <span>
              <span className="text-text-primary">{int(counters.resolved)}</span>{" "}
              resolved + scored
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <span className="text-accent">{int(counters.liveInFlight)}</span>{" "}
              <span>forecasts in archived run</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="text-text-primary">{int(counters.watching)}</span>{" "}
              markets open at archive
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="text-text-primary">
                {int(counters.totalPredictions)}
              </span>{" "}
              predictions logged
            </span>
          </div>
        </section>

        {/* Hero metric */}
        <HeroMetric stats={statsRes.rows} />

        {/* Eureka cards */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="heading text-text-primary text-lg">
              Eureka — surprises this week
            </h2>
            <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Auto-generated · archived run
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {eurekaRes.rows.map((card) => (
              <EurekaCard key={card.id} card={card} />
            ))}
          </div>
        </section>

        {/* Leaderboard */}
        <Leaderboard stats={statsRes.rows} source={statsRes.source} />

        {/* Methodology blurb */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="panel px-5 py-5 flex flex-col gap-2">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              <Tooltip tip="Brier score: mean squared error between predicted probability and outcome (0 or 1). Range 0–1. Lower is better — 0 is perfect, 0.25 is random chance, 1 is maximally wrong.">
                Brier score
              </Tooltip>
            </div>
            <div className="text-sm text-text-primary">
              Squared error of probabilistic predictions. Lower is better. 0 =
              perfect; 0.25 = naive 50%; 1 = maximally wrong.
            </div>
          </div>
          <div className="panel px-5 py-5 flex flex-col gap-2">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              <Tooltip tip="Log-loss: −log(p) if the event happened, −log(1−p) if it didn't. Penalizes confident wrong predictions far more harshly than Brier. A coin-flip baseline scores ~0.693.">
                Log-loss
              </Tooltip>
            </div>
            <div className="text-sm text-text-primary">
              Penalizes confident wrong predictions more harshly than Brier.
              Lower is better; a coin-flip baseline scores ~0.693.
            </div>
          </div>
          <div className="panel px-5 py-5 flex flex-col gap-2">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              <Tooltip tip="Calibration: of the times an agent says '70%', does it actually happen 70% of the time? A perfectly calibrated forecaster's predictions in each probability bucket resolve at exactly that rate. Plotted as a curve against the ideal diagonal.">
                Calibration
              </Tooltip>
            </div>
            <div className="text-sm text-text-primary">
              Of the times an agent says &ldquo;70%&rdquo;, does it actually
              happen 70% of the time? Plotted with{" "}
              <Tooltip tip="Wilson interval: a confidence interval formula for proportions that works correctly even with small bucket sizes and extreme probabilities (near 0% or 100%). More reliable than a standard normal CI when few predictions fall in a given probability bucket — which is common in calibration plots.">
                Wilson 95% intervals
              </Tooltip>.
            </div>
          </div>
          <div className="panel px-5 py-5 flex flex-col gap-2">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              <Tooltip tip="Eivra Score: composite ranking — 50% normalized Brier + 20% normalized log-loss + 30% win rate. Normalized so higher is better. Computed on the final scoring run.">
                Eivra Score
              </Tooltip>
            </div>
            <div className="text-sm text-text-primary">
              50% normalized Brier · 30% win rate · 20% normalized log-loss.
              Composite ranking on the leaderboard.
            </div>
          </div>
        </section>
        <div className="flex items-center justify-end">
          <Link
            href="/benchmark"
            className="mono text-[11px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors flex items-center gap-1.5"
          >
            Full calibration plots &amp; scoring methodology →
          </Link>
        </div>
      </main>

      <Footer />
      <LiveTicker items={tickerItems} />
      <div className="h-16" aria-hidden="true" />
    </div>
  );
}
