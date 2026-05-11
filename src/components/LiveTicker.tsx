"use client";

import { useEffect, useState, useReducer } from "react";
import { AGENTS, HUE_TO_TEXT } from "@/lib/agents";
import { DEMO_PREDICTIONS, DEMO_MARKETS } from "@/lib/demo-data";
import { trunc, prob, relativeTime } from "@/lib/format";

type TickerItem = {
  id: string;
  agentId: string;
  agentName: string;
  hueClass: string;
  marketTitle: string;
  probability: number;
  marketPrice: number;
  reasoning: string;
  ts: string;
};

function buildItems(): TickerItem[] {
  // Stitch the most recent N demo predictions into ticker items
  const recent = DEMO_PREDICTIONS.slice(-30).reverse();
  return recent.map((p, i) => {
    const agent = AGENTS.find((a) => a.id === p.agent_id)!;
    const market = DEMO_MARKETS.find((m) => m.id === p.market_id)!;
    return {
      id: `${p.agent_id}-${p.market_id}-${i}`,
      agentId: agent.id,
      agentName: agent.name,
      hueClass: HUE_TO_TEXT[agent.hue],
      marketTitle: market.question,
      probability: p.probability,
      marketPrice: p.market_price_at_forecast,
      reasoning: p.reasoning,
      ts: p.created_at,
    };
  });
}

/**
 * LiveTicker — bottom strip showing newest forecasts.
 *
 * Per /autoplan review:
 *   - When prefers-reduced-motion: discrete cycling, 4s dwell, cross-fade.
 *   - Mobile (<480px): same discrete cycling unconditionally; marquee not rendered.
 *   - aria-live="polite", each item announced as it appears.
 */
export function LiveTicker() {
  const items = buildItems();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sm = window.matchMedia("(max-width: 480px)");
    setReducedMotion(mq.matches);
    setIsMobile(sm.matches);
    const onMq = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    const onSm = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onMq);
    sm.addEventListener("change", onSm);
    return () => {
      mq.removeEventListener("change", onMq);
      sm.removeEventListener("change", onSm);
    };
  }, []);

  const useDiscrete = reducedMotion || isMobile;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 h-14 border-t border-border-subtle bg-panel-hi"
      role="region"
      aria-label="Live agent forecasts"
    >
      <div className="max-w-[1280px] mx-auto h-full flex items-center px-6 gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="live-dot" aria-hidden="true" />
          <span className="mono text-[11px] uppercase tracking-wider text-text-muted">
            Live
          </span>
        </div>

        {useDiscrete ? (
          <DiscreteTicker items={items} />
        ) : (
          <MarqueeTicker items={items} />
        )}
      </div>
    </div>
  );
}

function MarqueeTicker({ items }: { items: TickerItem[] }) {
  // Duplicate the list so the seamless loop wraps without a visible jump
  const doubled = [...items, ...items];
  return (
    <div
      className="overflow-hidden flex-1 relative"
      onMouseEnter={(e) => {
        const el = e.currentTarget.firstElementChild as HTMLElement | null;
        if (el) el.style.animationPlayState = "paused";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget.firstElementChild as HTMLElement | null;
        if (el) el.style.animationPlayState = "running";
      }}
    >
      <div
        className="flex animate-marquee whitespace-nowrap"
        style={{ animationDuration: `${items.length * 4}s` }}
        aria-hidden="true"
      >
        {doubled.map((it, i) => (
          <TickerItemLine key={`${it.id}-${i}`} item={it} />
        ))}
      </div>
    </div>
  );
}

function DiscreteTicker({ items }: { items: TickerItem[] }) {
  const [idx, dispatch] = useReducer(
    (state: number) => (state + 1) % items.length,
    0
  );
  useEffect(() => {
    if (items.length === 0) return;
    const interval = setInterval(dispatch, 4000);
    return () => clearInterval(interval);
  }, [items.length]);
  const item = items[idx];
  if (!item) return null;
  return (
    <div className="flex-1 overflow-hidden" aria-live="polite">
      <TickerItemLine item={item} key={item.id} />
    </div>
  );
}

function TickerItemLine({ item }: { item: TickerItem }) {
  const delta = item.probability - item.marketPrice;
  const deltaSign = delta >= 0 ? "+" : "";
  return (
    <span className="inline-flex items-center gap-3 px-4 mono text-xs">
      <span className={`uppercase tracking-wider ${item.hueClass}`}>
        {item.agentName}
      </span>
      <span className="text-text-muted">·</span>
      <span className="text-text-primary">{trunc(item.marketTitle, 56)}</span>
      <span className="text-text-muted">·</span>
      <span className="text-text-primary">P={prob(item.probability)}</span>
      <span
        className={`text-[10px] ${delta >= 0 ? "text-accent" : "text-text-muted"}`}
      >
        ({deltaSign}
        {prob(delta)})
      </span>
      <span className="text-text-muted">·</span>
      <span className="text-text-secondary">
        {trunc(item.reasoning, 88)}
      </span>
      <span className="text-text-muted ml-2">{relativeTime(item.ts)}</span>
    </span>
  );
}
