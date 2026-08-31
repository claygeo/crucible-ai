import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import {
  buildPaperTradingProofReadiness,
  buildPaperTradingProofRunway,
  buildPaperTradingStrategyRegistrySync,
  loadPaperTradingSnapshotHistory,
} from "@/lib/trading-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const [snapshot, persisted] = await Promise.all([
    getTradingSnapshot(controls),
    loadPaperTradingSnapshotHistory(1000),
  ]);
  const registrySync = buildPaperTradingStrategyRegistrySync(
    snapshot.strategy_variants,
    persisted.snapshots,
  );
  const proofReadiness = buildPaperTradingProofReadiness({
    persistenceStatus: persisted.status,
    proofSummary: persisted.proof_summary,
    captureHealth: persisted.capture_health,
    captureCalendar: persisted.capture_calendar,
    registrySync,
    resolutionWatch: snapshot.resolution_watch,
  });
  const proofRunway = buildPaperTradingProofRunway({
    proofSummary: persisted.proof_summary,
    captureHealth: persisted.capture_health,
    captureCalendar: persisted.capture_calendar,
    resolutionWatch: snapshot.resolution_watch,
  });

  return NextResponse.json(
    {
      ...snapshot.would_trade_today,
      controls,
      proof_readiness: proofReadiness,
      proof_runway: proofRunway,
      registry_sync: registrySync,
      persistence: {
        status: persisted.status,
        latest_captured_at: persisted.latest_captured_at,
        capture_health: persisted.capture_health,
      },
      description:
        "Paper-only would-trade feed from the final archived snapshot. Ranked candidates were for observation only; no real-money execution was ever enabled.",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
