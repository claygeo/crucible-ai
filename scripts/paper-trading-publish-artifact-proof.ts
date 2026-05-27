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
  if (
    Object.keys(agentEdgeProof).length > 0 &&
    (agentEdgeProof.paper_only !== true ||
      agentEdgeProof.real_money_execution_allowed !== false)
  ) {
    throw new Error(
      "Refusing to publish agent_edge_proof unless it stays paper-only with execution disabled.",
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
    artifact_audit: {
      verdict: artifactAudit.verdict ?? null,
      checked_at: artifactAudit.checked_at ?? null,
      exit_code: artifactAudit.exit_code ?? null,
      artifact_count: artifactAudit.artifact_count ?? null,
      latest_snapshot_date: artifactAudit.latest_snapshot_date ?? null,
      row_count: artifactAudit.row_count ?? null,
      live_row_count: artifactAudit.live_row_count ?? null,
      control_row_count: artifactAudit.control_row_count ?? null,
      selected_query_row_count: artifactAudit.selected_query_row_count ?? null,
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
