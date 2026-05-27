import { NextResponse } from "next/server";
import { loadPaperTradingArtifactWorkflowStatus } from "@/lib/trading-artifacts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const status = await loadPaperTradingArtifactWorkflowStatus(5);

  return NextResponse.json(status, {
    status: status.status === "unavailable" ? 503 : 200,
    headers: {
      "cache-control": "no-store, max-age=0",
      "access-control-allow-origin": "*",
    },
  });
}
