import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agents";
import { DEMO_AGENT_STATS } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

type CalibrationBin = {
  bin_low: number;
  bin_high: number;
  n: number;
  observed_rate: number;
  ci_low: number;
  ci_high: number;
};

function computeECE(bins: CalibrationBin[], totalScored: number): number {
  if (totalScored === 0) return 0;
  return bins.reduce((acc, bin) => {
    if (bin.n === 0) return acc;
    const midpoint = (bin.bin_low + bin.bin_high) / 2;
    return acc + (bin.n / totalScored) * Math.abs(bin.observed_rate - midpoint);
  }, 0);
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let rows: Array<Record<string, unknown>> = [];
  let source: "live" | "demo" = "demo";

  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await sb
        .from("agent_stats")
        .select("agent_id, rank, brier_30d, calibration, total_scored")
        .order("rank", { ascending: true });
      if (!error && data && data.length > 0) {
        const withData = (data as Array<Record<string, unknown>>).filter(
          (s) => Number(s.total_scored) > 0
        );
        if (withData.length > 0) {
          rows = withData;
          source = "live";
        }
      }
    } catch {
      // fall through to demo
    }
  }

  if (source === "demo") {
    rows = (DEMO_AGENT_STATS as unknown as Array<Record<string, unknown>>).map(
      (s) => ({
        agent_id: s.agent_id,
        rank: s.rank,
        brier_30d: s.brier_30d,
        calibration: (s.calibration as CalibrationBin[] | undefined) ?? [],
        total_scored: s.total_scored,
      })
    );
  }

  const agents = rows.map((s) => {
    const agent = AGENTS.find((a) => a.id === (s.agent_id as string));
    const bins = (s.calibration ?? []) as CalibrationBin[];
    const totalScored = Number(s.total_scored ?? 0);
    const ece = computeECE(bins, totalScored);
    return {
      rank: Number(s.rank ?? 99),
      agent_id: s.agent_id as string,
      name: agent?.name ?? (s.agent_id as string),
      brier_30d: Number(s.brier_30d ?? 0),
      total_scored: totalScored,
      ece: Math.round(ece * 1e6) / 1e6,
      bins: bins.map((b) => ({
        bin_low: b.bin_low,
        bin_high: b.bin_high,
        midpoint: Math.round(((b.bin_low + b.bin_high) / 2) * 100) / 100,
        n: b.n,
        observed_rate: b.observed_rate,
        ci_low: b.ci_low,
        ci_high: b.ci_high,
        sparse: b.n < 5,
      })),
    };
  });

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      source,
      schema_version: "1",
      description:
        "Eivra per-agent calibration data. ECE = Expected Calibration Error: weighted mean absolute deviation between bin midpoint and observed frequency. Lower ECE = better calibrated. Each bin spans 0.1 probability width; bins with n < 5 are flagged sparse. ci_low/ci_high are Wilson 95% confidence intervals.",
      agents,
    },
    {
      headers: {
        "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
        "access-control-allow-origin": "*",
      },
    }
  );
}
