import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import { buildPaperTradingAgentEdgeProof } from "@/lib/trading-agent-edge-proof";
import { loadPublishedPaperTradingArtifactProof } from "@/lib/trading-artifacts";
import { buildPaperTradingProofAudit } from "@/lib/trading-proof-audit";
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
  const [snapshot, persisted, publishedArtifactProof] = await Promise.all([
    getTradingSnapshot(controls),
    loadPaperTradingSnapshotHistory(1000),
    loadPublishedPaperTradingArtifactProof(),
  ]);
  const registrySync = buildPaperTradingStrategyRegistrySync(
    snapshot.strategy_variants,
    persisted.snapshots,
  );
  const readiness = buildPaperTradingProofReadiness({
    persistenceStatus: persisted.status,
    proofSummary: persisted.proof_summary,
    captureHealth: persisted.capture_health,
    captureCalendar: persisted.capture_calendar,
    registrySync,
    resolutionWatch: snapshot.resolution_watch,
  });
  const runway = buildPaperTradingProofRunway({
    proofSummary: persisted.proof_summary,
    captureHealth: persisted.capture_health,
    captureCalendar: persisted.capture_calendar,
    resolutionWatch: snapshot.resolution_watch,
  });
  const agentEdgeProof = buildPaperTradingAgentEdgeProof({
    persistedRows: persisted.agent_edge_proof_matrix,
    publishedArtifactProof,
  });
  const audit = buildPaperTradingProofAudit({
    snapshot,
    persisted,
    agentEdgeProof,
    publishedArtifactProof,
    registrySync,
    readiness,
    runway,
    controls,
  });

  return NextResponse.json(
    {
      ...audit,
      description:
        "Read-only Eivra paper-trading proof audit. This endpoint never enables execution; it only reports whether durable paper evidence is ready for operator capital review.",
    },
    {
      status: audit.verdict === "unavailable" ? 503 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
