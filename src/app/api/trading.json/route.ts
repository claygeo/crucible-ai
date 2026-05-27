import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import { loadPaperTradingSnapshotHistory } from "@/lib/trading-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const [snapshot, persisted] = await Promise.all([
    getTradingSnapshot(controls),
    loadPaperTradingSnapshotHistory(96),
  ]);

  return NextResponse.json(
    {
      ...snapshot,
      persisted_daily_snapshots: persisted.snapshots,
      persisted_strategy_rollups: persisted.strategy_rollups,
      persistence: {
        status: persisted.status,
        message: persisted.message,
        latest_captured_at: persisted.latest_captured_at,
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
