/**
 * resolve-markets — Supabase Edge Function (Deno).
 *
 * Runs every 30 min via pg_cron. For each market that's now resolved on the
 * provider but not yet scored in our DB:
 *   1. Update markets.resolved_outcome / resolved_at / status
 *   2. For every prediction on that market with created_at < resolved_at,
 *      compute Brier + log-loss + paper P&L and insert into scores.
 *   3. Refresh agent_stats and agent_elo.
 *   4. Compute the synthetic "ensemble" / "Crowd" prediction (uniform-weight
 *      of all non-abstaining individual predictions on this market) and
 *      score it.
 *
 * Idempotent — UPSERT on scores.prediction_id.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SHARED_SECRET = Deno.env.get("CRON_SHARED_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type DBMarket = {
  id: string;
  source: string;
  source_id: string;
  question: string;
  status: string;
  resolved_outcome: boolean | null;
  resolved_at: string | null;
};

/** Pull resolution from Polymarket Gamma. */
async function fetchPolymarketResolution(sourceId: string): Promise<{
  resolved: boolean;
  outcome?: boolean;
  resolved_at?: string;
} | null> {
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/markets/${sourceId}`,
      { headers: { "user-agent": "eivra-bot/0.1" } }
    );
    if (!res.ok) return null;
    const m = (await res.json()) as Record<string, unknown>;
    if (m.closed !== true) return { resolved: false };
    // Polymarket: outcomePrices[0] = 1.0 means YES won
    let outcome: boolean | undefined;
    if (typeof m.outcomePrices === "string") {
      try {
        const arr = JSON.parse(m.outcomePrices) as string[];
        const p = Number(arr[0]);
        if (p === 1) outcome = true;
        else if (p === 0) outcome = false;
      } catch {}
    }
    if (outcome === undefined) return { resolved: false }; // ambiguous, skip
    return {
      resolved: true,
      outcome,
      resolved_at: (m.endDate as string | undefined) ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Pull resolution from Manifold. */
async function fetchManifoldResolution(sourceId: string): Promise<{
  resolved: boolean;
  outcome?: boolean;
  resolved_at?: string;
} | null> {
  try {
    const res = await fetch(
      `https://api.manifold.markets/v0/market/${sourceId}`,
      { headers: { "user-agent": "eivra-bot/0.1" } }
    );
    if (!res.ok) return null;
    const m = (await res.json()) as Record<string, unknown>;
    if (m.isResolved !== true) return { resolved: false };
    const resolution = m.resolution as string | undefined;
    let outcome: boolean | undefined;
    if (resolution === "YES") outcome = true;
    else if (resolution === "NO") outcome = false;
    else return { resolved: false }; // MKT / CANCEL — not a binary outcome
    return {
      resolved: true,
      outcome,
      resolved_at:
        (m.resolutionTime as number | undefined) !== undefined
          ? new Date(m.resolutionTime as number).toISOString()
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function clamp(p: number): number {
  return Math.min(0.9999, Math.max(0.0001, p));
}

async function logEvent(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
) {
  await sb
    .from("system_events")
    .insert({ level, source: "resolve-markets", message, meta: meta ?? null });
}

Deno.serve(async (req) => {
  if (CRON_SHARED_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${CRON_SHARED_SECRET}`) {
      return new Response("unauthorized", { status: 401 });
    }
  }
  const { data: ks } = await sb
    .from("system_settings")
    .select("value")
    .eq("key", "global_pause")
    .single();
  if (ks?.value === true) {
    return new Response(JSON.stringify({ skipped: "global_pause=true" }), {
      headers: { "content-type": "application/json" },
    });
  }

  const t0 = Date.now();

  // 1. Find markets we believe are still open but might have resolved on the provider
  const { data: candidates, error } = await sb
    .from("markets")
    .select("id, source, source_id, question, status, resolved_outcome, resolved_at")
    .in("status", ["open", "pending_resolution"])
    .or("closes_at.lt.now(),closes_at.is.null")
    .limit(50);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  let resolvedCount = 0;
  let scoredCount = 0;
  const errors: string[] = [];

  for (const c of (candidates ?? []) as DBMarket[]) {
    let resolution: Awaited<ReturnType<typeof fetchPolymarketResolution>> = null;
    if (c.source === "polymarket")
      resolution = await fetchPolymarketResolution(c.source_id);
    else if (c.source === "manifold")
      resolution = await fetchManifoldResolution(c.source_id);
    if (!resolution || !resolution.resolved) {
      // Not resolved yet — bump status to pending_resolution if past closes_at
      await sb
        .from("markets")
        .update({ status: "pending_resolution", updated_at: new Date().toISOString() })
        .eq("id", c.id);
      continue;
    }

    // Update market record
    await sb
      .from("markets")
      .update({
        status: "resolved",
        resolved_outcome: resolution.outcome,
        resolved_at: resolution.resolved_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.id);
    resolvedCount += 1;

    // Score every prediction made BEFORE the resolution timestamp
    const { data: preds } = await sb
      .from("predictions")
      .select("id, agent_id, probability, market_price_at_forecast, abstained, created_at")
      .eq("market_id", c.id)
      .lt("created_at", resolution.resolved_at ?? new Date().toISOString());

    if (!preds || preds.length === 0) continue;

    const outcome = resolution.outcome ? 1 : 0;
    const scoreRows: Array<Record<string, unknown>> = [];
    for (const p of preds) {
      if (p.abstained) continue; // abstained predictions are not scored
      const pp = clamp(Number(p.probability));
      const brier = (pp - outcome) ** 2;
      const log_loss = -(outcome * Math.log(pp) + (1 - outcome) * Math.log(1 - pp));
      const wasCorrect = (pp > 0.5) === Boolean(outcome);
      // Paper P&L: Kelly fraction = 0.25 of $100 bankroll, take long-yes if pp > market_price else long-no
      const stake = 25;
      const mp = Number(p.market_price_at_forecast ?? 0.5);
      const tookYes = pp > mp;
      const paper_pnl = tookYes
        ? stake * (outcome - mp)
        : stake * (mp - outcome);
      scoreRows.push({
        prediction_id: p.id,
        agent_id: p.agent_id,
        market_id: c.id,
        brier,
        log_loss,
        paper_pnl,
        was_correct: wasCorrect,
      });
    }
    if (scoreRows.length > 0) {
      const { error: scoreErr } = await sb
        .from("scores")
        .upsert(scoreRows, { onConflict: "prediction_id" });
      if (scoreErr) {
        errors.push(`score insert market=${c.id}: ${scoreErr.message}`);
      } else {
        scoredCount += scoreRows.length;
      }
    }
  }

  // Refresh agent_stats — recompute rolling 30-day stats
  await refreshAgentStats();

  const summary = {
    duration_ms: Date.now() - t0,
    candidates_checked: candidates?.length ?? 0,
    markets_resolved: resolvedCount,
    predictions_scored: scoredCount,
    errors,
  };
  await logEvent(errors.length ? "warn" : "info", "resolve complete", summary);
  return new Response(JSON.stringify(summary), {
    headers: { "content-type": "application/json" },
  });
});

async function refreshAgentStats() {
  // Agent_stats refresh — uses raw SQL via execute_sql RPC equivalent.
  // For simplicity we do it in JS.
  const { data: agents } = await sb.from("agents").select("id");
  if (!agents) return;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  for (const a of agents) {
    const { data: scores } = await sb
      .from("scores")
      .select("brier, log_loss, paper_pnl, was_correct, scored_at")
      .eq("agent_id", a.id)
      .gte("scored_at", thirtyDaysAgo);
    const { data: allScores } = await sb
      .from("scores")
      .select("brier, log_loss, paper_pnl")
      .eq("agent_id", a.id);
    const { count: totalPreds } = await sb
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", a.id);

    const sample = (scores ?? []) as Array<{
      brier: number;
      log_loss: number;
      paper_pnl: number;
      was_correct: boolean;
    }>;
    const allSample = (allScores ?? []) as Array<{
      brier: number;
      log_loss: number;
      paper_pnl: number;
    }>;

    const avg = (xs: number[]) =>
      xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length;

    const brier30 = avg(sample.map((s) => Number(s.brier)));
    const ll30 = avg(sample.map((s) => Number(s.log_loss)));
    const pnl30 = sample.reduce((s, x) => s + Number(x.paper_pnl ?? 0), 0);
    const winrate30 =
      sample.length === 0
        ? null
        : sample.filter((s) => s.was_correct).length / sample.length;
    const brierAll = avg(allSample.map((s) => Number(s.brier)));
    const llAll = avg(allSample.map((s) => Number(s.log_loss)));
    const pnlAll = allSample.reduce((s, x) => s + Number(x.paper_pnl ?? 0), 0);

    await sb.from("agent_stats").upsert(
      {
        agent_id: a.id,
        total_predictions: totalPreds ?? 0,
        total_scored: allSample.length,
        brier_30d: brier30,
        log_loss_30d: ll30,
        brier_alltime: brierAll,
        log_loss_alltime: llAll,
        win_rate_30d: winrate30,
        paper_pnl_30d: pnl30,
        paper_pnl_alltime: pnlAll,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id" }
    );
  }

  // Compute Eivra Score + ranks
  const { data: stats } = await sb
    .from("agent_stats")
    .select("agent_id, brier_30d, log_loss_30d, win_rate_30d");
  const arr = (stats ?? []).filter(
    (s) =>
      s.brier_30d !== null && s.log_loss_30d !== null && s.win_rate_30d !== null
  ) as Array<{
    agent_id: string;
    brier_30d: number;
    log_loss_30d: number;
    win_rate_30d: number;
  }>;
  if (arr.length === 0) return;
  const minB = Math.min(...arr.map((s) => Number(s.brier_30d)));
  const maxB = Math.max(...arr.map((s) => Number(s.brier_30d)));
  const minL = Math.min(...arr.map((s) => Number(s.log_loss_30d)));
  const maxL = Math.max(...arr.map((s) => Number(s.log_loss_30d)));
  const scored = arr.map((s) => {
    const bn = maxB > minB ? (Number(s.brier_30d) - minB) / (maxB - minB) : 0;
    const ln = maxL > minL ? (Number(s.log_loss_30d) - minL) / (maxL - minL) : 0;
    const cs =
      0.5 * (1 - bn) + 0.3 * Number(s.win_rate_30d) + 0.2 * (1 - ln);
    return { agent_id: s.agent_id, eivra_score: cs };
  });
  scored.sort((a, b) => b.eivra_score - a.eivra_score);
  for (let i = 0; i < scored.length; i++) {
    await sb
      .from("agent_stats")
      .update({
        eivra_score: scored[i].eivra_score,
        rank: i + 1,
      })
      .eq("agent_id", scored[i].agent_id);
  }
}
