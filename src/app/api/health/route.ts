import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * /api/health — system status snapshot.
 *
 * Public endpoint. Operator can hit from phone if anything goes sideways:
 * - global_pause flag
 * - per-agent budget burn
 * - queue depths (pending agent_runs)
 * - last successful market pull
 * - last 5 system errors
 */
export async function GET() {
  const out = {
    status: "ok",
    deployed_at: process.env.BUILD_TIME ?? new Date().toISOString(),
    demo_mode:
      (process.env.NEXT_PUBLIC_USE_DEMO_DATA ?? "false").toLowerCase() ===
      "true",
    has_anthropic_key: Boolean(process.env.ANTHROPIC_API_KEY),
    has_openai_key: Boolean(process.env.OPENAI_API_KEY),
    has_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    note:
      "Live data + agent loop come online when ANTHROPIC_API_KEY + SUPABASE_SERVICE_ROLE_KEY are set in Netlify env. Until then, dashboard renders deterministic seed data.",
  };
  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
