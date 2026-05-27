import { NextResponse } from "next/server";
import {
  applyResolutionCatchup,
  buildResolutionCatchupPreview,
} from "@/lib/trading-resolution-catchup";
import { parseTradingControls } from "@/lib/trading";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseLimit(url: URL): number {
  const raw = url.searchParams.get("limit");
  const parsed = raw ? Number.parseInt(raw, 10) : 25;
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(1, Math.min(parsed, 100));
}

function parseDryRun(url: URL): boolean {
  const raw = url.searchParams.get("dry_run") ?? url.searchParams.get("dryRun");
  if (!raw) return true;
  return !["false", "0", "no"].includes(raw.toLowerCase());
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SHARED_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const controls = parseTradingControls(url.searchParams);
  const preview = await buildResolutionCatchupPreview({
    controls,
    limit: parseLimit(url),
  });

  return NextResponse.json(
    {
      ...preview,
      description:
        "Read-only paper-trading resolution catch-up preview. It detects provider-resolved live markets that Eivra has not scored yet and estimates the paper-only P&L that would land after resolver refresh. It never writes outcomes, scores, orders, or real-money execution state.",
    },
    {
      status: preview.status === "error" ? 500 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message:
          "Set CRON_SHARED_SECRET and call with Authorization: Bearer <secret>.",
      },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const url = new URL(request.url);
  const result = await applyResolutionCatchup({
    dryRun: parseDryRun(url),
    limit: parseLimit(url),
    marketId: url.searchParams.get("market_id"),
  });

  return NextResponse.json(
    {
      ...result,
      description:
        "Authorized paper-only resolution catch-up. It updates stale market resolution fields and score rows for provider-resolved markets, then refreshes agent stats. It never creates orders, wallets, leverage, or real-money execution state.",
    },
    {
      status: result.status === "error" ? 500 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}
