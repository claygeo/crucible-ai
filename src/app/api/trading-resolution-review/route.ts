import { NextResponse } from "next/server";
import { loadPublishedPaperTradingArtifactProof } from "@/lib/trading-artifacts";
import {
  buildResolutionReviewQueue,
  enrichResolutionReviewQueueWithProviderResolution,
} from "@/lib/trading-resolution-review";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const [snapshot, publishedArtifactProof] = await Promise.all([
    getTradingSnapshot(controls),
    loadPublishedPaperTradingArtifactProof(),
  ]);
  const queue = await enrichResolutionReviewQueueWithProviderResolution(
    buildResolutionReviewQueue({
      resolutionWatch: snapshot.resolution_watch,
      publishedArtifactProof,
    }),
  );

  return NextResponse.json(
    {
      ...queue,
      description:
        "Read-only paper-trading resolution review queue. It lists live paper markets that must be reviewed before open EV can be trusted. It never writes market outcomes and never enables execution.",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
