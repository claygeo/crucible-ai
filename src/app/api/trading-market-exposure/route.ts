import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import {
  buildPaperTradingProofReadiness,
  buildPaperTradingProofRunway,
  loadPaperTradingSnapshotHistory,
} from "@/lib/trading-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const [snapshot, persisted] = await Promise.all([
    getTradingSnapshot(controls),
    loadPaperTradingSnapshotHistory(1000),
  ]);
  const proofReadiness = buildPaperTradingProofReadiness({
    persistenceStatus: persisted.status,
    proofSummary: persisted.proof_summary,
    captureHealth: persisted.capture_health,
    captureCalendar: persisted.capture_calendar,
    resolutionWatch: snapshot.resolution_watch,
  });
  const proofRunway = buildPaperTradingProofRunway({
    proofSummary: persisted.proof_summary,
    captureHealth: persisted.capture_health,
    captureCalendar: persisted.capture_calendar,
    resolutionWatch: snapshot.resolution_watch,
  });

  return NextResponse.json(
    {
      ...snapshot.market_exposure_digest,
      controls,
      proof_readiness: proofReadiness,
      proof_runway: proofRunway,
      resolution_watch: snapshot.resolution_watch,
      description:
        "Paper-only market exposure digest. Groups open live paper tickets by market/source/category so repeated agent exposure is visible before review.",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
