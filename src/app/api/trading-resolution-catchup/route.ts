import { NextResponse } from "next/server";
import { buildResolutionCatchupPreview } from "@/lib/trading-resolution-catchup";
import { parseTradingControls } from "@/lib/trading";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseLimit(url: URL): number {
  const raw = url.searchParams.get("limit");
  const parsed = raw ? Number.parseInt(raw, 10) : 25;
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(1, Math.min(parsed, 100));
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
