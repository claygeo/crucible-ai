import { NextResponse } from "next/server";
import {
  buildPaperTradingArtifactHistory,
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";
import {
  buildResolutionReviewQueue,
  enrichResolutionReviewQueueWithProviderResolution,
} from "@/lib/trading-resolution-review";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [status, publishedProof] = await Promise.all([
    loadPaperTradingArtifactWorkflowStatus(5),
    loadPublishedPaperTradingArtifactProof(),
  ]);
  const resolutionReviewQueue =
    await enrichResolutionReviewQueueWithProviderResolution(
      buildResolutionReviewQueue({
        publishedArtifactProof: publishedProof,
      }),
    );
  const artifactHistory = buildPaperTradingArtifactHistory({
    publishedArtifactProof: publishedProof,
  });

  return NextResponse.json(
    {
      ...status,
      artifact_history: artifactHistory,
      published_proof: publishedProof,
      resolution_review_queue: resolutionReviewQueue,
    },
    {
      status:
        status.status === "unavailable" &&
        publishedProof.status === "unavailable"
          ? 503
          : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
