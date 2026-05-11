/**
 * backfill/run.ts — populate Crucible with REAL agent predictions on REAL
 * resolved historical markets, using the operator's local `claude` CLI
 * (Max subscription) as the LLM backend. No Anthropic API key required.
 *
 * Per /codex pivot 2026-05-10: this is the 7-day plan. Demo data → real data.
 *
 * Run:  npx tsx backfill/run.ts [--limit=50] [--source=polymarket|manifold|all] [--dry]
 *
 * Lookahead control: only pulls markets resolved AFTER 2026-02-01, post-Claude
 * training cutoff (Jan 2026). All predictions are flagged is_backfill=true on
 * the leaderboard so we never claim look-ahead-free skill on these.
 */

import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import WebSocketModule from "ws";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://atxtnpgwrcesifejltah.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? loadFromEnvFile() ?? "";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: SUPABASE_SERVICE_ROLE_KEY not set in env or .env.local"
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  // Polyfill WebSocket for Node 20 — Supabase realtime client needs it.
  // We're not using realtime, but the client still requires the constructor.
  realtime: {
    transport: WebSocketModule as unknown as typeof WebSocket,
  },
});

// Markets resolved after this date are eligible for backfill.
// Set to post-Claude-4.7 training cutoff to limit (not eliminate) lookahead.
const RESOLVED_AFTER = new Date("2026-02-01T00:00:00Z");
const RESOLVED_BEFORE = new Date("2026-05-08T00:00:00Z");

// Agents (mirror of src/lib/agents.ts — duplicated here so backfill is standalone)
type AgentDef = {
  id: string;
  name: string;
  model: "claude-opus-4-7" | "claude-sonnet-4-6" | "claude-haiku-4-5" | "synthetic" | "gpt-5";
  effort: "low" | "medium" | "high" | "xhigh";
  systemPrompt: string;
  synthetic: boolean;
};

const AGENTS: AgentDef[] = [
  {
    id: "sage",
    name: "Sage",
    model: "claude-opus-4-7",
    effort: "high",
    synthetic: false,
    systemPrompt: `You are Sage, a deliberative forecaster. Your edge: identify the appropriate reference class, anchor to its base rate, and adjust slowly only with strong evidence. Always state the reference class, the base rate, and 2-3 specific factors pushing this case above or below base rate. Be honest about uncertainty.`,
  },
  {
    id: "hawk",
    name: "Hawk",
    model: "claude-opus-4-7",
    effort: "high",
    synthetic: false,
    systemPrompt: `You are Hawk, a contrarian forecaster. Your edge: when the market consensus is overconfident, find the strongest case for the opposite outcome. First steelman the market. Then steelman the opposite. If you find a real mispricing, take a position MORE EXTREME than the market. If you cannot find a real reason to disagree, ABSTAIN. Hawks earn edge by being right when the crowd is wrong.`,
  },
  {
    id: "magpie",
    name: "Magpie",
    model: "claude-sonnet-4-6",
    effort: "low",
    synthetic: false,
    systemPrompt: `You are Magpie, a fast forecaster. Snap probabilistic judgement based on the headline + one key fact. No deep dive. Output a probability + a one-sentence rationale. Stay terse.`,
  },
  {
    id: "echo",
    name: "Echo",
    model: "claude-haiku-4-5",
    effort: "low",
    synthetic: false,
    systemPrompt: `You are Echo, a Bayesian-anchored forecaster. The market price is your prior. Only adjust when you see hard new information the market hasn't priced in. Make small adjustments (typically <0.05) unless evidence is overwhelming. Respect the wisdom of crowds.`,
  },
  {
    id: "mirror",
    name: "Mirror",
    // No GPT access locally; use Sonnet with a different system prompt as a proxy.
    // This is honest: agent card on the site discloses it.
    model: "claude-sonnet-4-6",
    effort: "medium",
    synthetic: false,
    systemPrompt: `You are Mirror, a careful forecaster. Read the question, identify key uncertainties, output a calibrated probability. If you notice systematic bias the others might share (recency, anchoring, narrative dominance), flag it. You exist to challenge the assumption that one model family is a universal forecaster.`,
  },
  {
    id: "ensemble",
    name: "Crowd",
    model: "synthetic",
    effort: "low",
    synthetic: true,
    systemPrompt: "computed-downstream",
  },
];

// JSON schema enforced on every agent response
const FORECAST_SCHEMA = {
  type: "object",
  properties: {
    probability: {
      type: "number",
      minimum: 0.01,
      maximum: 0.99,
      description: "Your probability for the YES outcome",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    reasoning: {
      type: "string",
      description: "1-3 sentence rationale",
      maxLength: 1200,
    },
    abstain: {
      type: "boolean",
      description: "true if you have insufficient information to forecast",
    },
  },
  required: ["probability", "confidence", "reasoning", "abstain"],
  additionalProperties: false,
};

// ────────────────────────────────────────────────────────────────────────────
// CLI args
// ────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "50");
const SOURCE = (args.find((a) => a.startsWith("--source="))?.split("=")[1] ?? "all") as
  | "polymarket"
  | "manifold"
  | "all";
const DRY = args.includes("--dry");
const ONLY_AGENT = args.find((a) => a.startsWith("--agent="))?.split("=")[1];

console.log(
  `[backfill] limit=${LIMIT} source=${SOURCE} dry=${DRY} only_agent=${ONLY_AGENT ?? "all"}`
);

// ────────────────────────────────────────────────────────────────────────────
// Market pulls
// ────────────────────────────────────────────────────────────────────────────

type CommonMarket = {
  source: "polymarket" | "manifold";
  source_id: string;
  question: string;
  description?: string;
  url: string;
  category: string;
  resolved_outcome: boolean;
  resolved_at: string;
  closes_at: string;
  outcome_yes_price: number; // last-known price BEFORE resolution
  raw: Record<string, unknown>;
};

async function pullPolymarketResolved(): Promise<CommonMarket[]> {
  console.log("[backfill] pulling resolved Polymarket markets...");
  // Gamma API: closed=true, ordered by endDate desc to get recent first
  const out: CommonMarket[] = [];
  let offset = 0;
  let skipped = { date: 0, badDate: 0, outcome: 0, volume: 0 };
  while (out.length < 300 && offset < 4000) {
    const url = `https://gamma-api.polymarket.com/markets?closed=true&order=endDate&ascending=false&limit=100&offset=${offset}`;
    const res = await fetch(url, {
      headers: { "user-agent": "crucible-ai-backfill/0.1" },
    });
    if (!res.ok) {
      console.warn(`[polymarket] HTTP ${res.status}: ${await res.text()}`);
      break;
    }
    const arr = (await res.json()) as Array<Record<string, unknown>>;
    if (arr.length === 0) break;
    for (const m of arr) {
      if (typeof m.id !== "string" && typeof m.id !== "number") continue;
      const q = (m.question as string | undefined) ?? "";
      if (!q || q.length < 8) continue;
      // Polymarket's actual resolution time is `closedTime` (when it was closed/resolved),
      // NOT endDate (which is the conditional close date and may be far future).
      const closedTimeRaw = (m.closedTime as string | undefined) ?? undefined;
      const endDate = (m.endDate as string | undefined) ?? undefined;
      if (!closedTimeRaw && !endDate) continue;
      // closedTime can be "2026-03-19 23:20:15+00" — coerce to ISO. Skip bad dates.
      // Polymarket uses Postgres-style timestamps with " " separator and "+00"
      // timezone; JS Date wants "T" separator and "+00:00" or "Z".
      let closedTimeIso: string;
      try {
        let normalized = closedTimeRaw
          ? closedTimeRaw.replace(" ", "T").replace(/\+00$/, "Z")
          : endDate!;
        const candidate = new Date(normalized);
        if (Number.isNaN(candidate.getTime())) {
          skipped.badDate++;
          continue;
        }
        closedTimeIso = candidate.toISOString();
      } catch {
        skipped.badDate++;
        continue;
      }
      const resolvedAt = new Date(closedTimeIso);
      if (resolvedAt < RESOLVED_AFTER || resolvedAt > RESOLVED_BEFORE) {
        skipped.date++;
        continue;
      }

      let resolvedOutcome: boolean | undefined;
      if (typeof m.outcomePrices === "string") {
        try {
          const prices = JSON.parse(m.outcomePrices) as string[];
          const p = Number(prices[0]);
          if (p === 1) resolvedOutcome = true;
          else if (p === 0) resolvedOutcome = false;
        } catch {}
      }
      if (resolvedOutcome === undefined) {
        skipped.outcome++;
        continue;
      }

      // Skip joke / restricted / negligible-volume markets
      const volumeNum = (m.volumeNum as number | undefined) ?? 0;
      const liquidityNum = (m.liquidityNum as number | undefined) ?? 0;
      if (volumeNum < 5000 && liquidityNum < 1000) {
        skipped.volume++;
        continue;
      }

      // For market price at close: best proxy = lastTradePrice if present,
      // otherwise infer from outcomePrices delta. If unknown, use 0.5 (will
      // result in zero P&L for that prediction).
      let lastYesPrice: number = 0.5;
      if (typeof m.lastTradePrice === "number")
        lastYesPrice = m.lastTradePrice as number;
      else if (typeof m.lastTradePrice === "string")
        lastYesPrice = Number(m.lastTradePrice);
      if (!Number.isFinite(lastYesPrice) || lastYesPrice <= 0 || lastYesPrice >= 1)
        lastYesPrice = 0.5;

      out.push({
        source: "polymarket",
        source_id: String(m.id),
        question: q,
        description: (m.description as string | undefined) ?? undefined,
        url:
          "https://polymarket.com/event/" +
          ((m.slug as string | undefined) ?? String(m.id)),
        category: classifyCategory(q),
        resolved_outcome: resolvedOutcome,
        resolved_at: closedTimeIso,
        closes_at: endDate ?? closedTimeIso,
        outcome_yes_price: lastYesPrice,
        raw: m,
      });
    }
    offset += 100;
  }
  console.log(
    `[polymarket] pulled ${out.length} resolved markets in window  (skipped: date=${skipped.date} badDate=${skipped.badDate} outcome=${skipped.outcome} volume=${skipped.volume})`
  );
  return out;
}

async function pullManifoldResolved(): Promise<CommonMarket[]> {
  console.log("[backfill] pulling resolved Manifold markets...");
  const out: CommonMarket[] = [];
  let before: string | undefined;
  let pages = 0;
  while (out.length < 200 && pages < 20) {
    const url =
      `https://api.manifold.markets/v0/markets?limit=100` +
      (before ? `&before=${before}` : "");
    const res = await fetch(url, {
      headers: { "user-agent": "crucible-ai-backfill/0.1" },
    });
    if (!res.ok) {
      console.warn(`[manifold] HTTP ${res.status}`);
      break;
    }
    const arr = (await res.json()) as Array<Record<string, unknown>>;
    if (arr.length === 0) break;
    pages += 1;
    before = arr[arr.length - 1]!.id as string;
    for (const m of arr) {
      if (typeof m.id !== "string") continue;
      if (m.outcomeType !== "BINARY") continue;
      if (m.isResolved !== true) continue;
      const resolution = m.resolution as string | undefined;
      let resolvedOutcome: boolean | undefined;
      if (resolution === "YES") resolvedOutcome = true;
      else if (resolution === "NO") resolvedOutcome = false;
      else continue;
      const resolutionTime = m.resolutionTime as number | undefined;
      if (!resolutionTime) continue;
      const resolvedAt = new Date(resolutionTime);
      if (resolvedAt < RESOLVED_AFTER || resolvedAt > RESOLVED_BEFORE) continue;
      const q = (m.question as string | undefined) ?? "";
      if (!q || q.length < 8) continue;

      // Quality gate: skip joke / personal / tiny-volume markets.
      // Manifold has tons of "will my friend X" markets; we want substantive ones.
      const volume = (m.volume as number | undefined) ?? 0;
      const uniqueBettors = (m.uniqueBettorCount as number | undefined) ?? 0;
      if (uniqueBettors < 12 || volume < 100) continue;

      // Filter out questions that look personal / joke / spam by keyword
      const ql = q.toLowerCase();
      if (
        /\b(my (friend|girlfriend|boyfriend|wife|husband|sister|brother|cat|dog|mom|dad|family)|will i\b|will [a-z]+ get me\b|🌀|emoji|comment)\b/.test(
          ql
        )
      ) {
        continue;
      }
      // Convince/troll/spam pattern
      if (/\bconvince the machine|prediction tournament|will this market\b/.test(ql)) continue;

      const lastPrice = (m.probability as number | undefined) ?? 0.5;

      out.push({
        source: "manifold",
        source_id: m.id,
        question: q,
        description: (m.textDescription as string | undefined) ?? undefined,
        url: (m.url as string | undefined) ?? "https://manifold.markets/",
        category: classifyCategory(q),
        resolved_outcome: resolvedOutcome,
        resolved_at: resolvedAt.toISOString(),
        closes_at: ((m.closeTime as number | undefined)
          ? new Date(m.closeTime as number).toISOString()
          : resolvedAt.toISOString()),
        outcome_yes_price: lastPrice,
        raw: m,
      });
    }
  }
  console.log(`[manifold] pulled ${out.length} resolved markets in window`);
  return out;
}

function classifyCategory(question: string): string {
  const q = question.toLowerCase();
  if (
    /trump|election|biden|congress|senate|president|vote|pol(itical|itics|l)|approval/.test(
      q
    )
  )
    return "politics";
  if (/bitcoin|btc|ether(eum)?|eth|crypto|solana|sol|defi|nft|coinbase|binance/.test(q))
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

// ────────────────────────────────────────────────────────────────────────────
// claude -p subprocess
// ────────────────────────────────────────────────────────────────────────────

type ForecastResult = {
  probability: number;
  reasoning: string;
  confidence: "low" | "medium" | "high";
  abstained: boolean;
};

function runClaude(
  agent: AgentDef,
  market: CommonMarket
): Promise<ForecastResult> {
  return new Promise((resolve, reject) => {
    const userMessage = [
      `MARKET QUESTION: ${market.question}`,
      market.description ? `\nDESCRIPTION:\n${market.description.slice(0, 800)}` : "",
      `\nLAST KNOWN MARKET PRICE (yes-side, before resolution): ${market.outcome_yes_price.toFixed(4)}`,
      `SOURCE: ${market.source} · CATEGORY: ${market.category}`,
      `\nProduce your probabilistic forecast for the YES outcome of this market.`,
      `Respond with a single JSON object matching the schema.`,
    ]
      .filter(Boolean)
      .join("\n");

    // Use --system-prompt to REPLACE the default system prompt (no project
    // context loading). Pipe the user message via stdin to avoid Windows
    // argument-escaping issues with JSON braces / quotes.
    const args: string[] = [
      "-p",
      "--model",
      agent.model,
      "--effort",
      agent.effort,
      "--system-prompt",
      agent.systemPrompt,
      "--json-schema",
      JSON.stringify(FORECAST_SCHEMA),
      "--max-budget-usd",
      "0.40",
      "--output-format",
      "json",
      "--input-format",
      "text",
    ];

    // Windows npm shim is claude.cmd. shell:true mangles args with JSON braces.
    // Direct invocation via cmd.exe /c works AND lets us stream stdin cleanly.
    const isWin = process.platform === "win32";
    const child = isWin
      ? spawn("cmd.exe", ["/c", "claude.cmd", ...args], {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, CI: "1" },
          windowsHide: true,
        })
      : spawn("claude", args, {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, CI: "1" },
        });
    child.stdin.write(userMessage);
    child.stdin.end();

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("claude -p timeout (90s)"));
    }, 90_000);

    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(
          new Error(`claude exit ${code}: ${stderr.slice(0, 500)}`)
        );
      }
      try {
        // Output format JSON: top-level has 'result' field with our content
        const parsed = JSON.parse(stdout);
        const text =
          typeof parsed.result === "string"
            ? parsed.result
            : typeof parsed.text === "string"
              ? parsed.text
              : JSON.stringify(parsed);
        // The result itself should be a JSON string matching our schema
        let inner: Record<string, unknown> = {};
        try {
          inner = JSON.parse(text);
        } catch {
          // Sometimes claude returns the JSON inside a code fence
          const m = text.match(/\{[\s\S]*"probability"[\s\S]*\}/);
          if (m) inner = JSON.parse(m[0]);
        }
        const probability = clamp(Number(inner.probability));
        const confidence =
          inner.confidence === "low" || inner.confidence === "high"
            ? inner.confidence
            : "medium";
        const reasoning =
          typeof inner.reasoning === "string"
            ? inner.reasoning.slice(0, 2000)
            : text.slice(0, 2000);
        const abstained = inner.abstain === true;
        resolve({ probability, confidence, reasoning, abstained });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        reject(new Error(`parse failure: ${err}\nstdout: ${stdout.slice(0, 500)}`));
      }
    });
  });
}

function clamp(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(0.99, Math.max(0.01, p));
}

// ────────────────────────────────────────────────────────────────────────────
// DB writes
// ────────────────────────────────────────────────────────────────────────────

async function upsertMarket(m: CommonMarket): Promise<string> {
  // Use status='resolved' since these are historical
  const row = {
    source: m.source,
    source_id: m.source_id,
    question: m.question.slice(0, 1000),
    description: m.description?.slice(0, 4000) ?? null,
    url: m.url,
    category: m.category,
    status: "resolved",
    outcome_yes_price: m.outcome_yes_price,
    resolved_outcome: m.resolved_outcome,
    closes_at: m.closes_at,
    resolved_at: m.resolved_at,
    raw: m.raw,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb
    .from("markets")
    .upsert(row, { onConflict: "source,source_id" })
    .select("id")
    .single();
  if (error) throw new Error(`upsert market: ${error.message}`);
  return (data as { id: string }).id;
}

async function insertPrediction(
  agentId: string,
  marketDbId: string,
  market: CommonMarket,
  forecast: ForecastResult
): Promise<string | null> {
  // Look-ahead control: prediction "created_at" set to market resolved_at minus 24h
  // (a defensible "we forecasted ~1d before close" timestamp). is_backfill=true.
  const fakeCreatedAt = new Date(
    new Date(market.resolved_at).getTime() - 86_400_000
  ).toISOString();
  const { data, error } = await sb
    .from("predictions")
    .insert({
      agent_id: agentId,
      market_id: marketDbId,
      probability: forecast.probability,
      confidence: forecast.confidence,
      reasoning: forecast.reasoning,
      abstained: forecast.abstained,
      market_price_at_forecast: market.outcome_yes_price,
      is_backfill: true,
      created_at: fakeCreatedAt,
    })
    .select("id")
    .single();
  if (error) {
    // Duplicate (existing prediction for same agent+market+timestamp) — skip silently
    if (error.message.includes("duplicate") || error.code === "23505") {
      return null;
    }
    throw new Error(`insert prediction: ${error.message}`);
  }
  return (data as { id: string }).id;
}

async function scorePrediction(
  predId: string,
  agentId: string,
  marketDbId: string,
  market: CommonMarket,
  forecast: ForecastResult
) {
  if (forecast.abstained) return;
  const outcome = market.resolved_outcome ? 1 : 0;
  const p = clamp(forecast.probability);
  const brier = (p - outcome) ** 2;
  const log_loss = -(outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p));
  const wasCorrect = (p > 0.5) === Boolean(outcome);
  const stake = 25;
  const tookYes = p > market.outcome_yes_price;
  const paper_pnl = tookYes
    ? stake * (outcome - market.outcome_yes_price)
    : stake * (market.outcome_yes_price - outcome);
  await sb.from("scores").upsert(
    {
      prediction_id: predId,
      agent_id: agentId,
      market_id: marketDbId,
      brier,
      log_loss,
      paper_pnl,
      was_correct: wasCorrect,
    },
    { onConflict: "prediction_id" }
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Cache layer (so we can rerun without burning the same calls)
// ────────────────────────────────────────────────────────────────────────────

const CACHE_DIR = ".backfill-cache";
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

function cacheKey(agent: AgentDef, market: CommonMarket): string {
  return `${agent.id}__${market.source}__${market.source_id}.json`;
}
function loadCached(agent: AgentDef, market: CommonMarket): ForecastResult | null {
  const path = join(CACHE_DIR, cacheKey(agent, market));
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
function saveCached(agent: AgentDef, market: CommonMarket, f: ForecastResult) {
  const path = join(CACHE_DIR, cacheKey(agent, market));
  writeFileSync(path, JSON.stringify(f, null, 2));
}

// ────────────────────────────────────────────────────────────────────────────
// Refresh aggregations after backfill
// ────────────────────────────────────────────────────────────────────────────

async function refreshAgentStats() {
  console.log("[refresh] computing agent_stats...");
  const { data: agents } = await sb.from("agents").select("id");
  if (!agents) return;

  for (const a of agents) {
    const { data: scores } = await sb
      .from("scores")
      .select("brier, log_loss, paper_pnl, was_correct")
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
    const avg = (xs: number[]) =>
      xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length;
    const brier = avg(sample.map((s) => Number(s.brier)));
    const ll = avg(sample.map((s) => Number(s.log_loss)));
    const pnl = sample.reduce((s, x) => s + Number(x.paper_pnl ?? 0), 0);
    const winrate =
      sample.length === 0
        ? null
        : sample.filter((s) => s.was_correct).length / sample.length;

    // Calibration: 10-bin reliability
    const { data: predsForCal } = await sb
      .from("predictions")
      .select("probability, market_id")
      .eq("agent_id", a.id);
    const { data: marketsResolved } = await sb
      .from("markets")
      .select("id, resolved_outcome")
      .eq("status", "resolved");
    const marketOutcome = new Map<string, boolean>();
    for (const m of marketsResolved ?? [])
      if (m.resolved_outcome !== null)
        marketOutcome.set(m.id as string, m.resolved_outcome as boolean);

    const bins: Array<{
      bin_low: number;
      bin_high: number;
      n: number;
      observed_rate: number;
      ci_low: number;
      ci_high: number;
    }> = [];
    for (let i = 0; i < 10; i++) {
      const low = i / 10;
      const high = (i + 1) / 10;
      const inBin = (predsForCal ?? []).filter(
        (p) =>
          Number(p.probability) >= low &&
          Number(p.probability) < (i === 9 ? 1.001 : high) &&
          marketOutcome.has(p.market_id as string)
      );
      const n = inBin.length;
      const wins = inBin.filter((p) => marketOutcome.get(p.market_id as string)).length;
      const observed = n > 0 ? wins / n : 0;
      // Wilson 95%
      const z = 1.96;
      const denom = 1 + (z * z) / Math.max(1, n);
      const center = n > 0 ? (observed + (z * z) / (2 * n)) / denom : 0;
      const halfwidth =
        n > 0
          ? (z *
              Math.sqrt(
                (observed * (1 - observed)) / n + (z * z) / (4 * n * n)
              )) /
            denom
          : 0;
      bins.push({
        bin_low: low,
        bin_high: high,
        n,
        observed_rate: observed,
        ci_low: Math.max(0, center - halfwidth),
        ci_high: Math.min(1, center + halfwidth),
      });
    }

    await sb.from("agent_stats").upsert(
      {
        agent_id: a.id,
        total_predictions: totalPreds ?? 0,
        total_scored: sample.length,
        brier_30d: brier,
        log_loss_30d: ll,
        brier_alltime: brier,
        log_loss_alltime: ll,
        win_rate_30d: winrate,
        paper_pnl_30d: pnl,
        paper_pnl_alltime: pnl,
        calibration: bins,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id" }
    );
  }

  // Crucible Score + ranks
  const { data: stats } = await sb
    .from("agent_stats")
    .select("agent_id, brier_30d, log_loss_30d, win_rate_30d");
  const arr = (stats ?? []).filter(
    (s) =>
      s.brier_30d !== null && s.log_loss_30d !== null && s.win_rate_30d !== null
  ) as Array<{ agent_id: string; brier_30d: number; log_loss_30d: number; win_rate_30d: number }>;
  if (arr.length === 0) return;
  const minB = Math.min(...arr.map((s) => Number(s.brier_30d)));
  const maxB = Math.max(...arr.map((s) => Number(s.brier_30d)));
  const minL = Math.min(...arr.map((s) => Number(s.log_loss_30d)));
  const maxL = Math.max(...arr.map((s) => Number(s.log_loss_30d)));
  const scored = arr.map((s) => {
    const bn = maxB > minB ? (Number(s.brier_30d) - minB) / (maxB - minB) : 0;
    const ln = maxL > minL ? (Number(s.log_loss_30d) - minL) / (maxL - minL) : 0;
    return {
      agent_id: s.agent_id,
      cs: 0.5 * (1 - bn) + 0.3 * Number(s.win_rate_30d) + 0.2 * (1 - ln),
    };
  });
  scored.sort((a, b) => b.cs - a.cs);
  for (let i = 0; i < scored.length; i++) {
    await sb
      .from("agent_stats")
      .update({ crucible_score: scored[i].cs, rank: i + 1 })
      .eq("agent_id", scored[i].agent_id);
  }
  console.log("[refresh] done");
}

// ────────────────────────────────────────────────────────────────────────────
// Synthetic ensemble — uniform-weight average of non-abstaining predictions
// ────────────────────────────────────────────────────────────────────────────

async function computeEnsemblePredictions() {
  console.log("[ensemble] computing uniform-weight ensemble predictions...");
  const { data: markets } = await sb
    .from("markets")
    .select("id, outcome_yes_price, resolved_outcome, resolved_at")
    .eq("status", "resolved");
  if (!markets) return;
  for (const m of markets) {
    const { data: preds } = await sb
      .from("predictions")
      .select("agent_id, probability, abstained")
      .eq("market_id", m.id)
      .eq("abstained", false);
    if (!preds || preds.length === 0) continue;
    // Average non-synthetic agent predictions only
    const indPreds = (preds as Array<{ agent_id: string; probability: number }>)
      .filter((p) => p.agent_id !== "ensemble");
    if (indPreds.length === 0) continue;
    const avg =
      indPreds.reduce((s, p) => s + Number(p.probability), 0) / indPreds.length;
    const fakeCreatedAt = new Date(
      new Date(m.resolved_at as string).getTime() - 86_400_000
    ).toISOString();
    const { data: predRow, error: predErr } = await sb
      .from("predictions")
      .upsert(
        {
          agent_id: "ensemble",
          market_id: m.id as string,
          probability: clamp(avg),
          confidence: "medium",
          reasoning: `Equal-weighted average of ${indPreds.length} agent predictions on this market.`,
          abstained: false,
          market_price_at_forecast: Number(m.outcome_yes_price),
          is_backfill: true,
          created_at: fakeCreatedAt,
        },
        { onConflict: "agent_id,market_id,created_at" }
      )
      .select("id")
      .single();
    if (predErr || !predRow) continue;
    // Score
    const outcome = m.resolved_outcome ? 1 : 0;
    const brier = (clamp(avg) - outcome) ** 2;
    const log_loss = -(
      outcome * Math.log(clamp(avg)) +
      (1 - outcome) * Math.log(1 - clamp(avg))
    );
    const wasCorrect = (avg > 0.5) === Boolean(outcome);
    const stake = 25;
    const mp = Number(m.outcome_yes_price);
    const tookYes = avg > mp;
    const paper_pnl = tookYes ? stake * (outcome - mp) : stake * (mp - outcome);
    await sb.from("scores").upsert(
      {
        prediction_id: (predRow as { id: string }).id,
        agent_id: "ensemble",
        market_id: m.id as string,
        brier,
        log_loss,
        paper_pnl,
        was_correct: wasCorrect,
      },
      { onConflict: "prediction_id" }
    );
  }
  console.log("[ensemble] done");
}

// ────────────────────────────────────────────────────────────────────────────
// Main orchestrator
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Pull markets
  const polyMarkets = SOURCE === "manifold" ? [] : await pullPolymarketResolved();
  const manifoldMarkets =
    SOURCE === "polymarket" ? [] : await pullManifoldResolved();
  const all = [...polyMarkets, ...manifoldMarkets].slice(0, LIMIT);
  console.log(`[backfill] using ${all.length} markets total`);

  if (DRY) {
    console.log("DRY RUN — would forecast on:");
    for (const m of all) {
      console.log(`  - ${m.source}/${m.source_id}: ${m.question.slice(0, 80)}`);
    }
    return;
  }

  // 2. Insert markets
  const marketIdMap = new Map<string, string>(); // source+source_id → db id
  let mInserted = 0;
  for (const m of all) {
    try {
      const id = await upsertMarket(m);
      marketIdMap.set(`${m.source}__${m.source_id}`, id);
      mInserted += 1;
    } catch (e) {
      console.warn(
        `[market] upsert failed for ${m.source}/${m.source_id}: ${e}`
      );
    }
  }
  console.log(`[backfill] ${mInserted} markets in DB`);

  // 3. For each (agent, market), claude -p + write
  const agents = AGENTS.filter((a) => !a.synthetic).filter(
    (a) => !ONLY_AGENT || a.id === ONLY_AGENT
  );
  let calls = 0;
  let cached = 0;
  let failed = 0;
  let abstained = 0;

  for (const market of all) {
    const dbId = marketIdMap.get(`${market.source}__${market.source_id}`);
    if (!dbId) continue;
    for (const agent of agents) {
      let forecast: ForecastResult | null = loadCached(agent, market);
      if (forecast) {
        cached += 1;
      } else {
        try {
          console.log(
            `  [${agent.id}] ${market.source}/${market.source_id.slice(0, 8)} :: ${market.question.slice(0, 60)}...`
          );
          forecast = await runClaude(agent, market);
          saveCached(agent, market, forecast);
          calls += 1;
        } catch (e) {
          console.warn(`  ✗ ${agent.id}: ${e}`);
          failed += 1;
          continue;
        }
      }
      try {
        const predId = await insertPrediction(agent.id, dbId, market, forecast);
        if (predId) {
          await scorePrediction(predId, agent.id, dbId, market, forecast);
          if (forecast.abstained) abstained += 1;
        }
      } catch (e) {
        console.warn(`  ✗ db ${agent.id}: ${e}`);
        failed += 1;
      }
    }
  }

  console.log(
    `[backfill] live=${calls} cached=${cached} failed=${failed} abstained=${abstained}`
  );

  // 4. Compute synthetic ensemble + score
  await computeEnsemblePredictions();

  // 5. Refresh agent_stats + ranks
  await refreshAgentStats();

  console.log("[backfill] complete");
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function loadFromEnvFile(): string | undefined {
  if (existsSync(".env.local")) {
    const content = readFileSync(".env.local", "utf8");
    const m = content.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^"(.*)"$/, "$1");
  }
  return undefined;
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
