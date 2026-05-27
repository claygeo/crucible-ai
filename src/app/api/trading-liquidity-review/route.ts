import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import { buildPaperTradingLiquidityReview } from "@/lib/trading-liquidity-review";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const snapshot = await getTradingSnapshot(controls);
  const liquidityReview = buildPaperTradingLiquidityReview(snapshot);

  return NextResponse.json(
    {
      ...liquidityReview,
      controls,
      description:
        "Read-only source-level liquidity and slippage review for Eivra paper strategies. It never enables execution; it only shows why paper P&L is not capital-review evidence without spread, depth, fee, and fill-size data.",
    },
    {
      status: liquidityReview.status === "unavailable" ? 503 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
