import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import {
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";
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

  return NextResponse.json(
    {
      ...capitalReviewPacket,
      controls,
      registry_sync: registrySync,
      current_resolution_watch: snapshot.resolution_watch,
      current_would_trade_today: snapshot.would_trade_today,
      github_artifact_workflow: artifactWorkflow,
      published_artifact_proof: publishedArtifactProof,
      description:
        "Read-only Eivra paper capital-review packet. It summarizes whether the 30-day proof lab is reviewable and never enables real-money execution.",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
