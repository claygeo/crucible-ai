import { NextResponse } from "next/server";
import {
  buildPaperTradingWriteReadiness,
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [artifactWorkflow, publishedArtifactProof] = await Promise.all([
    loadPaperTradingArtifactWorkflowStatus(5),
    loadPublishedPaperTradingArtifactProof(),
  ]);
  const writeReadiness = buildPaperTradingWriteReadiness({
    artifactWorkflow,
    publishedArtifactProof,
  });

  return NextResponse.json(
    {
      ...writeReadiness,
      github_artifact_workflow: artifactWorkflow,
      published_artifact_proof: publishedArtifactProof,
      description:
        "Read-only paper snapshot write-readiness. Shows whether daily proof captures are persisting Supabase rows or only publishing GitHub artifacts.",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
