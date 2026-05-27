import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import { buildPaperTradingAgentEdgeProof } from "@/lib/trading-agent-edge-proof";
import { loadPublishedPaperTradingArtifactProof } from "@/lib/trading-artifacts";
import { loadPaperTradingSnapshotHistory } from "@/lib/trading-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const [snapshot, persisted, publishedArtifactProof] = await Promise.all([
    getTradingSnapshot(controls),
    loadPaperTradingSnapshotHistory(1000),
    loadPublishedPaperTradingArtifactProof(),
  ]);
  const proof = buildPaperTradingAgentEdgeProof({
    persistedRows: persisted.agent_edge_proof_matrix,
    publishedArtifactProof,
  });

  return NextResponse.json(
    {
      ...proof,
      controls,
      current_agent_edge_matrix: snapshot.agent_edge_matrix,
      published_agent_edge_matrix: publishedArtifactProof.agent_edge_matrix,
      published_selected_bankroll_risk:
        publishedArtifactProof.selected_bankroll_risk,
      published_selected_open_outcome_scenarios:
        publishedArtifactProof.selected_open_outcome_scenarios,
      persisted_source_status: persisted.status,
      published_artifact_proof_status: publishedArtifactProof.status,
      description:
        "Read-only canonical agent-edge proof leaderboard. Uses persisted Supabase rows when available and falls back to the latest published artifact proof; it also exposes current and published open-outcome matrices while never enabling execution.",
    },
    {
      status: proof.status === "unavailable" ? 503 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
