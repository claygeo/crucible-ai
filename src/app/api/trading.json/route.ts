import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import {
  buildPaperTradingProofEvidenceSources,
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
    persisted.snapshots
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
  const proofEvidenceSources = buildPaperTradingProofEvidenceSources({
    persistence: persisted,
    proofReadiness,
    proofRunway,
    resolutionWatch: snapshot.resolution_watch,
  });

  return NextResponse.json(
    {
      ...snapshot,
      proof_evidence_sources: proofEvidenceSources,
      persisted_daily_snapshots: persisted.snapshots,
      persisted_strategy_rollups: persisted.strategy_rollups,
      persisted_proof_summary: persisted.proof_summary,
      persisted_proof_readiness: proofReadiness,
      persisted_proof_runway: proofRunway,
      persisted_capture_calendar: persisted.capture_calendar,
      persisted_agent_edge_proof_matrix: persisted.agent_edge_proof_matrix,
      persistence: {
        status: persisted.status,
        message: persisted.message,
        latest_captured_at: persisted.latest_captured_at,
        capture_health: persisted.capture_health,
        capture_calendar: persisted.capture_calendar,
        registry_sync: registrySync,
        proof_summary: persisted.proof_summary,
        proof_readiness: proofReadiness,
        proof_runway: proofRunway,
        proof_evidence_sources: proofEvidenceSources,
        agent_edge_proof_matrix: persisted.agent_edge_proof_matrix,
      },
      persisted_registry_sync: registrySync,
      description:
        "Eivra paper-trading v2. Converts agent probability edges versus market prices into bounded paper tickets. Query params configure analytics only; no real money, no order execution, and no leverage.",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    }
  );
}
