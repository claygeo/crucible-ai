import { NextResponse } from "next/server";
import { buildPaperTradingAgentEdgeProof } from "@/lib/trading-agent-edge-proof";
import {
  buildPaperTradingArtifactHistory,
  buildPaperTradingEvidenceSla,
  buildPaperTradingWriteReadiness,
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";
import { buildPaperTradingLabStatus } from "@/lib/trading-lab-status";
import { buildResolutionCatchupPreview } from "@/lib/trading-resolution-catchup";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import {
  buildPaperTradingCapitalReviewPacket,
  buildPaperTradingProofReadiness,
  buildPaperTradingProofRunway,
  buildPaperTradingStrategyRegistrySync,
  loadPaperTradingSnapshotHistory,
} from "@/lib/trading-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const [snapshot, persisted, artifactWorkflow, publishedArtifactProof] =
    await Promise.all([
      getTradingSnapshot(controls),
      loadPaperTradingSnapshotHistory(1000),
      loadPaperTradingArtifactWorkflowStatus(5),
      loadPublishedPaperTradingArtifactProof(),
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
  const capitalReviewPacket = buildPaperTradingCapitalReviewPacket({
    proofSummary: persisted.proof_summary,
    proofReadiness,
    proofRunway,
  });
  const writeReadiness = buildPaperTradingWriteReadiness({
    artifactWorkflow,
    publishedArtifactProof,
  });
  const artifactHistory = buildPaperTradingArtifactHistory({
    publishedArtifactProof,
  });
  const evidenceSla = buildPaperTradingEvidenceSla({
    persistence: persisted,
    publishedArtifactProof,
    writeReadiness,
    registrySync,
    resolutionWatch: snapshot.resolution_watch,
  });
  const agentEdgeProof = buildPaperTradingAgentEdgeProof({
    persistedRows: persisted.agent_edge_proof_matrix,
    publishedArtifactProof,
  });
  const resolutionCatchupPreview = await buildResolutionCatchupPreview({
    controls: snapshot.controls,
  });
  const labStatus = buildPaperTradingLabStatus({
    snapshot,
    registrySync,
    proofReadiness,
    proofRunway,
    capitalReviewPacket,
    writeReadiness,
    artifactHistory,
    evidenceSla,
    agentEdgeProof,
    resolutionCatchupPreview,
  });

  return NextResponse.json(
    {
      ...labStatus,
      controls,
      description:
        "Read-only Eivra 30-day paper lab status. It composes evidence SLA, resolver catch-up, agent-edge profitability, exposure-cap leakage, and capital-review gates without enabling execution.",
    },
    {
      status: labStatus.status === "unavailable" ? 503 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
