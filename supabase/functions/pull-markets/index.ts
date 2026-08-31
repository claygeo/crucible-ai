/**
 * pull-markets — Supabase Edge Function (Deno).
 *
 * Pulls open prediction-market questions from Polymarket Gamma + Manifold
 * Markets every 15 min via pg_cron. Idempotent UPSERT into public.markets.
 *
 * Schedule (set up in supabase/migrations/0003_cron_pull_markets.sql):
 *   select cron.schedule('pull-markets', '*/15 * * * *',
 *     $$ select net.http_post(
 *          url := 'https://YOUR-PROJECT-REF.functions.supabase.co/pull-markets',
 *          headers := '{"Authorization": "Bearer '||current_setting('app.cron_token')||'"}'::jsonb
 *        ) $$);
 *
 * Auth: takes a bearer token matching env CRON_SHARED_SECRET. Or uses service role.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SHARED_SECRET = Deno.env.get("CRON_SHARED_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type CommonMarket = {
  source: "polymarket" | "manifold";
  source_id: string;
  question: string;
  description?: string;
  url: string;
  category: string;
  status: "open" | "pending_resolution" | "resolved" | "voided";
  outcome_yes_price: number;
  closes_at?: string;
  resolved_at?: string;
  resolved_outcome?: boolean;
  raw: unknown;
};

/** Pull from Polymarket Gamma API: open markets, top by liquidity. */
async function pullPolymarket(): Promise<CommonMarket[]> {
  // Polymarket Gamma open-markets endpoint — returns ~100 active by default.
  // Docs: https://docs.polymarket.com/developers/gamma-markets-api
  const url =
    "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=80";
  const res = await fetch(url, {
    headers: { "user-agent": "eivra-bot/0.1" },
  });
  if (!res.ok) {
    throw new Error(`polymarket gamma ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as Array<Record<string, unknown>>;
  const out: CommonMarket[] = [];
  for (const m of json) {
    if (typeof m.id !== "string" && typeof m.id !== "number") continue;
    const q = (m.question as string | undefined) ?? "";
    if (!q || q.length < 8) continue;
    // Best-effort YES price extraction
    let yesPrice = 0.5;
    if (typeof m.outcomePrices === "string") {
      try {
        const arr = JSON.parse(m.outcomePrices) as string[];
        if (arr.length > 0) yesPrice = Number(arr[0]);
      } catch {}
    } else if (Array.isArray(m.outcomePrices)) {
      const first = (m.outcomePrices as unknown[])[0];
      if (typeof first === "string" || typeof first === "number")
        yesPrice = Number(first);
    }
    if (!Number.isFinite(yesPrice) || yesPrice <= 0 || yesPrice >= 1)
      yesPrice = 0.5;

    const closesAt = (m.endDate as string | undefined) ?? undefined;
    const url =
      "https://polymarket.com/event/" +
      ((m.slug as string | undefined) ?? String(m.id));

    out.push({
      source: "polymarket",
      source_id: String(m.id),
      question: q,
      description: (m.description as string | undefined) ?? undefined,
      url,
      category: classifyCategory(q),
      status: "open",
      outcome_yes_price: yesPrice,
      closes_at: closesAt,
      raw: m,
    });
  }
  return out;
}

/** Pull from Manifold Markets API: open markets, recent activity. */
async function pullManifold(): Promise<CommonMarket[]> {
  // Manifold v0 markets endpoint — returns recent markets across all groups.
  // Docs: https://docs.manifold.markets/api
  const url = "https://api.manifold.markets/v0/markets?limit=80";
  const res = await fetch(url, {
    headers: { "user-agent": "eivra-bot/0.1" },
  });
  if (!res.ok) {
    throw new Error(`manifold ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as Array<Record<string, unknown>>;
  const out: CommonMarket[] = [];
  for (const m of json) {
    if (typeof m.id !== "string") continue;
    if (m.outcomeType !== "BINARY") continue; // week-1: binary only
    if (m.isResolved) continue; // skip resolved on pull (we'll catch via resolve-markets)
    const q = (m.question as string | undefined) ?? "";
    if (!q || q.length < 8) continue;

    const probability = (m.probability as number | undefined) ?? 0.5;
    const closeTime = (m.closeTime as number | undefined) ?? undefined;
    const url = (m.url as string | undefined) ?? `https://manifold.markets/`;

    out.push({
      source: "manifold",
      source_id: m.id,
      question: q,
      description: (m.textDescription as string | undefined) ?? undefined,
      url,
      category: classifyCategory(q),
      status: "open",
      outcome_yes_price: probability,
      closes_at: closeTime ? new Date(closeTime).toISOString() : undefined,
      raw: m,
    });
  }
  return out;
}

/** Crude classifier for category — replace with embeddings or LLM later. */
function classifyCategory(question: string): string {
  const q = question.toLowerCase();
  if (
    /trump|election|biden|congress|senate|president|vote|pol(itical|itics|l)|approval/.test(
      q
    )
  )
    return "politics";
  if (
    /bitcoin|btc|ether(eum)?|eth|crypto|solana|sol|defi|nft|coinbase|binance/.test(
      q
    )
  )
    return "crypto";
  if (
    /nfl|nba|mlb|nhl|fifa|world cup|super bowl|playoff|championship|olympic|sports?/.test(
      q
    )
  )
    return "sports";
  if (
    /\bai\b|gpt|claude|llm|model|openai|anthropic|deepmind|google|nvidia|chatbot|agent/.test(
      q
    )
  )
    return "ai-tech";
  return "other";
}

/** UPSERT markets idempotently. */
async function upsertMarkets(markets: CommonMarket[]) {
  if (markets.length === 0) return { inserted: 0 };
  const rows = markets.map((m) => ({
    source: m.source,
    source_id: m.source_id,
    question: m.question.slice(0, 1000),
    description: m.description?.slice(0, 4000) ?? null,
    url: m.url,
    category: m.category,
    status: m.status,
    outcome_yes_price: m.outcome_yes_price,
    closes_at: m.closes_at ?? null,
    resolved_at: m.resolved_at ?? null,
    resolved_outcome: m.resolved_outcome ?? null,
    raw: m.raw,
    updated_at: new Date().toISOString(),
  }));
  const { error, count } = await sb
    .from("markets")
    .upsert(rows, { onConflict: "source,source_id", count: "exact" });
  if (error) throw new Error(`upsert markets: ${error.message}`);
  return { inserted: count ?? rows.length };
}

async function logEvent(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
) {
  await sb
    .from("system_events")
    .insert({ level, source: "pull-markets", message, meta: meta ?? null });
}

Deno.serve(async (req) => {
  // Auth gate
  if (CRON_SHARED_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${CRON_SHARED_SECRET}`) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  // Kill switch
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
  let polyOk = 0,
    manifoldOk = 0,
    errors: string[] = [];

  try {
    const [polyRes, manifoldRes] = await Promise.allSettled([
      pullPolymarket(),
      pullManifold(),
    ]);

    if (polyRes.status === "fulfilled") {
      const r = await upsertMarkets(polyRes.value);
      polyOk = r.inserted;
    } else {
      errors.push(`polymarket: ${polyRes.reason}`);
    }
    if (manifoldRes.status === "fulfilled") {
      const r = await upsertMarkets(manifoldRes.value);
      manifoldOk = r.inserted;
    } else {
      errors.push(`manifold: ${manifoldRes.reason}`);
    }

    const summary = {
      duration_ms: Date.now() - t0,
      polymarket_upserted: polyOk,
      manifold_upserted: manifoldOk,
      errors,
    };
    await logEvent(errors.length ? "warn" : "info", "pull complete", summary);
    return new Response(JSON.stringify(summary), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await logEvent("error", "pull failed", { err });
    return new Response(JSON.stringify({ error: err }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
