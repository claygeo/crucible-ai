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
        "Read-only historical snapshot write-readiness from the archived run. Daily proof captures ended when the pipeline was decommissioned.",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
