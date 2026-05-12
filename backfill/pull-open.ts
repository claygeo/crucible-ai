/**
 * pull-open.ts — pull OPEN prediction-market questions from Polymarket + Manifold
 * and UPSERT into Supabase. No LLM calls.
 *
 * Run cadence: every 15 min on VPS cron. Cheap, idempotent (UPSERT on
 * source+source_id), no auth needed.
 *
 * Purpose: keep the homepage "markets watched" counter alive (currently 0
 * because backfill only inserts resolved markets).
 *
 * Run: npx tsx backfill/pull-open.ts [--limit=100]
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

const args = process.argv.slice(2);
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "100");

type OpenMarket = {
  source: "polymarket" | "manifold";
  source_id: string;
  question: string;
  description?: string;
  url: string;
  category: string;
  status: "open";
  outcome_yes_price: number;
  closes_at?: string;
  raw: unknown;
};

function classifyCategory(question: string): string {
  const q = question.toLowerCase();
  if (/trump|election|biden|congress|senate|president|vote|pol(itical|itics|l)|approval/.test(q)) return "politics";
  if (/bitcoin|btc|ether(eum)?|eth|crypto|solana|sol|defi|nft|coinbase|binance/.test(q)) return "crypto";
  if (/nfl|nba|mlb|nhl|fifa|world cup|super bowl|playoff|championship|olympic|sports?/.test(q)) return "sports";
  if (/\bai\b|gpt|claude|llm|model|openai|anthropic|deepmind|google|nvidia|chatbot|agent/.test(q)) return "ai-tech";
  return "other";
}

async function pullPolymarketOpen(): Promise<OpenMarket[]> {
  console.log("[pull-open] polymarket...");
  const out: OpenMarket[] = [];
  let offset = 0;
  while (out.length < 200 && offset < 800) {
    const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volumeNum&ascending=false&limit=100&offset=${offset}`;
    const res = await fetch(url, { headers: { "user-agent": "eivra-pull/0.1" } });
    if (!res.ok) {
      console.warn(`[polymarket] ${res.status}`);
      break;
    }
    const arr = (await res.json()) as Array<Record<string, unknown>>;
    if (arr.length === 0) break;
    for (const m of arr) {
      if (typeof m.id !== "string" && typeof m.id !== "number") continue;
      const q = (m.question as string | undefined) ?? "";
      if (!q || q.length < 8) continue;
      const volumeNum = (m.volumeNum as number | undefined) ?? 0;
      if (volumeNum < 5000) continue;
      let yesPrice = 0.5;
      if (typeof m.lastTradePrice === "number") yesPrice = m.lastTradePrice as number;
      else if (typeof m.lastTradePrice === "string") yesPrice = Number(m.lastTradePrice);
      if (!Number.isFinite(yesPrice) || yesPrice <= 0 || yesPrice >= 1) yesPrice = 0.5;
      const endDate = m.endDate as string | undefined;
      out.push({
        source: "polymarket",
        source_id: String(m.id),
        question: q,
        description: (m.description as string | undefined) ?? undefined,
        url: "https://polymarket.com/event/" + ((m.slug as string | undefined) ?? String(m.id)),
        category: classifyCategory(q),
        status: "open",
        outcome_yes_price: yesPrice,
        closes_at: endDate,
        raw: m,
      });
    }
    offset += 100;
  }
  console.log(`[polymarket] ${out.length} open markets`);
  return out;
}

async function pullManifoldOpen(): Promise<OpenMarket[]> {
  console.log("[pull-open] manifold...");
  const out: OpenMarket[] = [];
  let before: string | undefined;
  let pages = 0;
  while (out.length < 200 && pages < 10) {
    const url = `https://api.manifold.markets/v0/markets?limit=100` + (before ? `&before=${before}` : "");
    const res = await fetch(url, { headers: { "user-agent": "eivra-pull/0.1" } });
    if (!res.ok) {
      console.warn(`[manifold] ${res.status}`);
      break;
    }
    const arr = (await res.json()) as Array<Record<string, unknown>>;
    if (arr.length === 0) break;
    pages += 1;
    before = arr[arr.length - 1]!.id as string;
    for (const m of arr) {
      if (typeof m.id !== "string") continue;
      if (m.outcomeType !== "BINARY") continue;
      if (m.isResolved === true) continue;
      const volume = (m.volume as number | undefined) ?? 0;
      const uniqueBettors = (m.uniqueBettorCount as number | undefined) ?? 0;
      if (uniqueBettors < 15 || volume < 200) continue;
      const q = (m.question as string | undefined) ?? "";
      if (!q || q.length < 8) continue;
      const ql = q.toLowerCase();
      if (
        /\b(my (friend|girlfriend|boyfriend|wife|husband|sister|brother|cat|dog|mom|dad|family)|will i\b|will [a-z]+ get me\b|🌀|emoji|comment)\b/.test(ql)
      ) continue;
      if (/\bconvince the machine|daily coinflip|prediction tournament|will this market\b/.test(ql)) continue;

      const lastPrice = (m.probability as number | undefined) ?? 0.5;
      const closeTime = m.closeTime as number | undefined;
      out.push({
        source: "manifold",
        source_id: m.id,
        question: q,
        description: (m.textDescription as string | undefined) ?? undefined,
        url: (m.url as string | undefined) ?? "https://manifold.markets/",
        category: classifyCategory(q),
        status: "open",
        outcome_yes_price: lastPrice,
        closes_at: closeTime ? new Date(closeTime).toISOString() : undefined,
        raw: m,
      });
    }
  }
  console.log(`[manifold] ${out.length} open markets`);
  return out;
}

async function upsertOpen(markets: OpenMarket[]) {
  if (markets.length === 0) return 0;
  const rows = markets.map((m) => ({
    source: m.source,
    source_id: m.source_id,
    question: m.question.slice(0, 1000),
    description: m.description?.slice(0, 4000) ?? null,
    url: m.url,
    category: m.category,
    status: "open" as const,
    outcome_yes_price: m.outcome_yes_price,
    closes_at: m.closes_at ?? null,
    raw: m.raw,
    updated_at: new Date().toISOString(),
  }));
  const { error, count } = await sb
    .from("markets")
    .upsert(rows, { onConflict: "source,source_id", count: "exact" });
  if (error) throw new Error(`upsert: ${error.message}`);
  return count ?? rows.length;
}

async function main() {
  const [poly, manifold] = await Promise.allSettled([pullPolymarketOpen(), pullManifoldOpen()]);
  const all: OpenMarket[] = [];
  if (poly.status === "fulfilled") all.push(...poly.value);
  if (manifold.status === "fulfilled") all.push(...manifold.value);
  // Round-robin by category for diversity, cap at LIMIT
  const byCat = new Map<string, OpenMarket[]>();
  for (const m of all) {
    const list = byCat.get(m.category) ?? [];
    list.push(m);
    byCat.set(m.category, list);
  }
  const cats = Array.from(byCat.keys());
  const out: OpenMarket[] = [];
  let i = 0;
  while (out.length < LIMIT && i < 1000) {
    const cat = cats[i % cats.length];
    const taken = out.filter((m) => m.category === cat).length;
    const list = byCat.get(cat) ?? [];
    if (taken < list.length) out.push(list[taken]!);
    i++;
    if (out.length === all.length) break;
  }
  console.log(`[pull-open] total ${all.length}, selecting ${out.length} diverse`);
  const inserted = await upsertOpen(out);
  console.log(`[pull-open] upserted ${inserted}`);
  await sb.from("system_events").insert({
    level: "info",
    source: "pull-open",
    message: "open-market pull complete",
    meta: { total: all.length, upserted: inserted, polymarket: poly.status === "fulfilled" ? poly.value.length : 0, manifold: manifold.status === "fulfilled" ? manifold.value.length : 0 },
  });
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
