import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEMO_EUREKA_CARDS } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

type EurekaCard = {
  id: string;
  headline: string;
  body: string;
  evidence: unknown[] | null;
  generated_at: string;
  sort_order: number;
};

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let cards: EurekaCard[] = [];
  let source: "live" | "demo" = "demo";

  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await sb
        .from("eureka_cards")
        .select("id, headline, body, evidence, generated_at, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("generated_at", { ascending: false })
        .limit(20);
      if (!error && data && data.length > 0) {
        cards = (data as Array<Record<string, unknown>>).map((c) => ({
          id: c.id as string,
          headline: c.headline as string,
          body: c.body as string,
          evidence: (c.evidence as unknown[] | null) ?? null,
          generated_at: c.generated_at as string,
          sort_order: Number(c.sort_order ?? 0),
        }));
        source = "live";
      }
    } catch {
      // fall through to demo data
    }
  }

  if (source === "demo") {
    cards = DEMO_EUREKA_CARDS.map((c, i) => ({
      id: c.id,
      headline: c.headline,
      body: c.body,
      evidence: null,
      generated_at: c.generated_at,
      sort_order: i,
    }));
  }

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      source,
      schema_version: "1",
      description:
        "Eivra Eureka cards — illustrative demo cards in the style of the run's nightly analysis job; the run's real cards did not survive the decommission. Each card highlights a surprising or noteworthy pattern in agent forecasting behavior. Cards are frozen; no regeneration occurs. Evidence arrays link to specific predictions or markets.",
      count: cards.length,
      cards,
    },
    {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
        "access-control-allow-origin": "*",
      },
    }
  );
}
