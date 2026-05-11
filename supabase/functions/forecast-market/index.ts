/**
 * forecast-market — Supabase Edge Function (Deno).
 *
 * Invoked per (agent × market) when the orchestrator finds a market that
 * agent hasn't forecasted in the current run window (default 30 min).
 *
 * Calls the agent's underlying LLM with its system prompt + market description
 * and the prevailing market price. Writes a prediction + evidence_events.
 *
 * 90s wall budget per invocation. On timeout, the orchestrator's next sweep
 * picks it up again (idempotent on agent_id + market_id + run_window_start).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const CRON_SHARED_SECRET = Deno.env.get("CRON_SHARED_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Agent = {
  id: string;
  name: string;
  model: string;
  daily_budget_usd: number;
  active: boolean;
  disabled_until: string | null;
  synthetic: boolean;
};

type Market = {
  id: string;
  question: string;
  description: string | null;
  outcome_yes_price: number;
  category: string;
  source: string;
  url: string;
};

/** Round timestamp down to the run-window bucket (default 30-min). */
function runWindowStart(d: Date, minutes = 30): Date {
  const ms = d.getTime();
  const bucketMs = minutes * 60_000;
  return new Date(Math.floor(ms / bucketMs) * bucketMs);
}

/** Approx token cost in USD for Anthropic models, used for budget tracking. */
function estimateAnthropicCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Rough May 2026 pricing — calibrate periodically
  const prices: Record<string, [number, number]> = {
    "claude-opus-4-7": [15 / 1_000_000, 75 / 1_000_000],
    "claude-sonnet-4-6": [3 / 1_000_000, 15 / 1_000_000],
    "claude-haiku-4-5": [0.8 / 1_000_000, 4 / 1_000_000],
  };
  const [p_in, p_out] = prices[model] ?? [3 / 1_000_000, 15 / 1_000_000];
  return inputTokens * p_in + outputTokens * p_out;
}

/** Get today's spend in USD for an agent. */
async function getTodaySpend(agentId: string): Promise<number> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await sb
    .from("agent_runs")
    .select("cost_usd")
    .eq("agent_id", agentId)
    .gte("created_at", dayStart.toISOString());
  if (error) return 0;
  return (data ?? []).reduce(
    (sum, r) => sum + (Number(r.cost_usd) || 0),
    0
  );
}

type ForecastResult = {
  probability: number;
  reasoning: string;
  confidence: "low" | "medium" | "high";
  abstained: boolean;
  citations: string[];
  inputTokens: number;
  outputTokens: number;
};

/** Call Anthropic API with the agent's system prompt + the market context. */
async function callAnthropic(
  agentSystemPrompt: string,
  market: Market,
  model: string
): Promise<ForecastResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set; cannot forecast in live mode");
  }
  const userMessage = buildUserMessage(market);
  const body = {
    model,
    max_tokens: model.includes("opus") ? 2048 : 1024,
    system:
      agentSystemPrompt +
      "\n\nOUTPUT FORMAT: respond with a single JSON object on the LAST line of your response, like {\"probability\": 0.34, \"confidence\": \"medium\", \"reasoning\": \"...\", \"citations\": [\"https://...\"], \"abstain\": false}. Probability must be between 0.01 and 0.99.",
    messages: [{ role: "user", content: userMessage }],
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(75_000),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  const text = json.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  const inputTokens = json.usage?.input_tokens ?? 0;
  const outputTokens = json.usage?.output_tokens ?? 0;
  return parseAgentOutput(text, inputTokens, outputTokens);
}

async function callOpenAI(
  agentSystemPrompt: string,
  market: Market,
  model: string
): Promise<ForecastResult> {
  if (!OPENAI_API_KEY) {
    // Mirror agent fallback: if OpenAI not configured, throw a recognizable
    // error so the orchestrator can swap to the Sonnet-with-different-prompt
    // fallback or mark the run as failed cleanly.
    throw new Error("OPENAI_API_KEY not set");
  }
  const userMessage = buildUserMessage(market);
  const body = {
    model: model === "gpt-5" ? "gpt-5" : model,
    messages: [
      { role: "system", content: agentSystemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1024,
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(75_000),
  });
  if (!res.ok) {
    throw new Error(`openai ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };
  const text = json.choices[0]?.message?.content ?? "";
  return parseAgentOutput(text, json.usage.prompt_tokens, json.usage.completion_tokens);
}

function buildUserMessage(market: Market): string {
  return [
    `MARKET QUESTION: ${market.question}`,
    market.description ? `\nDESCRIPTION:\n${market.description}` : "",
    `\nCURRENT MARKET PRICE: ${market.outcome_yes_price.toFixed(4)} (yes-side)`,
    `SOURCE: ${market.source} · CATEGORY: ${market.category}`,
    `\nProduce your probabilistic forecast for the YES outcome. End with the JSON output.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function parseAgentOutput(
  text: string,
  inputTokens: number,
  outputTokens: number
): ForecastResult {
  // Try to find JSON block on the last line
  const lines = text
    .trim()
    .split("\n")
    .filter((l) => l.trim().length > 0);
  let jsonStr = lines[lines.length - 1] ?? "";
  // Strip code fences if present
  jsonStr = jsonStr.replace(/^```json?\s*/, "").replace(/```$/, "").trim();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Try to find any JSON-shaped block in the text
    const m = text.match(/\{[\s\S]*"probability"[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {}
    }
  }
  const abstained = parsed.abstain === true;
  let probability = Number(parsed.probability);
  if (!Number.isFinite(probability)) probability = 0.5;
  // Clamp to safe range so Brier/log-loss don't explode
  probability = Math.min(0.9999, Math.max(0.0001, probability));
  const confidence =
    parsed.confidence === "low" || parsed.confidence === "high"
      ? parsed.confidence
      : "medium";
  const reasoning =
    typeof parsed.reasoning === "string"
      ? parsed.reasoning
      : text.slice(0, 4000);
  const citations = Array.isArray(parsed.citations)
    ? parsed.citations.filter((c): c is string => typeof c === "string")
    : [];
  return {
    probability: abstained ? 0.5 : probability,
    reasoning,
    confidence: confidence as "low" | "medium" | "high",
    abstained,
    citations,
    inputTokens,
    outputTokens,
  };
}

async function logEvent(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
) {
  await sb
    .from("system_events")
    .insert({ level, source: "forecast-market", message, meta: meta ?? null });
}

Deno.serve(async (req) => {
  if (CRON_SHARED_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${CRON_SHARED_SECRET}`) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const { agent_id, market_id } = (await req.json().catch(() => ({}))) as {
    agent_id?: string;
    market_id?: string;
  };
  if (!agent_id || !market_id) {
    return new Response(
      JSON.stringify({ error: "agent_id and market_id required" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const window = runWindowStart(new Date()).toISOString();
  const t0 = Date.now();

  // Fetch agent + market
  const [{ data: agent }, { data: market }] = await Promise.all([
    sb.from("agents").select("*").eq("id", agent_id).single(),
    sb.from("markets").select("*").eq("id", market_id).single(),
  ]);
  if (!agent) {
    return new Response(JSON.stringify({ error: "agent not found" }), {
      status: 404,
    });
  }
  if (!market) {
    return new Response(JSON.stringify({ error: "market not found" }), {
      status: 404,
    });
  }

  const a = agent as Agent;
  const m = market as Market;

  // Skip synthetic ensemble — it's computed by the resolver, not by LLM call
  if (a.synthetic) {
    return new Response(
      JSON.stringify({ skipped: "synthetic agent (computed downstream)" }),
      { headers: { "content-type": "application/json" } }
    );
  }

  // Disabled / quota check
  if (!a.active) {
    return new Response(JSON.stringify({ skipped: "agent inactive" }), {
      headers: { "content-type": "application/json" },
    });
  }
  if (a.disabled_until && new Date(a.disabled_until) > new Date()) {
    return new Response(
      JSON.stringify({ skipped: "agent disabled until " + a.disabled_until }),
      { headers: { "content-type": "application/json" } }
    );
  }
  const todaySpend = await getTodaySpend(a.id);
  if (todaySpend >= a.daily_budget_usd) {
    // Mark disabled until end of UTC day
    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);
    await sb
      .from("agents")
      .update({ disabled_until: endOfDay.toISOString() })
      .eq("id", a.id);
    await logEvent("warn", `agent ${a.id} hit daily budget`, {
      todaySpend,
      budget: a.daily_budget_usd,
    });
    return new Response(
      JSON.stringify({ skipped: "quota_exceeded", todaySpend }),
      { headers: { "content-type": "application/json" } }
    );
  }

  // Idempotency: try to insert agent_run row for this window
  const { data: runRow, error: runErr } = await sb
    .from("agent_runs")
    .insert({
      agent_id: a.id,
      market_id: m.id,
      run_window_start: window,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (runErr) {
    // Already exists for this window — skip
    return new Response(
      JSON.stringify({ skipped: "already ran in this window" }),
      { headers: { "content-type": "application/json" } }
    );
  }

  // Get system prompt from agents table — but we need the rich version from
  // src/lib/agents.ts. For simplicity here we use the stored persona/edge as
  // a degraded prompt; longer term we'd duplicate the full prompt into DB.
  const systemPrompt = `You are ${a.name}, a forecaster. Persona: ${(a as unknown as { persona?: string }).persona ?? ""}\nEdge: ${(a as unknown as { edge?: string }).edge ?? ""}\n\nProduce a probabilistic forecast (0.01-0.99) for the YES outcome of the given market question, plus 1-2 paragraphs of reasoning.`;

  let result: ForecastResult;
  try {
    if (a.model.startsWith("gpt-") || a.model === "gpt-5") {
      result = await callOpenAI(systemPrompt, m, a.model);
    } else {
      result = await callAnthropic(systemPrompt, m, a.model);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await sb
      .from("agent_runs")
      .update({
        status: "failed",
        error: err.slice(0, 500),
        duration_ms: Date.now() - t0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runRow.id);
    await logEvent("error", `forecast failed for ${a.id}/${m.id}`, { err });
    return new Response(JSON.stringify({ error: err }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const cost = estimateAnthropicCost(
    a.model,
    result.inputTokens,
    result.outputTokens
  );

  // Insert prediction
  const { data: predRow, error: predErr } = await sb
    .from("predictions")
    .insert({
      agent_id: a.id,
      market_id: m.id,
      run_id: runRow.id,
      probability: result.probability,
      confidence: result.confidence,
      reasoning: result.reasoning.slice(0, 8000),
      abstained: result.abstained,
      market_price_at_forecast: m.outcome_yes_price,
      is_backfill: false,
    })
    .select()
    .single();
  if (predErr) {
    await sb
      .from("agent_runs")
      .update({
        status: "failed",
        error: `insert prediction: ${predErr.message}`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runRow.id);
    return new Response(
      JSON.stringify({ error: "prediction insert failed" }),
      { status: 500 }
    );
  }

  // Evidence events
  const events: Array<{
    prediction_id: string;
    kind: string;
    content: string;
    url?: string;
  }> = [
    {
      prediction_id: predRow.id,
      kind: "pull",
      content: `market_id=${m.id} title="${m.question.slice(0, 80)}"`,
    },
  ];
  for (const url of result.citations.slice(0, 5)) {
    events.push({
      prediction_id: predRow.id,
      kind: "cite",
      content: url.slice(0, 120),
      url,
    });
  }
  events.push({
    prediction_id: predRow.id,
    kind: result.abstained ? "abstain" : "conclude",
    content: `p=${result.probability.toFixed(4)} conf=${result.confidence} reasoning_tokens=${result.outputTokens}`,
  });
  await sb.from("evidence_events").insert(events);

  // Mark run complete
  await sb
    .from("agent_runs")
    .update({
      status: result.abstained ? "abstained" : "completed",
      cost_usd: cost,
      duration_ms: Date.now() - t0,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runRow.id);

  return new Response(
    JSON.stringify({
      ok: true,
      prediction_id: predRow.id,
      probability: result.probability,
      cost_usd: cost,
      duration_ms: Date.now() - t0,
    }),
    { headers: { "content-type": "application/json" } }
  );
});
