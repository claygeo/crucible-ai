import { NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const controls = parseTradingControls(new URL(request.url).searchParams);
  const snapshot = await getTradingSnapshot(controls);

  return NextResponse.json(
    {
      ...snapshot.agent_edge_attribution,
      controls,
      source: snapshot.source,
      description:
        "Read-only agent-edge resolved-profit attribution. It groups canonical paper P&L by source, category, and market so profitable-looking rules can be checked for concentration before any capital review.",
    },
    {
      status:
        snapshot.agent_edge_attribution.status === "unavailable" ? 503 : 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "access-control-allow-origin": "*",
      },
    },
  );
}
