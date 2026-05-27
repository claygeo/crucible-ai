import { NextResponse } from "next/server";
import { parseTradingControls } from "@/lib/trading";
import { buildPaperTradingAgentEdgeEvidenceTimeline } from "@/lib/trading-agent-edge-evidence";
import { buildPaperTradingAgentEdgeProof } from "@/lib/trading-agent-edge-proof";
import { loadPublishedPaperTradingArtifactProof } from "@/lib/trading-artifacts";
import { loadPaperTradingSnapshotHistory } from "@/lib/trading-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const [persisted, publishedArtifactProof] = await Promise.all([
    loadPaperTradingSnapshotHistory(1000),
    loadPublishedPaperTradingArtifactProof(),
  ]);
  const agentEdgeProof = buildPaperTradingAgentEdgeProof({
    persistedRows: persisted.agent_edge_proof_matrix,
    publishedArtifactProof,
  });
  const timeline = buildPaperTradingAgentEdgeEvidenceTimeline({
    persistence: persisted,
    agentEdgeProof,
    publishedArtifactProof,
    selectedAgentId: controls.agent_id,
    selectedMinEdge: controls.min_edge,
  });

  return NextResponse.json(
    {
      ...timeline,
      controls,
      description:
        "Read-only per-rule daily evidence timeline for canonical Eivra agent-edge paper strategies. It is derived from persisted paper snapshots and never enables execution.",
    },
    {
      status: timeline.status === "unavailable" ? 503 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
