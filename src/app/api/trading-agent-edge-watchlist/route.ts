import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import { loadPublishedPaperTradingArtifactProof } from "@/lib/trading-artifacts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const [snapshot, publishedArtifactProof] = await Promise.all([
    getTradingSnapshot(controls),
    loadPublishedPaperTradingArtifactProof(),
  ]);

  return NextResponse.json(
    {
      schema_version: "1",
      generated_at: new Date().toISOString(),
      paper_only: true,
      real_money_execution_allowed: false,
      controls,
      current_agent_edge_watchlist: snapshot.agent_edge_watchlist,
      published_agent_edge_watchlist:
        publishedArtifactProof.agent_edge_watchlist,
      published_artifact_proof_status: publishedArtifactProof.status,
      description:
        "Read-only open-signal watchlist for canonical Eivra agent-edge rules. It tracks paper-only tradability, exposure, and open EV; it never creates orders or enables real-money execution.",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
