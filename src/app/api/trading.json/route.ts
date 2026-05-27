import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import { buildPaperTradingAgentEdgeProof } from "@/lib/trading-agent-edge-proof";
import {
  buildPaperTradingEvidenceSla,
  buildPaperTradingWriteReadiness,
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";
import { buildResolutionReviewQueue } from "@/lib/trading-resolution-review";
import {
  buildPaperTradingCapitalReviewPacket,
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
  const proofEvidenceSources = buildPaperTradingProofEvidenceSources({
    persistence: persisted,
    proofReadiness,
    proofRunway,
    resolutionWatch: snapshot.resolution_watch,
  });
  const resolutionReviewQueue = buildResolutionReviewQueue({
    resolutionWatch: snapshot.resolution_watch,
    publishedArtifactProof,
  });

  return NextResponse.json(
    {
      ...snapshot,
      resolution_review_queue: resolutionReviewQueue,
      proof_evidence_sources: proofEvidenceSources,
      persisted_daily_snapshots: persisted.snapshots,
      persisted_strategy_rollups: persisted.strategy_rollups,
      persisted_proof_summary: persisted.proof_summary,
      persisted_proof_readiness: proofReadiness,
      persisted_proof_runway: proofRunway,
      persisted_capital_review_packet: capitalReviewPacket,
      persisted_capture_calendar: persisted.capture_calendar,
      persisted_agent_edge_proof_matrix: persisted.agent_edge_proof_matrix,
      github_artifact_workflow: artifactWorkflow,
      published_artifact_proof: publishedArtifactProof,
      paper_write_readiness: writeReadiness,
      paper_evidence_sla: evidenceSla,
      paper_agent_edge_proof: agentEdgeProof,
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
        capital_review_packet: capitalReviewPacket,
        proof_evidence_sources: proofEvidenceSources,
        resolution_review_queue: resolutionReviewQueue,
        github_artifact_workflow: artifactWorkflow,
        published_artifact_proof: publishedArtifactProof,
        write_readiness: writeReadiness,
        evidence_sla: evidenceSla,
        agent_edge_proof: agentEdgeProof,
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
    },
  );
}
