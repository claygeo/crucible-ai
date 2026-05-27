import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { PAPER_TRADING_ARTIFACT_CONTRACT } from "../src/lib/trading-snapshots";

type Args = {
  artifactAuditPath: string;
  workflowPath: string | null;
  outputPath: string;
};

function usage(): never {
  console.error(`Eivra paper-trading artifact proof publisher

Build the public latest proof JSON used by the dashboard/API:
  npx tsx scripts/paper-trading-publish-artifact-proof.ts \\
    --artifact-audit paper-artifact-audit-result.json \\
    --workflow paper-snapshot-workflow.json \\
    --output public/paper-trading/latest-artifact-proof.json
`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    artifactAuditPath: "",
    workflowPath: null,
    outputPath: "public/paper-trading/latest-artifact-proof.json",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--artifact-audit") {
      args.artifactAuditPath = argv[++i] ?? "";
    } else if (arg === "--workflow") {
      args.workflowPath = argv[++i] ?? "";
    } else if (arg === "--output") {
      args.outputPath = argv[++i] ?? "";
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
    }
  }

  if (!args.artifactAuditPath || !args.outputPath) usage();
  return args;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function runUrl(runId: string | null): string | null {
  if (!runId) return null;
  const server = stringEnv("GITHUB_SERVER_URL") ?? "https://github.com";
  const repository =
    stringEnv("GITHUB_REPOSITORY") ??
    PAPER_TRADING_ARTIFACT_CONTRACT.repository;
  return `${server}/${repository}/actions/runs/${runId}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactAudit = record(readJson(args.artifactAuditPath));
  const artifactProof = record(artifactAudit.artifact_proof);
  const workflowMode = args.workflowPath ? readJson(args.workflowPath) : null;

  if (artifactProof.paper_only !== true) {
    throw new Error(
      "Refusing to publish artifact proof without paper_only=true.",
    );
  }
  if (artifactProof.real_money_execution_allowed !== false) {
    throw new Error(
      "Refusing to publish artifact proof unless real_money_execution_allowed=false.",
    );
  }
  const agentEdgeProof = record(artifactProof.agent_edge_proof);
  const agentEdgeWatchlist = record(artifactProof.agent_edge_watchlist);
  const agentEdgeRunway = record(artifactProof.agent_edge_runway);
  const agentEdgeTradeLedger = record(artifactProof.agent_edge_trade_ledger);
  const agentEdgeAttribution = record(artifactProof.agent_edge_attribution);
  const liquidityReview = record(artifactProof.liquidity_review);
  const agentEdgeEvidence = record(artifactProof.agent_edge_evidence);
  if (
    artifactProof.status === "available" &&
    Object.keys(agentEdgeAttribution).length === 0
  ) {
    throw new Error(
      "Refusing to publish available artifact proof without agent_edge_attribution.",
    );
  }
  if (
    artifactProof.status === "available" &&
    Object.keys(liquidityReview).length === 0
  ) {
    throw new Error(
      "Refusing to publish available artifact proof without liquidity_review.",
    );
  }
  if (
    artifactProof.status === "available" &&
    Object.keys(agentEdgeEvidence).length === 0
  ) {
    throw new Error(
      "Refusing to publish available artifact proof without agent_edge_evidence.",
    );
  }
  if (
    Object.keys(agentEdgeProof).length > 0 &&
    (agentEdgeProof.paper_only !== true ||
      agentEdgeProof.real_money_execution_allowed !== false)
  ) {
    throw new Error(
      "Refusing to publish agent_edge_proof unless it stays paper-only with execution disabled.",
    );
  }
  if (
    Object.keys(agentEdgeWatchlist).length > 0 &&
    (agentEdgeWatchlist.paper_only !== true ||
      agentEdgeWatchlist.real_money_execution_allowed !== false)
  ) {
    throw new Error(
      "Refusing to publish agent_edge_watchlist unless it stays paper-only with execution disabled.",
    );
  }
  if (
    Object.keys(agentEdgeRunway).length > 0 &&
    (agentEdgeRunway.paper_only !== true ||
      agentEdgeRunway.real_money_execution_allowed !== false)
  ) {
    throw new Error(
      "Refusing to publish agent_edge_runway unless it stays paper-only with execution disabled.",
    );
  }
  if (
    Object.keys(agentEdgeTradeLedger).length > 0 &&
    (agentEdgeTradeLedger.paper_only !== true ||
      agentEdgeTradeLedger.real_money_execution_allowed !== false)
  ) {
    throw new Error(
      "Refusing to publish agent_edge_trade_ledger unless it stays paper-only with execution disabled.",
    );
  }
  if (
    Object.keys(agentEdgeAttribution).length > 0 &&
    (agentEdgeAttribution.paper_only !== true ||
      agentEdgeAttribution.real_money_execution_allowed !== false)
  ) {
    throw new Error(
      "Refusing to publish agent_edge_attribution unless it stays paper-only with execution disabled.",
    );
  }
  if (
    Object.keys(liquidityReview).length > 0 &&
    (liquidityReview.paper_only !== true ||
      liquidityReview.real_money_execution_allowed !== false ||
      liquidityReview.capital_review_allowed !== false ||
      liquidityReview.stress_evidence_counts_as_proof !== false ||
      !Array.isArray(liquidityReview.stress_rules))
  ) {
    throw new Error(
      "Refusing to publish liquidity_review unless it stays paper-only and marks stress evidence as non-proof.",
    );
  }
  if (
    Object.keys(agentEdgeEvidence).length > 0 &&
    (agentEdgeEvidence.paper_only !== true ||
      agentEdgeEvidence.real_money_execution_allowed !== false ||
      !Array.isArray(agentEdgeEvidence.rules))
  ) {
    throw new Error(
      "Refusing to publish agent_edge_evidence unless it stays paper-only and includes rules.",
    );
  }

  const runId = stringEnv("GITHUB_RUN_ID");
  const artifactName = runId
    ? PAPER_TRADING_ARTIFACT_CONTRACT.artifact_name_pattern.replace(
        "<run_id>",
        runId,
      )
    : null;
  const published = {
    schema_version: "1",
    generated_at: new Date().toISOString(),
    source: "github_actions_artifact_audit",
    paper_only: true,
    real_money_execution_allowed: false,
    repository:
      stringEnv("GITHUB_REPOSITORY") ??
      PAPER_TRADING_ARTIFACT_CONTRACT.repository,
    workflow_path: PAPER_TRADING_ARTIFACT_CONTRACT.workflow_path,
    workflow_run: {
      id: runId,
      url: runUrl(runId),
      event: stringEnv("GITHUB_EVENT_NAME"),
      ref: stringEnv("GITHUB_REF_NAME"),
      head_sha: stringEnv("GITHUB_SHA"),
      artifact_name: artifactName,
      download_command: runId
        ? PAPER_TRADING_ARTIFACT_CONTRACT.download_command.replace(
            "<run_id>",
            runId,
          )
        : null,
    },
    artifact_contract: PAPER_TRADING_ARTIFACT_CONTRACT,
    workflow_mode: workflowMode,
    agent_edge_proof:
      Object.keys(agentEdgeProof).length > 0 ? agentEdgeProof : null,
    agent_edge_watchlist:
      Object.keys(agentEdgeWatchlist).length > 0 ? agentEdgeWatchlist : null,
    agent_edge_runway:
      Object.keys(agentEdgeRunway).length > 0 ? agentEdgeRunway : null,
    agent_edge_trade_ledger:
      Object.keys(agentEdgeTradeLedger).length > 0
        ? agentEdgeTradeLedger
        : null,
    agent_edge_attribution:
      Object.keys(agentEdgeAttribution).length > 0
        ? agentEdgeAttribution
        : null,
    liquidity_review:
      Object.keys(liquidityReview).length > 0 ? liquidityReview : null,
    agent_edge_evidence:
      Object.keys(agentEdgeEvidence).length > 0 ? agentEdgeEvidence : null,
    artifact_audit: {
      verdict: artifactAudit.verdict ?? null,
      checked_at: artifactAudit.checked_at ?? null,
      exit_code: artifactAudit.exit_code ?? null,
      artifact_count: artifactAudit.artifact_count ?? null,
      discovered_artifact_count:
        artifactAudit.discovered_artifact_count ??
        artifactAudit.artifact_count ??
        null,
      selected_artifact_paths: artifactAudit.selected_artifact_paths ?? [],
      latest_snapshot_date: artifactAudit.latest_snapshot_date ?? null,
      row_count: artifactAudit.row_count ?? null,
      live_row_count: artifactAudit.live_row_count ?? null,
      control_row_count: artifactAudit.control_row_count ?? null,
      selected_query_row_count: artifactAudit.selected_query_row_count ?? null,
      snapshot_dates: artifactAudit.snapshot_dates ?? [],
      duplicate_snapshot_dates: artifactAudit.duplicate_snapshot_dates ?? [],
      ignored_duplicate_artifacts:
        artifactAudit.ignored_duplicate_artifacts ?? [],
      sources: artifactAudit.sources ?? [],
      schema_versions: artifactAudit.schema_versions ?? [],
      failed_checks: artifactAudit.failed_checks ?? [],
      snapshot_summaries: artifactAudit.snapshot_summaries ?? [],
    },
    artifact_proof: artifactProof,
  };

  const outputPath = resolve(args.outputPath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(published, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        status: "published",
        output_path: outputPath,
        verdict: artifactAudit.verdict ?? null,
        latest_snapshot_date: artifactAudit.latest_snapshot_date ?? null,
        real_money_execution_allowed: false,
      },
      null,
      2,
    ),
  );
}

main();
