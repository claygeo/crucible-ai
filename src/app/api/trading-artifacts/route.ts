import { NextResponse } from "next/server";
import {
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [status, publishedProof] = await Promise.all([
    loadPaperTradingArtifactWorkflowStatus(5),
    loadPublishedPaperTradingArtifactProof(),
  ]);

  return NextResponse.json(
    {
      ...status,
      published_proof: publishedProof,
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
