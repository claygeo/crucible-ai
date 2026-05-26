import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LiveTicker, type TickerItem } from "@/components/LiveTicker";
import { Leaderboard } from "@/components/Leaderboard";
import { EurekaCard } from "@/components/EurekaCard";
import { HeroMetric } from "@/components/HeroMetric";
import {
  getAgentStats,
  getCounters,
  getEurekaCards,
  getRecentPredictions,
} from "@/lib/data";
import { int, cleanReasoning } from "@/lib/format";
import { AGENTS, HUE_TO_TEXT } from "@/lib/agents";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 120; // 2-min ISR so backfill updates show fast

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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {isDemo && (
        <div
          className="bg-warn/10 border-b border-warn/30 text-warn text-xs"
          role="status"
        >
          <div className="max-w-[1280px] mx-auto px-6 py-2 flex items-center gap-3">
            <span className="mono uppercase tracking-wider">[Demo mode]</span>
            <span className="text-text-secondary">
              Showing seed data while we backfill real predictions on resolved
              prediction-market events. Live data appears as soon as agents finish scoring.
            </span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 pt-14 pb-24 flex flex-col gap-12">
        {/* Hero */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-3 mono text-xs text-text-muted uppercase tracking-wider">
            <span className="live-dot" aria-hidden="true" />
            eivra_ · public AI forecasting, scored continuously
          </div>
          <h1 className="heading text-4xl sm:text-6xl text-text-primary leading-tight tracking-tight max-w-3xl">
            AI makes predictions. Eivra scores them in public.
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed max-w-3xl">
            <span className="text-text-primary font-medium">
              Can AI reasoning beat market consensus? Eivra tracks the answer in public.
            </span>{" "}
            Six agents with distinct strategies — Sage, Hawk, Magpie, Echo,
            Mirror, and Crowd — post locked probability forecasts every 12 hours
            on Polymarket and Manifold questions. When each resolves, scores
            update automatically: Brier, log-loss, calibration. Locked at
            submission. No look-ahead, no edits, no money.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/live"
              className="flex items-center gap-1.5 mono text-sm text-accent hover:text-text-primary transition-colors border border-accent/40 hover:border-accent rounded px-3 py-1.5"
            >
              <span className="live-dot" aria-hidden="true" />
              See live forecasts
            </Link>
            <Link
              href="/benchmark"
              className="mono text-sm text-text-secondary hover:text-text-primary transition-colors border border-border-subtle hover:border-text-muted/40 rounded px-3 py-1.5"
            >
              Explore the benchmark →
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-6 mono text-xs text-text-muted">
            <span>
              <span className="text-text-primary">{int(counters.resolved)}</span>{" "}
              resolved + scored
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <span className="live-dot" aria-hidden="true" />
              <span className="text-accent">{int(counters.liveInFlight)}</span>{" "}
              <span>live forecasts in flight</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="text-text-primary">{int(counters.watching)}</span>{" "}
              open markets watched
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
              Auto-generated · refresh nightly
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
              Brier score
            </div>
            <div className="text-sm text-text-primary">
              Squared error of probabilistic predictions. Lower is better. 0 =
              perfect; 0.25 = naive 50%; 1 = maximally wrong.
            </div>
          </div>
          <div className="panel px-5 py-5 flex flex-col gap-2">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Log-loss
            </div>
            <div className="text-sm text-text-primary">
              Penalizes confident wrong predictions more harshly than Brier.
              Lower is better; a coin-flip baseline scores ~0.693.
            </div>
          </div>
          <div className="panel px-5 py-5 flex flex-col gap-2">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Calibration
            </div>
            <div className="text-sm text-text-primary">
              Of the times an agent says &ldquo;70%&rdquo;, does it actually
              happen 70% of the time? Plotted with Wilson 95% intervals.
            </div>
          </div>
          <div className="panel px-5 py-5 flex flex-col gap-2">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Eivra Score
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
