import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import { buildPaperTradingAgentEdgeProof } from "@/lib/trading-agent-edge-proof";
import {
  buildPaperTradingArtifactHistory,
  buildPaperTradingEvidenceSla,
  buildPaperTradingWriteReadiness,
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";
import { buildPaperTradingLabStatus } from "@/lib/trading-lab-status";
import { buildPaperTradingLiquidityReview } from "@/lib/trading-liquidity-review";
import { buildResolutionCatchupPreview } from "@/lib/trading-resolution-catchup";
import {
  buildResolutionReviewQueue,
  enrichResolutionReviewQueueWithProviderResolution,
} from "@/lib/trading-resolution-review";
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
  const liquidityReview = buildPaperTradingLiquidityReview(snapshot);
  const proofEvidenceSources = buildPaperTradingProofEvidenceSources({
    persistence: persisted,
    proofReadiness,
    proofRunway,
    resolutionWatch: snapshot.resolution_watch,
  });
  const resolutionReviewQueue =
    await enrichResolutionReviewQueueWithProviderResolution(
      buildResolutionReviewQueue({
        resolutionWatch: snapshot.resolution_watch,
        publishedArtifactProof,
      }),
    );
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
      ...snapshot,
      paper_lab_status: labStatus,
      resolution_review_queue: resolutionReviewQueue,
      resolution_catchup_preview: resolutionCatchupPreview,
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
      paper_artifact_history: artifactHistory,
      paper_write_readiness: writeReadiness,
      paper_evidence_sla: evidenceSla,
      paper_agent_edge_proof: agentEdgeProof,
      paper_liquidity_review: liquidityReview,
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
        resolution_catchup_preview: resolutionCatchupPreview,
        github_artifact_workflow: artifactWorkflow,
        published_artifact_proof: publishedArtifactProof,
        artifact_history: artifactHistory,
        write_readiness: writeReadiness,
        evidence_sla: evidenceSla,
        lab_status: labStatus,
        agent_edge_proof: agentEdgeProof,
        agent_edge_proof_matrix: persisted.agent_edge_proof_matrix,
        liquidity_review: liquidityReview,
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
