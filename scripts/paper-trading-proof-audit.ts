import { existsSync, readFileSync } from "fs";
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const loadedEnvFiles = options.envFiles.filter((file) => loadEnvFile(file));
  const { getTradingSnapshot, parseTradingControls } =
    await import("../src/lib/trading");
  const { buildPaperTradingProofAudit } =
    await import("../src/lib/trading-proof-audit");
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

  const controls = parseTradingControls(options.params);
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
  });
  const report = buildPaperTradingProofAudit({
    snapshot,
    persisted,
    agentEdgeProof,
    publishedArtifactProof,
    registrySync,
    readiness,
    runway,
    controls,
    loadedEnvFiles,
    soft: options.soft,
  });

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
