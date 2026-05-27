import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import { loadPaperTradingSnapshotHistory } from "@/lib/trading-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const [snapshot, persisted] = await Promise.all([
    getTradingSnapshot(controls),
    loadPaperTradingSnapshotHistory(1000),
  ]);

  return NextResponse.json(
    {
      ...snapshot,
      persisted_daily_snapshots: persisted.snapshots,
      persisted_strategy_rollups: persisted.strategy_rollups,
      persisted_proof_summary: persisted.proof_summary,
      persisted_capture_calendar: persisted.capture_calendar,
      persistence: {
        status: persisted.status,
        message: persisted.message,
        latest_captured_at: persisted.latest_captured_at,
        capture_health: persisted.capture_health,
        capture_calendar: persisted.capture_calendar,
        proof_summary: persisted.proof_summary,
      },
      description:
        "Eivra paper-trading v2. Converts agent probability edges versus market prices into bounded paper tickets. Query params configure analytics only; no real money, no order execution, and no leverage.",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    }
  );
}
