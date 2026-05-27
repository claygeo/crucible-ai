import { NextResponse } from "next/server";
import {
  buildPaperTradingStrategyRegistry,
  parseTradingControls,
} from "@/lib/trading";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const registry = buildPaperTradingStrategyRegistry(controls);

  return NextResponse.json(
    {
      ...registry,
      description:
        "Paper-only Eivra strategy lab registry. These are analytics rules under observation, not executable orders, wallets, leverage, or live-capital instructions.",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
