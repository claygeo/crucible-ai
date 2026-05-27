import type { PaperTradingAgentEdgeProof } from "../src/lib/trading-agent-edge-proof";
import type { PublishedPaperTradingArtifactProof } from "../src/lib/trading-artifacts";
import type { PaperTradingProofAudit } from "../src/lib/trading-proof-audit";
import { installNodeWebSocket } from "./node-websocket";

const DEFAULT_QUERY = new URLSearchParams({
  sample: "live_only",
  agent: "all",
  category: "all",
  side: "all",
  min_edge: "0.1",
  stake_mode: "kelly_capped",
  ticket_usd: "25",
  max_stake_usd: "100",
  max_open_exposure_usd: "500",
});
const FIXED_GENERATED_AT = "2026-01-01T00:00:00.000Z";

type Failure = {
  code: string;
  detail: string;
};

type JsonRecord = Record<string, unknown>;

type AuditInputs = {
  snapshot: Awaited<
    ReturnType<typeof import("../src/lib/trading").getTradingSnapshot>
  >;
  persisted: Awaited<
    ReturnType<
      typeof import("../src/lib/trading-snapshots").loadPaperTradingSnapshotHistory
    >
  >;
  publishedArtifactProof: PublishedPaperTradingArtifactProof;
  controls: ReturnType<
    typeof import("../src/lib/trading").parseTradingControls
  >;
  registrySync: ReturnType<
    typeof import("../src/lib/trading-snapshots").buildPaperTradingStrategyRegistrySync
  >;
  readiness: ReturnType<
    typeof import("../src/lib/trading-snapshots").buildPaperTradingProofReadiness
  >;
  runway: ReturnType<
    typeof import("../src/lib/trading-snapshots").buildPaperTradingProofRunway
  >;
  agentEdgeProof: PaperTradingAgentEdgeProof;
};

const failures: Failure[] = [];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function expect(condition: boolean, code: string, detail: string) {
  if (!condition) failures.push({ code, detail });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableJson(entryValue)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function jsonRecord(response: Response): Promise<JsonRecord> {
  const value = (await response.json()) as unknown;
  if (!isRecord(value)) {
    throw new Error("Route did not return a JSON object.");
  }
  return value;
}

function checkById(audit: PaperTradingProofAudit, id: string) {
  const found = audit.checks.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Audit check missing: ${id}`);
  }
  return found;
}

function withPublishedProof(
  proof: PublishedPaperTradingArtifactProof,
  overrides: Partial<PublishedPaperTradingArtifactProof>,
): PublishedPaperTradingArtifactProof {
  return {
    ...proof,
    ...overrides,
  };
}

async function loadAuditInputs(): Promise<AuditInputs> {
  const { getTradingSnapshot, parseTradingControls } =
    await import("../src/lib/trading");
  const { buildPaperTradingAgentEdgeProof } =
    await import("../src/lib/trading-agent-edge-proof");
  const { loadPublishedPaperTradingArtifactProof } =
    await import("../src/lib/trading-artifacts");
  const {
    buildPaperTradingProofReadiness,
    buildPaperTradingProofRunway,
    buildPaperTradingStrategyRegistrySync,
    loadPaperTradingSnapshotHistory,
  } = await import("../src/lib/trading-snapshots");

  const controls = parseTradingControls(DEFAULT_QUERY);
  const [snapshot, persisted, publishedArtifactProof] = await Promise.all([
    getTradingSnapshot(controls),
    loadPaperTradingSnapshotHistory(1000),
    loadPublishedPaperTradingArtifactProof(),
  ]);
  const registrySync = buildPaperTradingStrategyRegistrySync(
    snapshot.strategy_variants,
    persisted.snapshots,
  );
  const readiness = buildPaperTradingProofReadiness({
    persistenceStatus: persisted.status,
    proofSummary: persisted.proof_summary,
    captureHealth: persisted.capture_health,
    captureCalendar: persisted.capture_calendar,
    registrySync,
    resolutionWatch: snapshot.resolution_watch,
  });
  const runway = buildPaperTradingProofRunway({
    proofSummary: persisted.proof_summary,
    captureHealth: persisted.capture_health,
    captureCalendar: persisted.capture_calendar,
    resolutionWatch: snapshot.resolution_watch,
  });
  const agentEdgeProof = buildPaperTradingAgentEdgeProof({
    persistedRows: persisted.agent_edge_proof_matrix,
    publishedArtifactProof,
    generatedAt: FIXED_GENERATED_AT,
  });

  return {
    snapshot,
    persisted,
    publishedArtifactProof,
    controls,
    registrySync,
    readiness,
    runway,
    agentEdgeProof,
  };
}

async function buildAudit(
  inputs: AuditInputs,
  overrides: {
    publishedArtifactProof?: PublishedPaperTradingArtifactProof;
    agentEdgeProof?: PaperTradingAgentEdgeProof;
  } = {},
): Promise<PaperTradingProofAudit> {
  const { buildPaperTradingProofAudit } =
    await import("../src/lib/trading-proof-audit");

  return buildPaperTradingProofAudit({
    snapshot: inputs.snapshot,
    persisted: inputs.persisted,
    agentEdgeProof: overrides.agentEdgeProof ?? inputs.agentEdgeProof,
    publishedArtifactProof:
      overrides.publishedArtifactProof ?? inputs.publishedArtifactProof,
    registrySync: inputs.registrySync,
    readiness: inputs.readiness,
    runway: inputs.runway,
    controls: inputs.controls,
    generatedAt: FIXED_GENERATED_AT,
  });
}

async function smokeRoutes() {
  const tradingRoute = (await import("../src/app/api/trading.json/route")) as {
    GET(request: Request): Promise<Response>;
  };
  const auditRoute =
    (await import("../src/app/api/trading-proof-audit/route")) as {
      GET(request: Request): Promise<Response>;
    };
  const query = DEFAULT_QUERY.toString();
  const [feedResponse, auditResponse] = await Promise.all([
    tradingRoute.GET(new Request(`http://localhost/api/trading.json?${query}`)),
    auditRoute.GET(
      new Request(`http://localhost/api/trading-proof-audit?${query}`),
    ),
  ]);
  const [feed, routeAudit] = await Promise.all([
    jsonRecord(feedResponse),
    jsonRecord(auditResponse),
  ]);
  const feedAudit = feed.paper_proof_audit;
  const persistence = feed.persistence;
  const nestedAudit = isRecord(persistence)
    ? persistence.proof_audit
    : undefined;

  expect(
    isRecord(feedAudit),
    "route_feed_audit",
    "trading.json is missing paper_proof_audit.",
  );
  expect(
    isRecord(nestedAudit),
    "route_nested_audit",
    "trading.json persistence.proof_audit is missing.",
  );
  if (isRecord(feedAudit) && isRecord(nestedAudit)) {
    expect(
      stableJson(feedAudit) === stableJson(nestedAudit),
      "route_audit_embed_mismatch",
      "paper_proof_audit and persistence.proof_audit should be the same payload.",
    );
  }
  if (isRecord(feedAudit)) {
    expect(
      feedAudit.verdict === routeAudit.verdict,
      "route_verdict_mismatch",
      "trading.json audit verdict differs from /api/trading-proof-audit.",
    );
    expect(
      stableJson(feedAudit.published_artifact_provenance) ===
        stableJson(routeAudit.published_artifact_provenance),
      "route_provenance_mismatch",
      "Published provenance differs between feed and audit route.",
    );
    expect(
      stableJson(feedAudit.published_artifact_outcome_proof) ===
        stableJson(routeAudit.published_artifact_outcome_proof),
      "route_outcome_proof_mismatch",
      "Published outcome proof differs between feed and audit route.",
    );
    expect(
      feedAudit.paper_only === true &&
        feedAudit.real_money_execution_allowed === false,
      "route_paper_only_lock",
      "Route audit must keep paper_only=true and real_money_execution_allowed=false.",
    );
    expect(
      feedAudit.ready_for_capital_review === (feedAudit.verdict === "pass"),
      "route_capital_review_contract",
      "ready_for_capital_review should only be true when the audit verdict passes.",
    );
  }

  return {
    feed_status: feedResponse.status,
    audit_status: auditResponse.status,
    verdict: isRecord(feedAudit) ? feedAudit.verdict : null,
    route_verdict: routeAudit.verdict ?? null,
  };
}

async function smokeBuilder(inputs: AuditInputs) {
  const { buildPaperTradingAgentEdgeProof } =
    await import("../src/lib/trading-agent-edge-proof");
  const currentAudit = await buildAudit(inputs);
  const outcomeCheck = checkById(
    currentAudit,
    "published_artifact_outcome_matrix",
  );
  const provenanceCheck = checkById(
    currentAudit,
    "published_artifact_provenance",
  );

  expect(
    outcomeCheck.status === "pass",
    "current_outcome_matrix",
    `Current published outcome matrix should pass; got ${outcomeCheck.status}: ${outcomeCheck.detail}`,
  );
  expect(
    currentAudit.published_artifact_outcome_proof.agent_edge_matrix_rows ===
      inputs.agentEdgeProof.rule_count,
    "current_outcome_matrix_row_count",
    `Expected ${inputs.agentEdgeProof.rule_count} published outcome rows, got ${currentAudit.published_artifact_outcome_proof.agent_edge_matrix_rows}.`,
  );
  expect(
    currentAudit.published_artifact_outcome_proof.paper_only === true &&
      currentAudit.published_artifact_outcome_proof
        .real_money_execution_allowed === false,
    "current_outcome_matrix_paper_only",
    "Published outcome proof must keep the paper-only execution lock.",
  );

  if (
    inputs.agentEdgeProof.source === "published_artifact" &&
    inputs.publishedArtifactProof.workflow_mode?.effective_dry_run === true
  ) {
    expect(
      provenanceCheck.status === "collecting",
      "current_dry_run_provenance",
      `Dry-run artifact fallback should be collecting, got ${provenanceCheck.status}.`,
    );
  }

  const emptyMatrixAudit = await buildAudit(inputs, {
    publishedArtifactProof: withPublishedProof(inputs.publishedArtifactProof, {
      agent_edge_matrix: [],
    }),
  });
  const emptyMatrixCheck = checkById(
    emptyMatrixAudit,
    "published_artifact_outcome_matrix",
  );
  expect(
    emptyMatrixCheck.status === "blocked" &&
      emptyMatrixCheck.detail.includes("0/"),
    "empty_outcome_matrix_blocks",
    `Empty published outcome matrix should block with row-count detail, got ${emptyMatrixCheck.status}: ${emptyMatrixCheck.detail}`,
  );

  const firstOutcomeRow = inputs.publishedArtifactProof.agent_edge_matrix[0];
  if (isRecord(firstOutcomeRow)) {
    const invalidStrategyId = String(
      firstOutcomeRow.strategy_id ?? "unknown_strategy",
    );
    const invalidMatrix = [
      {
        ...firstOutcomeRow,
        pending_pnl_counts_as_proof: true,
      },
      ...inputs.publishedArtifactProof.agent_edge_matrix.slice(1),
    ];
    const invalidMatrixAudit = await buildAudit(inputs, {
      publishedArtifactProof: withPublishedProof(
        inputs.publishedArtifactProof,
        { agent_edge_matrix: invalidMatrix },
      ),
    });
    const invalidMatrixCheck = checkById(
      invalidMatrixAudit,
      "published_artifact_outcome_matrix",
    );
    expect(
      invalidMatrixCheck.status === "blocked" &&
        invalidMatrixCheck.detail.includes(invalidStrategyId),
      "pending_pnl_flag_blocks",
      `pending_pnl_counts_as_proof=true should block and name ${invalidStrategyId}; got ${invalidMatrixCheck.status}: ${invalidMatrixCheck.detail}`,
    );
  } else {
    failures.push({
      code: "published_outcome_row_missing",
      detail:
        "Current published proof has no first agent-edge outcome row to corrupt.",
    });
  }

  const missingRunAudit = await buildAudit(inputs, {
    publishedArtifactProof: withPublishedProof(inputs.publishedArtifactProof, {
      workflow_run: null,
    }),
  });
  const missingRunCheck = checkById(
    missingRunAudit,
    "published_artifact_provenance",
  );
  expect(
    missingRunCheck.status === "blocked",
    "missing_workflow_run_blocks",
    `Missing workflow_run should block provenance, got ${missingRunCheck.status}.`,
  );

  const unknownModeAudit = await buildAudit(inputs, {
    publishedArtifactProof: withPublishedProof(inputs.publishedArtifactProof, {
      workflow_mode: { mode_reason: "unknown write mode smoke" },
    }),
  });
  const unknownModeCheck = checkById(
    unknownModeAudit,
    "published_artifact_provenance",
  );
  if (inputs.agentEdgeProof.source === "published_artifact") {
    expect(
      unknownModeCheck.status === "collecting",
      "unknown_workflow_mode_collecting",
      `Unknown workflow mode should stay collecting for artifact fallback, got ${unknownModeCheck.status}.`,
    );
  }

  const supabasePrimaryProof = buildPaperTradingAgentEdgeProof({
    persistedRows: inputs.agentEdgeProof.rows,
    publishedArtifactProof: inputs.publishedArtifactProof,
    generatedAt: FIXED_GENERATED_AT,
  });
  const supabasePrimaryAudit = await buildAudit(inputs, {
    agentEdgeProof: supabasePrimaryProof,
  });
  const supabasePrimaryCheck = checkById(
    supabasePrimaryAudit,
    "published_artifact_provenance",
  );
  expect(
    supabasePrimaryProof.source === "supabase" &&
      supabasePrimaryCheck.status === "pass",
    "supabase_primary_provenance_passes",
    `Supabase-primary agent-edge proof should pass provenance even with dry-run artifact context; source=${supabasePrimaryProof.source}, status=${supabasePrimaryCheck.status}.`,
  );

  return {
    verdict: currentAudit.verdict,
    source: currentAudit.source,
    agent_edge_source: inputs.agentEdgeProof.source,
    rule_count: inputs.agentEdgeProof.rule_count,
    outcome_matrix_status: outcomeCheck.status,
    outcome_matrix_rows:
      currentAudit.published_artifact_outcome_proof.agent_edge_matrix_rows,
    provenance_status: provenanceCheck.status,
    workflow_run_id: currentAudit.published_artifact_provenance.workflow_run_id,
    effective_dry_run:
      currentAudit.published_artifact_provenance.effective_dry_run,
    write_enabled: currentAudit.published_artifact_provenance.write_enabled,
  };
}

async function main() {
  installNodeWebSocket();

  const [routeSummary, inputs] = await Promise.all([
    smokeRoutes(),
    loadAuditInputs(),
  ]);
  const builderSummary = await smokeBuilder(inputs);
  const result = {
    ok: failures.length === 0,
    checked_at: new Date().toISOString(),
    route: routeSummary,
    builder: builderSummary,
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
