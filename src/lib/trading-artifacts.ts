import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PAPER_TRADING_ARTIFACT_CONTRACT } from "@/lib/trading-snapshots";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_USER_AGENT = "eivra-paper-proof-lab";
const DEFAULT_RECENT_RUN_LIMIT = 5;
const PUBLISHED_PROOF_PATH = "public/paper-trading/latest-artifact-proof.json";
const PUBLISHED_PROOF_URL = "/paper-trading/latest-artifact-proof.json";

export type PaperTradingWorkflowArtifactStatus =
  | "available"
  | "missing"
  | "expired"
  | "unchecked";

export type PaperTradingWorkflowArtifact = {
  status: PaperTradingWorkflowArtifactStatus;
  status_label: string;
  expected_name: string;
  id: number | null;
  name: string | null;
  size_bytes: number | null;
  created_at: string | null;
  expires_at: string | null;
  expired: boolean | null;
  archive_download_url: string | null;
};

export type PaperTradingWorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  event: string;
  created_at: string;
  updated_at: string;
  head_sha: string;
  html_url: string;
  download_command: string;
  artifact: PaperTradingWorkflowArtifact;
};

export type PaperTradingArtifactWorkflowStatus = {
  status: "available" | "collecting" | "blocked" | "unavailable";
  status_label: string;
  generated_at: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  repository: string;
  workflow_path: string;
  workflow_api_url: string;
  artifact_contract: typeof PAPER_TRADING_ARTIFACT_CONTRACT;
  latest_run: PaperTradingWorkflowRun | null;
  latest_successful_artifact_run: PaperTradingWorkflowRun | null;
  recent_runs: PaperTradingWorkflowRun[];
  error: string | null;
};

export type PublishedPaperTradingArtifactProof = {
  status: "available" | "blocked" | "unavailable";
  status_label: string;
  generated_at: string | null;
  source: string | null;
  message: string;
  next_required_action: string;
  path: string;
  url: string;
  paper_only: true;
  real_money_execution_allowed: false;
  repository: string | null;
  workflow_path: string | null;
  workflow_run: Record<string, unknown> | null;
  artifact_audit: Record<string, unknown> | null;
  artifact_proof: Record<string, unknown> | null;
  proof_summary: Record<string, unknown> | null;
  proof_readiness: Record<string, unknown> | null;
  proof_runway: Record<string, unknown> | null;
  agent_edge_proof_matrix: unknown[];
  top_strategy_rollups: unknown[];
  error: string | null;
};

type GitHubRunPayload = {
  id?: unknown;
  status?: unknown;
  conclusion?: unknown;
  event?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  head_sha?: unknown;
  html_url?: unknown;
};

type GitHubRunsPayload = {
  workflow_runs?: unknown;
};

type GitHubArtifactPayload = {
  id?: unknown;
  name?: unknown;
  size_in_bytes?: unknown;
  created_at?: unknown;
  expires_at?: unknown;
  expired?: unknown;
  archive_download_url?: unknown;
};

type GitHubArtifactsPayload = {
  artifacts?: unknown;
};

function artifactStatusLabel(
  status: PaperTradingWorkflowArtifactStatus,
): string {
  if (status === "available") return "Available";
  if (status === "expired") return "Expired";
  if (status === "missing") return "Missing";
  return "Unchecked";
}

function workflowStatusLabel(
  status: PaperTradingArtifactWorkflowStatus["status"],
): string {
  if (status === "available") return "Artifact available";
  if (status === "collecting") return "Collecting";
  if (status === "blocked") return "Blocked";
  return "Unavailable";
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function workflowFileName(): string {
  return (
    PAPER_TRADING_ARTIFACT_CONTRACT.workflow_path.split("/").pop() ??
    "paper-trading-snapshot.yml"
  );
}

function workflowRunsUrl(limit: number): string {
  return `${GITHUB_API_BASE}/repos/${
    PAPER_TRADING_ARTIFACT_CONTRACT.repository
  }/actions/workflows/${workflowFileName()}/runs?per_page=${limit}`;
}

function runArtifactsUrl(runId: number): string {
  return `${GITHUB_API_BASE}/repos/${PAPER_TRADING_ARTIFACT_CONTRACT.repository}/actions/runs/${runId}/artifacts?per_page=20`;
}

function expectedArtifactName(runId: number): string {
  return PAPER_TRADING_ARTIFACT_CONTRACT.artifact_name_pattern.replace(
    "<run_id>",
    String(runId),
  );
}

function downloadCommand(runId: number): string {
  return PAPER_TRADING_ARTIFACT_CONTRACT.download_command.replace(
    "<run_id>",
    String(runId),
  );
}

async function fetchGitHubJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": GITHUB_USER_AGENT,
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function emptyArtifact(
  runId: number,
  status: PaperTradingWorkflowArtifactStatus,
): PaperTradingWorkflowArtifact {
  return {
    status,
    status_label: artifactStatusLabel(status),
    expected_name: expectedArtifactName(runId),
    id: null,
    name: null,
    size_bytes: null,
    created_at: null,
    expires_at: null,
    expired: null,
    archive_download_url: null,
  };
}

async function loadRunArtifact(
  runId: number,
): Promise<PaperTradingWorkflowArtifact> {
  try {
    const payload = await fetchGitHubJson<GitHubArtifactsPayload>(
      runArtifactsUrl(runId),
    );
    const artifacts = Array.isArray(payload.artifacts)
      ? (payload.artifacts as GitHubArtifactPayload[])
      : [];
    const expectedName = expectedArtifactName(runId);
    const artifact = artifacts.find((item) => item.name === expectedName);
    if (!artifact) return emptyArtifact(runId, "missing");

    const expired = booleanOrNull(artifact.expired);
    const status: PaperTradingWorkflowArtifactStatus = expired
      ? "expired"
      : "available";
    return {
      status,
      status_label: artifactStatusLabel(status),
      expected_name: expectedName,
      id: nullableNumber(artifact.id),
      name: nullableString(artifact.name),
      size_bytes: nullableNumber(artifact.size_in_bytes),
      created_at: nullableString(artifact.created_at),
      expires_at: nullableString(artifact.expires_at),
      expired,
      archive_download_url: nullableString(artifact.archive_download_url),
    };
  } catch {
    return emptyArtifact(runId, "unchecked");
  }
}

async function workflowRunFromPayload(
  run: GitHubRunPayload,
): Promise<PaperTradingWorkflowRun> {
  const id = numberValue(run.id);
  return {
    id,
    status: stringValue(run.status, "unknown"),
    conclusion: nullableString(run.conclusion),
    event: stringValue(run.event, "unknown"),
    created_at: stringValue(run.created_at),
    updated_at: stringValue(run.updated_at),
    head_sha: stringValue(run.head_sha),
    html_url: stringValue(
      run.html_url,
      `https://github.com/${PAPER_TRADING_ARTIFACT_CONTRACT.repository}/actions/runs/${id}`,
    ),
    download_command: downloadCommand(id),
    artifact: await loadRunArtifact(id),
  };
}

function workflowStatusFromRuns(
  latestRun: PaperTradingWorkflowRun | null,
  latestSuccessfulArtifactRun: PaperTradingWorkflowRun | null,
): PaperTradingArtifactWorkflowStatus["status"] {
  if (latestSuccessfulArtifactRun) return "available";
  if (
    latestRun &&
    (latestRun.status === "queued" ||
      latestRun.status === "in_progress" ||
      latestRun.status === "requested" ||
      latestRun.status === "waiting")
  ) {
    return "collecting";
  }
  if (latestRun && latestRun.status === "completed") return "blocked";
  return "unavailable";
}

function workflowMessage(
  status: PaperTradingArtifactWorkflowStatus["status"],
  latestRun: PaperTradingWorkflowRun | null,
  latestSuccessfulArtifactRun: PaperTradingWorkflowRun | null,
): string {
  if (status === "available" && latestSuccessfulArtifactRun) {
    return `Latest usable proof artifact is ${latestSuccessfulArtifactRun.artifact.expected_name}.`;
  }
  if (status === "collecting" && latestRun) {
    return `Latest paper proof workflow run is ${latestRun.status}.`;
  }
  if (status === "blocked" && latestRun) {
    return `Latest workflow completed without a usable proof artifact (${latestRun.conclusion ?? "unknown"}).`;
  }
  return "GitHub workflow evidence is unavailable.";
}

function workflowNextAction(
  status: PaperTradingArtifactWorkflowStatus["status"],
  latestRun: PaperTradingWorkflowRun | null,
): string {
  if (status === "available") {
    return "Audit the latest downloaded artifact bundle before treating artifact-only proof as durable evidence.";
  }
  if (status === "collecting") {
    return "Wait for the active paper proof workflow run to finish.";
  }
  if (status === "blocked" && latestRun) {
    return `Inspect workflow run ${latestRun.id} before trusting the artifact fallback.`;
  }
  return "Restore GitHub Actions workflow visibility for the artifact fallback.";
}

function unavailableWorkflowStatus(
  generatedAt: string,
  error: unknown,
): PaperTradingArtifactWorkflowStatus {
  return {
    status: "unavailable",
    status_label: workflowStatusLabel("unavailable"),
    generated_at: generatedAt,
    message: "GitHub workflow evidence is unavailable.",
    next_required_action:
      "Restore GitHub Actions workflow visibility for the artifact fallback.",
    paper_only: true,
    real_money_execution_allowed: false,
    repository: PAPER_TRADING_ARTIFACT_CONTRACT.repository,
    workflow_path: PAPER_TRADING_ARTIFACT_CONTRACT.workflow_path,
    workflow_api_url: workflowRunsUrl(DEFAULT_RECENT_RUN_LIMIT),
    artifact_contract: PAPER_TRADING_ARTIFACT_CONTRACT,
    latest_run: null,
    latest_successful_artifact_run: null,
    recent_runs: [],
    error: error instanceof Error ? error.message : String(error),
  };
}

function unavailablePublishedProof(
  message: string,
  error: string | null,
): PublishedPaperTradingArtifactProof {
  return {
    status: "unavailable",
    status_label: "Unavailable",
    generated_at: null,
    source: null,
    message,
    next_required_action:
      "Wait for the paper proof workflow to publish latest-artifact-proof.json.",
    path: PUBLISHED_PROOF_PATH,
    url: PUBLISHED_PROOF_URL,
    paper_only: true,
    real_money_execution_allowed: false,
    repository: PAPER_TRADING_ARTIFACT_CONTRACT.repository,
    workflow_path: PAPER_TRADING_ARTIFACT_CONTRACT.workflow_path,
    workflow_run: null,
    artifact_audit: null,
    artifact_proof: null,
    proof_summary: null,
    proof_readiness: null,
    proof_runway: null,
    agent_edge_proof_matrix: [],
    top_strategy_rollups: [],
    error,
  };
}

export async function loadPublishedPaperTradingArtifactProof(): Promise<PublishedPaperTradingArtifactProof> {
  try {
    const raw = await readFile(
      join(process.cwd(), PUBLISHED_PROOF_PATH),
      "utf8",
    );
    const payload = JSON.parse(raw) as unknown;
    const proof = objectOrNull(payload);
    if (!proof) {
      return unavailablePublishedProof(
        "Published proof JSON is not an object.",
        null,
      );
    }
    const artifactProof = objectOrNull(proof.artifact_proof);
    const artifactAudit = objectOrNull(proof.artifact_audit);
    const proofReadiness = objectOrNull(artifactProof?.proof_readiness);
    const proofRunway = objectOrNull(artifactProof?.proof_runway);
    const proofSummary = objectOrNull(artifactProof?.proof_summary);
    const paperOnly =
      proof.paper_only === true && artifactProof?.paper_only === true;
    const executionDisabled =
      proof.real_money_execution_allowed === false &&
      artifactProof?.real_money_execution_allowed === false;

    if (!paperOnly || !executionDisabled) {
      return unavailablePublishedProof(
        "Published proof failed the paper-only execution lock.",
        null,
      );
    }

    const isPlaceholder = proof.source === "placeholder";
    const artifactProofStatus = stringValue(
      artifactProof?.status,
      "unavailable",
    );
    const status: PublishedPaperTradingArtifactProof["status"] = isPlaceholder
      ? "unavailable"
      : artifactProofStatus === "available"
        ? "available"
        : "blocked";
    const nextRequiredAction =
      stringValue(proofReadiness?.next_required_action) ||
      stringValue(artifactProof?.message) ||
      "Audit the latest published artifact proof before treating it as durable evidence.";

    return {
      status,
      status_label:
        status === "available"
          ? "Published proof available"
          : status === "blocked"
            ? "Published proof blocked"
            : "Unavailable",
      generated_at: nullableString(proof.generated_at),
      source: nullableString(proof.source),
      message: isPlaceholder
        ? "No published artifact proof has been generated yet."
        : stringValue(
            artifactProof?.message,
            "Latest artifact proof JSON is published.",
          ),
      next_required_action: nextRequiredAction,
      path: PUBLISHED_PROOF_PATH,
      url: PUBLISHED_PROOF_URL,
      paper_only: true,
      real_money_execution_allowed: false,
      repository: nullableString(proof.repository),
      workflow_path: nullableString(proof.workflow_path),
      workflow_run: objectOrNull(proof.workflow_run),
      artifact_audit: artifactAudit,
      artifact_proof: artifactProof,
      proof_summary: proofSummary,
      proof_readiness: proofReadiness,
      proof_runway: proofRunway,
      agent_edge_proof_matrix: arrayOrEmpty(
        artifactProof?.agent_edge_proof_matrix,
      ),
      top_strategy_rollups: arrayOrEmpty(artifactProof?.top_strategy_rollups),
      error: null,
    };
  } catch (error) {
    return unavailablePublishedProof(
      "Published proof JSON is not available.",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function loadPaperTradingArtifactWorkflowStatus(
  limit = DEFAULT_RECENT_RUN_LIMIT,
): Promise<PaperTradingArtifactWorkflowStatus> {
  const generatedAt = new Date().toISOString();
  const boundedLimit = Math.max(1, Math.min(limit, 10));
  try {
    const payload = await fetchGitHubJson<GitHubRunsPayload>(
      workflowRunsUrl(boundedLimit),
    );
    const runs = Array.isArray(payload.workflow_runs)
      ? (payload.workflow_runs as GitHubRunPayload[])
      : [];
    const recentRuns = await Promise.all(
      runs.slice(0, boundedLimit).map(workflowRunFromPayload),
    );
    const latestRun = recentRuns[0] ?? null;
    const latestSuccessfulArtifactRun =
      recentRuns.find(
        (run) =>
          run.status === "completed" &&
          run.conclusion === "success" &&
          run.artifact.status === "available",
      ) ?? null;
    const status = workflowStatusFromRuns(
      latestRun,
      latestSuccessfulArtifactRun,
    );

    return {
      status,
      status_label: workflowStatusLabel(status),
      generated_at: generatedAt,
      message: workflowMessage(status, latestRun, latestSuccessfulArtifactRun),
      next_required_action: workflowNextAction(status, latestRun),
      paper_only: true,
      real_money_execution_allowed: false,
      repository: PAPER_TRADING_ARTIFACT_CONTRACT.repository,
      workflow_path: PAPER_TRADING_ARTIFACT_CONTRACT.workflow_path,
      workflow_api_url: workflowRunsUrl(boundedLimit),
      artifact_contract: PAPER_TRADING_ARTIFACT_CONTRACT,
      latest_run: latestRun,
      latest_successful_artifact_run: latestSuccessfulArtifactRun,
      recent_runs: recentRuns,
      error: null,
    };
  } catch (error) {
    return unavailableWorkflowStatus(generatedAt, error);
  }
}
