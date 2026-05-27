import { NextRequest, NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import {
  loadPaperTradingSnapshotHistory,
  persistPaperTradingSnapshot,
} from "@/lib/trading-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 96;

function parseLimit(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get("limit");
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_LIMIT;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(parsed, MAX_LIMIT));
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SHARED_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const history = await loadPaperTradingSnapshotHistory(parseLimit(request));

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      schema_version: "1",
      description:
        "Persisted Eivra paper-trading proof snapshots. Rows are analytics evidence only; no execution path.",
      persistence: {
        status: history.status,
        message: history.message,
        latest_captured_at: history.latest_captured_at,
        capture_health: history.capture_health,
      },
      count: history.snapshots.length,
      strategy_rollups: history.strategy_rollups,
      snapshots: history.snapshots,
    },
    {
      status: history.status === "error" ? 500 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message:
          "Set CRON_SHARED_SECRET and call with Authorization: Bearer <secret>.",
      },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  const controls = parseTradingControls(request.nextUrl.searchParams);
  const snapshot = await getTradingSnapshot(controls);
  const result = await persistPaperTradingSnapshot(snapshot);

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      schema_version: "1",
      source: snapshot.source,
      result,
    },
    {
      status: result.status === "written" ? 201 : 503,
      headers: { "cache-control": "no-store, max-age=0" },
    }
  );
}
