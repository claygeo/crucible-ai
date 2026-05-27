import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import {
  buildPaperTradingArtifactHistory,
  buildPaperTradingEvidenceSla,
  buildPaperTradingWriteReadiness,
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";
import {
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

  return NextResponse.json(
    {
      ...evidenceSla,
      controls,
      registry_sync: registrySync,
      current_resolution_watch: snapshot.resolution_watch,
      github_artifact_workflow: artifactWorkflow,
      published_artifact_proof: publishedArtifactProof,
      paper_artifact_history: artifactHistory,
      paper_write_readiness: writeReadiness,
      description:
        "Read-only Eivra paper evidence SLA. It reports whether the 30-day proof capture trail is healthy, degraded, or blocked; it never enables real-money execution.",
    },
    {
      status: evidenceSla.status === "unavailable" ? 503 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
