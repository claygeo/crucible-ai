/**
 * generate-eureka.ts — refresh the 3 Eureka insight cards from live Supabase data.
 *
 * Replaces the static DEMO_EUREKA_CARDS on the homepage. Runs daily on VPS.
 *
 * Per /codex 2026-05-11 design call, the 3 archetypes are:
 *   1. Conviction Gap — agent performance on high-confidence calls (p>=0.8 or p<=0.2)
 *   2. Market Mispricing Hunter — agent that profited most fading the market in a category
 *   3. Calibration Surprise — surprisingly tight calibration in a specific probability bin
 *
 * Strategy:
 *   - Deactivate all existing active eureka cards
 *   - Insert 3 new active cards with sort_order 0/1/2
 *   - If a computation has insufficient data, emit a stub card explaining it
 *
 * Run: npx tsx backfill/generate-eureka.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

const SUPABASE_URL = "https://atxtnpgwrcesifejltah.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? loadFromEnvFile() ?? "";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type PredictionRow = {
  id: string;
  agent_id: string;
  market_id: string;
  probability: number;
  market_price_at_forecast: number;
  abstained: boolean;
  created_at: string;
};

type ScoreRow = {
  prediction_id: string;
  agent_id: string;
  market_id: string;
  brier: number;
  log_loss: number;
  paper_pnl: number;
  was_correct: boolean;
};

type MarketRow = {
  id: string;
  category: string;
  resolved_outcome: boolean | null;
};

type AgentRow = { id: string; name: string };

type EurekaCardOut = {
  headline: string;
  body: string;
  evidence: Record<string, unknown>;
  generated_at: string;
  active: boolean;
  sort_order: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Data loading
// ────────────────────────────────────────────────────────────────────────────

async function loadData() {
  const [{ data: agents }, { data: preds }, { data: scores }, { data: markets }] =
    await Promise.all([
      sb.from("agents").select("id, name"),
      sb
        .from("predictions")
        .select("id, agent_id, market_id, probability, market_price_at_forecast, abstained, created_at")
        .eq("abstained", false),
      sb.from("scores").select("prediction_id, agent_id, market_id, brier, log_loss, paper_pnl, was_correct"),
      sb
        .from("markets")
        .select("id, category, resolved_outcome")
        .eq("status", "resolved"),
    ]);

  return {
    agents: (agents ?? []) as AgentRow[],
    preds: (preds ?? []) as PredictionRow[],
    scores: (scores ?? []) as ScoreRow[],
    markets: (markets ?? []) as MarketRow[],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Archetype 1: Conviction Gap
// ────────────────────────────────────────────────────────────────────────────

function convictionCard(
  agents: AgentRow[],
  preds: PredictionRow[],
  scores: ScoreRow[]
): EurekaCardOut | null {
  // For each agent: filter to high-conviction predictions (p>=0.8 OR p<=0.2),
  // join to scores, compute win rate + avg Brier. Compare to field-wide
  // same-bucket performance.
  const scoreByPred = new Map(scores.map((s) => [s.prediction_id, s]));
  const HIGH = 0.8;
  const LOW = 0.2;
  type Stat = { n: number; wins: number; brierSum: number };
  const byAgent = new Map<string, Stat>();
  const field: Stat = { n: 0, wins: 0, brierSum: 0 };

  for (const p of preds) {
    const isHC = p.probability >= HIGH || p.probability <= LOW;
    if (!isHC) continue;
    const s = scoreByPred.get(p.id);
    if (!s) continue;
    const a = byAgent.get(p.agent_id) ?? { n: 0, wins: 0, brierSum: 0 };
    a.n += 1;
    if (s.was_correct) a.wins += 1;
    a.brierSum += Number(s.brier);
    byAgent.set(p.agent_id, a);
    field.n += 1;
    if (s.was_correct) field.wins += 1;
    field.brierSum += Number(s.brier);
  }

  if (field.n < 10) return null;

  const fieldWin = field.wins / field.n;
  const fieldBrier = field.brierSum / field.n;

  // Pick the agent with biggest positive edge over field (high win rate AND low Brier),
  // requiring n >= 8 for some reliability.
  let best: { id: string; stat: Stat; winRate: number; brier: number; edge: number } | null = null;
  for (const [id, stat] of byAgent.entries()) {
    if (stat.n < 8) continue;
    const winRate = stat.wins / stat.n;
    const brier = stat.brierSum / stat.n;
    const edge = (winRate - fieldWin) - (brier - fieldBrier);
    if (!best || edge > best.edge) best = { id, stat, winRate, brier, edge };
  }
  if (!best) return null;
  const agentName = agents.find((a) => a.id === best.id)?.name ?? best.id;
  const bucket = "p ≥ 0.8 or ≤ 0.2";
  return {
    headline: `${agentName}'s edge appears when it stops hedging`,
    body: `On high-conviction calls (${bucket}, n=${best.stat.n}), ${agentName} posts a ${pct(best.winRate)} win rate and ${best.brier.toFixed(3)} Brier — vs the field's ${pct(fieldWin)} / ${fieldBrier.toFixed(3)} in the same bucket.`,
    evidence: {
      archetype: "conviction_gap",
      agent_id: best.id,
      bucket: { lower: LOW, upper: HIGH },
      agent_n: best.stat.n,
      agent_win_rate: best.winRate,
      agent_brier: best.brier,
      field_n: field.n,
      field_win_rate: fieldWin,
      field_brier: fieldBrier,
    },
    generated_at: new Date().toISOString(),
    active: true,
    sort_order: 0,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Archetype 2: Market Mispricing Hunter
// ────────────────────────────────────────────────────────────────────────────

function mispricingCard(
  agents: AgentRow[],
  preds: PredictionRow[],
  scores: ScoreRow[],
  markets: MarketRow[]
): EurekaCardOut | null {
  const marketById = new Map(markets.map((m) => [m.id, m]));
  const scoreByPred = new Map(scores.map((s) => [s.prediction_id, s]));
  // For each (agent, category): keep predictions where |p - market_price| >= 0.10,
  // sum paper_pnl, count predictions. Pick (agent, category, pnl) with biggest pnl,
  // n >= 5.
  type Key = string; // `agent::category`
  type Slice = { agent_id: string; category: string; pnl: number; n: number; brierSum: number };
  const byKey = new Map<Key, Slice>();
  const DISAGREE = 0.1;
  for (const p of preds) {
    const m = marketById.get(p.market_id);
    if (!m) continue;
    const disagree = Math.abs(p.probability - p.market_price_at_forecast);
    if (disagree < DISAGREE) continue;
    const s = scoreByPred.get(p.id);
    if (!s) continue;
    const k = `${p.agent_id}::${m.category}`;
    const slice = byKey.get(k) ?? { agent_id: p.agent_id, category: m.category, pnl: 0, n: 0, brierSum: 0 };
    slice.pnl += Number(s.paper_pnl ?? 0);
    slice.n += 1;
    slice.brierSum += Number(s.brier);
    byKey.set(k, slice);
  }

  let best: Slice | null = null;
  for (const s of byKey.values()) {
    if (s.n < 5) continue;
    if (!best || s.pnl > best.pnl) best = s;
  }
  if (!best || best.pnl <= 0) return null;
  const agentName = agents.find((a) => a.id === best.agent_id)?.name ?? best.agent_id;
  const brier = best.brierSum / best.n;
  return {
    headline: `${agentName} made the most fading the market in ${best.category}`,
    body: `On ${best.category} calls where ${agentName} disagreed with the market by 10pp+, paper P&L was ${signedDollars(best.pnl)} across ${best.n} predictions (Brier ${brier.toFixed(3)}). Mispricing edge, not just rank.`,
    evidence: {
      archetype: "mispricing_hunter",
      agent_id: best.agent_id,
      category: best.category,
      n: best.n,
      paper_pnl: best.pnl,
      avg_brier: brier,
      disagreement_threshold: DISAGREE,
    },
    generated_at: new Date().toISOString(),
    active: true,
    sort_order: 1,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Archetype 3: Calibration Surprise
// ────────────────────────────────────────────────────────────────────────────

async function calibrationCard(
  agents: AgentRow[]
): Promise<EurekaCardOut | null> {
  // Use agent_stats.calibration JSON. For each agent, find the bin where
  // observed_rate is closest to the bin's mid-prob AND n>=5. The "tightest
  // calibration in a tail bin" is the most surprising claim.
  const { data: stats } = await sb
    .from("agent_stats")
    .select("agent_id, calibration, total_scored");
  if (!stats) return null;

  type Best = {
    agent_id: string;
    bin_low: number;
    bin_high: number;
    n: number;
    predicted: number;
    observed: number;
    gap: number;
  };
  let best: Best | null = null;
  for (const s of stats as Array<{ agent_id: string; calibration: unknown; total_scored: number }>) {
    if (!Array.isArray(s.calibration) || s.total_scored < 10) continue;
    for (const b of s.calibration as Array<{
      bin_low: number;
      bin_high: number;
      n: number;
      observed_rate: number;
    }>) {
      if (!b || b.n < 5) continue;
      const mid = (b.bin_low + b.bin_high) / 2;
      const gap = Math.abs(b.observed_rate - mid);
      // Bonus weight for tail bins (closer to 0 or 1 = more surprising calibration)
      const tailBonus = Math.min(b.bin_low, 1 - b.bin_high) <= 0.1 ? 0.02 : 0;
      const score = gap - tailBonus;
      if (!best || score < best.gap) {
        best = {
          agent_id: s.agent_id,
          bin_low: b.bin_low,
          bin_high: b.bin_high,
          n: b.n,
          predicted: mid,
          observed: b.observed_rate,
          gap,
        };
      }
    }
  }
  if (!best) return null;
  const agentName = agents.find((a) => a.id === best.agent_id)?.name ?? best.agent_id;
  const bandLabel = `${Math.round(best.bin_low * 100)}-${Math.round(best.bin_high * 100)}%`;
  return {
    headline: `${agentName}'s ${bandLabel} forecasts hit ${pct(best.observed)} of the time`,
    body: `In the ${bandLabel} probability band, ${agentName} predicted ${pct(best.predicted, 1)} on average — and ${pct(best.observed)} of those ${best.n} resolved markets actually happened. That's the tightest-calibrated pocket in the field right now.`,
    evidence: {
      archetype: "calibration_surprise",
      agent_id: best.agent_id,
      band: { lower: best.bin_low, upper: best.bin_high, mid: best.predicted },
      n: best.n,
      observed_rate: best.observed,
      gap_from_perfect: best.gap,
    },
    generated_at: new Date().toISOString(),
    active: true,
    sort_order: 2,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Fallback / orchestrator
// ────────────────────────────────────────────────────────────────────────────

function fallbackCard(sort_order: number, archetype: string): EurekaCardOut {
  return {
    headline: archetype === "conviction_gap"
      ? "Not enough high-conviction data yet"
      : archetype === "mispricing_hunter"
        ? "Looking for category-level mispricing"
        : "Calibration bins still filling",
    body:
      "This insight refreshes when more resolved markets are scored across the field. Backfill cron runs every 6 hours.",
    evidence: { archetype, stub: true },
    generated_at: new Date().toISOString(),
    active: true,
    sort_order,
  };
}

async function main() {
  console.log("[eureka] loading data...");
  const { agents, preds, scores, markets } = await loadData();
  console.log(
    `[eureka] agents=${agents.length} preds=${preds.length} scores=${scores.length} resolved_markets=${markets.length}`
  );

  const conviction = convictionCard(agents, preds, scores);
  const mispricing = mispricingCard(agents, preds, scores, markets);
  const calibration = await calibrationCard(agents);

  const cards: EurekaCardOut[] = [
    conviction ?? fallbackCard(0, "conviction_gap"),
    mispricing ?? fallbackCard(1, "mispricing_hunter"),
    calibration ?? fallbackCard(2, "calibration_surprise"),
  ];

  // Deactivate existing cards
  console.log("[eureka] deactivating old cards...");
  const { error: deactErr } = await sb
    .from("eureka_cards")
    .update({ active: false })
    .eq("active", true);
  if (deactErr) {
    console.warn("[eureka] deactivate warning:", deactErr.message);
  }

  // Insert new
  console.log("[eureka] inserting new cards...");
  const { error: insErr } = await sb.from("eureka_cards").insert(cards);
  if (insErr) {
    console.error("[eureka] insert error:", insErr.message);
    process.exit(1);
  }

  console.log("[eureka] new cards:");
  for (const c of cards) {
    console.log(`  - sort_order=${c.sort_order} [${c.headline}]`);
  }

  await sb.from("system_events").insert({
    level: "info",
    source: "generate-eureka",
    message: "eureka cards refreshed",
    meta: {
      cards: cards.map((c) => ({ sort_order: c.sort_order, archetype: (c.evidence as { archetype?: string }).archetype })),
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function signedDollars(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "+";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function loadFromEnvFile(): string | undefined {
  if (existsSync(".env.local")) {
    const c = readFileSync(".env.local", "utf8");
    const m = c.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^"(.*)"$/, "$1");
  }
  return undefined;
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
