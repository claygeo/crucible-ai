import { NextRequest, NextResponse } from "next/server";
import { getTradingSnapshot, parseTradingControls } from "@/lib/trading";
import {
  buildPaperTradingEvidenceSla,
  buildPaperTradingWriteReadiness,
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";
import { buildResolutionReviewQueue } from "@/lib/trading-resolution-review";
import {
  buildPaperTradingCapitalReviewPacket,
  buildPaperTradingProofEvidenceSources,
  loadPaperTradingSnapshotHistory,
  persistPaperTradingSnapshot,
} from "@/lib/trading-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 1000;

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
  const [history, artifactWorkflow, publishedArtifactProof] = await Promise.all(
    [
      loadPaperTradingSnapshotHistory(parseLimit(request)),
      loadPaperTradingArtifactWorkflowStatus(5),
      loadPublishedPaperTradingArtifactProof(),
    ],
  );
  const proofEvidenceSources = buildPaperTradingProofEvidenceSources({
    persistence: history,
    proofReadiness: history.proof_readiness,
    proofRunway: history.proof_runway,
  });
  const capitalReviewPacket = buildPaperTradingCapitalReviewPacket({
    proofSummary: history.proof_summary,
    proofReadiness: history.proof_readiness,
    proofRunway: history.proof_runway,
  });
  const writeReadiness = buildPaperTradingWriteReadiness({
    artifactWorkflow,
    publishedArtifactProof,
  });
  const evidenceSla = buildPaperTradingEvidenceSla({
    persistence: history,
    publishedArtifactProof,
    writeReadiness,
  });
  const resolutionReviewQueue = buildResolutionReviewQueue({
    publishedArtifactProof,
  });

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
        capture_calendar: history.capture_calendar,
        proof_summary: history.proof_summary,
        proof_readiness: history.proof_readiness,
        proof_runway: history.proof_runway,
        capital_review_packet: capitalReviewPacket,
        proof_evidence_sources: proofEvidenceSources,
        resolution_review_queue: resolutionReviewQueue,
        github_artifact_workflow: artifactWorkflow,
        published_artifact_proof: publishedArtifactProof,
        write_readiness: writeReadiness,
        evidence_sla: evidenceSla,
        agent_edge_proof_matrix: history.agent_edge_proof_matrix,
      },
      proof_summary: history.proof_summary,
      proof_readiness: history.proof_readiness,
      proof_runway: history.proof_runway,
      capital_review_packet: capitalReviewPacket,
      proof_evidence_sources: proofEvidenceSources,
      resolution_review_queue: resolutionReviewQueue,
      github_artifact_workflow: artifactWorkflow,
      published_artifact_proof: publishedArtifactProof,
      paper_write_readiness: writeReadiness,
      paper_evidence_sla: evidenceSla,
      capture_calendar: history.capture_calendar,
      agent_edge_proof_matrix: history.agent_edge_proof_matrix,
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
    },
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
      { status: 401, headers: { "cache-control": "no-store" } },
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
    },
  );
}
