import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

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

type CliOptions = {
  write: boolean;
  json: boolean;
  allowDemoWrite: boolean;
  envFiles: string[];
  rowsOutput: string | null;
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
    const withoutExport = line.startsWith("export ")
      ? line.slice(7).trim()
      : line;
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
  let write = false;
  let json = false;
  let allowDemoWrite = false;
  let rowsOutput: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, inlineValue] = arg.split("=", 2);
    const nextValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      i += 1;
      return argv[i] ?? "";
    };

    if (arg === "--write") {
      write = true;
    } else if (arg === "--dry-run") {
      write = false;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--allow-demo-write") {
      allowDemoWrite = true;
    } else if (flag === "--env") {
      envFiles.push(nextValue());
    } else if (flag === "--rows-output") {
      rowsOutput = nextValue();
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

  return { write, json, allowDemoWrite, envFiles, rowsOutput, params };
}

function printHelp() {
  console.log(`Eivra paper-trading snapshot capture

Dry run:
  npm run paper:snapshot

Write one persisted proof snapshot:
  npm run paper:snapshot -- --write

Options:
  --write                    Insert rows into Supabase using SUPABASE_SERVICE_ROLE_KEY.
  --dry-run                  Build rows and print a summary without inserting. Default.
  --json                     Print machine-readable JSON.
  --env <file>               Load an additional env file before importing app code.
  --rows-output <file>       Write full snapshot rows JSON for archival evidence.
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

function summarizeRows(rows: Array<Record<string, unknown>>) {
  const liveRows = rows.filter((row) => row.sample === "live_only");
  const controlRows = rows.filter((row) => row.sample !== "live_only");
  const selectedRows = rows.filter(
    (row) => row.strategy_id === "selected-query",
  );
  const openExposureUsd = rows.reduce(
    (sum, row) => sum + Number(row.open_exposure_usd ?? 0),
    0,
  );
  const openExpectedPnlUsd = rows.reduce(
    (sum, row) => sum + Number(row.open_expected_pnl_usd ?? 0),
    0,
  );

  return {
    row_count: rows.length,
    live_row_count: liveRows.length,
    control_row_count: controlRows.length,
    selected_query_row_count: selectedRows.length,
    open_exposure_usd: Math.round(openExposureUsd * 100) / 100,
    open_expected_pnl_usd: Math.round(openExpectedPnlUsd * 100) / 100,
    strategy_ids: rows.map((row) => String(row.strategy_id)).sort(),
  };
}

function writeRowsArtifact(
  path: string,
  value: Record<string, unknown>,
): string {
  const fullPath = resolve(process.cwd(), path);
  writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return fullPath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const loadedEnvFiles = options.envFiles.filter((file) => loadEnvFile(file));
  const { getTradingSnapshot, parseTradingControls } =
    await import("../src/lib/trading");
  const {
    buildPaperTradingSnapshotRows,
    loadPaperTradingSnapshotHistory,
    persistPaperTradingSnapshot,
  } = await import("../src/lib/trading-snapshots");
  const { buildPaperTradingLiquidityReview } =
    await import("../src/lib/trading-liquidity-review");

  const controls = parseTradingControls(options.params);
  const snapshot = await getTradingSnapshot(controls);
  const liquidityReview = buildPaperTradingLiquidityReview(
    snapshot,
    snapshot.generated_at,
  );
  const rows = buildPaperTradingSnapshotRows(snapshot);
  const rowSummary = summarizeRows(rows as Array<Record<string, unknown>>);
  const rowsArtifact = {
    source: snapshot.source,
    generated_at: snapshot.generated_at,
    controls,
    strategy_registry: snapshot.strategy_registry,
    would_trade_today: snapshot.would_trade_today,
    market_exposure_digest: snapshot.market_exposure_digest,
    agent_edge_watchlist: snapshot.agent_edge_watchlist,
    agent_edge_runway: snapshot.agent_edge_runway,
    agent_edge_trade_ledger: snapshot.agent_edge_trade_ledger,
    agent_edge_attribution: snapshot.agent_edge_attribution,
    liquidity_review: liquidityReview,
    loaded_env_files: loadedEnvFiles,
    snapshot_date: snapshot.generated_at.slice(0, 10),
    schema_version: "1",
    row_count: rows.length,
    rows,
  };
  const rowsArtifactPath = options.rowsOutput
    ? writeRowsArtifact(options.rowsOutput, rowsArtifact)
    : null;
  const baseSummary = {
    dry_run: !options.write,
    source: snapshot.source,
    generated_at: snapshot.generated_at,
    controls,
    strategy_registry: snapshot.strategy_registry,
    would_trade_today: snapshot.would_trade_today,
    market_exposure_digest: snapshot.market_exposure_digest,
    agent_edge_watchlist: snapshot.agent_edge_watchlist,
    agent_edge_runway: snapshot.agent_edge_runway,
    agent_edge_trade_ledger: snapshot.agent_edge_trade_ledger,
    agent_edge_attribution: snapshot.agent_edge_attribution,
    liquidity_review: liquidityReview,
    loaded_env_files: loadedEnvFiles,
    snapshot_date: snapshot.generated_at.slice(0, 10),
    selected_strategy: {
      id: snapshot.selected_strategy.id,
      label: snapshot.selected_strategy.label,
      proof_status: snapshot.selected_strategy.proof_gate.status,
      resolved_trades: snapshot.selected_strategy.resolved_trades,
      open_signals: snapshot.selected_strategy.open_signals,
      open_exposure_usd: snapshot.selected_strategy.open_exposure_usd,
      open_expected_pnl_usd: snapshot.selected_strategy.open_expected_pnl_usd,
    },
    resolution_watch: snapshot.resolution_watch,
    rows: rowSummary,
    rows_artifact_path: rowsArtifactPath,
  };

  if (!options.write) {
    emit(options.json, {
      ...baseSummary,
      message: "Dry run only. Re-run with --write to insert snapshot rows.",
    });
    return;
  }

  if (snapshot.source !== "live" && !options.allowDemoWrite) {
    throw new Error(
      `Refusing to persist ${snapshot.source} snapshot rows. Set Supabase env vars for live data or pass --allow-demo-write explicitly.`,
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for --write.");
  }

  const result = await persistPaperTradingSnapshot(snapshot);
  const history = await loadPaperTradingSnapshotHistory(1000);
  emit(options.json, {
    ...baseSummary,
    result,
    persistence: {
      status: history.status,
      latest_captured_at: history.latest_captured_at,
      capture_health: history.capture_health,
      capture_calendar: history.capture_calendar,
      proof_summary: history.proof_summary,
      proof_readiness: history.proof_readiness,
      proof_runway: history.proof_runway,
    },
  });

  if (result.status !== "written") {
    process.exitCode = 1;
  }
}

function emit(json: boolean, value: unknown) {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
