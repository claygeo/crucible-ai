import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import { buildPaperTradingAgentEdgeDossier } from "@/lib/trading-agent-edge-dossier";
import { buildPaperTradingAgentEdgeEvidenceTimeline } from "@/lib/trading-agent-edge-evidence";
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
  const agentEdgeProof = buildPaperTradingAgentEdgeProof({
    persistedRows: persisted.agent_edge_proof_matrix,
    publishedArtifactProof,
  });
  const evidenceTimeline = buildPaperTradingAgentEdgeEvidenceTimeline({
    persistence: persisted,
    agentEdgeProof,
    publishedArtifactProof,
    selectedAgentId: controls.agent_id,
    selectedMinEdge: controls.min_edge,
  });
  const dossier = buildPaperTradingAgentEdgeDossier({
    agentEdgeProof,
    evidenceTimeline,
    tradeLedger: snapshot.agent_edge_trade_ledger,
    runway: snapshot.agent_edge_runway,
    watchlist: snapshot.agent_edge_watchlist,
    selectedAgentId: controls.agent_id,
    selectedMinEdge: controls.min_edge,
  });

  return NextResponse.json(
    {
      ...dossier,
      controls,
      description:
        "Read-only selected-rule proof dossier for Eivra agent-edge paper strategies. It composes durable proof, daily evidence, resolved tickets, runway, and open-signal watchlist without enabling execution.",
    },
    {
      status: dossier.status === "unavailable" ? 503 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
