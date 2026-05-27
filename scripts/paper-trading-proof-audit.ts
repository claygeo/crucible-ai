import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PAPER_TRADING_PROOF_RULES } from "../src/lib/trading";
import type { PaperTradingProofReadinessStatus } from "../src/lib/trading-snapshots";

const DEFAULT_QUERY: Record<string, string> = {
  sample: "live_only",
  agent: "all",
  category: "all",
  side: "all",
  min_edge: "0.1",
  stake_mode: "kelly_capped",
  ticket_usd: "25",
  max_stake_usd: "100",
  max_open_exposure_usd: "500",
};

type AuditStatus = "pass" | "collecting" | "blocked" | "unavailable";

type AuditCheck = {
  id: string;
  label: string;
  status: AuditStatus;
  current: string;
  target: string;
  detail: string;
};

type CliOptions = {
  json: boolean;
  soft: boolean;
  envFiles: string[];
  params: URLSearchParams;
};

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(path: string): boolean {
  const fullPath = resolve(process.cwd(), path);
  if (!existsSync(fullPath)) return false;

  const contents = readFileSync(fullPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const equals = withoutExport.indexOf("=");
    if (equals <= 0) continue;
    const key = withoutExport.slice(0, equals).trim();
    const value = unquote(withoutExport.slice(equals + 1));
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
  return true;
}

function parseArgs(argv: string[]): CliOptions {
  const params = new URLSearchParams(DEFAULT_QUERY);
  const envFiles = [".env.local", ".env"];
  let json = process.env.npm_config_json === "true";
  let soft = process.env.npm_config_soft === "true";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, inlineValue] = arg.split("=", 2);
    const nextValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      i += 1;
      return argv[i] ?? "";
    };

    if (arg === "--json") {
      json = true;
    } else if (arg === "--soft") {
      soft = true;
    } else if (flag === "--env") {
      envFiles.push(nextValue());
    } else if (flag === "--sample") {
      params.set("sample", nextValue());
    } else if (flag === "--agent") {
      params.set("agent", nextValue());
    } else if (flag === "--category") {
      params.set("category", nextValue());
    } else if (flag === "--side") {
      params.set("side", nextValue());
    } else if (flag === "--min-edge") {
      params.set("min_edge", nextValue());
    } else if (flag === "--stake-mode") {
      params.set("stake_mode", nextValue());
    } else if (flag === "--ticket-usd") {
      params.set("ticket_usd", nextValue());
    } else if (flag === "--max-stake-usd") {
      params.set("max_stake_usd", nextValue());
    } else if (flag === "--max-open-exposure-usd") {
      params.set("max_open_exposure_usd", nextValue());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { json, soft, envFiles, params };
}

function printHelp() {
  console.log(`Eivra paper-trading proof audit

Hard gate:
  npm run paper:audit

Machine-readable report without failing the shell:
  npm run paper:audit:soft

Options:
  --json                     Print machine-readable JSON.
  --soft                     Always exit 0 after printing the report.
  --env <file>               Load an additional env file before importing app code.
  --sample <live_only|all|backfill>
  --agent <all|sage|hawk|magpie|echo|mirror|crowd>
  --category <all|politics|sports|ai-tech|crypto|other>
  --side <all|YES|NO>
  --min-edge <number>
  --stake-mode <kelly_capped|flat>
  --ticket-usd <number>
  --max-stake-usd <number>
  --max-open-exposure-usd <number>
`);
}

function statusRank(status: AuditStatus): number {
  if (status === "blocked") return 0;
  if (status === "unavailable") return 1;
  if (status === "collecting") return 2;
  return 3;
}

function readinessToAudit(status: PaperTradingProofReadinessStatus): AuditStatus {
  return status;
}

function check(
  id: string,
  label: string,
  status: AuditStatus,
  current: string,
  target: string,
  detail: string
): AuditCheck {
  return { id, label, status, current, target, detail };
}

function verdictFromChecks(checks: AuditCheck[]): AuditStatus {
  return checks.reduce<AuditStatus>((worst, item) => {
    return statusRank(item.status) < statusRank(worst) ? item.status : worst;
  }, "pass");
}

function statusLabel(status: AuditStatus): string {
  if (status === "pass") return "Pass";
  if (status === "blocked") return "Blocked";
  if (status === "unavailable") return "Unavailable";
  return "Collecting";
}

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const loadedEnvFiles = options.envFiles.filter((file) => loadEnvFile(file));
  const { getTradingSnapshot, parseTradingControls } = await import(
    "../src/lib/trading"
  );
  const {
    buildPaperTradingProofReadiness,
    buildPaperTradingProofRunway,
    buildPaperTradingStrategyRegistrySync,
    loadPaperTradingSnapshotHistory,
  } = await import("../src/lib/trading-snapshots");

  const controls = parseTradingControls(options.params);
  const [snapshot, persisted] = await Promise.all([
    getTradingSnapshot(controls),
    loadPaperTradingSnapshotHistory(1000),
  ]);
  const registrySync = buildPaperTradingStrategyRegistrySync(
    snapshot.strategy_variants,
    persisted.snapshots
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
  const evidenceWindowReady =
    persisted.capture_calendar.complete_days >=
      PAPER_TRADING_PROOF_RULES.requiredLiveDays &&
    persisted.capture_calendar.missing_days === 0 &&
    persisted.capture_calendar.partial_days === 0 &&
    persisted.proof_summary.best_live_resolved_trades >=
      PAPER_TRADING_PROOF_RULES.requiredResolvedTrades;

  const checks: AuditCheck[] = [
    check(
      "paper_only_lock",
      "Paper-only lock",
      readiness.paper_only &&
        runway.paper_only &&
        persisted.proof_summary.paper_only &&
        !readiness.real_money_execution_allowed &&
        !runway.real_money_execution_allowed &&
        !persisted.proof_summary.real_money_execution_allowed
        ? "pass"
        : "blocked",
      persisted.proof_summary.real_money_execution_allowed
        ? "execution enabled"
        : "execution disabled",
      "execution disabled everywhere",
      "The audit must never pass if any surface allows real-money execution."
    ),
    check(
      "live_data_source",
      "Live data source",
      snapshot.source === "live" ? "pass" : "unavailable",
      snapshot.source,
      "live",
      "Demo-sourced analytics cannot support capital review."
    ),
    check(
      "persisted_archive",
      "Persisted proof archive",
      persisted.status === "available" ? "pass" : "unavailable",
      persisted.status,
      "available",
      persisted.message
    ),
    check(
      "capture_freshness",
      "Capture freshness",
      persisted.capture_health.status === "fresh"
        ? "pass"
        : persisted.capture_health.status === "waiting_first_capture"
          ? "collecting"
          : persisted.capture_health.status === "stale"
            ? "blocked"
            : "unavailable",
      persisted.capture_health.status_label,
      "fresh",
      persisted.capture_health.message
    ),
    check(
      "registry_sync",
      "Strategy registry sync",
      registrySync.status === "synced"
        ? "pass"
        : registrySync.status === "pending_capture"
          ? "collecting"
          : "unavailable",
      `${registrySync.persisted_latest_live_strategy_count}/${registrySync.current_live_strategy_count} live`,
      "current live registry captured",
      registrySync.message
    ),
    check(
      "resolution_hygiene",
      "Resolution hygiene",
      snapshot.resolution_watch.overdue_live_signals > 0 ? "blocked" : "pass",
      `${snapshot.resolution_watch.overdue_live_signals} overdue / ${snapshot.resolution_watch.open_live_signals} open`,
      "0 overdue live paper markets",
      "Open EV is not realized profit; overdue markets must be resolved or investigated."
    ),
    check(
      "capture_window",
      "30-day capture window",
      persisted.capture_calendar.status === "unavailable"
        ? "unavailable"
        : persisted.capture_calendar.missing_days > 0 ||
            persisted.capture_calendar.partial_days > 0
          ? "blocked"
          : persisted.capture_calendar.complete_days >=
              PAPER_TRADING_PROOF_RULES.requiredLiveDays
            ? "pass"
            : "collecting",
      `${persisted.capture_calendar.complete_days}/${PAPER_TRADING_PROOF_RULES.requiredLiveDays} complete days`,
      `${PAPER_TRADING_PROOF_RULES.requiredLiveDays} complete days, 0 missing`,
      `${persisted.capture_calendar.missing_days} missing, ${persisted.capture_calendar.partial_days} partial.`
    ),
    check(
      "resolved_live_trades",
      "Resolved live trades",
      persisted.proof_summary.status === "unavailable"
        ? "unavailable"
        : persisted.proof_summary.best_live_resolved_trades >=
            PAPER_TRADING_PROOF_RULES.requiredResolvedTrades
          ? "pass"
          : "collecting",
      `${persisted.proof_summary.best_live_resolved_trades}/${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades}`,
      `${PAPER_TRADING_PROOF_RULES.requiredResolvedTrades} resolved live paper trades`,
      persisted.proof_summary.best_live_strategy_label
        ? `Best live rollup: ${persisted.proof_summary.best_live_strategy_label}.`
        : "No live rollup is available yet."
    ),
    check(
      "window_pnl",
      "Positive window P&L",
      !evidenceWindowReady
        ? "collecting"
        : persisted.proof_summary.best_live_window_pnl_usd >=
              PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd
          ? "pass"
          : "blocked",
      money(persisted.proof_summary.best_live_window_pnl_usd),
      `>= ${money(PAPER_TRADING_PROOF_RULES.minResolvedNetPnlUsd)}`,
      "Judged only after enough captured days and resolved live trades exist."
    ),
    check(
      "window_roi",
      "Positive window ROI",
      !evidenceWindowReady
        ? "collecting"
        : persisted.proof_summary.best_live_window_roi_on_stake >
              PAPER_TRADING_PROOF_RULES.minRoiOnStake
          ? "pass"
          : "blocked",
      `${(persisted.proof_summary.best_live_window_roi_on_stake * 100).toFixed(1)}%`,
      `> ${(PAPER_TRADING_PROOF_RULES.minRoiOnStake * 100).toFixed(1)}%`,
      "Judged only after the proof window is complete."
    ),
    check(
      "drawdown",
      "Drawdown limit",
      !evidenceWindowReady
        ? "collecting"
        : persisted.proof_summary.best_live_blockers.some((blocker) =>
              blocker.toLowerCase().includes("drawdown")
            )
          ? "blocked"
          : "pass",
      "tracked in rollups",
      `<= ${money(PAPER_TRADING_PROOF_RULES.maxDrawdownUsd)}`,
      "Drawdown blockers come from the durable proof gate."
    ),
    check(
      "capital_review_boundary",
      "Capital review boundary",
      readiness.ready_for_capital_review &&
        persisted.proof_summary.capital_review_status === "reviewable"
        ? "pass"
        : persisted.proof_summary.capital_review_status === "unavailable"
          ? "unavailable"
          : "collecting",
      persisted.proof_summary.capital_review_status_label,
      "reviewable candidate, execution still disabled",
      readiness.next_required_action
    ),
  ];
  const readinessCheck = check(
    "readiness_contract",
    "Readiness contract",
    readinessToAudit(readiness.status),
    readiness.status_label,
    "Ready for review",
    readiness.next_required_action
  );
  checks.push(readinessCheck);

  const verdict = verdictFromChecks(checks);
  const failedChecks = checks.filter((item) => item.status !== "pass");
  const report = {
    generated_at: new Date().toISOString(),
    verdict,
    verdict_label: statusLabel(verdict),
    ready_for_capital_review: verdict === "pass",
    exit_code: verdict === "pass" || options.soft ? 0 : 1,
    loaded_env_files: loadedEnvFiles,
    source: snapshot.source,
    controls,
    proof_rules: PAPER_TRADING_PROOF_RULES,
    summary: {
      live_strategy_count: persisted.proof_summary.live_strategy_count,
      best_live_strategy_label: persisted.proof_summary.best_live_strategy_label,
      captured_days: persisted.proof_summary.best_live_captured_days,
      resolved_live_trades: persisted.proof_summary.best_live_resolved_trades,
      window_pnl_usd: persisted.proof_summary.best_live_window_pnl_usd,
      window_roi_on_stake: persisted.proof_summary.best_live_window_roi_on_stake,
      open_live_signals: snapshot.resolution_watch.open_live_signals,
      overdue_live_signals: snapshot.resolution_watch.overdue_live_signals,
      earliest_capital_review_at: runway.earliest_capital_review_at,
    },
    readiness,
    runway,
    failed_checks: failedChecks.map((item) => item.id),
    checks,
  };

  emit(options.json, report);
  if (report.exit_code !== 0) {
    process.exitCode = report.exit_code;
  }
}

function emit(_json: boolean, value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
