import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { basename, join, resolve } from "path";
import type {
  PaperTradingSnapshotRow,
  PaperTradingStrategyProofRollup,
} from "../src/lib/trading-snapshots";
import type { TradingResolutionWatch } from "../src/lib/trading";

const ARTIFACT_FILE_NAME = "paper-snapshot-rows.json";
const DEFAULT_MIN_LIVE_ROWS = 15;
const VALID_SOURCES = new Set(["live", "demo"]);
const VALID_SAMPLES = new Set(["live_only", "all", "backfill"]);
const REQUIRED_ARTIFACT_FIELDS = [
  "source",
  "generated_at",
  "controls",
  "snapshot_date",
  "schema_version",
  "row_count",
  "rows",
] as const;
const REQUIRED_ROW_FIELDS = [
  "snapshot_date",
  "source",
  "schema_version",
  "strategy_id",
  "strategy_label",
  "sample",
  "controls_hash",
  "controls",
  "strategy_summary",
  "proof_gate",
  "exposure_ledger",
  "daily_series",
  "resolved_trades",
  "open_signals",
  "skipped_trades",
  "resolved_net_pnl_usd",
  "resolved_roi_on_stake",
  "open_exposure_usd",
  "open_expected_pnl_usd",
  "proof_status",
] as const;

type CliOptions = {
  allowDemo: boolean;
  json: boolean;
  soft: boolean;
  minLiveRows: number;
  snapshotSummaryPath: string | null;
  workflowPath: string | null;
  inputs: string[];
};

type Check = {
  code: string;
  label: string;
  status: "pass" | "fail";
  detail: string;
};

type ArtifactAudit = {
  path: string;
  source: string | null;
  generated_at: string | null;
  snapshot_date: string | null;
  schema_version: string | null;
  declared_row_count: number | null;
  actual_row_count: number;
  live_row_count: number;
  control_row_count: number;
  selected_query_row_count: number;
  strategy_ids: string[];
  missing_fields: string[];
  checks: Check[];
};

type FailedCheck = {
  path: string | null;
  code: string;
  label: string;
  detail: string;
};

type ArtifactScan = {
  audit: ArtifactAudit;
  proofRows: PaperTradingSnapshotRow[];
  snapshotSummary: SnapshotSummaryContext | null;
};

type SnapshotSummaryContext = {
  path: string;
  source: string | null;
  generated_at: string | null;
  snapshot_date: string | null;
  resolution_watch: TradingResolutionWatch | null;
  strategy_registry: Record<string, unknown> | null;
  would_trade_today: Record<string, unknown> | null;
  market_exposure_digest: Record<string, unknown> | null;
  status: "available" | "missing" | "error";
  message: string;
};

type WorkflowModeContext = {
  path: string;
  requested_dry_run: boolean;
  effective_dry_run: boolean;
  write_enabled: boolean;
  mode_reason: string;
  status: "available" | "missing" | "error";
  message: string;
};

type StrategyRollupSummary = {
  strategy_id: string;
  strategy_label: string;
  sample: string;
  durable_status: string;
  evidence_grade: string;
  captured_days: number;
  resolved_trades: number;
  window_pnl_usd: number;
  window_roi_on_stake: number;
  max_drawdown_usd: number;
  open_exposure_usd: number;
  open_expected_pnl_usd: number;
  latest_snapshot_date: string | null;
  blockers: string[];
};

function parseArgs(argv: string[]): CliOptions {
  const inputs: string[] = [];
  let allowDemo = false;
  let json = process.env.npm_config_json === "true";
  let soft = process.env.npm_config_soft === "true";
  let minLiveRows = DEFAULT_MIN_LIVE_ROWS;
  let snapshotSummaryPath: string | null = null;
  let workflowPath: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, inlineValue] = arg.split("=", 2);
    const nextValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      i += 1;
      return argv[i] ?? "";
    };

    if (arg === "--allow-demo") {
      allowDemo = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--soft") {
      soft = true;
    } else if (flag === "--min-live-rows") {
      const parsed = Number(nextValue());
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--min-live-rows must be a positive integer.");
      }
      minLiveRows = parsed;
    } else if (flag === "--snapshot-summary") {
      snapshotSummaryPath = nextValue();
    } else if (flag === "--workflow") {
      workflowPath = nextValue();
    } else if (flag === "--dir" || flag === "--file") {
      inputs.push(nextValue());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      inputs.push(arg);
    }
  }

  return {
    allowDemo,
    json,
    soft,
    minLiveRows,
    snapshotSummaryPath,
    workflowPath,
    inputs: inputs.length > 0 ? inputs : ["."],
  };
}

function printHelp() {
  console.log(`Eivra paper-trading artifact audit

Audit downloaded GitHub proof artifacts:
  npm run paper:artifact-audit -- ./paper-artifacts --json

Download then audit one run:
  gh run download <run_id> --repo claygeo/eivra --dir ./paper-artifacts
  npm run paper:artifact-audit -- ./paper-artifacts --json

Options:
  --dir <path>               Directory to scan recursively. Defaults to cwd.
  --file <path>              Direct paper-snapshot-rows.json file to audit.
  --json                     Print machine-readable JSON.
  --soft                     Always exit 0 after printing the report.
  --allow-demo               Do not fail demo-sourced artifacts.
  --min-live-rows <number>   Minimum live strategy rows required per artifact. Default ${DEFAULT_MIN_LIVE_ROWS}.
  --snapshot-summary <file>  Optional paper-snapshot-result.json for live resolution context.
  --workflow <file>          Optional paper-snapshot-workflow.json write-mode context.

The report also includes artifact_proof: a read-only strategy proof rollup built
from valid artifact rows with the same paper-only logic used by persisted
Supabase snapshots.
`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return !Number.isNaN(new Date(value).getTime());
}

function discoverArtifactFiles(inputs: string[]): string[] {
  const found = new Set<string>();

  const visit = (path: string) => {
    const fullPath = resolve(process.cwd(), path);
    if (!existsSync(fullPath)) {
      throw new Error(`Artifact path does not exist: ${fullPath}`);
    }

    const stats = statSync(fullPath);
    if (stats.isFile()) {
      if (basename(fullPath) !== ARTIFACT_FILE_NAME) {
        throw new Error(
          `Expected ${ARTIFACT_FILE_NAME}, got file: ${fullPath}`,
        );
      }
      found.add(fullPath);
      return;
    }

    if (!stats.isDirectory()) return;
    for (const entry of readdirSync(fullPath)) {
      const child = join(fullPath, entry);
      const childStats = statSync(child);
      if (childStats.isDirectory()) {
        visit(child);
      } else if (
        childStats.isFile() &&
        basename(child) === ARTIFACT_FILE_NAME
      ) {
        found.add(child);
      }
    }
  };

  for (const input of inputs) visit(input);
  return [...found].sort((a, b) => a.localeCompare(b));
}

function snapshotSummaryPathForArtifact(
  artifactPath: string,
  explicitPath: string | null,
): string | null {
  if (explicitPath) return resolve(process.cwd(), explicitPath);
  const sibling = join(
    resolve(artifactPath, ".."),
    "paper-snapshot-result.json",
  );
  return existsSync(sibling) ? sibling : null;
}

function readSnapshotSummary(
  path: string | null,
  explicit: boolean,
): SnapshotSummaryContext | null {
  if (!path) return null;
  if (!existsSync(path)) {
    return explicit
      ? {
          path,
          source: null,
          generated_at: null,
          snapshot_date: null,
          resolution_watch: null,
          strategy_registry: null,
          would_trade_today: null,
          market_exposure_digest: null,
          status: "missing",
          message: "Snapshot summary file was not found.",
        }
      : null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(parsed)) {
      return {
        path,
        source: null,
        generated_at: null,
        snapshot_date: null,
        resolution_watch: null,
        strategy_registry: null,
        would_trade_today: null,
        market_exposure_digest: null,
        status: "error",
        message: "Snapshot summary JSON is not an object.",
      };
    }
    const resolutionWatch = isRecord(parsed.resolution_watch)
      ? (parsed.resolution_watch as unknown as TradingResolutionWatch)
      : null;
    const strategyRegistry = isRecord(parsed.strategy_registry)
      ? parsed.strategy_registry
      : null;
    const wouldTradeToday = isRecord(parsed.would_trade_today)
      ? parsed.would_trade_today
      : null;
    const marketExposureDigest = isRecord(parsed.market_exposure_digest)
      ? parsed.market_exposure_digest
      : null;
    return {
      path,
      source: optionalString(parsed.source),
      generated_at: optionalString(parsed.generated_at),
      snapshot_date: optionalString(parsed.snapshot_date),
      resolution_watch: resolutionWatch,
      strategy_registry: strategyRegistry,
      would_trade_today: wouldTradeToday,
      market_exposure_digest: marketExposureDigest,
      status: resolutionWatch ? "available" : "error",
      message: resolutionWatch
        ? "Snapshot summary resolution context loaded."
        : "Snapshot summary is missing resolution_watch.",
    };
  } catch (error) {
    return {
      path,
      source: null,
      generated_at: null,
      snapshot_date: null,
      resolution_watch: null,
      strategy_registry: null,
      would_trade_today: null,
      market_exposure_digest: null,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function readWorkflowMode(path: string | null): WorkflowModeContext | null {
  if (!path) return null;
  const resolvedPath = resolve(process.cwd(), path);
  if (!existsSync(resolvedPath)) {
    return {
      path: resolvedPath,
      requested_dry_run: false,
      effective_dry_run: false,
      write_enabled: false,
      mode_reason: "",
      status: "missing",
      message: "Workflow mode file was not found.",
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(resolvedPath, "utf8"));
    if (!isRecord(parsed)) {
      return {
        path: resolvedPath,
        requested_dry_run: false,
        effective_dry_run: false,
        write_enabled: false,
        mode_reason: "",
        status: "error",
        message: "Workflow mode JSON is not an object.",
      };
    }
    const requestedDryRun = optionalBoolean(parsed.requested_dry_run);
    const effectiveDryRun = optionalBoolean(parsed.effective_dry_run);
    const writeEnabled = optionalBoolean(parsed.write_enabled);
    const modeReason = optionalString(parsed.mode_reason) ?? "";
    if (
      requestedDryRun === null ||
      effectiveDryRun === null ||
      writeEnabled === null
    ) {
      return {
        path: resolvedPath,
        requested_dry_run: false,
        effective_dry_run: false,
        write_enabled: false,
        mode_reason: modeReason,
        status: "error",
        message:
          "Workflow mode JSON must include requested_dry_run, effective_dry_run, and write_enabled booleans.",
      };
    }

    return {
      path: resolvedPath,
      requested_dry_run: requestedDryRun,
      effective_dry_run: effectiveDryRun,
      write_enabled: writeEnabled,
      mode_reason: modeReason,
      status: "available",
      message: "Workflow mode context loaded.",
    };
  } catch (error) {
    return {
      path: resolvedPath,
      requested_dry_run: false,
      effective_dry_run: false,
      write_enabled: false,
      mode_reason: "",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function check(
  checks: Check[],
  code: string,
  label: string,
  passed: boolean,
  detail: string,
) {
  checks.push({
    code,
    label,
    status: passed ? "pass" : "fail",
    detail,
  });
}

function collectMissingFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  prefix: string,
): string[] {
  return fields
    .filter((field) => !(field in value))
    .map((field) => `${prefix}.${field}`);
}

function scanArtifact(path: string, options: CliOptions): ArtifactScan {
  const checks: Check[] = [];
  const missingFields: string[] = [];
  const proofRows: PaperTradingSnapshotRow[] = [];
  const summaryPath = snapshotSummaryPathForArtifact(
    path,
    options.snapshotSummaryPath,
  );
  const snapshotSummary = readSnapshotSummary(
    summaryPath,
    Boolean(options.snapshotSummaryPath),
  );
  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
    check(checks, "json_parse", "JSON parses", true, "Artifact JSON parsed.");
  } catch (error) {
    check(
      checks,
      "json_parse",
      "JSON parses",
      false,
      error instanceof Error ? error.message : String(error),
    );
    return emptyArtifactScan(path, checks);
  }

  if (!isRecord(parsed)) {
    check(
      checks,
      "artifact_object",
      "Artifact is an object",
      false,
      "Top-level JSON is not an object.",
    );
    return emptyArtifactScan(path, checks);
  }

  missingFields.push(
    ...collectMissingFields(parsed, REQUIRED_ARTIFACT_FIELDS, "artifact"),
  );

  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const source = optionalString(parsed.source);
  const generatedAt = optionalString(parsed.generated_at);
  const snapshotDate = optionalString(parsed.snapshot_date);
  const schemaVersion = optionalString(parsed.schema_version);
  const declaredRowCount = isFiniteNumber(parsed.row_count)
    ? parsed.row_count
    : null;

  check(
    checks,
    "artifact_fields",
    "Required artifact fields",
    missingFields.length === 0,
    missingFields.length === 0
      ? "All required artifact fields are present."
      : missingFields.join(", "),
  );
  check(
    checks,
    "source",
    "Live source",
    source === "live" || (options.allowDemo && source === "demo"),
    source === "live"
      ? "Artifact source is live."
      : options.allowDemo && source === "demo"
        ? "Demo artifact allowed by flag."
        : `Artifact source is ${source ?? "missing"}.`,
  );
  check(
    checks,
    "known_source",
    "Known source value",
    typeof source === "string" && VALID_SOURCES.has(source),
    source ? `Source: ${source}.` : "Source is missing.",
  );
  check(
    checks,
    "schema_version",
    "Schema version",
    schemaVersion === "1",
    `Schema version: ${schemaVersion ?? "missing"}.`,
  );
  check(
    checks,
    "generated_at",
    "Generated timestamp",
    validTimestamp(generatedAt),
    generatedAt ?? "generated_at is missing.",
  );
  check(
    checks,
    "snapshot_date",
    "Snapshot date",
    validDate(snapshotDate),
    snapshotDate ?? "snapshot_date is missing.",
  );
  check(
    checks,
    "generated_date_matches",
    "Generated timestamp matches snapshot date",
    validTimestamp(generatedAt) &&
      validDate(snapshotDate) &&
      new Date(generatedAt).toISOString().slice(0, 10) === snapshotDate,
    generatedAt && snapshotDate
      ? `${new Date(generatedAt).toISOString().slice(0, 10)} vs ${snapshotDate}.`
      : "Cannot compare missing generated_at/snapshot_date.",
  );
  check(
    checks,
    "row_count",
    "Declared row count matches rows",
    declaredRowCount === rows.length,
    `${declaredRowCount ?? "missing"} declared / ${rows.length} actual.`,
  );
  check(
    checks,
    "rows_array",
    "Rows array",
    Array.isArray(parsed.rows) && rows.length > 0,
    Array.isArray(parsed.rows)
      ? `${rows.length} rows.`
      : "rows is not an array.",
  );

  const strategyIds = new Set<string>();
  const duplicateStrategyIds = new Set<string>();
  let liveRowCount = 0;
  let controlRowCount = 0;
  let selectedQueryRowCount = 0;

  rows.forEach((row, index) => {
    const rowPrefix = `rows[${index}]`;
    if (!isRecord(row)) {
      missingFields.push(`${rowPrefix}.object`);
      return;
    }

    missingFields.push(
      ...collectMissingFields(row, REQUIRED_ROW_FIELDS, rowPrefix),
    );

    const strategyId =
      optionalString(row.strategy_id) ?? `${rowPrefix}.unknown`;
    if (strategyIds.has(strategyId)) duplicateStrategyIds.add(strategyId);
    strategyIds.add(strategyId);
    if (strategyId === "selected-query") selectedQueryRowCount += 1;

    const sample = optionalString(row.sample);
    if (sample === "live_only") liveRowCount += 1;
    if (sample !== "live_only") controlRowCount += 1;

    if (row.source !== source)
      missingFields.push(`${rowPrefix}.source_mismatch`);
    if (row.schema_version !== "1")
      missingFields.push(`${rowPrefix}.schema_version`);
    if (row.snapshot_date !== snapshotDate) {
      missingFields.push(`${rowPrefix}.snapshot_date_mismatch`);
    }
    if (typeof sample !== "string" || !VALID_SAMPLES.has(sample)) {
      missingFields.push(`${rowPrefix}.sample`);
    }

    for (const field of [
      "resolved_trades",
      "open_signals",
      "skipped_trades",
      "resolved_net_pnl_usd",
      "resolved_roi_on_stake",
      "open_exposure_usd",
      "open_expected_pnl_usd",
    ]) {
      if (!isFiniteNumber(row[field])) {
        missingFields.push(`${rowPrefix}.${field}`);
      }
    }

    const strategySummary = row.strategy_summary;
    if (!isRecord(strategySummary)) {
      missingFields.push(`${rowPrefix}.strategy_summary.object`);
    } else {
      if (strategySummary.id !== row.strategy_id) {
        missingFields.push(`${rowPrefix}.strategy_summary.id`);
      }
      if (strategySummary.sample !== row.sample) {
        missingFields.push(`${rowPrefix}.strategy_summary.sample`);
      }
      if (!isRecord(strategySummary.proof_gate)) {
        missingFields.push(`${rowPrefix}.strategy_summary.proof_gate`);
      }
      if (!isRecord(strategySummary.exposure_ledger)) {
        missingFields.push(`${rowPrefix}.strategy_summary.exposure_ledger`);
      }
    }

    const proofGate = row.proof_gate;
    if (!isRecord(proofGate)) {
      missingFields.push(`${rowPrefix}.proof_gate.object`);
    } else if (proofGate.status !== row.proof_status) {
      missingFields.push(`${rowPrefix}.proof_gate.status`);
    }

    if (!isRecord(row.exposure_ledger)) {
      missingFields.push(`${rowPrefix}.exposure_ledger.object`);
    }

    const dailySeries = row.daily_series;
    if (!isRecord(dailySeries)) {
      missingFields.push(`${rowPrefix}.daily_series.object`);
    } else {
      if (dailySeries.strategy_id !== row.strategy_id) {
        missingFields.push(`${rowPrefix}.daily_series.strategy_id`);
      }
      if (!Array.isArray(dailySeries.days)) {
        missingFields.push(`${rowPrefix}.daily_series.days`);
      }
    }

    proofRows.push(hydrateArtifactRow(row, generatedAt, snapshotDate, index));
  });

  check(
    checks,
    "row_fields",
    "Required row evidence fields",
    missingFields.filter((field) => field.startsWith("rows[")).length === 0,
    missingFields.filter((field) => field.startsWith("rows[")).length === 0
      ? "Every row has the required proof fields."
      : `${missingFields.filter((field) => field.startsWith("rows[")).length} row field issue(s).`,
  );
  check(
    checks,
    "duplicate_strategy_ids",
    "Unique strategy ids per artifact",
    duplicateStrategyIds.size === 0,
    duplicateStrategyIds.size === 0
      ? "No duplicate strategy ids in artifact."
      : [...duplicateStrategyIds].sort().join(", "),
  );
  check(
    checks,
    "live_row_coverage",
    "Minimum live strategy rows",
    liveRowCount >= options.minLiveRows,
    `${liveRowCount}/${options.minLiveRows} live rows.`,
  );

  return {
    audit: {
      path,
      source,
      generated_at: generatedAt,
      snapshot_date: snapshotDate,
      schema_version: schemaVersion,
      declared_row_count: declaredRowCount,
      actual_row_count: rows.length,
      live_row_count: liveRowCount,
      control_row_count: controlRowCount,
      selected_query_row_count: selectedQueryRowCount,
      strategy_ids: [...strategyIds].sort((a, b) => a.localeCompare(b)),
      missing_fields: [...new Set(missingFields)].sort((a, b) =>
        a.localeCompare(b),
      ),
      checks,
    },
    proofRows,
    snapshotSummary,
  };
}

function emptyArtifactScan(path: string, checks: Check[]): ArtifactScan {
  return {
    audit: {
      path,
      source: null,
      generated_at: null,
      snapshot_date: null,
      schema_version: null,
      declared_row_count: null,
      actual_row_count: 0,
      live_row_count: 0,
      control_row_count: 0,
      selected_query_row_count: 0,
      strategy_ids: [],
      missing_fields: [],
      checks,
    },
    proofRows: [],
    snapshotSummary: null,
  };
}

function hydrateArtifactRow(
  row: Record<string, unknown>,
  generatedAt: string | null,
  artifactSnapshotDate: string | null,
  index: number,
): PaperTradingSnapshotRow {
  const snapshotDate =
    optionalString(row.snapshot_date) ?? artifactSnapshotDate ?? "unknown";
  const strategyId = optionalString(row.strategy_id) ?? `unknown-${index}`;
  const capturedAt =
    optionalString(row.captured_at) ??
    generatedAt ??
    `${snapshotDate}T00:00:00.000Z`;
  return {
    ...row,
    id: optionalString(row.id) ?? `${snapshotDate}-${strategyId}-${index}`,
    captured_at: capturedAt,
  } as PaperTradingSnapshotRow;
}

function summarizeStrategyRollup(
  rollup: PaperTradingStrategyProofRollup,
): StrategyRollupSummary {
  return {
    strategy_id: rollup.strategy_id,
    strategy_label: rollup.strategy_label,
    sample: rollup.sample,
    durable_status: rollup.durable_proof_gate.status,
    evidence_grade: rollup.proof_quality.evidence_grade,
    captured_days: rollup.capture_coverage.captured_days,
    resolved_trades: rollup.proof_window.resolved_trades,
    window_pnl_usd: rollup.proof_window.resolved_net_pnl_usd,
    window_roi_on_stake: rollup.proof_window.resolved_roi_on_stake,
    max_drawdown_usd: rollup.proof_window.max_drawdown_usd,
    open_exposure_usd: rollup.proof_window.latest_open_exposure_usd,
    open_expected_pnl_usd: rollup.proof_window.latest_open_expected_pnl_usd,
    latest_snapshot_date: rollup.latest_snapshot_date,
    blockers: rollup.durable_proof_gate.blockers,
  };
}

async function buildArtifactProof(
  proofRows: PaperTradingSnapshotRow[],
  blocked: boolean,
  resolutionWatch: TradingResolutionWatch | null,
  strategyRegistry: Record<string, unknown> | null,
  wouldTradeToday: Record<string, unknown> | null,
  marketExposureDigest: Record<string, unknown> | null,
  workflowMode: WorkflowModeContext | null,
) {
  const workflowModePayload =
    workflowMode?.status === "available"
      ? {
          requested_dry_run: workflowMode.requested_dry_run,
          effective_dry_run: workflowMode.effective_dry_run,
          write_enabled: workflowMode.write_enabled,
          mode_reason: workflowMode.mode_reason,
        }
      : null;

  if (blocked || proofRows.length === 0) {
    return {
      status: "unavailable",
      message: blocked
        ? "Artifact proof rollup skipped because artifact checks failed."
        : "No artifact rows are available for proof rollup.",
      paper_only: true,
      real_money_execution_allowed: false,
      workflow_mode: workflowModePayload,
      latest_captured_at: null,
      proof_summary: null,
      proof_readiness: null,
      proof_runway: null,
      capital_review_packet: null,
      capture_health: null,
      capture_calendar: null,
      resolution_watch: resolutionWatch,
      strategy_registry: strategyRegistry,
      would_trade_today: wouldTradeToday,
      market_exposure_digest: marketExposureDigest,
      agent_edge_proof_matrix: [],
      top_strategy_rollups: [],
    };
  }

  const {
    buildPaperTradingAgentEdgeProofMatrix,
    buildPaperTradingCapitalReviewPacket,
    buildPaperTradingCaptureCalendar,
    buildPaperTradingCaptureHealth,
    buildPaperTradingProofReadiness,
    buildPaperTradingProofRunway,
    buildPaperTradingProofSummary,
    buildPaperTradingStrategyRollups,
  } = await import("../src/lib/trading-snapshots");
  const sortedRows = proofRows
    .slice()
    .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at));
  const latestCapturedAt = sortedRows[0]?.captured_at ?? null;
  const captureHealth = buildPaperTradingCaptureHealth(latestCapturedAt);
  const captureCalendar = buildPaperTradingCaptureCalendar(
    sortedRows,
    captureHealth,
  );
  const strategyRollups = buildPaperTradingStrategyRollups(
    sortedRows,
    captureHealth,
  );
  const agentEdgeProofMatrix =
    buildPaperTradingAgentEdgeProofMatrix(strategyRollups);
  const proofSummary = buildPaperTradingProofSummary(strategyRollups);
  const proofReadiness = buildPaperTradingProofReadiness({
    persistenceStatus: "available",
    proofSummary,
    captureHealth,
    captureCalendar,
    resolutionWatch,
  });
  const proofRunway = buildPaperTradingProofRunway({
    proofSummary,
    captureHealth,
    captureCalendar,
    resolutionWatch,
  });
  const capitalReviewPacket = buildPaperTradingCapitalReviewPacket({
    proofSummary,
    proofReadiness,
    proofRunway,
    workflowMode: workflowModePayload,
  });

  return {
    status: "available",
    message:
      "Artifact rows were rolled up with the same paper-only proof logic used for persisted snapshots.",
    paper_only: true,
    real_money_execution_allowed: false,
    workflow_mode: workflowModePayload,
    latest_captured_at: latestCapturedAt,
    proof_summary: proofSummary,
    proof_readiness: proofReadiness,
    proof_runway: proofRunway,
    capital_review_packet: capitalReviewPacket,
    capture_health: captureHealth,
    capture_calendar: captureCalendar,
    resolution_watch: resolutionWatch,
    strategy_registry: strategyRegistry,
    would_trade_today: wouldTradeToday,
    market_exposure_digest: marketExposureDigest,
    agent_edge_proof_matrix: agentEdgeProofMatrix,
    top_strategy_rollups: strategyRollups
      .slice(0, 12)
      .map(summarizeStrategyRollup),
  };
}

async function buildReport(options: CliOptions, files: string[]) {
  const workflowMode = readWorkflowMode(options.workflowPath);
  const scans = files.map((file) => scanArtifact(file, options));
  const artifactAudits = scans.map((scan) => scan.audit);
  const failedChecks: FailedCheck[] = artifactAudits.flatMap((artifact) =>
    artifact.checks
      .filter((item) => item.status === "fail")
      .map((item) => ({
        path: artifact.path,
        code: item.code,
        label: item.label,
        detail: item.detail,
      })),
  );
  const snapshotDates = artifactAudits
    .map((artifact) => artifact.snapshot_date)
    .filter((date): date is string => Boolean(date))
    .sort();
  const duplicateSnapshotDates = snapshotDates.filter(
    (date, index) => snapshotDates.indexOf(date) !== index,
  );
  const uniqueSnapshotDates = [...new Set(snapshotDates)];

  if (files.length === 0) {
    failedChecks.push({
      path: null,
      code: "artifact_discovery",
      label: "Artifact discovery",
      detail: `No ${ARTIFACT_FILE_NAME} files found in the requested path(s).`,
    });
  }
  if (workflowMode && workflowMode.status !== "available") {
    failedChecks.push({
      path: workflowMode.path,
      code: "workflow_mode",
      label: "Workflow mode context",
      detail: workflowMode.message,
    });
  }
  for (const scan of scans) {
    const summary = scan.snapshotSummary;
    if (!summary || summary.status === "available") continue;
    if (options.snapshotSummaryPath) {
      failedChecks.push({
        path: summary.path,
        code: "snapshot_summary",
        label: "Snapshot summary resolution context",
        detail: summary.message,
      });
    }
  }
  if (duplicateSnapshotDates.length > 0) {
    failedChecks.push({
      path: null,
      code: "duplicate_snapshot_dates",
      label: "Unique snapshot dates",
      detail: [...new Set(duplicateSnapshotDates)].sort().join(", "),
    });
  }

  const latestSnapshotDate =
    uniqueSnapshotDates[uniqueSnapshotDates.length - 1] ?? null;
  const completeArtifactDays = new Set(
    artifactAudits
      .filter(
        (artifact) =>
          artifact.snapshot_date &&
          artifact.live_row_count >= options.minLiveRows &&
          artifact.checks.every((item) => item.status === "pass"),
      )
      .map((artifact) => artifact.snapshot_date as string),
  );
  const artifactProofRows =
    failedChecks.length === 0 ? scans.flatMap((scan) => scan.proofRows) : [];
  const snapshotSummaries = scans
    .map((scan) => scan.snapshotSummary)
    .filter((summary): summary is SnapshotSummaryContext => Boolean(summary));
  const latestSnapshotSummary =
    snapshotSummaries
      .filter((summary) => summary.status === "available")
      .sort(
        (a, b) =>
          Date.parse(b.generated_at ?? "") - Date.parse(a.generated_at ?? ""),
      )[0] ?? null;
  if (latestSnapshotSummary?.resolution_watch) {
    const wouldTradeToday = latestSnapshotSummary.would_trade_today;
    if (!wouldTradeToday) {
      failedChecks.push({
        path: latestSnapshotSummary.path,
        code: "would_trade_today",
        label: "Would-trade feed",
        detail: "Snapshot summary is missing would_trade_today.",
      });
    } else {
      const globalReviewRequired =
        latestSnapshotSummary.resolution_watch.review_required_live_signals;
      const feedGlobalReviewRequired =
        wouldTradeToday.global_review_required_live_signals;
      const feedStatus = wouldTradeToday.status;

      if (
        !isFiniteNumber(feedGlobalReviewRequired) ||
        feedGlobalReviewRequired !== globalReviewRequired
      ) {
        failedChecks.push({
          path: latestSnapshotSummary.path,
          code: "would_trade_resolution_sync",
          label: "Would-trade resolution sync",
          detail: `Expected global review count ${globalReviewRequired}, got ${String(
            feedGlobalReviewRequired,
          )}.`,
        });
      }
      if (globalReviewRequired > 0 && feedStatus !== "blocked") {
        failedChecks.push({
          path: latestSnapshotSummary.path,
          code: "would_trade_blocked_status",
          label: "Would-trade blocked status",
          detail: `Expected would_trade_today.status=blocked while ${globalReviewRequired} live paper markets need review, got ${String(
            feedStatus,
          )}.`,
        });
      }
      if (
        wouldTradeToday.paper_only !== true ||
        wouldTradeToday.real_money_execution_allowed !== false
      ) {
        failedChecks.push({
          path: latestSnapshotSummary.path,
          code: "would_trade_paper_only",
          label: "Would-trade paper-only lock",
          detail:
            "would_trade_today must keep paper_only=true and real_money_execution_allowed=false.",
        });
      }
    }
    const marketExposureDigest = latestSnapshotSummary.market_exposure_digest;
    if (!marketExposureDigest) {
      failedChecks.push({
        path: latestSnapshotSummary.path,
        code: "market_exposure_digest",
        label: "Market exposure digest",
        detail: "Snapshot summary is missing market_exposure_digest.",
      });
    } else {
      const digestOpenLiveSignals = marketExposureDigest.open_live_signals;
      const resolutionOpenLiveSignals =
        latestSnapshotSummary.resolution_watch.open_live_signals;

      if (
        !isFiniteNumber(digestOpenLiveSignals) ||
        digestOpenLiveSignals !== resolutionOpenLiveSignals
      ) {
        failedChecks.push({
          path: latestSnapshotSummary.path,
          code: "market_exposure_resolution_sync",
          label: "Market exposure resolution sync",
          detail: `Expected open live signal count ${resolutionOpenLiveSignals}, got ${String(
            digestOpenLiveSignals,
          )}.`,
        });
      }
      if (
        marketExposureDigest.paper_only !== true ||
        marketExposureDigest.real_money_execution_allowed !== false
      ) {
        failedChecks.push({
          path: latestSnapshotSummary.path,
          code: "market_exposure_paper_only",
          label: "Market exposure paper-only lock",
          detail:
            "market_exposure_digest must keep paper_only=true and real_money_execution_allowed=false.",
        });
      }
    }
  }
  const proof = await buildArtifactProof(
    artifactProofRows,
    failedChecks.length > 0,
    latestSnapshotSummary?.resolution_watch ?? null,
    latestSnapshotSummary?.strategy_registry ?? null,
    latestSnapshotSummary?.would_trade_today ?? null,
    latestSnapshotSummary?.market_exposure_digest ?? null,
    workflowMode,
  );
  const capitalReviewPacket = isRecord(proof.capital_review_packet)
    ? proof.capital_review_packet
    : null;
  if (proof.status === "available" && !capitalReviewPacket) {
    failedChecks.push({
      path: null,
      code: "capital_review_packet",
      label: "Capital review packet",
      detail: "Available artifact proof must include capital_review_packet.",
    });
  }
  if (
    capitalReviewPacket &&
    (capitalReviewPacket.paper_only !== true ||
      capitalReviewPacket.real_money_execution_allowed !== false ||
      capitalReviewPacket.execution_path_present !== false)
  ) {
    failedChecks.push({
      path: null,
      code: "capital_review_paper_only",
      label: "Capital review paper-only lock",
      detail:
        "capital_review_packet must keep paper_only=true, real_money_execution_allowed=false, and execution_path_present=false.",
    });
  }
  const proofWorkflowMode = isRecord(proof.workflow_mode)
    ? proof.workflow_mode
    : null;
  if (workflowMode?.status === "available" && !proofWorkflowMode) {
    failedChecks.push({
      path: workflowMode.path,
      code: "artifact_proof_workflow_mode",
      label: "Artifact proof workflow mode",
      detail: "Artifact proof must include workflow_mode when provided.",
    });
  }
  if (workflowMode?.status === "available" && capitalReviewPacket) {
    const packetWorkflowMode = isRecord(capitalReviewPacket.workflow_mode)
      ? capitalReviewPacket.workflow_mode
      : null;
    if (!packetWorkflowMode) {
      failedChecks.push({
        path: workflowMode.path,
        code: "capital_review_workflow_mode",
        label: "Capital review workflow mode",
        detail:
          "Capital review packet must include workflow_mode when provided.",
      });
    }
    if (
      workflowMode.write_enabled === false &&
      capitalReviewPacket.decision !== "do_not_allocate_capital"
    ) {
      failedChecks.push({
        path: workflowMode.path,
        code: "capital_review_write_disabled",
        label: "Capital review write-disabled guard",
        detail:
          "Capital review packet must say do_not_allocate_capital when Supabase snapshot writes are disabled.",
      });
    }
  }

  return {
    verdict: failedChecks.length === 0 ? "pass" : "blocked",
    checked_at: new Date().toISOString(),
    artifact_file_name: ARTIFACT_FILE_NAME,
    allow_demo: options.allowDemo,
    min_live_rows: options.minLiveRows,
    artifact_count: files.length,
    artifact_paths: files,
    snapshot_dates: uniqueSnapshotDates,
    duplicate_snapshot_dates: [...new Set(duplicateSnapshotDates)].sort(),
    coverage_days: uniqueSnapshotDates.length,
    complete_artifact_days: completeArtifactDays.size,
    latest_snapshot_date: latestSnapshotDate,
    row_count: artifactAudits.reduce(
      (sum, artifact) => sum + artifact.actual_row_count,
      0,
    ),
    live_row_count: artifactAudits.reduce(
      (sum, artifact) => sum + artifact.live_row_count,
      0,
    ),
    control_row_count: artifactAudits.reduce(
      (sum, artifact) => sum + artifact.control_row_count,
      0,
    ),
    selected_query_row_count: artifactAudits.reduce(
      (sum, artifact) => sum + artifact.selected_query_row_count,
      0,
    ),
    sources: [
      ...new Set(
        artifactAudits.map((artifact) => artifact.source).filter(Boolean),
      ),
    ].sort(),
    schema_versions: [
      ...new Set(
        artifactAudits
          .map((artifact) => artifact.schema_version)
          .filter(Boolean),
      ),
    ].sort(),
    missing_fields: [
      ...new Set(artifactAudits.flatMap((artifact) => artifact.missing_fields)),
    ].sort(),
    failed_checks: failedChecks,
    workflow_mode: workflowMode,
    snapshot_summaries: snapshotSummaries,
    latest_snapshot_summary: latestSnapshotSummary,
    artifact_proof: proof,
    artifacts: artifactAudits,
    exit_code: failedChecks.length === 0 || options.soft ? 0 : 1,
  };
}

function emit(_json: boolean, value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = discoverArtifactFiles(options.inputs);
  const report = await buildReport(options, files);
  emit(options.json, report);
  if (report.exit_code !== 0) {
    process.exitCode = report.exit_code;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
