import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  PAPER_TRADING_PROOF_RULES,
  type TradingResolutionWatch,
} from "@/lib/trading";
import {
  PAPER_TRADING_ARTIFACT_CONTRACT,
  type PaperTradingCaptureCalendarDay,
  type PaperTradingPersistenceRead,
  type PaperTradingStrategyRegistrySync,
} from "@/lib/trading-snapshots";

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
  workflow_mode: Record<string, unknown> | null;
  artifact_audit: Record<string, unknown> | null;
  artifact_proof: Record<string, unknown> | null;
  proof_summary: Record<string, unknown> | null;
  proof_readiness: Record<string, unknown> | null;
  proof_runway: Record<string, unknown> | null;
  capital_review_packet: Record<string, unknown> | null;
  strategy_registry: Record<string, unknown> | null;
  would_trade_today: Record<string, unknown> | null;
  market_exposure_digest: Record<string, unknown> | null;
  agent_edge_watchlist: Record<string, unknown> | null;
  agent_edge_trade_ledger: Record<string, unknown> | null;
  agent_edge_proof: Record<string, unknown> | null;
  agent_edge_proof_matrix: unknown[];
  top_strategy_rollups: unknown[];
  error: string | null;
};

export type PaperTradingWriteReadinessStatus =
  | "persisting"
  | "artifact_only"
  | "unknown";

export type PaperTradingWriteReadiness = {
  schema_version: "1";
  generated_at: string;
  status: PaperTradingWriteReadinessStatus;
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  write_enabled: boolean | null;
  effective_dry_run: boolean | null;
  requested_dry_run: boolean | null;
  mode_reason: string | null;
  artifact_proof_status: PublishedPaperTradingArtifactProof["status"];
  artifact_workflow_status: PaperTradingArtifactWorkflowStatus["status"];
  latest_workflow_run_id: number | null;
  latest_workflow_run_url: string | null;
  latest_published_at: string | null;
  blockers: string[];
};

export type PaperTradingArtifactHistoryStatus =
  | "complete"
  | "collecting"
  | "unavailable";

export type PaperTradingArtifactHistory = {
  schema_version: "1";
  generated_at: string;
  status: PaperTradingArtifactHistoryStatus;
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  proof_window_days: number;
  retained_artifact_count: number;
  selected_artifact_count: number;
  ignored_duplicate_artifact_count: number;
  coverage_days: number;
  complete_artifact_days: number;
  days_remaining_to_30: number;
  coverage_ratio: number;
  latest_snapshot_date: string | null;
  latest_workflow_run_id: string | null;
  latest_published_at: string | null;
  selected_snapshot_dates: string[];
  duplicate_snapshot_dates: string[];
  selected_artifact_paths: string[];
  ignored_duplicate_artifacts: unknown[];
  blockers: string[];
};

export type PaperTradingEvidenceSlaStatus =
  | "on_track"
  | "collecting"
  | "degraded"
  | "blocked"
  | "unavailable";

export type PaperTradingEvidenceSlaViolation = {
  id:
    | "persistence"
    | "artifact_proof"
    | "write_mode"
    | "capture_freshness"
    | "capture_calendar"
    | "registry_sync"
    | "resolution_hygiene";
  severity: "info" | "warning" | "blocking";
  label: string;
  current: string;
  target: string;
  detail: string;
};

export type PaperTradingEvidenceSla = {
  schema_version: "1";
  generated_at: string;
  status: PaperTradingEvidenceSlaStatus;
  status_label: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  proof_window_days: number;
  schedule_cron_utc: string;
  scheduled_time_utc: string;
  stale_after_hours: number;
  data_source_status:
    | "supabase_and_artifacts"
    | "supabase_only"
    | "artifact_only"
    | "none";
  latest_snapshot_date: string | null;
  latest_captured_at: string | null;
  next_expected_capture_at: string | null;
  complete_days: number;
  partial_days: number;
  missing_days: number;
  coverage_ratio: number;
  current_streak_days: number;
  days_remaining_to_30: number;
  expected_live_strategy_count: number;
  persisted_row_count: number;
  artifact_live_row_count: number | null;
  artifact_proof_status: PublishedPaperTradingArtifactProof["status"];
  write_mode_status: PaperTradingWriteReadinessStatus;
  write_enabled: boolean | null;
  effective_dry_run: boolean | null;
  registry_sync_status: PaperTradingStrategyRegistrySync["status"] | null;
  review_required_live_signals: number | null;
  violations: PaperTradingEvidenceSlaViolation[];
  recent_calendar_days: PaperTradingCaptureCalendarDay[];
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

function stringArray(value: unknown): string[] {
  return arrayOrEmpty(value).filter(
    (item): item is string => typeof item === "string",
  );
}

function artifactHistoryStatusLabel(
  status: PaperTradingArtifactHistoryStatus,
): string {
  if (status === "complete") return "Complete";
  if (status === "collecting") return "Collecting";
  return "Unavailable";
}

export function buildPaperTradingArtifactHistory(args: {
  publishedArtifactProof: PublishedPaperTradingArtifactProof;
  generatedAt?: string;
}): PaperTradingArtifactHistory {
  const audit = args.publishedArtifactProof.artifact_audit;
  const proofWindowDays = PAPER_TRADING_PROOF_RULES.requiredLiveDays;
  const selectedSnapshotDates = stringArray(audit?.snapshot_dates);
  const duplicateSnapshotDates = stringArray(audit?.duplicate_snapshot_dates);
  const ignoredDuplicateArtifacts = arrayOrEmpty(
    audit?.ignored_duplicate_artifacts,
  );
  const selectedArtifactCount = numberValue(audit?.artifact_count);
  const retainedArtifactCount =
    nullableNumber(audit?.discovered_artifact_count) ?? selectedArtifactCount;
  const coverageDays =
    nullableNumber(audit?.coverage_days) ?? selectedSnapshotDates.length;
  const completeArtifactDays =
    nullableNumber(audit?.complete_artifact_days) ?? coverageDays;
  const daysRemainingTo30 = Math.max(0, proofWindowDays - completeArtifactDays);
  const hasUsableAudit =
    args.publishedArtifactProof.status !== "unavailable" &&
    audit !== null &&
    selectedArtifactCount > 0;
  const status: PaperTradingArtifactHistoryStatus = !hasUsableAudit
    ? "unavailable"
    : completeArtifactDays >= proofWindowDays
      ? "complete"
      : "collecting";
  const blockers =
    status === "unavailable"
      ? [
          args.publishedArtifactProof.message ||
            "No published artifact audit is available.",
        ]
      : args.publishedArtifactProof.real_money_execution_allowed !== false
        ? [
            "Published artifact proof did not keep real-money execution disabled.",
          ]
        : [];

  return {
    schema_version: "1",
    generated_at: args.generatedAt ?? new Date().toISOString(),
    status,
    status_label: artifactHistoryStatusLabel(status),
    message:
      status === "complete"
        ? "The retained GitHub artifact trail covers the required paper proof window."
        : status === "collecting"
          ? "Retained GitHub artifacts are being accumulated into the paper proof window."
          : "No usable retained GitHub artifact trail is available yet.",
    next_required_action:
      status === "complete"
        ? "Review resolved P&L, ROI, drawdown, and capital-review blockers; execution remains disabled."
        : status === "collecting"
          ? `Collect ${daysRemainingTo30} more distinct daily artifact capture${
              daysRemainingTo30 === 1 ? "" : "s"
            }.`
          : "Run the paper snapshot workflow until it publishes a valid artifact proof.",
    paper_only: true,
    real_money_execution_allowed: false,
    proof_window_days: proofWindowDays,
    retained_artifact_count: retainedArtifactCount,
    selected_artifact_count: selectedArtifactCount,
    ignored_duplicate_artifact_count: ignoredDuplicateArtifacts.length,
    coverage_days: coverageDays,
    complete_artifact_days: completeArtifactDays,
    days_remaining_to_30: daysRemainingTo30,
    coverage_ratio:
      proofWindowDays > 0
        ? Math.min(1, completeArtifactDays / proofWindowDays)
        : 0,
    latest_snapshot_date: nullableString(audit?.latest_snapshot_date),
    latest_workflow_run_id: nullableString(
      args.publishedArtifactProof.workflow_run?.id,
    ),
    latest_published_at: args.publishedArtifactProof.generated_at,
    selected_snapshot_dates: selectedSnapshotDates,
    duplicate_snapshot_dates: duplicateSnapshotDates,
    selected_artifact_paths: stringArray(audit?.selected_artifact_paths),
    ignored_duplicate_artifacts: ignoredDuplicateArtifacts,
    blockers,
  };
}

export function buildPaperTradingWriteReadiness(args: {
  artifactWorkflow: PaperTradingArtifactWorkflowStatus;
  publishedArtifactProof: PublishedPaperTradingArtifactProof;
  generatedAt?: string;
}): PaperTradingWriteReadiness {
  const workflowMode = args.publishedArtifactProof.workflow_mode;
  const writeEnabled = booleanOrNull(workflowMode?.write_enabled);
  const effectiveDryRun = booleanOrNull(workflowMode?.effective_dry_run);
  const requestedDryRun = booleanOrNull(workflowMode?.requested_dry_run);
  const modeReason = nullableString(workflowMode?.mode_reason);
  const latestRun = args.artifactWorkflow.latest_run;
  const status: PaperTradingWriteReadinessStatus =
    writeEnabled === true && effectiveDryRun === false
      ? "persisting"
      : writeEnabled === false || effectiveDryRun === true
        ? "artifact_only"
        : "unknown";
  const blockers =
    status === "artifact_only"
      ? [
          modeReason ??
            "Paper snapshot workflow is publishing artifacts without persisting Supabase rows.",
        ]
      : status === "unknown"
        ? ["No published workflow_mode is available for the latest proof."]
        : [];

  return {
    schema_version: "1",
    generated_at: args.generatedAt ?? new Date().toISOString(),
    status,
    status_label:
      status === "persisting"
        ? "Persisting"
        : status === "artifact_only"
          ? "Artifact only"
          : "Unknown",
    message:
      status === "persisting"
        ? "Daily proof captures are configured to write Supabase snapshot rows and publish GitHub artifacts."
        : status === "artifact_only"
          ? "Daily proof captures are publishing GitHub artifacts, but Supabase snapshot rows are not being written."
          : "The latest public proof does not expose workflow write mode yet.",
    next_required_action:
      status === "persisting"
        ? "Keep monitoring daily captures and resolved live paper tickets."
        : status === "artifact_only"
          ? "Configure SUPABASE_SERVICE_ROLE_KEY for the Paper trading snapshot workflow before relying on the persisted dashboard row trail."
          : "Run the Paper trading snapshot workflow with workflow-mode publishing enabled.",
    paper_only: true,
    real_money_execution_allowed: false,
    write_enabled: writeEnabled,
    effective_dry_run: effectiveDryRun,
    requested_dry_run: requestedDryRun,
    mode_reason: modeReason,
    artifact_proof_status: args.publishedArtifactProof.status,
    artifact_workflow_status: args.artifactWorkflow.status,
    latest_workflow_run_id: latestRun?.id ?? null,
    latest_workflow_run_url: latestRun?.html_url ?? null,
    latest_published_at: args.publishedArtifactProof.generated_at,
    blockers,
  };
}

function evidenceSlaStatusLabel(status: PaperTradingEvidenceSlaStatus): string {
  if (status === "on_track") return "On track";
  if (status === "collecting") return "Collecting";
  if (status === "degraded") return "Degraded";
  if (status === "blocked") return "Blocked";
  return "Unavailable";
}

function evidenceSlaDataSource(args: {
  hasPersistedRows: boolean;
  hasArtifactProof: boolean;
}): PaperTradingEvidenceSla["data_source_status"] {
  if (args.hasPersistedRows && args.hasArtifactProof) {
    return "supabase_and_artifacts";
  }
  if (args.hasPersistedRows) return "supabase_only";
  if (args.hasArtifactProof) return "artifact_only";
  return "none";
}

function evidenceSlaLatestSnapshotDate(args: {
  persistence: PaperTradingPersistenceRead;
  publishedArtifactProof: PublishedPaperTradingArtifactProof;
}): string | null {
  const latestPersisted =
    args.persistence.snapshots
      .map((snapshot) => snapshot.snapshot_date)
      .filter((date) => typeof date === "string" && date.length > 0)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;
  const artifactAudit = args.publishedArtifactProof.artifact_audit;
  return (
    latestPersisted ??
    nullableString(artifactAudit?.latest_snapshot_date) ??
    null
  );
}

function evidenceSlaNextAction(
  status: PaperTradingEvidenceSlaStatus,
  violations: PaperTradingEvidenceSlaViolation[],
  daysRemaining: number,
): string {
  const firstBlocking = violations.find(
    (violation) => violation.severity === "blocking",
  );
  const firstWarning = violations.find(
    (violation) => violation.severity === "warning",
  );
  if (status === "unavailable") {
    return "Restore Supabase reads or a published GitHub proof artifact before trusting the 30-day lab.";
  }
  if (status === "blocked" && firstBlocking) {
    return firstBlocking.detail;
  }
  if (status === "degraded" && firstWarning) {
    return firstWarning.detail;
  }
  if (status === "collecting") {
    return `Collect ${daysRemaining} more complete daily proof capture${
      daysRemaining === 1 ? "" : "s"
    }.`;
  }
  return "Keep daily proof captures landing on schedule; execution remains disabled.";
}

export function buildPaperTradingEvidenceSla(args: {
  persistence: PaperTradingPersistenceRead;
  publishedArtifactProof: PublishedPaperTradingArtifactProof;
  writeReadiness: PaperTradingWriteReadiness;
  registrySync?: PaperTradingStrategyRegistrySync | null;
  resolutionWatch?: TradingResolutionWatch | null;
  generatedAt?: string;
}): PaperTradingEvidenceSla {
  const artifactAudit = args.publishedArtifactProof.artifact_audit;
  const artifactLiveRowCount = nullableNumber(artifactAudit?.live_row_count);
  const hasArtifactProof = args.publishedArtifactProof.status === "available";
  const hasPersistedRows = args.persistence.snapshots.length > 0;
  const dataSourceStatus = evidenceSlaDataSource({
    hasPersistedRows,
    hasArtifactProof,
  });
  const violations: PaperTradingEvidenceSlaViolation[] = [];

  if (args.persistence.status !== "available") {
    violations.push({
      id: "persistence",
      severity: hasArtifactProof ? "warning" : "blocking",
      label: "Supabase proof log",
      current: args.persistence.status.replace("_", " "),
      target: "available persisted proof rows",
      detail: hasArtifactProof
        ? "Supabase proof rows are unavailable, so the lab is relying on the latest public GitHub artifact proof."
        : args.persistence.message,
    });
  } else if (!hasPersistedRows) {
    violations.push({
      id: "persistence",
      severity: "info",
      label: "Supabase proof log",
      current: "0 rows",
      target: "daily proof rows",
      detail:
        "Supabase is reachable, but no persisted paper proof rows are available yet.",
    });
  }

  if (!hasArtifactProof) {
    violations.push({
      id: "artifact_proof",
      severity: hasPersistedRows ? "warning" : "blocking",
      label: "Published artifact proof",
      current: args.publishedArtifactProof.status_label,
      target: "available latest public proof JSON",
      detail: args.publishedArtifactProof.message,
    });
  }

  if (args.writeReadiness.status !== "persisting") {
    violations.push({
      id: "write_mode",
      severity:
        args.writeReadiness.status === "artifact_only" ? "warning" : "blocking",
      label: "Snapshot write mode",
      current: args.writeReadiness.status_label,
      target: "persisting Supabase rows",
      detail: args.writeReadiness.next_required_action,
    });
  }

  if (args.persistence.status === "available") {
    const health = args.persistence.capture_health;
    if (health.status === "waiting_first_capture") {
      violations.push({
        id: "capture_freshness",
        severity: "info",
        label: "Daily capture freshness",
        current: health.status_label,
        target: "fresh daily capture",
        detail: health.message,
      });
    } else if (health.status !== "fresh") {
      violations.push({
        id: "capture_freshness",
        severity: "blocking",
        label: "Daily capture freshness",
        current: health.status_label,
        target: "fresh daily capture",
        detail: health.message,
      });
    }

    const calendar = args.persistence.capture_calendar;
    if (calendar.missing_days > 0 || calendar.partial_days > 0) {
      violations.push({
        id: "capture_calendar",
        severity: "blocking",
        label: "Capture calendar",
        current: `${calendar.complete_days} complete / ${calendar.partial_days} partial / ${calendar.missing_days} missing`,
        target: "0 partial or missing proof days",
        detail:
          "Repair missing or partial daily captures before treating the proof window as continuous.",
      });
    }
  }

  if (args.registrySync && args.registrySync.status !== "synced") {
    violations.push({
      id: "registry_sync",
      severity:
        args.registrySync.status === "pending_capture" &&
        dataSourceStatus !== "artifact_only"
          ? "blocking"
          : "warning",
      label: "Strategy registry sync",
      current: args.registrySync.status_label,
      target: "current live strategy registry captured",
      detail: args.registrySync.message,
    });
  }

  if (
    args.resolutionWatch &&
    args.resolutionWatch.review_required_live_signals > 0
  ) {
    violations.push({
      id: "resolution_hygiene",
      severity: "warning",
      label: "Resolution hygiene",
      current: `${args.resolutionWatch.review_required_live_signals} needs review`,
      target: "0 review-required live paper markets",
      detail:
        "Investigate overdue or unknown-close live paper markets before trusting open EV.",
    });
  }

  const hasBlocking = violations.some(
    (violation) => violation.severity === "blocking",
  );
  const hasWarning = violations.some(
    (violation) => violation.severity === "warning",
  );
  const daysRemaining = Math.max(
    0,
    args.persistence.capture_calendar.days_remaining_to_30,
  );
  const status: PaperTradingEvidenceSlaStatus =
    dataSourceStatus === "none"
      ? "unavailable"
      : hasBlocking
        ? "blocked"
        : hasWarning
          ? "degraded"
          : daysRemaining > 0
            ? "collecting"
            : "on_track";
  const latestSnapshotDate = evidenceSlaLatestSnapshotDate({
    persistence: args.persistence,
    publishedArtifactProof: args.publishedArtifactProof,
  });
  const nextRequiredAction = evidenceSlaNextAction(
    status,
    violations,
    daysRemaining,
  );

  return {
    schema_version: "1",
    generated_at: args.generatedAt ?? new Date().toISOString(),
    status,
    status_label: evidenceSlaStatusLabel(status),
    message:
      status === "on_track"
        ? "The 30-day paper evidence window is complete and current."
        : status === "collecting"
          ? "Daily evidence capture is healthy, but the 30-day proof window is still filling."
          : status === "degraded"
            ? "The lab has usable evidence, but at least one proof source needs attention."
            : status === "blocked"
              ? "The evidence trail has a blocker that must be repaired before the proof window is trusted."
              : "No usable paper evidence source is currently available.",
    next_required_action: nextRequiredAction,
    paper_only: true,
    real_money_execution_allowed: false,
    proof_window_days: PAPER_TRADING_PROOF_RULES.requiredLiveDays,
    schedule_cron_utc: PAPER_TRADING_ARTIFACT_CONTRACT.schedule_cron_utc,
    scheduled_time_utc: PAPER_TRADING_ARTIFACT_CONTRACT.scheduled_time_utc,
    stale_after_hours: args.persistence.capture_health.stale_after_hours,
    data_source_status: dataSourceStatus,
    latest_snapshot_date: latestSnapshotDate,
    latest_captured_at:
      args.persistence.latest_captured_at ??
      args.publishedArtifactProof.generated_at,
    next_expected_capture_at:
      args.persistence.capture_health.next_expected_capture_at ?? null,
    complete_days: args.persistence.capture_calendar.complete_days,
    partial_days: args.persistence.capture_calendar.partial_days,
    missing_days: args.persistence.capture_calendar.missing_days,
    coverage_ratio: args.persistence.capture_calendar.coverage_ratio,
    current_streak_days: args.persistence.capture_calendar.current_streak_days,
    days_remaining_to_30: daysRemaining,
    expected_live_strategy_count:
      args.persistence.capture_calendar.expected_live_strategy_count,
    persisted_row_count: args.persistence.snapshots.length,
    artifact_live_row_count: artifactLiveRowCount,
    artifact_proof_status: args.publishedArtifactProof.status,
    write_mode_status: args.writeReadiness.status,
    write_enabled: args.writeReadiness.write_enabled,
    effective_dry_run: args.writeReadiness.effective_dry_run,
    registry_sync_status: args.registrySync?.status ?? null,
    review_required_live_signals:
      args.resolutionWatch?.review_required_live_signals ?? null,
    violations,
    recent_calendar_days: args.persistence.capture_calendar.days
      .slice(-7)
      .reverse(),
  };
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
    workflow_mode: null,
    artifact_audit: null,
    artifact_proof: null,
    proof_summary: null,
    proof_readiness: null,
    proof_runway: null,
    capital_review_packet: null,
    strategy_registry: null,
    would_trade_today: null,
    market_exposure_digest: null,
    agent_edge_watchlist: null,
    agent_edge_trade_ledger: null,
    agent_edge_proof: null,
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
    const workflowMode = objectOrNull(proof.workflow_mode);
    const proofReadiness = objectOrNull(artifactProof?.proof_readiness);
    const proofRunway = objectOrNull(artifactProof?.proof_runway);
    const capitalReviewPacket = objectOrNull(
      artifactProof?.capital_review_packet,
    );
    const proofSummary = objectOrNull(artifactProof?.proof_summary);
    const strategyRegistry = objectOrNull(artifactProof?.strategy_registry);
    const wouldTradeToday = objectOrNull(artifactProof?.would_trade_today);
    const marketExposureDigest = objectOrNull(
      artifactProof?.market_exposure_digest,
    );
    const agentEdgeTradeLedger =
      objectOrNull(artifactProof?.agent_edge_trade_ledger) ??
      objectOrNull(proof.agent_edge_trade_ledger);
    const agentEdgeWatchlist =
      objectOrNull(artifactProof?.agent_edge_watchlist) ??
      objectOrNull(proof.agent_edge_watchlist);
    const agentEdgeProof =
      objectOrNull(artifactProof?.agent_edge_proof) ??
      objectOrNull(proof.agent_edge_proof);
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
      workflow_mode: workflowMode,
      artifact_audit: artifactAudit,
      artifact_proof: artifactProof,
      proof_summary: proofSummary,
      proof_readiness: proofReadiness,
      proof_runway: proofRunway,
      capital_review_packet: capitalReviewPacket,
      strategy_registry: strategyRegistry,
      would_trade_today: wouldTradeToday,
      market_exposure_digest: marketExposureDigest,
      agent_edge_watchlist: agentEdgeWatchlist,
      agent_edge_trade_ledger: agentEdgeTradeLedger,
      agent_edge_proof: agentEdgeProof,
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
