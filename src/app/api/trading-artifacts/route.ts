import { NextResponse } from "next/server";
import {
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";
import { buildResolutionReviewQueue } from "@/lib/trading-resolution-review";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [status, publishedProof] = await Promise.all([
    loadPaperTradingArtifactWorkflowStatus(5),
    loadPublishedPaperTradingArtifactProof(),
  ]);
  const resolutionReviewQueue = buildResolutionReviewQueue({
    publishedArtifactProof: publishedProof,
  });

  return NextResponse.json(
    {
      ...status,
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
