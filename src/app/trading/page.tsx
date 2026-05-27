import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Tooltip } from "@/components/Tooltip";
import { AGENTS, HUE_TO_BG, HUE_TO_TEXT } from "@/lib/agents";
import { buildPaperTradingAgentEdgeDossier } from "@/lib/trading-agent-edge-dossier";
import { buildPaperTradingAgentEdgeEvidenceTimeline } from "@/lib/trading-agent-edge-evidence";
import { buildPaperTradingAgentEdgeProof } from "@/lib/trading-agent-edge-proof";
import {
  buildPaperTradingArtifactHistory,
  buildPaperTradingEvidenceSla,
  buildPaperTradingWriteReadiness,
  loadPaperTradingArtifactWorkflowStatus,
  loadPublishedPaperTradingArtifactProof,
} from "@/lib/trading-artifacts";
import { buildPaperTradingLabStatus } from "@/lib/trading-lab-status";
import { buildResolutionCatchupPreview } from "@/lib/trading-resolution-catchup";
import {
  buildResolutionReviewQueue,
  enrichResolutionReviewQueueWithProviderResolution,
} from "@/lib/trading-resolution-review";
import { buildPaperTradingLiquidityReview } from "@/lib/trading-liquidity-review";
import { buildPaperTradingProofAudit } from "@/lib/trading-proof-audit";
import { dollars, int, pct, prob, relativeTime, signed } from "@/lib/format";
import {
  TRADING_CATEGORY_OPTIONS,
  TRADING_MIN_EDGE_OPTIONS,
  TRADING_SAMPLE_OPTIONS,
  TRADING_SIDE_OPTIONS,
  TRADING_STAKE_MODE_OPTIONS,
  getTradingSnapshot,
  parseTradingControls,
  tradingControlsToQuery,
} from "@/lib/trading";
import {
  buildPaperTradingCapitalReviewPacket,
  buildPaperTradingProofEvidenceSources,
  buildPaperTradingProofReadiness,
  buildPaperTradingProofRunway,
  buildPaperTradingStrategyRegistrySync,
  loadPaperTradingSnapshotHistory,
} from "@/lib/trading-snapshots";

export const revalidate = 120;

export const metadata = {
  title: "Paper trading - Eivra",
  description:
    "Paper-only prediction-market trading analytics for Eivra agents. Converts forecast edge into bounded simulated tickets and tracks P&L.",
  openGraph: {
    title: "Eivra Paper Trading - tradability, not just accuracy",
    description:
      "Which AI forecaster is actually tradable? Eivra turns agent edges into bounded paper tickets and scores the P&L.",
  },
};

function pnlClass(n: number) {
  if (n > 0) return "text-positive";
  if (n < 0) return "text-rose-400";
  return "text-text-muted";
}

function sideClass(side: "YES" | "NO") {
  return side === "YES"
    ? "bg-positive/10 text-positive"
    : "bg-rose-400/10 text-rose-400";
}

function proofStatusClass(status: string) {
  if (status === "candidate") return "bg-positive/10 text-positive";
  if (status === "not_qualified" || status === "stale") {
    return "bg-rose-400/10 text-rose-400";
  }
  if (status === "control_only") return "bg-text-muted/10 text-text-muted";
  return "bg-warn/10 text-warn";
}

function proofSummaryClass(status: string) {
  if (status === "candidate" || status === "reviewable") return "text-positive";
  if (status === "not_qualified" || status === "stale") return "text-rose-400";
  if (status === "collecting" || status === "blocked") return "text-warn";
  return "text-text-muted";
}

function proofQualityClass(grade: string) {
  if (grade === "reviewable") return "text-positive";
  if (grade === "developing") return "text-accent";
  if (grade === "thin") return "text-warn";
  return "text-text-muted";
}

function persistenceStatusClass(status: string) {
  if (status === "available") return "text-positive";
  if (status === "table_missing") return "text-warn";
  return "text-text-muted";
}

function captureHealthClass(status: string) {
  if (status === "fresh") return "text-positive";
  if (status === "stale") return "text-rose-400";
  if (status === "waiting_first_capture") return "text-warn";
  return "text-text-muted";
}

function captureCalendarClass(status: string) {
  if (status === "complete") return "text-positive";
  if (status === "partial" || status === "missing") return "text-warn";
  return "text-text-muted";
}

function captureCalendarBadgeClass(status: string) {
  if (status === "complete") return "bg-positive/10 text-positive";
  if (status === "partial" || status === "missing") return "bg-warn/10 text-warn";
  return "bg-text-muted/10 text-text-muted";
}

function registrySyncClass(status: string) {
  if (status === "synced") return "text-positive";
  if (status === "pending_capture") return "text-warn";
  return "text-text-muted";
}

function resolutionWatchClass(status: string) {
  if (status === "overdue_resolution") return "text-warn";
  if (status === "waiting_resolution") return "text-accent";
  return "text-text-muted";
}

function readinessStatusClass(status: string) {
  if (status === "pass" || status === "available" || status === "reviewable") return "bg-positive/10 text-positive";
  if (status === "blocked") return "bg-rose-400/10 text-rose-400";
  if (status === "unavailable") return "bg-text-muted/10 text-text-muted";
  return "bg-warn/10 text-warn";
}

function attributionStatusClass(status: string) {
  if (status === "diversified") return "bg-positive/10 text-positive";
  if (status === "concentrated") return "bg-warn/10 text-warn";
  if (status === "unavailable") return "bg-text-muted/10 text-text-muted";
  return "bg-accent/10 text-accent";
}

function resolutionQueueStatusClass(status: string) {
  if (status === "clear") return "bg-positive/10 text-positive";
  if (status === "blocked") return "bg-rose-400/10 text-rose-400";
  return "bg-text-muted/10 text-text-muted";
}

function resolutionCatchupStatusClass(status: string) {
  if (status === "clear") return "bg-positive/10 text-positive";
  if (status === "resolver_lag") return "bg-warn/10 text-warn";
  if (status === "error") return "bg-rose-400/10 text-rose-400";
  if (status === "provider_pending") return "bg-accent/10 text-accent";
  return "bg-text-muted/10 text-text-muted";
}

function proofRunwayStatusClass(status: string) {
  if (status === "reviewable") return "bg-positive/10 text-positive";
  if (status === "blocked") return "bg-rose-400/10 text-rose-400";
  if (status === "unavailable") return "bg-text-muted/10 text-text-muted";
  return "bg-warn/10 text-warn";
}

function agentEdgeRunwayStatusClass(status: string) {
  if (status === "sample_complete") return "bg-positive/10 text-positive";
  if (status === "sample_reachable") return "bg-accent/10 text-accent";
  if (status === "blocked") return "bg-rose-400/10 text-rose-400";
  if (status === "starved") return "bg-text-muted/10 text-text-muted";
  return "bg-warn/10 text-warn";
}

function wouldTradeStatusClass(status: string) {
  if (status === "collecting") return "bg-accent/10 text-accent";
  if (status === "blocked") return "bg-rose-400/10 text-rose-400";
  return "bg-text-muted/10 text-text-muted";
}

function marketExposureStatusClass(status: string) {
  if (status === "concentrated") return "bg-warn/10 text-warn";
  if (status === "observing") return "bg-accent/10 text-accent";
  return "bg-text-muted/10 text-text-muted";
}

function executionStressStatusClass(status: string) {
  if (status === "survives_stress") return "bg-positive/10 text-positive";
  if (status === "fragile_profit") return "bg-warn/10 text-warn";
  if (status === "loss_making") return "bg-rose-400/10 text-rose-400";
  return "bg-accent/10 text-accent";
}

function capitalReviewPacketStatusClass(status: string) {
  if (status === "reviewable_paper_candidate") {
    return "bg-positive/10 text-positive";
  }
  if (status === "not_reviewable") return "bg-warn/10 text-warn";
  return "bg-text-muted/10 text-text-muted";
}

function writeReadinessStatusClass(status: string) {
  if (status === "persisting") return "bg-positive/10 text-positive";
  if (status === "artifact_only") return "bg-warn/10 text-warn";
  return "bg-text-muted/10 text-text-muted";
}

function evidenceSlaStatusClass(status: string) {
  if (status === "on_track") return "bg-positive/10 text-positive";
  if (status === "collecting") return "bg-accent/10 text-accent";
  if (status === "degraded") return "bg-warn/10 text-warn";
  if (status === "blocked") return "bg-rose-400/10 text-rose-400";
  return "bg-text-muted/10 text-text-muted";
}

function labStatusClass(status: string) {
  if (status === "reviewable") return "bg-positive/10 text-positive";
  if (status === "collecting") return "bg-accent/10 text-accent";
  if (status === "degraded") return "bg-warn/10 text-warn";
  if (status === "blocked") return "bg-rose-400/10 text-rose-400";
  return "bg-text-muted/10 text-text-muted";
}

function operatingPlanStatusClass(status: string) {
  if (status === "reviewable") return "bg-positive/10 text-positive";
  if (status === "attention") return "bg-warn/10 text-warn";
  if (status === "blocked") return "bg-rose-400/10 text-rose-400";
  if (status === "unavailable") return "bg-text-muted/10 text-text-muted";
  return "bg-accent/10 text-accent";
}

function labCheckStatusClass(status: string) {
  if (status === "pass") return "bg-positive/10 text-positive";
  if (status === "warning") return "bg-warn/10 text-warn";
  if (status === "blocked") return "bg-rose-400/10 text-rose-400";
  if (status === "unavailable") return "bg-text-muted/10 text-text-muted";
  return "bg-accent/10 text-accent";
}

function artifactHistoryStatusClass(status: string) {
  if (status === "complete") return "bg-positive/10 text-positive";
  if (status === "collecting") return "bg-accent/10 text-accent";
  return "bg-text-muted/10 text-text-muted";
}

function proofEvidenceSourceStatusClass(status: string) {
  if (status === "active" || status === "available" || status === "reviewable") {
    return "bg-positive/10 text-positive";
  }
  if (status === "blocked") return "bg-rose-400/10 text-rose-400";
  if (status === "unavailable") return "bg-text-muted/10 text-text-muted";
  return "bg-warn/10 text-warn";
}

function shortDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function edgePoints(n: number) {
  return `${Math.round(n * 100)}pp`;
}

function dailyProfitFactor(value: number | null) {
  return value === null || !Number.isFinite(value) ? "-" : value.toFixed(2);
}

const SAMPLE_LABELS = {
  live_only: "Live only",
  all: "All",
  backfill: "Backfill",
};

const CATEGORY_LABELS = {
  all: "All",
  politics: "Politics",
  sports: "Sports",
  "ai-tech": "AI & Tech",
  crypto: "Crypto",
  other: "Other",
};

const STAKE_MODE_LABELS = {
  kelly_capped: "Kelly capped",
  flat: "Flat ticket",
};

type TradingPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function TradingPage({
  searchParams,
}: {
  searchParams: TradingPageSearchParams;
}) {
  const controls = parseTradingControls(await searchParams);
  const [snapshot, persisted, artifactWorkflow, publishedArtifactProof] =
    await Promise.all([
      getTradingSnapshot(controls),
      loadPaperTradingSnapshotHistory(1000),
      loadPaperTradingArtifactWorkflowStatus(5),
      loadPublishedPaperTradingArtifactProof(),
    ]);
  const leader = snapshot.agent_summaries[0];
  const liveResolved =
    snapshot.totals.live_resolved_trades > 0
      ? `${int(snapshot.totals.live_resolved_trades)} live`
      : "live pending";
  const livePnlPending = snapshot.totals.live_resolved_trades === 0;
  const resolutionWatch = snapshot.resolution_watch;
  const wouldTradeToday = snapshot.would_trade_today;
  const marketExposureDigest = snapshot.market_exposure_digest;
  const liveLeader = snapshot.live_agent_summaries[0];
  const liveStrategyRows = snapshot.strategy_variants.filter(
    (strategy) => strategy.sample === "live_only"
  );
  const agentEdgeRows = snapshot.agent_edge_matrix;
  const evidenceRows = snapshot.selected_daily_snapshots;
  const selectedStrategy = snapshot.selected_strategy;
  const selectedBankrollRisk = snapshot.selected_bankroll_risk;
  const selectedOpenOutcomeScenarios =
    snapshot.selected_open_outcome_scenarios;
  const selectedBestCase = selectedOpenOutcomeScenarios.scenarios.find(
    (scenario) => scenario.id === "best_case"
  );
  const selectedExpectedCase = selectedOpenOutcomeScenarios.scenarios.find(
    (scenario) => scenario.id === "model_expected"
  );
  const selectedProof = selectedStrategy.proof_gate;
  const exposureLedger = snapshot.selected_exposure_ledger;
  const skippedExposureEntries = exposureLedger.recent_entries.filter(
    (entry) => entry.status === "skipped_exposure_cap"
  );
  const skippedResolvedExposureEntries = skippedExposureEntries.filter(
    (entry) => entry.missed_pnl_usd !== null
  );
  const selectedQuery = tradingControlsToQuery(snapshot.controls);
  const jsonHref = `/api/trading.json?${selectedQuery}`;
  const snapshotJsonHref = "/api/trading-snapshots?limit=1000";
  const auditJsonHref = `/api/trading-proof-audit?${selectedQuery}`;
  const artifactJsonHref = "/api/trading-artifacts";
  const strategyRegistryJsonHref =
    `/api/trading-strategy-registry?${selectedQuery}`;
  const wouldTradeTodayJsonHref =
    `/api/trading-would-trade-today?${selectedQuery}`;
  const marketExposureJsonHref =
    `/api/trading-market-exposure?${selectedQuery}`;
  const resolutionCatchupJsonHref =
    `/api/trading-resolution-catchup?${selectedQuery}`;
  const publishedProofHref = "/paper-trading/latest-artifact-proof.json";
  const edgeOptions = Array.from(
    new Set([...TRADING_MIN_EDGE_OPTIONS, snapshot.controls.min_edge])
  ).sort((a, b) => a - b);
  const selectedOpenSignals = snapshot.selected_open_signals;
  const latestPersistedSnapshots = persisted.snapshots.slice(0, 8);
  const persistedRollups = persisted.strategy_rollups.slice(0, 8);
  const persistedAgentEdgeProofRows = persisted.agent_edge_proof_matrix;
  const captureHealth = persisted.capture_health;
  const captureCalendar = persisted.capture_calendar;
  const captureCalendarDays = captureCalendar.days.slice().reverse().slice(0, 30);
  const proofSummary = persisted.proof_summary;
  const registrySync = buildPaperTradingStrategyRegistrySync(
    snapshot.strategy_variants,
    persisted.snapshots
  );
  const proofReadiness = buildPaperTradingProofReadiness({
    persistenceStatus: persisted.status,
    proofSummary,
    captureHealth,
    captureCalendar,
    registrySync,
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
  });
  const writeReadiness = buildPaperTradingWriteReadiness({
    artifactWorkflow,
    publishedArtifactProof,
  });
  const artifactHistory = buildPaperTradingArtifactHistory({
    publishedArtifactProof,
  });
  const evidenceSla = buildPaperTradingEvidenceSla({
    persistence: persisted,
    publishedArtifactProof,
    writeReadiness,
    registrySync,
    resolutionWatch,
  });
  const agentEdgeProof = buildPaperTradingAgentEdgeProof({
    persistedRows: persisted.agent_edge_proof_matrix,
    publishedArtifactProof,
  });
  const agentEdgeEvidenceTimeline = buildPaperTradingAgentEdgeEvidenceTimeline({
    persistence: persisted,
    agentEdgeProof,
    publishedArtifactProof,
    selectedAgentId: snapshot.controls.agent_id,
    selectedMinEdge: snapshot.controls.min_edge,
  });
  const agentEdgeDossier = buildPaperTradingAgentEdgeDossier({
    agentEdgeProof,
    evidenceTimeline: agentEdgeEvidenceTimeline,
    tradeLedger: snapshot.agent_edge_trade_ledger,
    runway: snapshot.agent_edge_runway,
    watchlist: snapshot.agent_edge_watchlist,
    selectedAgentId: snapshot.controls.agent_id,
    selectedMinEdge: snapshot.controls.min_edge,
  });
  const liquidityReview = buildPaperTradingLiquidityReview(snapshot);
  const proofAudit = buildPaperTradingProofAudit({
    snapshot,
    persisted,
    agentEdgeProof,
    publishedArtifactProof,
    registrySync,
    readiness: proofReadiness,
    runway: proofRunway,
    controls: snapshot.controls,
  });
  const failedAuditChecks = proofAudit.checks.filter(
    (item) => item.status !== "pass",
  );
  const profitabilityGuard = agentEdgeProof.profitability_guard;
  const durableCapacityLeakage = agentEdgeProof.capacity_leakage;
  const agentEdgeWatchlist = snapshot.agent_edge_watchlist;
  const agentEdgeRunway = snapshot.agent_edge_runway;
  const agentEdgeTradeLedger = snapshot.agent_edge_trade_ledger;
  const agentEdgeAttribution = snapshot.agent_edge_attribution;
  const agentEdgeLedgerByRule = new Map(
    agentEdgeTradeLedger.rules.map((rule) => [
      `${rule.agent_id}-${rule.min_edge}`,
      rule,
    ]),
  );
  const agentEdgeRunwayByRule = new Map(
    agentEdgeRunway.rules.map((rule) => [
      `${rule.agent_id}-${rule.min_edge}`,
      rule,
    ]),
  );
  const proofEvidenceSources = buildPaperTradingProofEvidenceSources({
    persistence: persisted,
    proofReadiness,
    proofRunway,
    resolutionWatch,
  });
  const resolutionReviewQueue =
    await enrichResolutionReviewQueueWithProviderResolution(
      buildResolutionReviewQueue({
        resolutionWatch,
        publishedArtifactProof,
      }),
    );
  const resolutionCatchupPreview = await buildResolutionCatchupPreview({
    controls: snapshot.controls,
  });
  const labStatus = buildPaperTradingLabStatus({
    snapshot,
    registrySync,
    proofReadiness,
    proofRunway,
    capitalReviewPacket,
    writeReadiness,
    artifactHistory,
    evidenceSla,
    agentEdgeProof,
    resolutionCatchupPreview,
  });
  const operatingPlan = labStatus.operating_plan;
  const selectedProofLag =
    labStatus.tradability.selected_agent_edge_proof_lag;
  const latestArtifactRun = artifactWorkflow.latest_successful_artifact_run;
  const latestWorkflowRun = artifactWorkflow.latest_run;
  const publishedAudit = publishedArtifactProof.artifact_audit;
  const publishedReadiness = publishedArtifactProof.proof_readiness;
  const publishedSnapshotDate =
    typeof publishedAudit?.latest_snapshot_date === "string"
      ? publishedAudit.latest_snapshot_date
      : "-";
  const publishedLiveRows =
    typeof publishedAudit?.live_row_count === "number"
      ? int(publishedAudit.live_row_count)
      : "-";
  const publishedReadinessStatus =
    typeof publishedReadiness?.status === "string"
      ? publishedReadiness.status
      : "unavailable";
  const resolutionReviewJsonHref = `/api/trading-resolution-review?${selectedQuery}`;
  const capitalReviewJsonHref = `/api/trading-capital-review?${selectedQuery}`;
  const writeReadinessJsonHref = "/api/trading-write-readiness";
  const evidenceSlaJsonHref = `/api/trading-evidence-sla?${selectedQuery}`;
  const labStatusJsonHref = `/api/trading-lab-status?${selectedQuery}`;
  const agentEdgeProofJsonHref = `/api/trading-agent-edge-proof?${selectedQuery}`;
  const agentEdgeEvidenceJsonHref = `/api/trading-agent-edge-evidence?${selectedQuery}`;
  const agentEdgeDossierJsonHref = `/api/trading-agent-edge-dossier?${selectedQuery}`;
  const agentEdgeAttributionJsonHref = `/api/trading-agent-edge-attribution?${selectedQuery}`;
  const liquidityReviewJsonHref = `/api/trading-liquidity-review?${selectedQuery}`;
  const agentEdgeTradesJsonHref = `/api/trading-agent-edge-trades?${selectedQuery}`;
  const agentEdgeWatchlistJsonHref = `/api/trading-agent-edge-watchlist?${selectedQuery}`;
  const agentEdgeRunwayJsonHref = `/api/trading-agent-edge-runway?${selectedQuery}`;
  const liveDailyEvidenceRows = snapshot.strategy_daily_series
    .filter((series) => series.sample === "live_only")
    .map((series) => {
      const strategy = snapshot.strategy_variants.find(
        (variant) => variant.id === series.strategy_id
      );
      const lockedTrades = series.days.reduce(
        (sum, day) => sum + day.locked_trades,
        0
      );
      const resolvedTrades = series.days.reduce(
        (sum, day) => sum + day.resolved_trades,
        0
      );
      const latestDay = series.days[0] ?? null;
      const avgDailyPnl =
        series.days.length > 0
          ? series.days.reduce((sum, day) => sum + day.net_pnl_usd, 0) /
            series.days.length
          : 0;

      return {
        series,
        strategy,
        lockedTrades,
        resolvedTrades,
        latestDay,
        avgDailyPnl,
      };
    });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-12 flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3 mono text-xs text-text-muted uppercase tracking-wider">
            <span className="live-dot" aria-hidden="true" />
            paper trader - bounded tickets - no execution
          </div>
          <h1 className="heading text-4xl sm:text-5xl text-text-primary tracking-tight">
            Accuracy is not enough. <span className="text-accent">Tradability</span> is the test.
          </h1>
          <p className="text-text-secondary text-base leading-relaxed max-w-3xl">
            Eivra now converts agent probability edges into paper-only prediction-market tickets.
            Each ticket has a fixed maximum loss, a market-entry price, and a resolved P&amp;L
            when the market closes.
          </p>
          <div className="flex flex-wrap items-center gap-3 mono text-xs text-text-muted">
            <span className="px-2 py-1 rounded bg-surface-elevated border border-border-subtle">
              source: <span className="text-text-primary">{snapshot.source}</span>
            </span>
            <span className="px-2 py-1 rounded bg-surface-elevated border border-border-subtle">
              selected bankroll:{" "}
              <span className="text-text-primary">
                {dollars(snapshot.controls.bankroll_usd, 0)}
              </span>
            </span>
            {snapshot.controls.bankroll_usd !== snapshot.config.bankrollUsd && (
              <span className="px-2 py-1 rounded bg-surface-elevated border border-border-subtle">
                proof default:{" "}
                <span className="text-text-primary">
                  {dollars(snapshot.config.bankrollUsd, 0)}
                </span>
              </span>
            )}
            <span className="px-2 py-1 rounded bg-surface-elevated border border-border-subtle">
              edge gate:{" "}
              <span className="text-text-primary">
                {pct(snapshot.config.minEdge, 0)}
              </span>
            </span>
            <span className="px-2 py-1 rounded bg-surface-elevated border border-border-subtle">
              max ticket loss:{" "}
              <span className="text-text-primary">
                {dollars(snapshot.config.maxStakeUsd, 0)}
              </span>
            </span>
            <span className="px-2 py-1 rounded bg-surface-elevated border border-border-subtle">
              {liveResolved}
            </span>
          </div>
        </section>

        {livePnlPending && (
          <section className="panel px-5 py-4 border-warn/30 bg-warn/5">
            <div className="mono text-[10px] uppercase tracking-wider text-warn mb-2">
              live P&amp;L pending
            </div>
            <p className="text-sm text-text-secondary leading-relaxed max-w-4xl">
              The resolved trading numbers below are historical/backfill sample only.
              Live-mode tickets are visible in the open-ticket feed and become
              meaningful after their markets resolve.
            </p>
          </section>
        )}

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="heading text-base text-text-primary">
                Would trade today
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Live-only paper watchlist ranked by current strategy rules.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={wouldTradeTodayJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                json feed
              </Link>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${wouldTradeStatusClass(
                  wouldTradeToday.status
                )}`}
              >
                {wouldTradeToday.status_label}
              </span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Unique live
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(wouldTradeToday.unique_open_signals)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Tradable
              </div>
              <div className="heading text-2xl text-positive mt-1">
                {int(wouldTradeToday.unique_tradable_signals)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Global review
              </div>
              <div
                className={`heading text-2xl mt-1 ${
                  wouldTradeToday.global_review_required_live_signals > 0
                    ? "text-rose-400"
                    : "text-text-primary"
                }`}
              >
                {int(wouldTradeToday.global_review_required_live_signals)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Tradable risk
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {dollars(wouldTradeToday.unique_tradable_open_exposure_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Tradable EV
              </div>
              <div
                className={`heading text-2xl mt-1 ${pnlClass(
                  wouldTradeToday.unique_tradable_open_expected_pnl_usd
                )}`}
              >
                {dollars(
                  wouldTradeToday.unique_tradable_open_expected_pnl_usd,
                  0
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-3 flex flex-wrap gap-x-4 gap-y-2 mono text-[11px] text-text-muted">
            <span>{wouldTradeToday.message}</span>
            <span className="text-text-primary">
              execution: {wouldTradeToday.execution_recommendation.replaceAll("_", " ")}
            </span>
            <span>real money: disabled</span>
            <span>
              watchlist review: {int(wouldTradeToday.unique_review_required_signals)}
            </span>
            <span>
              selected strategy: {wouldTradeToday.selected_strategy_id.replaceAll("_", " ")}
            </span>
          </div>
          {wouldTradeToday.top_strategies.length === 0 ? (
            <div className="text-sm text-text-muted mono">
              [no live paper strategy has an open candidate]
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Would trade today">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Strategy</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Proof</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Tradable</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Review</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Risk</th>
                    <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">EV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {wouldTradeToday.top_strategies.slice(0, 6).map((strategy) => (
                    <tr key={strategy.strategy_id}>
                      <td className="py-3 pr-3">
                        <div className="text-sm text-text-primary">
                          {strategy.rank}. {strategy.strategy_label}
                        </div>
                        <div className="mono text-[10px] text-text-muted uppercase tracking-wider">
                          edge {pct(strategy.min_edge, 0)} / avg live edge{" "}
                          {pct(strategy.avg_edge, 1)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofStatusClass(
                            strategy.proof_status
                          )}`}
                        >
                          {strategy.proof_status_label}
                        </span>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(strategy.tradable_signals)}
                      </td>
                      <td
                        className={`py-3 px-3 mono text-right ${
                          strategy.review_required_signals > 0
                            ? "text-rose-400"
                            : "text-text-secondary"
                        }`}
                      >
                        {int(strategy.review_required_signals)}
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {dollars(strategy.tradable_open_exposure_usd, 0)}
                      </td>
                      <td
                        className={`py-3 pl-3 mono text-right ${pnlClass(
                          strategy.tradable_open_expected_pnl_usd
                        )}`}
                      >
                        {dollars(strategy.tradable_open_expected_pnl_usd, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="heading text-base text-text-primary">
                Market exposure digest
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Groups open live paper tickets so repeated agent exposure is visible.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={marketExposureJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                json feed
              </Link>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${marketExposureStatusClass(
                  marketExposureDigest.status
                )}`}
              >
                {marketExposureDigest.status_label}
              </span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Markets
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(marketExposureDigest.unique_open_markets)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Signals
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(marketExposureDigest.open_live_signals)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Multi-agent
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(marketExposureDigest.multi_agent_markets)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Top share
              </div>
              <div
                className={`heading text-2xl mt-1 ${
                  marketExposureDigest.status === "concentrated"
                    ? "text-warn"
                    : "text-text-primary"
                }`}
              >
                {pct(marketExposureDigest.top_market_exposure_share, 1)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Open risk
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {dollars(marketExposureDigest.total_open_exposure_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Open EV
              </div>
              <div
                className={`heading text-2xl mt-1 ${pnlClass(
                  marketExposureDigest.total_open_expected_pnl_usd
                )}`}
              >
                {dollars(marketExposureDigest.total_open_expected_pnl_usd, 0)}
              </div>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-3 flex flex-wrap gap-x-4 gap-y-2 mono text-[11px] text-text-muted">
            <span>{marketExposureDigest.message}</span>
            <span>threshold {pct(marketExposureDigest.concentration_threshold, 0)}</span>
            <span>review only</span>
            <span>real money: disabled</span>
          </div>
          {marketExposureDigest.top_markets.length === 0 ? (
            <div className="text-sm text-text-muted mono">
              [no open live paper markets]
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Market exposure digest">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Market</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Signals</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Agents</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Risk</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Share</th>
                    <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">EV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {marketExposureDigest.top_markets.slice(0, 8).map((market) => (
                    <tr key={market.market_id}>
                      <td className="py-3 pr-3">
                        <Link
                          href={`/markets/${market.market_id}`}
                          className="text-sm text-text-primary hover:text-accent transition-colors line-clamp-2"
                        >
                          {market.market_question}
                        </Link>
                        <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                          {market.market_source} / {market.market_category} /{" "}
                          {market.sides.join("+")}
                        </div>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(market.signal_count)}
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(market.agent_count)}
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {dollars(market.open_exposure_usd, 0)}
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {pct(market.exposure_share, 1)}
                      </td>
                      <td
                        className={`py-3 pl-3 mono text-right ${pnlClass(
                          market.open_expected_pnl_usd
                        )}`}
                      >
                        {dollars(market.open_expected_pnl_usd, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="heading text-base text-text-primary">
              Configurable paper strategy
            </h2>
            <span className="mono text-[10px] uppercase tracking-wider text-accent">
              analytics only
            </span>
          </div>
          <form action="/trading" className="grid md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Sample
              </span>
              <select
                name="sample"
                defaultValue={snapshot.controls.sample}
                className="paper-control"
              >
                {TRADING_SAMPLE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {SAMPLE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Agent
              </span>
              <select
                name="agent"
                defaultValue={snapshot.controls.agent_id ?? "all"}
                className="paper-control"
              >
                <option value="all">All agents</option>
                {AGENTS.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Category
              </span>
              <select
                name="category"
                defaultValue={snapshot.controls.category ?? "all"}
                className="paper-control"
              >
                {TRADING_CATEGORY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Side
              </span>
              <select
                name="side"
                defaultValue={snapshot.controls.side ?? "all"}
                className="paper-control"
              >
                {TRADING_SIDE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "Both" : value}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Edge gate
              </span>
              <select
                name="min_edge"
                defaultValue={String(snapshot.controls.min_edge)}
                className="paper-control"
              >
                {edgeOptions.map((value) => (
                  <option key={value} value={value}>
                    {pct(value, 0)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Bankroll
              </span>
              <input
                name="bankroll_usd"
                type="number"
                min={100}
                max={50000}
                step="100"
                defaultValue={snapshot.controls.bankroll_usd}
                className="paper-control"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Stake mode
              </span>
              <select
                name="stake_mode"
                defaultValue={snapshot.controls.stake_mode}
                className="paper-control"
              >
                {TRADING_STAKE_MODE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {STAKE_MODE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Flat ticket
              </span>
              <input
                name="ticket_usd"
                type="number"
                min={snapshot.config.minStakeUsd}
                max={snapshot.config.maxStakeUsd}
                step="5"
                defaultValue={snapshot.controls.flat_stake_usd}
                className="paper-control"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Kelly cap
              </span>
              <input
                name="max_stake_usd"
                type="number"
                min={snapshot.config.minStakeUsd}
                max={snapshot.config.maxStakeUsd}
                step="5"
                defaultValue={snapshot.controls.max_stake_usd}
                className="paper-control"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Exposure cap
              </span>
              <input
                name="max_open_exposure_usd"
                type="number"
                min={snapshot.config.minStakeUsd}
                max={snapshot.controls.bankroll_usd}
                step="50"
                defaultValue={snapshot.controls.max_open_exposure_usd}
                className="paper-control"
              />
            </label>
            <div className="md:col-span-4 flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                className="mono text-[11px] uppercase tracking-wider rounded bg-accent/10 border border-accent/30 text-accent px-3 py-2 hover:bg-accent/15 transition-colors"
              >
                Run config
              </button>
              <Link
                href="/trading"
                className="mono text-[11px] uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors"
              >
                Reset
              </Link>
              <Link
                href={jsonHref}
                className="mono text-[11px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                JSON feed
              </Link>
            </div>
          </form>
          <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3 border-t border-border-subtle pt-4">
            <div className="lg:col-span-2">
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Selected strategy
              </div>
              <div className="text-sm text-text-primary mt-1">
                {selectedStrategy.label}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Resolved
              </div>
              <div className="heading text-xl text-text-primary mt-1">
                {int(selectedStrategy.resolved_trades)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                P&amp;L
              </div>
              <div className={`heading text-xl mt-1 ${pnlClass(selectedStrategy.net_pnl_usd)}`}>
                {dollars(selectedStrategy.net_pnl_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Open EV
              </div>
              <div className={`heading text-xl mt-1 ${pnlClass(selectedStrategy.open_expected_pnl_usd)}`}>
                {dollars(selectedStrategy.open_expected_pnl_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Open loss
              </div>
              <div className={`heading text-xl mt-1 ${pnlClass(selectedBankrollRisk.worst_case_open_loss_usd)}`}>
                {dollars(selectedBankrollRisk.worst_case_open_loss_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Worst bankroll
              </div>
              <div className="heading text-xl text-text-primary mt-1">
                {dollars(selectedBankrollRisk.bankroll_after_worst_case_usd, 0)}
              </div>
            </div>
          </div>
          <div className="mono text-[11px] text-text-muted border-t border-border-subtle pt-3">
            Open exposure is {pct(selectedBankrollRisk.open_exposure_pct_of_bankroll, 1)} of selected bankroll;
            remaining paper capacity is {dollars(selectedBankrollRisk.remaining_open_capacity_usd, 0)}.
            This is analytics only; real-money execution remains disabled.
          </div>
          <div className="grid sm:grid-cols-3 gap-3 border-t border-border-subtle pt-4">
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Break-even open wins
              </div>
              <div className="heading text-xl text-text-primary mt-1">
                {selectedOpenOutcomeScenarios.open_ticket_count === 0
                  ? "none open"
                  : selectedOpenOutcomeScenarios.break_even_open_wins_required === null
                  ? "unreachable"
                  : `${int(selectedOpenOutcomeScenarios.break_even_open_wins_required)} / ${int(selectedOpenOutcomeScenarios.open_ticket_count)}`}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Expected after open
              </div>
              <div className={`heading text-xl mt-1 ${pnlClass(selectedExpectedCase?.total_pnl_usd ?? 0)}`}>
                {dollars(selectedExpectedCase?.total_pnl_usd ?? 0, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Best after open
              </div>
              <div className={`heading text-xl mt-1 ${pnlClass(selectedBestCase?.total_pnl_usd ?? 0)}`}>
                {dollars(selectedBestCase?.total_pnl_usd ?? 0, 0)}
              </div>
            </div>
          </div>
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="heading text-base text-text-primary">
                30-day lab status
              </h2>
              <p className="text-xs text-text-muted mt-1">
                {labStatus.selected_strategy.strategy_label}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={labStatusJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                lab json
              </Link>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${labStatusClass(
                  labStatus.status
                )}`}
              >
                {labStatus.status_label}
              </span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Proof days
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(labStatus.proof_window.complete_days)}/
                {int(labStatus.proof_window.required_days)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Accepted P&amp;L
              </div>
              <div
                className={`heading text-2xl mt-1 ${pnlClass(
                  labStatus.tradability.selected_accepted_resolved_pnl_usd
                )}`}
              >
                {dollars(
                  labStatus.tradability.selected_accepted_resolved_pnl_usd,
                  0
                )}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Selected missed
              </div>
              <div
                className={`heading text-2xl mt-1 ${pnlClass(
                  labStatus.tradability.skipped_resolved_net_pnl_usd
                )}`}
              >
                {dollars(
                  labStatus.tradability.skipped_resolved_net_pnl_usd,
                  0
                )}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Leaky rules
              </div>
              <div className="heading text-2xl text-warn mt-1">
                {int(
                  labStatus.tradability.canonical_agent_edge_leakage
                    .rules_with_profitable_skipped_resolved
                )}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Proven rules
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(labStatus.profitability.proven_profitable_rule_count)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Positive thin
              </div>
              <div className="heading text-2xl text-warn mt-1">
                {int(labStatus.profitability.positive_unproven_rule_count)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Resolver
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {labStatus.operations.resolution_catchup_status.replaceAll(
                  "_",
                  " "
                )}
              </div>
            </div>
          </div>
          {selectedProofLag.status === "live_ahead_of_durable" ||
          selectedProofLag.status === "durable_ahead_of_live" ? (
            <div className="border-t border-border-subtle pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-warn">
                  selected proof source lag
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  {selectedProofLag.message}
                </div>
              </div>
              <div className="mono text-[11px] text-text-muted shrink-0">
                live {int(selectedProofLag.live_skipped_resolved_trades)} /
                durable {int(selectedProofLag.durable_skipped_resolved_trades)} /
                delta{" "}
                {dollars(
                  selectedProofLag.delta_skipped_resolved_net_pnl_usd,
                  0
                )}
              </div>
            </div>
          ) : null}
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 border-t border-border-subtle pt-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${operatingPlanStatusClass(
                    operatingPlan.status
                  )}`}
                >
                  {operatingPlan.status_label}
                </span>
                <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  day {int(operatingPlan.evidence_day.complete_days)}/
                  {int(operatingPlan.evidence_day.required_days)}
                </span>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  primary action
                </div>
                <p className="text-sm text-text-primary leading-relaxed mt-1">
                  {operatingPlan.primary_action}
                </p>
                <p className="text-xs text-text-muted leading-relaxed mt-2">
                  {operatingPlan.primary_reason}
                </p>
              </div>
              {operatingPlan.secondary_actions.length > 0 ? (
                <div className="text-xs text-text-secondary leading-relaxed">
                  <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                    watch
                  </span>{" "}
                  {operatingPlan.secondary_actions.slice(0, 2).join(" ")}
                </div>
              ) : null}
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {labStatus.checks.slice(0, 9).map((item) => (
                <div
                  key={item.id}
                  className="border-b border-border-subtle/60 pb-2 min-w-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="mono text-[10px] uppercase tracking-wider text-text-muted truncate">
                      {item.label}
                    </div>
                    <span
                      className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${labCheckStatusClass(
                        item.status
                      )}`}
                    >
                      {item.status_label}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary mt-1 line-clamp-2">
                    {item.current}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="heading text-base text-text-primary">30-day proof gate</h2>
            <div className="flex items-center gap-2">
              <Link
                href={auditJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                audit json
              </Link>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${readinessStatusClass(
                  proofAudit.verdict
                )}`}
              >
                audit {proofAudit.verdict_label}
              </span>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofStatusClass(selectedProof.status)}`}
              >
                {selectedProof.status_label}
              </span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Live days
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(selectedProof.calendar_days_observed)}/
                {int(selectedProof.rules.requiredLiveDays)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Resolved
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(selectedProof.resolved_trades)}/
                {int(selectedProof.rules.requiredResolvedTrades)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Gate P&amp;L
              </div>
              <div className={`heading text-2xl mt-1 ${pnlClass(selectedProof.resolved_net_pnl_usd)}`}>
                {dollars(selectedProof.resolved_net_pnl_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Gate ROI
              </div>
              <div className={`heading text-2xl mt-1 ${pnlClass(selectedProof.resolved_roi_on_stake)}`}>
                {pct(selectedProof.resolved_roi_on_stake, 1)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Max DD
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {dollars(selectedProof.max_drawdown_usd, 0)}
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 border-t border-border-subtle pt-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              A strategy cannot become a candidate until it has 30 live calendar
              days, at least 30 resolved live paper tickets, positive resolved
              P&amp;L, positive ROI, and drawdown under{" "}
              <span className="text-text-primary">
                {dollars(selectedProof.rules.maxDrawdownUsd, 0)}
              </span>
              . This is a proof label only, not an execution signal.
            </p>
            <div className="flex flex-col gap-2">
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Blockers
              </div>
              {selectedProof.blockers.length === 0 ? (
                <div className="text-sm text-positive mono">
                  [proof gate clear on paper]
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedProof.blockers.map((blocker) => (
                    <span
                      key={blocker}
                      className="mono text-[11px] text-warn bg-warn/10 rounded px-2 py-1"
                    >
                      {blocker}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-border-subtle pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="heading text-sm text-text-primary">
                  Audit blockers
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {proofAudit.ready_for_capital_review
                    ? "The read-only proof audit is clear; execution remains disabled."
                    : `${int(failedAuditChecks.length)} checks still block capital review.`}
                </p>
              </div>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${readinessStatusClass(
                  proofAudit.verdict
                )}`}
              >
                {proofAudit.verdict_label}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="border border-border-subtle rounded px-3 py-2 min-w-0">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Agent-edge audit
                </div>
                <div className={`heading text-sm mt-1 ${proofSummaryClass(proofAudit.agent_edge_proof.guard_status)}`}>
                  {proofAudit.agent_edge_proof.guard_status_label}
                </div>
                <div className="text-xs text-text-muted mt-1 truncate">
                  {proofAudit.agent_edge_proof.source_label}
                </div>
              </div>
              <div className="border border-border-subtle rounded px-3 py-2 min-w-0">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Proven rules
                </div>
                <div className="heading text-sm text-text-primary mt-1">
                  {int(proofAudit.agent_edge_proof.rules_with_profitability_proven)}/
                  {int(proofAudit.agent_edge_proof.rule_count)}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  {int(proofAudit.agent_edge_proof.rules_with_minimum_sample)} minimum sample
                </div>
              </div>
              <div className="border border-border-subtle rounded px-3 py-2 min-w-0">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Positive thin
                </div>
                <div className="heading text-sm text-warn mt-1">
                  {int(proofAudit.agent_edge_proof.positive_unproven_rule_count)}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  cannot count as proof yet
                </div>
              </div>
              <div className="border border-border-subtle rounded px-3 py-2 min-w-0">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Missed P&amp;L
                </div>
                <div className={`heading text-sm mt-1 ${pnlClass(proofAudit.agent_edge_proof.capacity_leakage_missed_pnl_usd)}`}>
                  {dollars(proofAudit.agent_edge_proof.capacity_leakage_missed_pnl_usd, 0)}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  not counted as proof
                </div>
              </div>
            </div>
            {failedAuditChecks.length === 0 ? (
              <div className="text-sm text-positive mono">
                [audit clear on paper]
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-2">
                {failedAuditChecks.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="border border-border-subtle rounded px-3 py-2 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="mono text-[10px] uppercase tracking-wider text-text-muted truncate">
                        {item.label}
                      </div>
                      <span
                        className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${readinessStatusClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary mt-2 line-clamp-2">
                      {item.current}
                    </div>
                    <div className="text-xs text-text-muted mt-1 line-clamp-2">
                      {item.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="heading text-base text-text-primary">Persisted proof log</h2>
            <div className="flex items-center gap-3">
              <Link
                href={auditJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                audit json
              </Link>
              <Link
                href={artifactJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                artifact json
              </Link>
              <Link
                href={writeReadinessJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                write readiness
              </Link>
              <Link
                href={evidenceSlaJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                evidence sla
              </Link>
              <Link
                href={labStatusJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                lab status
              </Link>
              <Link
                href={agentEdgeProofJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                agent proof
              </Link>
              <Link
                href={agentEdgeTradesJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                trade ledger
              </Link>
              <Link
                href={publishedProofHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                published proof
              </Link>
              <Link
                href={snapshotJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                json feed
              </Link>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9 gap-3">
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Capital review
              </div>
              <div
                className={`heading text-2xl mt-1 ${proofSummaryClass(
                  proofSummary.capital_review_status
                )}`}
              >
                {proofSummary.capital_review_status_label}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Evidence SLA
              </div>
              <div className="mt-2">
                <span
                  className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${evidenceSlaStatusClass(
                    evidenceSla.status
                  )}`}
                >
                  {evidenceSla.status_label}
                </span>
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Registry sync
              </div>
              <div
                className={`heading text-2xl mt-1 ${registrySyncClass(
                  registrySync.status
                )}`}
              >
                {registrySync.status_label}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Write mode
              </div>
              <div className="mt-2">
                <span
                  className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${writeReadinessStatusClass(
                    writeReadiness.status
                  )}`}
                >
                  {writeReadiness.status_label}
                </span>
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Archive
              </div>
              <div
                className={`heading text-2xl mt-1 ${persistenceStatusClass(
                  persisted.status
                )}`}
              >
                {persisted.status.replace("_", " ")}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Rows
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(persisted.snapshots.length)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Latest capture
              </div>
              <div
                suppressHydrationWarning
                className="heading text-2xl text-text-primary mt-1"
              >
                {persisted.latest_captured_at
                  ? relativeTime(persisted.latest_captured_at)
                  : "-"}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Capture health
              </div>
              <div
                className={`heading text-2xl mt-1 ${captureHealthClass(
                  captureHealth.status
                )}`}
              >
                {captureHealth.status_label}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Next capture
              </div>
              <div
                suppressHydrationWarning
                className="heading text-2xl text-text-primary mt-1"
              >
                {relativeTime(captureHealth.next_expected_capture_at)}
              </div>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-3 flex flex-wrap gap-x-4 gap-y-2 mono text-[11px] text-text-muted">
            <span className={proofSummaryClass(proofSummary.status)}>
              live proof {proofSummary.status_label}
            </span>
            <span className={proofSummaryClass(proofSummary.capital_review_status)}>
              real-money execution disabled
            </span>
            <Link
              href={evidenceSlaJsonHref}
              className={`${
                evidenceSla.status === "on_track" ||
                evidenceSla.status === "collecting"
                  ? "text-accent"
                  : evidenceSla.status === "degraded"
                    ? "text-warn"
                    : "text-rose-400"
              } hover:text-text-primary transition-colors`}
            >
              evidence sla {evidenceSla.status_label.toLowerCase()}
            </Link>
            <span>
              source {evidenceSla.data_source_status.replaceAll("_", " ")} /{" "}
              complete {int(evidenceSla.complete_days)}/
              {int(evidenceSla.proof_window_days)}
            </span>
            {evidenceSla.status === "blocked" ||
            evidenceSla.status === "degraded" ? (
              <span className="text-warn">
                {evidenceSla.next_required_action}
              </span>
            ) : null}
            <Link
              href={agentEdgeProofJsonHref}
              className="text-accent hover:text-text-primary transition-colors"
            >
              agent edge proof {agentEdgeProof.source_label.toLowerCase()} /{" "}
              {int(agentEdgeProof.rule_count)} rules
            </Link>
            <span>
              profitable proven {int(agentEdgeProof.profitable_rule_count)} / positive{" "}
              unproven {int(agentEdgeProof.positive_unproven_rule_count)} /{" "}
              unresolved {int(agentEdgeProof.unresolved_rule_count)}
            </span>
            <span className={proofSummaryClass(profitabilityGuard.status)}>
              proof guard {profitabilityGuard.status_label.toLowerCase()} / sample{" "}
              {int(profitabilityGuard.rules_with_minimum_sample)}/
              {int(agentEdgeProof.rule_count)}
            </span>
            <span
              className={
                durableCapacityLeakage.rules_with_profitable_skipped_resolved > 0
                  ? "text-warn"
                  : "text-text-muted"
              }
            >
              durable leakage {durableCapacityLeakage.status_label.toLowerCase()} /{" "}
              {int(durableCapacityLeakage.rules_with_profitable_skipped_resolved)}{" "}
              rules / {dollars(durableCapacityLeakage.skipped_resolved_net_pnl_usd, 0)} missed
            </span>
            <Link
              href={agentEdgeTradesJsonHref}
              className="text-accent hover:text-text-primary transition-colors"
            >
              resolved ticket ledger {agentEdgeTradeLedger.status_label.toLowerCase()} /{" "}
              {int(agentEdgeTradeLedger.total_resolved_trades)} trades /{" "}
              {dollars(agentEdgeTradeLedger.total_net_pnl_usd, 0)} / above BE{" "}
              {int(agentEdgeTradeLedger.above_break_even_rule_count)}
            </Link>
            <Link
              href={agentEdgeWatchlistJsonHref}
              className="text-accent hover:text-text-primary transition-colors"
            >
              agent edge watchlist {agentEdgeWatchlist.status_label.toLowerCase()} /{" "}
              {int(agentEdgeWatchlist.total_tradable_signals)} tradable /{" "}
              {int(agentEdgeWatchlist.total_review_required_signals)} review
            </Link>
            <Link
              href={agentEdgeRunwayJsonHref}
              className="text-accent hover:text-text-primary transition-colors"
            >
              agent edge runway {agentEdgeRunway.status_label.toLowerCase()} /{" "}
              {int(agentEdgeRunway.sample_reachable_rule_count)} reachable / best gap{" "}
              {agentEdgeRunway.minimum_sample_gap_after_open === null
                ? "-"
                : int(agentEdgeRunway.minimum_sample_gap_after_open)}
            </Link>
            <span className={registrySyncClass(registrySync.status)}>
              registry {registrySync.status_label.toLowerCase()}{" "}
              {int(registrySync.persisted_latest_live_strategy_count)}/
              {int(registrySync.current_live_strategy_count)} live variants
            </span>
            <Link
              href={writeReadinessJsonHref}
              className={`${
                writeReadiness.status === "persisting"
                  ? "text-positive"
                  : "text-warn"
              } hover:text-text-primary transition-colors`}
            >
              write readiness {writeReadiness.status_label.toLowerCase()}
            </Link>
            {writeReadiness.status !== "persisting" ? (
              <span className="text-warn">
                {writeReadiness.next_required_action}
              </span>
            ) : null}
            {registrySync.missing_live_strategy_count > 0 ? (
              <span className="text-warn">
                pending capture {int(registrySync.missing_live_strategy_count)} variants
              </span>
            ) : null}
            {proofSummary.best_live_strategy_label ? (
              <span>
                best live {proofSummary.best_live_strategy_label}:{" "}
                <span className={pnlClass(proofSummary.best_live_window_pnl_usd)}>
                  {dollars(proofSummary.best_live_window_pnl_usd, 0)}
                </span>{" "}
                / {pct(proofSummary.best_live_window_roi_on_stake, 1)}
              </span>
            ) : null}
            <span>
              live {int(proofSummary.live_strategy_count)} / candidates{" "}
              {int(proofSummary.candidate_count)} / controls{" "}
              {int(proofSummary.control_count)}
            </span>
            <Link
              href={strategyRegistryJsonHref}
              className="text-accent hover:text-text-primary transition-colors"
            >
              strategy registry{" "}
              {int(snapshot.strategy_registry.live_strategy_count)} live /{" "}
              {int(snapshot.strategy_registry.control_strategy_count)} control
            </Link>
            <span className={captureHealthClass(captureHealth.status)}>
              {captureHealth.message}
            </span>
            <span>cron {captureHealth.cron} UTC</span>
            <span>
              stale after {int(captureHealth.stale_after_hours)}h
            </span>
            {captureHealth.latest_capture_age_hours !== null ? (
              <span>
                age {captureHealth.latest_capture_age_hours.toFixed(1)}h
              </span>
            ) : null}
          </div>
          <div className="border-t border-border-subtle pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="heading text-sm text-text-primary">
                  Proof evidence sources
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Supabase persistence and GitHub artifacts are tracked separately
                  so missing DB writes cannot hide the paper-only proof trail.
                </p>
              </div>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofEvidenceSourceStatusClass(
                  proofEvidenceSources.status
                )}`}
              >
                {proofEvidenceSources.status_label}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Proof evidence sources">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Source</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Status</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Current</th>
                    <th className="text-left py-2 pl-3 mono text-[10px] uppercase tracking-wider">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {proofEvidenceSources.sources.map((source) => (
                    <tr key={source.id}>
                      <td className="py-3 pr-3">
                        <div className="text-sm text-text-primary">
                          {source.label}
                        </div>
                        <div className="text-xs text-text-muted leading-relaxed max-w-xl">
                          {source.detail}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofEvidenceSourceStatusClass(
                            source.status
                          )}`}
                        >
                          {source.status_label}
                        </span>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {source.current}
                      </td>
                      <td className="py-3 pl-3 mono text-left text-text-secondary">
                        {source.target}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border-subtle pt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Artifact workflow
                </div>
                <div className="mt-1">
                  <span
                    className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofEvidenceSourceStatusClass(
                      artifactWorkflow.status
                    )}`}
                  >
                    {artifactWorkflow.status_label}
                  </span>
                </div>
                <div className="text-xs text-text-muted mt-2 leading-relaxed">
                  {artifactWorkflow.message}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Latest run
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {latestWorkflowRun ? (
                    <a
                      href={latestWorkflowRun.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-accent transition-colors"
                    >
                      {latestWorkflowRun.id}
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
                <div
                  suppressHydrationWarning
                  className="mono text-[10px] uppercase tracking-wider text-text-muted mt-1"
                >
                  {latestWorkflowRun
                    ? `${latestWorkflowRun.conclusion ?? latestWorkflowRun.status} / ${relativeTime(
                        latestWorkflowRun.updated_at
                      )}`
                    : "none"}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Latest artifact
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {latestArtifactRun
                    ? latestArtifactRun.artifact.status_label
                    : "-"}
                </div>
                <div
                  suppressHydrationWarning
                  className="mono text-[10px] uppercase tracking-wider text-text-muted mt-1"
                >
                  {latestArtifactRun?.artifact.expires_at
                    ? `expires ${relativeTime(latestArtifactRun.artifact.expires_at)}`
                    : "no artifact"}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Published proof
                </div>
                <div className="mt-1">
                  <span
                    className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofEvidenceSourceStatusClass(
                      publishedArtifactProof.status
                    )}`}
                  >
                    {publishedArtifactProof.status_label}
                  </span>
                </div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted mt-2">
                  {publishedSnapshotDate} / {publishedLiveRows} live rows /{" "}
                  {publishedArtifactProof.agent_edge_proof_matrix.length} rules
                </div>
                <div
                  className={`mono text-[10px] uppercase tracking-wider mt-1 ${proofSummaryClass(
                    publishedReadinessStatus
                  )}`}
                >
                  readiness {publishedReadinessStatus}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Artifact history
                </div>
                <div className="mt-1">
                  <span
                    className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${artifactHistoryStatusClass(
                      artifactHistory.status
                    )}`}
                  >
                    {artifactHistory.status_label}
                  </span>
                </div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted mt-2">
                  {int(artifactHistory.complete_artifact_days)}/
                  {int(artifactHistory.proof_window_days)} days /{" "}
                  {int(artifactHistory.retained_artifact_count)} retained
                </div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted mt-1">
                  {int(artifactHistory.ignored_duplicate_artifact_count)} same-day reruns ignored
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Artifact action
                </div>
                <div className="text-sm text-text-primary mt-1 leading-relaxed">
                  {artifactWorkflow.next_required_action}
                </div>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3 flex flex-wrap gap-x-4 gap-y-2 mono text-[11px] text-text-muted">
              <span>{proofEvidenceSources.artifact_contract.workflow_path}</span>
              <span>
                artifact {proofEvidenceSources.artifact_contract.artifact_name_pattern}
              </span>
              <span>
                files {int(proofEvidenceSources.artifact_contract.expected_files.length)}
              </span>
              <span>
                retention {int(proofEvidenceSources.artifact_contract.retention_days)}d
              </span>
              <span>
                artifact history {int(artifactHistory.complete_artifact_days)}/
                {int(artifactHistory.proof_window_days)} days
              </span>
              <span>
                retained {int(artifactHistory.retained_artifact_count)} /
                selected {int(artifactHistory.selected_artifact_count)} /
                deduped {int(artifactHistory.ignored_duplicate_artifact_count)}
              </span>
              <span className="break-all">
                audit {proofEvidenceSources.artifact_contract.audit_command}
              </span>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="heading text-sm text-text-primary">
                  Resolution review queue
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {resolutionReviewQueue.message}
                </p>
              </div>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${resolutionQueueStatusClass(
                  resolutionReviewQueue.status
                )}`}
              >
                {resolutionReviewQueue.status_label}
              </span>
            </div>
            <div className="grid sm:grid-cols-5 gap-3">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Current
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(resolutionReviewQueue.current_review_required)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Published
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(resolutionReviewQueue.published_review_required)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Unique
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(resolutionReviewQueue.item_count)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Provider
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(
                    resolutionReviewQueue.provider_resolution_resolved_item_count
                  )}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Action
                </div>
                <Link
                  href={resolutionReviewJsonHref}
                  className="mono text-[11px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
                >
                  review JSON
                </Link>
              </div>
            </div>
            {resolutionReviewQueue.items.length === 0 ? (
              <div className="text-sm text-text-muted mono">
                [no review-required paper markets in current or published proof]
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Resolution review queue">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Market</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Evidence</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Agent</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">EV</th>
                      <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Close</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {resolutionReviewQueue.items.slice(0, 8).map((item) => (
                      <tr key={item.prediction_id}>
                        <td className="py-3 pr-3">
                          <Link
                            href={`/markets/${item.market_id}`}
                            className="text-sm text-text-primary hover:text-accent transition-colors line-clamp-2"
                          >
                            {item.market_question}
                          </Link>
                          <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                            {item.market_source ?? "unknown source"} /{" "}
                            {item.market_status ?? "unknown status"} /{" "}
                            {item.close_status.replaceAll("_", " ")}
                          </div>
                          {item.market_url ? (
                            <a
                              href={item.market_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
                            >
                              source market
                            </a>
                          ) : null}
                          {item.provider_resolution ? (
                            <div
                              className={`mono text-[10px] uppercase tracking-wider ${
                                item.provider_resolution.status === "resolved"
                                  ? "text-positive"
                                  : item.provider_resolution.status === "open"
                                    ? "text-text-muted"
                                    : "text-warn"
                              }`}
                            >
                              {item.provider_resolution.status_label}
                              {item.provider_resolution.resolved_at
                                ? ` / ${relativeTime(
                                    item.provider_resolution.resolved_at
                                  )}`
                                : ""}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          <div>{item.source_labels.join(" + ")}</div>
                          <div className="text-[10px] text-text-muted">
                            {item.source_run_ids.length > 0
                              ? `run ${item.source_run_ids.join(", ")}`
                              : "live"}
                          </div>
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {item.agent_name} {item.side}
                        </td>
                        <td
                          className={`py-3 px-3 mono text-right ${pnlClass(
                            item.expected_pnl_usd
                          )}`}
                        >
                          {dollars(item.expected_pnl_usd, 2)}
                        </td>
                        <td
                          suppressHydrationWarning
                          className={`py-3 pl-3 mono text-right ${
                            item.close_status === "overdue"
                              ? "text-warn"
                              : "text-text-secondary"
                          }`}
                        >
                          {item.market_closes_at
                            ? relativeTime(item.market_closes_at)
                            : "unknown"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="border-t border-border-subtle pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="heading text-sm text-text-primary">
                  Resolver catch-up preview
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {resolutionCatchupPreview.message}
                </p>
              </div>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${resolutionCatchupStatusClass(
                  resolutionCatchupPreview.status
                )}`}
              >
                {resolutionCatchupPreview.status_label}
              </span>
            </div>
            <div className="grid sm:grid-cols-5 gap-3">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Due
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(resolutionCatchupPreview.due_market_count)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Unscored
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(resolutionCatchupPreview.unscored_live_prediction_count)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Resolved
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(resolutionCatchupPreview.provider_resolved_market_count)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Eligible
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(resolutionCatchupPreview.eligible_trade_count)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  P&amp;L
                </div>
                <div
                  className={`heading text-xl mt-1 ${pnlClass(
                    resolutionCatchupPreview.projected_resolved_pnl_usd
                  )}`}
                >
                  {dollars(
                    resolutionCatchupPreview.projected_resolved_pnl_usd,
                    2
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3 flex flex-wrap gap-x-4 gap-y-2 mono text-[11px] text-text-muted">
              <span>{resolutionCatchupPreview.next_required_action}</span>
              <span>
                wins {int(resolutionCatchupPreview.projected_win_count)} /
                losses {int(resolutionCatchupPreview.projected_loss_count)}
              </span>
              <Link
                href={resolutionCatchupJsonHref}
                className="uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                catch-up json
              </Link>
            </div>
            {resolutionCatchupPreview.top_projected_trades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Resolution catch-up preview">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Market</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Agent</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Edge</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Stake</th>
                      <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {resolutionCatchupPreview.top_projected_trades
                      .slice(0, 5)
                      .map((trade) => (
                        <tr key={trade.prediction_id}>
                          <td className="py-3 pr-3">
                            <Link
                              href={`/markets/${trade.market_id}`}
                              className="text-sm text-text-primary hover:text-accent transition-colors line-clamp-2"
                            >
                              {trade.market_question}
                            </Link>
                            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                              {trade.side} / resolved {trade.resolved_outcome}
                            </div>
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {trade.agent_name}
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {pct(trade.abs_edge, 1)}
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {dollars(trade.stake_usd, 0)}
                          </td>
                          <td
                            className={`py-3 pl-3 mono text-right ${pnlClass(
                              trade.projected_pnl_usd
                            )}`}
                          >
                            {dollars(trade.projected_pnl_usd, 2)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          <div className="border-t border-border-subtle pt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="heading text-sm text-text-primary">
                  Capital review packet
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {capitalReviewPacket.decision_summary}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={capitalReviewJsonHref}
                  className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
                >
                  packet json
                </Link>
                <span
                  className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${capitalReviewPacketStatusClass(
                    capitalReviewPacket.status
                  )}`}
                >
                  {capitalReviewPacket.status_label}
                </span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-x-5 gap-y-4">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Decision
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {capitalReviewPacket.decision.replaceAll("_", " ")}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Captured
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(capitalReviewPacket.evidence.captured_days)}/
                  {int(capitalReviewPacket.evidence.required_live_days)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Resolved
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(capitalReviewPacket.evidence.resolved_trades)}/
                  {int(capitalReviewPacket.evidence.required_resolved_trades)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Window P&amp;L
                </div>
                <div
                  className={`heading text-xl mt-1 ${pnlClass(
                    capitalReviewPacket.evidence.window_pnl_usd
                  )}`}
                >
                  {dollars(capitalReviewPacket.evidence.window_pnl_usd, 0)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Review blockers
                </div>
                <div
                  className={`heading text-xl mt-1 ${
                    capitalReviewPacket.blockers.length > 0
                      ? "text-warn"
                      : "text-positive"
                  }`}
                >
                  {int(capitalReviewPacket.blockers.length)}
                </div>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3 flex flex-wrap gap-x-4 gap-y-2 mono text-[11px] text-text-muted">
              <span>{capitalReviewPacket.next_required_action}</span>
              <span>execution path: absent</span>
              <span>real money: disabled</span>
              <span>
                earliest review{" "}
                {capitalReviewPacket.earliest_capital_review_date ?? "unknown"}
              </span>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="heading text-sm text-text-primary">
                  Proof readiness checklist
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {proofReadiness.next_required_action}
                </p>
              </div>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${readinessStatusClass(
                  proofReadiness.status
                )}`}
              >
                {proofReadiness.status_label}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Proof readiness checklist">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Gate</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Status</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Current</th>
                    <th className="text-left py-2 pl-3 mono text-[10px] uppercase tracking-wider">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {proofReadiness.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-3">
                        <div className="text-sm text-text-primary">
                          {item.label}
                        </div>
                        <div className="text-xs text-text-muted leading-relaxed max-w-xl">
                          {item.detail}
                        </div>
                        {item.evidence.length > 0 ? (
                          <div className="mt-2 flex flex-col gap-1.5">
                            <div className="mono text-[10px] uppercase tracking-wider text-warn">
                              Blocking evidence
                            </div>
                            {item.evidence.map((evidence) => (
                              <Link
                                key={`${evidence.kind}-${evidence.prediction_id}`}
                                href={`/markets/${evidence.market_id}`}
                                className="block border-l border-warn/50 pl-3 hover:border-warn transition-colors"
                              >
                                <span className="block text-xs text-text-primary leading-relaxed max-w-xl line-clamp-2">
                                  {evidence.market_question}
                                </span>
                                <span className="block mono text-[10px] uppercase tracking-wider text-text-muted">
                                  {evidence.agent_name} {evidence.side} /{" "}
                                  {dollars(evidence.stake_usd, 0)} stake / EV{" "}
                                  {dollars(evidence.expected_pnl_usd, 2)} / close{" "}
                                  {evidence.market_closes_at
                                    ? relativeTime(evidence.market_closes_at)
                                    : "unknown"}{" "}
                                  / open {evidence.age_days.toFixed(1)}d
                                </span>
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${readinessStatusClass(
                            item.status
                          )}`}
                        >
                          {item.status_label}
                        </span>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {item.current}
                      </td>
                      <td className="py-3 pl-3 mono text-left text-text-secondary">
                        {item.target}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="heading text-sm text-text-primary">
                  Proof runway
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {proofRunway.blocker_summary}
                </p>
              </div>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofRunwayStatusClass(
                  proofRunway.status
                )}`}
              >
                {proofRunway.status_label}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Earliest review
                </div>
                <div
                  suppressHydrationWarning
                  className="heading text-xl text-text-primary mt-1"
                >
                  {proofRunway.earliest_capital_review_at
                    ? shortDate(proofRunway.earliest_capital_review_at)
                    : "-"}
                </div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted mt-1">
                  {proofRunway.days_until_earliest_review !== null
                    ? `${int(proofRunway.days_until_earliest_review)}d minimum`
                    : "unknown"}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Capture days left
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(proofRunway.capture_days_remaining)}
                </div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted mt-1">
                  {int(captureCalendar.complete_days)}/
                  {int(captureCalendar.expected_days)} logged
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Resolved left
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(proofRunway.resolved_trades_remaining)}
                </div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted mt-1">
                  {proofRunway.pending_resolution_capacity === null
                    ? "open unknown"
                    : `${int(proofRunway.pending_resolution_capacity)} open`}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Resolution pressure
                </div>
                <div
                  className={`heading text-xl mt-1 ${
                    (proofRunway.review_required_live_signals ?? 0) > 0
                      ? "text-warn"
                      : "text-text-primary"
                  }`}
                >
                  {proofRunway.review_required_live_signals === null
                    ? "-"
                    : `${int(proofRunway.review_required_live_signals)} review`}
                </div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted mt-1">
                  {proofRunway.overdue_live_signals === null
                    ? "closing unknown"
                    : `${int(proofRunway.overdue_live_signals)} overdue / ${int(
                        proofRunway.unknown_close_live_signals ?? 0
                      )} unknown close`}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Proof runway milestones">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Milestone</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Status</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Current</th>
                    <th className="text-left py-2 px-3 mono text-[10px] uppercase tracking-wider">Target</th>
                    <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">ETA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {proofRunway.milestones.map((milestone) => (
                    <tr key={milestone.id}>
                      <td className="py-3 pr-3">
                        <div className="text-sm text-text-primary">
                          {milestone.label}
                        </div>
                        <div className="text-xs text-text-muted leading-relaxed max-w-xl">
                          {milestone.detail}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofRunwayStatusClass(
                            milestone.status
                          )}`}
                        >
                          {milestone.status_label}
                        </span>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {milestone.current}
                      </td>
                      <td className="py-3 px-3 mono text-left text-text-secondary">
                        {milestone.target}
                      </td>
                      <td
                        suppressHydrationWarning
                        className="py-3 pl-3 mono text-right text-text-secondary"
                      >
                        {milestone.eta_at ? relativeTime(milestone.eta_at) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-4 flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Daily ledger
                </div>
                <div
                  className={`heading text-xl mt-1 ${captureCalendarClass(
                    captureCalendar.status
                  )}`}
                >
                  {captureCalendar.status_label}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Complete days
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(captureCalendar.complete_days)}/
                  {int(captureCalendar.expected_days)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Missing
                </div>
                <div
                  className={`heading text-xl mt-1 ${
                    captureCalendar.missing_days > 0
                      ? "text-warn"
                      : "text-text-primary"
                  }`}
                >
                  {int(captureCalendar.missing_days)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Partial
                </div>
                <div
                  className={`heading text-xl mt-1 ${
                    captureCalendar.partial_days > 0
                      ? "text-warn"
                      : "text-text-primary"
                  }`}
                >
                  {int(captureCalendar.partial_days)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Live variants
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(captureCalendar.expected_live_strategy_count)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Days left
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(captureCalendar.days_remaining_to_30)}
                </div>
              </div>
            </div>
            {captureCalendarDays.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Daily persisted capture calendar">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Date</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Status</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Rows</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Live</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Controls</th>
                      <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Latest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {captureCalendarDays.map((day) => (
                      <tr key={day.snapshot_date}>
                        <td className="py-3 pr-3 mono text-text-secondary">
                          {day.snapshot_date}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${captureCalendarBadgeClass(
                              day.status
                            )}`}
                          >
                            {day.status_label}
                          </span>
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {int(day.captured_rows)}
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {int(day.live_strategy_count)}/
                          {int(day.expected_live_strategy_count)}
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {int(day.control_rows)}
                        </td>
                        <td
                          suppressHydrationWarning
                          className="py-3 pl-3 mono text-right text-text-secondary"
                        >
                          {day.latest_captured_at
                            ? relativeTime(day.latest_captured_at)
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          {latestPersistedSnapshots.length === 0 ? (
            <div className="text-sm text-text-muted mono">
              [{persisted.message}]
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="heading text-sm text-text-primary">
                    Persisted agent edge proof
                  </h3>
                  <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                    canonical stored rollups
                  </span>
                </div>
                {persistedAgentEdgeProofRows.length === 0 ? (
                  <div className="text-sm text-text-muted mono py-4">
                    [no persisted canonical agent-edge proof yet]
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full" aria-label="Persisted agent edge proof matrix">
                      <thead>
                        <tr className="border-b border-border-subtle text-text-muted">
                          <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Agent</th>
                          <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Edge</th>
                          <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Proof</th>
                          <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Days</th>
                          <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                          <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Missed</th>
                          <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Window P&amp;L</th>
                          <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">ROI</th>
                          <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Open risk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle/60">
                        {persistedAgentEdgeProofRows.map((row) => {
                          const agent = AGENTS.find((item) => item.id === row.agent_id);
                          const hueTxt = agent ? HUE_TO_TEXT[agent.hue] : "text-text-primary";
                          const hueBg = agent ? HUE_TO_BG[agent.hue] : "bg-accent";

                          return (
                            <tr key={`${row.agent_id}-${row.min_edge}`}>
                              <td className="py-3 pr-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-2 h-2 rounded-full ${hueBg}`}
                                    aria-hidden="true"
                                  />
                                  <span className={`text-sm ${hueTxt}`}>
                                    {row.agent_name}
                                  </span>
                                </div>
                                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                                  latest {row.latest_snapshot_date ?? "-"}
                                </div>
                              </td>
                              <td className="py-3 px-3 mono text-right text-text-secondary">
                                {edgePoints(row.min_edge)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span
                                  className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofStatusClass(row.proof_status)}`}
                                >
                                  {row.proof_status_label}
                                </span>
                                <div
                                  className={`mt-1 mono text-[10px] uppercase tracking-wider ${proofQualityClass(
                                    row.evidence_grade
                                  )}`}
                                >
                                  {row.evidence_grade_label}
                                </div>
                                {row.blockers[0] ? (
                                  <div className="mt-1 mono text-[10px] text-text-muted normal-case tracking-normal">
                                    {row.blockers[0]}
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-3 px-3 mono text-right text-text-secondary">
                                {int(row.captured_days)}/
                                {int(row.required_captured_days)}
                                {row.missing_capture_days > 0 ? (
                                  <div className="mt-1 text-[10px] text-rose-400">
                                    {int(row.missing_capture_days)} missed
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-3 px-3 mono text-right text-text-secondary">
                                {int(row.resolved_trades)}/
                                {int(row.required_resolved_trades)}
                                <div
                                  className={`mt-1 text-[10px] ${proofQualityClass(
                                    row.evidence_grade
                                  )}`}
                                >
                                  {pct(row.win_rate, 0)} win /{" "}
                                  {dollars(row.avg_pnl_per_trade_usd, 2)}
                                </div>
                              </td>
                              <td
                                className={`py-3 px-3 mono text-right ${pnlClass(
                                  row.skipped_resolved_net_pnl_usd
                                )}`}
                              >
                                {dollars(row.skipped_resolved_net_pnl_usd, 0)}
                                {row.skipped_resolved_trades > 0 ? (
                                  <div className="mt-1 text-[10px] text-text-muted">
                                    {int(row.skipped_resolved_trades)} skipped
                                  </div>
                                ) : null}
                                {row.skipped_profitable_resolved_trades > 0 ? (
                                  <div className="mt-1 text-[10px] text-warn">
                                    capacity leak
                                  </div>
                                ) : null}
                              </td>
                              <td
                                className={`py-3 px-3 mono text-right ${pnlClass(
                                  row.window_pnl_usd
                                )}`}
                              >
                                {dollars(row.window_pnl_usd, 0)}
                              </td>
                              <td
                                className={`py-3 px-3 mono text-right ${pnlClass(
                                  row.window_roi_on_stake
                                )}`}
                              >
                                {pct(row.window_roi_on_stake, 1)}
                                <div className="mt-1 text-[10px] text-text-muted">
                                  daily PF {dailyProfitFactor(row.daily_profit_factor)}
                                </div>
                              </td>
                              <td className="py-3 pl-3 mono text-right text-text-secondary">
                                {dollars(row.open_exposure_usd, 0)}
                                <div
                                  className={`mt-1 text-[10px] ${pnlClass(
                                    row.open_expected_pnl_usd
                                  )}`}
                                >
                                  EV {dollars(row.open_expected_pnl_usd, 0)}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Persisted strategy proof progress">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Strategy</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Days</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Rows</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Proof</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Skipped</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Window P&amp;L</th>
                      <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Open risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {persistedRollups.map((rollup) => {
                      const durableGate = rollup.durable_proof_gate;
                      const coverage = rollup.capture_coverage;
                      const proofWindow = rollup.proof_window;
                      const proofQuality = rollup.proof_quality;
                      return (
                        <tr key={rollup.strategy_id}>
                          <td className="py-3 pr-3">
                            <div className="text-sm text-text-primary">
                              {rollup.strategy_label}
                            </div>
                            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                              latest {rollup.latest_snapshot_date ?? "-"} /{" "}
                              {rollup.source} / {rollup.sample.replace("_", " ")}
                            </div>
                            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                              window {proofWindow.start_snapshot_date ?? "-"} -{" "}
                              {proofWindow.end_snapshot_date ?? "-"}
                            </div>
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {int(durableGate.captured_days)}/
                            {int(durableGate.required_captured_days)}
                            {rollup.days_remaining_to_30 > 0 ? (
                              <span className="text-text-muted">
                                {" "}
                                ({int(rollup.days_remaining_to_30)} left)
                              </span>
                            ) : null}
                            <div
                              className={`mt-1 text-[10px] ${
                                coverage.missing_days > 0
                                  ? "text-rose-400"
                                  : "text-text-muted"
                              }`}
                            >
                              {coverage.missing_days > 0
                                ? `${int(coverage.missing_days)} missed`
                                : `${pct(coverage.coverage_ratio, 0)} coverage`}
                            </div>
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {int(rollup.captured_rows)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofStatusClass(durableGate.status)}`}
                            >
                              {durableGate.status_label}
                            </span>
                            <div
                              className={`mt-1 mono text-[10px] uppercase tracking-wider ${proofQualityClass(
                                proofQuality.evidence_grade
                              )}`}
                            >
                              {proofQuality.evidence_grade_label}
                            </div>
                            {durableGate.blockers[0] ? (
                              <div className="mt-1 mono text-[10px] text-text-muted normal-case tracking-normal">
                                {durableGate.blockers[0]}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {int(durableGate.resolved_trades)}
                            <div
                              className={`mt-1 text-[10px] ${proofQualityClass(
                                proofQuality.evidence_grade
                              )}`}
                            >
                              {pct(proofQuality.win_rate, 0)} win /{" "}
                              {dollars(proofQuality.avg_pnl_per_trade_usd, 2)}
                            </div>
                          </td>
                          <td className="py-3 px-3 mono text-right text-warn">
                            {int(rollup.latest_skipped_trades)}
                          </td>
                          <td
                            className={`py-3 px-3 mono text-right ${pnlClass(
                              durableGate.resolved_net_pnl_usd
                            )}`}
                          >
                            {dollars(durableGate.resolved_net_pnl_usd, 0)}
                            <div className="mt-1 text-[10px] text-text-muted">
                              {pct(durableGate.resolved_roi_on_stake, 1)}
                            </div>
                            <div className="mt-1 text-[10px] text-text-muted">
                              daily PF{" "}
                              {dailyProfitFactor(proofQuality.daily_profit_factor)}
                            </div>
                          </td>
                          <td className="py-3 pl-3 mono text-right text-text-secondary">
                            {dollars(proofWindow.latest_open_exposure_usd, 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Persisted paper trading proof log">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Captured</th>
                      <th className="text-left py-2 px-3 mono text-[10px] uppercase tracking-wider">Strategy</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Proof</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Skipped</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">P&amp;L</th>
                      <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Open risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {latestPersistedSnapshots.map((row) => (
                      <tr key={row.id}>
                        <td
                          suppressHydrationWarning
                          className="py-3 pr-3 mono text-text-secondary"
                        >
                          {relativeTime(row.captured_at)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-sm text-text-primary">
                            {row.strategy_label}
                          </div>
                          <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                            {row.source} / {row.sample.replace("_", " ")}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofStatusClass(row.proof_status)}`}
                          >
                            {row.proof_gate.status_label}
                          </span>
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {int(row.resolved_trades)}
                        </td>
                        <td className="py-3 px-3 mono text-right text-warn">
                          {int(row.skipped_trades)}
                        </td>
                        <td
                          className={`py-3 px-3 mono text-right ${pnlClass(
                            row.resolved_net_pnl_usd
                          )}`}
                        >
                          {dollars(row.resolved_net_pnl_usd, 0)}
                        </td>
                        <td className="py-3 pl-3 mono text-right text-text-secondary">
                          {dollars(row.open_exposure_usd, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="heading text-base text-text-primary">
              Paper exposure ledger
            </h2>
            <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
              selected config
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Cap
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {dollars(exposureLedger.max_open_exposure_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Accepted
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(exposureLedger.accepted_trades)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Skipped
              </div>
              <div className="heading text-2xl text-warn mt-1">
                {int(exposureLedger.skipped_trades)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Skipped resolved
              </div>
              <div className="heading text-2xl text-warn mt-1">
                {int(exposureLedger.skipped_resolved_trades)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Missed P&amp;L
              </div>
              <div className={`heading text-2xl mt-1 ${pnlClass(exposureLedger.skipped_resolved_net_pnl_usd)}`}>
                {dollars(exposureLedger.skipped_resolved_net_pnl_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Current risk
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {dollars(exposureLedger.current_open_exposure_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Peak risk
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {dollars(exposureLedger.peak_open_exposure_usd, 0)}
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 border-t border-border-subtle pt-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              The selected strategy is replayed chronologically. A paper ticket is
              accepted only if its maximum loss keeps simultaneous open risk under
              the cap. Skipped signals remain visible so profitable-looking rules
              cannot hide capacity problems. Resolved skipped tickets count as
              missed P&amp;L, not proof P&amp;L.
            </p>
            <div className="flex flex-col gap-2">
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Recent skipped signals
              </div>
              {skippedExposureEntries.length === 0 ? (
                <div className="text-sm text-text-muted mono">
                  [no signals skipped by exposure cap]
                </div>
              ) : (
                <div className="divide-y divide-border-subtle/60">
                  {skippedExposureEntries.slice(0, 4).map((entry) => (
                    <div key={entry.prediction_id} className="py-2 flex flex-col gap-1">
                      <div className="text-sm text-text-primary line-clamp-1">
                        {entry.market_question}
                      </div>
                      <div className="mono text-[11px] text-text-muted flex flex-wrap gap-x-3 gap-y-1">
                        <span>{entry.agent_name}</span>
                        <span>{entry.side}</span>
                        <span>stake {dollars(entry.stake_usd, 0)}</span>
                        <span>
                          before {dollars(entry.open_exposure_before_usd, 0)}
                        </span>
                        {entry.missed_pnl_usd !== null ? (
                          <span className={pnlClass(entry.missed_pnl_usd)}>
                            missed {dollars(entry.missed_pnl_usd, 2)}
                          </span>
                        ) : (
                          <span>EV {dollars(entry.expected_pnl_usd, 2)}</span>
                        )}
                        <span className="text-warn">skipped</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {skippedResolvedExposureEntries.length > 0 ? (
                <div className="mono text-[11px] text-warn bg-warn/10 rounded px-2 py-1">
                  {int(skippedResolvedExposureEntries.length)} skipped signal
                  {skippedResolvedExposureEntries.length === 1 ? "" : "s"} have
                  since resolved; they are capacity leakage, not realized proof.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="panel px-5 py-4 flex flex-col gap-1">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Resolved P&amp;L{livePnlPending ? " - backfill" : ""}
            </div>
            <div className={`heading text-3xl ${pnlClass(snapshot.totals.resolved_net_pnl_usd)}`}>
              {dollars(snapshot.totals.resolved_net_pnl_usd, 0)}
            </div>
            <div className="text-xs text-text-secondary">
              {int(snapshot.totals.resolved_trades)} tickets,{" "}
              {pct(snapshot.totals.resolved_roi_on_stake, 1)} ROI on risked stake.
            </div>
          </div>
          <div className="panel px-5 py-4 flex flex-col gap-1">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Raw open exposure
            </div>
            <div className="heading text-3xl text-text-primary">
              {dollars(snapshot.totals.open_exposure_usd, 0)}
            </div>
            <div className="text-xs text-text-secondary">
              {int(snapshot.totals.open_signals)} eligible tickets before selected cap.
            </div>
          </div>
          <div className="panel px-5 py-4 flex flex-col gap-1">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Expected open P&amp;L
            </div>
            <div className={`heading text-3xl ${pnlClass(snapshot.totals.open_expected_pnl_usd)}`}>
              {dollars(snapshot.totals.open_expected_pnl_usd, 0)}
            </div>
            <div className="text-xs text-text-secondary">
              Model-implied EV before market resolution.
            </div>
          </div>
          <div className="panel px-5 py-4 flex flex-col gap-1">
            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Current leader
            </div>
            <div className="heading text-3xl text-text-primary">
              {leader ? leader.agent_name : "None"}
            </div>
            <div className="text-xs text-text-secondary">
              {leader
                ? `${dollars(leader.net_pnl_usd, 0)} net over ${int(leader.trades)} tickets.`
                : "No resolved paper tickets yet."}
            </div>
          </div>
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="heading text-base text-text-primary">Resolution watch</h2>
            <span
              className={`mono text-[10px] uppercase tracking-wider ${resolutionWatchClass(
                resolutionWatch.status
              )}`}
            >
              {resolutionWatch.status_label}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Open live
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(resolutionWatch.open_live_signals)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Tradable
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(resolutionWatch.tradable_open_live_signals)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Overdue
              </div>
              <div
                className={`heading text-2xl mt-1 ${
                  resolutionWatch.overdue_live_signals > 0
                    ? "text-warn"
                    : "text-text-primary"
                }`}
              >
                {int(resolutionWatch.overdue_live_signals)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Closing 7d
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(resolutionWatch.closing_next_7d_signals)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Unknown close
              </div>
              <div
                className={`heading text-2xl mt-1 ${
                  resolutionWatch.unknown_close_live_signals > 0
                    ? "text-warn"
                    : "text-text-primary"
                }`}
              >
                {int(resolutionWatch.unknown_close_live_signals)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Next close
              </div>
              <div
                suppressHydrationWarning
                className="heading text-2xl text-text-primary mt-1"
              >
                {resolutionWatch.next_close_at
                  ? relativeTime(resolutionWatch.next_close_at)
                  : "-"}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Tradable EV
              </div>
              <div
                className={`heading text-2xl mt-1 ${pnlClass(
                  resolutionWatch.tradable_open_expected_pnl_usd
                )}`}
              >
                {dollars(resolutionWatch.tradable_open_expected_pnl_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Review EV
              </div>
              <div
                className={`heading text-2xl mt-1 ${
                  resolutionWatch.review_required_live_signals > 0
                    ? "text-warn"
                    : pnlClass(
                        resolutionWatch.review_required_open_expected_pnl_usd
                      )
                }`}
              >
                {dollars(
                  resolutionWatch.review_required_open_expected_pnl_usd,
                  0
                )}
              </div>
            </div>
          </div>
          {resolutionWatch.signals.length === 0 ? (
            <div className="text-sm text-text-muted mono">
              [no open live paper tickets awaiting resolution]
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-border-subtle pt-4">
              <table className="w-full" aria-label="Live resolution watch">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Market</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Agent</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Side</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Stake</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">EV</th>
                    <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Close</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {resolutionWatch.signals.map((signal) => (
                    <tr key={signal.prediction_id}>
                      <td className="py-3 pr-3">
                        <Link
                          href={`/markets/${signal.market_id}`}
                          className="text-sm text-text-primary hover:text-accent transition-colors line-clamp-2"
                        >
                          {signal.market_question}
                        </Link>
                        <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                          {signal.tradability_status.replaceAll("_", " ")} /{" "}
                          {signal.close_status.replaceAll("_", " ")}
                          {signal.age_days > 0
                            ? ` / open ${signal.age_days.toFixed(1)}d`
                            : ""}
                        </div>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {signal.agent_name}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${sideClass(
                            signal.side
                          )}`}
                        >
                          {signal.side}
                        </span>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {dollars(signal.stake_usd, 0)}
                      </td>
                      <td
                        className={`py-3 px-3 mono text-right ${pnlClass(
                          signal.expected_pnl_usd
                        )}`}
                      >
                        {dollars(signal.expected_pnl_usd, 2)}
                      </td>
                      <td
                        suppressHydrationWarning
                        className={`py-3 pl-3 mono text-right ${
                          signal.close_status === "overdue"
                            ? "text-warn"
                            : "text-text-secondary"
                        }`}
                      >
                        {signal.market_closes_at
                          ? relativeTime(signal.market_closes_at)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="heading text-base text-text-primary">
                Liquidity / slippage review
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Source-level execution quality is a capital-review blocker, not
                paper P&amp;L.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={liquidityReviewJsonHref}
                className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
              >
                liquidity json
              </Link>
              <span
                className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${readinessStatusClass(
                  liquidityReview.status
                )}`}
              >
                {liquidityReview.status_label}
              </span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Sources
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(liquidityReview.source_count)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Blocked
              </div>
              <div className="heading text-2xl text-warn mt-1">
                {int(liquidityReview.blocked_source_count)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Open signals
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(liquidityReview.live_open_signals)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Open risk
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {dollars(liquidityReview.open_exposure_usd, 0)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Recent resolved
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(liquidityReview.recent_resolved_trades)}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Adj. P&amp;L
              </div>
              <div className="heading text-2xl text-warn mt-1">missing</div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Stress pass
              </div>
              <div className="heading text-2xl text-text-primary mt-1">
                {int(liquidityReview.stress_surviving_rule_count)}/
                {int(liquidityReview.stress_tested_rule_count)}
              </div>
            </div>
          </div>
          {liquidityReview.sources.length === 0 ? (
            <div className="text-sm text-text-muted mono">
              [no live source activity needs liquidity review yet]
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-border-subtle pt-4">
              <table
                className="w-full"
                aria-label="Source liquidity and slippage review"
              >
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Source</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Open</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Exposure</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Fields</th>
                    <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {liquidityReview.sources.map((source) => (
                    <tr key={source.source_id}>
                      <td className="py-3 pr-3">
                        <div className="text-sm text-text-primary">
                          {source.source_label}
                        </div>
                        <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                          {int(source.execution_quality_sample_count)} sampled /{" "}
                          {int(source.missing_fields.length)} missing
                        </div>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(source.live_open_signals)} /{" "}
                        {int(source.unique_open_markets)} markets
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {dollars(source.open_exposure_usd, 0)}
                      </td>
                      <td
                        className={`py-3 px-3 mono text-right ${pnlClass(
                          source.recent_resolved_net_pnl_usd
                        )}`}
                      >
                        {int(source.recent_resolved_trades)} /{" "}
                        {dollars(source.recent_resolved_net_pnl_usd, 0)}
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(source.available_fields.length)}/
                        {int(
                          source.available_fields.length +
                            source.missing_fields.length
                        )}
                        <div className="text-[10px] uppercase tracking-wider text-warn">
                          {source.missing_fields.length > 0
                            ? `${int(source.missing_fields.length)} missing`
                            : "complete"}
                        </div>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <span
                          className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${readinessStatusClass(
                            source.status
                          )}`}
                        >
                          {source.status_label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="overflow-x-auto border-t border-border-subtle pt-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                execution-friction stress
              </div>
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                counts as proof:{" "}
                {liquidityReview.stress_evidence_counts_as_proof
                  ? "yes"
                  : "no"}
              </div>
            </div>
            <table className="w-full" aria-label="Execution friction stress">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted">
                  <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Rule</th>
                  <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                  <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Gross</th>
                  <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Worst stress</th>
                  <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/60">
                {liquidityReview.stress_rules.slice(0, 8).map((rule) => {
                  const worstScenario =
                    rule.scenarios[rule.scenarios.length - 1] ?? null;
                  return (
                    <tr key={rule.strategy_id}>
                      <td className="py-3 pr-3">
                        <div className="text-sm text-text-primary">
                          {rule.strategy_label}
                        </div>
                        <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                          {rule.agent_name} / edge {edgePoints(rule.min_edge)}
                        </div>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(rule.resolved_trades)}
                      </td>
                      <td
                        className={`py-3 px-3 mono text-right ${pnlClass(
                          rule.gross_net_pnl_usd
                        )}`}
                      >
                        {dollars(rule.gross_net_pnl_usd, 0)}
                        <div className="mt-1 text-[10px] text-text-muted">
                          {pct(rule.gross_roi_on_stake, 1)}
                        </div>
                      </td>
                      <td
                        className={`py-3 px-3 mono text-right ${pnlClass(
                          rule.worst_case_net_pnl_usd
                        )}`}
                      >
                        {dollars(rule.worst_case_net_pnl_usd, 0)}
                        <div className="mt-1 text-[10px] text-text-muted">
                          {worstScenario
                            ? `${worstScenario.total_friction_bps}bps`
                            : "-"}
                        </div>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <span
                          className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${executionStressStatusClass(
                            rule.status
                          )}`}
                        >
                          {rule.status_label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border-subtle pt-3 text-xs text-text-muted">
            {liquidityReview.next_required_action}
          </div>
        </section>

        <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5">
          <div className="panel px-5 py-5 flex flex-col gap-4 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="heading text-base text-text-primary">Live-only proof</h2>
              <span className="mono text-[10px] uppercase tracking-wider text-accent">
                no backfill
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-elevated/40 border border-border-subtle rounded px-3 py-3">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Raw live risk
                </div>
                <div className="heading text-2xl text-text-primary">
                  {dollars(snapshot.live_totals.open_exposure_usd, 0)}
                </div>
                <div className="text-xs text-text-secondary">
                  {int(snapshot.live_totals.open_signals)} tickets before cap.
                </div>
              </div>
              <div className="bg-surface-elevated/40 border border-border-subtle rounded px-3 py-3">
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Live resolved
                </div>
                <div className={`heading text-2xl ${pnlClass(snapshot.live_totals.resolved_net_pnl_usd)}`}>
                  {dollars(snapshot.live_totals.resolved_net_pnl_usd, 0)}
                </div>
                <div className="text-xs text-text-secondary">
                  {int(snapshot.live_totals.resolved_trades)} tickets scored.
                </div>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              This is the only section that should influence future real-money decisions.
              Backfill is useful for debugging the machinery, but the 30-day proof
              comes from live locked forecasts that resolve after the ticket existed.
            </p>
            <div className="border-t border-border-subtle pt-3 mono text-xs text-text-muted">
              Live leader:{" "}
              <span className="text-text-primary">
                {liveLeader
                  ? `${liveLeader.agent_name} (${dollars(liveLeader.net_pnl_usd, 0)})`
                  : "pending resolutions"}
              </span>
            </div>
          </div>

          <div className="panel px-5 py-5 flex flex-col gap-4 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="heading text-base text-text-primary">Strategy lab</h2>
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                live variants
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Live strategy variants">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Strategy</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Proof</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Days</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Open</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Skipped</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">P&amp;L</th>
                    <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Open EV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {liveStrategyRows.map((strategy) => (
                    <tr key={strategy.id}>
                      <td className="py-3 pr-3">
                        <div className="text-sm text-text-primary">{strategy.label}</div>
                        <div className="text-xs text-text-muted leading-relaxed max-w-md">
                          {strategy.description}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofStatusClass(strategy.proof_gate.status)}`}
                        >
                          {strategy.proof_gate.status_label}
                        </span>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(strategy.proof_gate.calendar_days_observed)}
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(strategy.resolved_trades)}
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(strategy.open_signals)}
                      </td>
                      <td className="py-3 px-3 mono text-right text-warn">
                        {int(strategy.exposure_ledger.skipped_trades)}
                      </td>
                      <td className={`py-3 px-3 mono text-right ${pnlClass(strategy.net_pnl_usd)}`}>
                        {dollars(strategy.net_pnl_usd, 0)}
                      </td>
                      <td className={`py-3 pl-3 mono text-right ${pnlClass(strategy.open_expected_pnl_usd)}`}>
                        {dollars(strategy.open_expected_pnl_usd, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel px-5 py-5 flex flex-col gap-4 min-w-0 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="heading text-base text-text-primary">Agent edge rules</h2>
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                canonical live matrix
              </span>
            </div>
            {agentEdgeRows.length === 0 ? (
              <div className="text-sm text-text-muted mono py-8">
                [no agent edge rules available]
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Agent edge rule matrix">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Agent</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Edge</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Proof</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Open</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Runway</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Skipped</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Missed</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">P&amp;L</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">ROI</th>
                      <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Open EV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {agentEdgeRows.map((rule) => {
                      const agent = AGENTS.find((item) => item.id === rule.agent_id);
                      const ledgerRule = agentEdgeLedgerByRule.get(
                        `${rule.agent_id}-${rule.min_edge}`
                      );
                      const runwayRule = agentEdgeRunwayByRule.get(
                        `${rule.agent_id}-${rule.min_edge}`
                      );
                      const hueTxt = agent ? HUE_TO_TEXT[agent.hue] : "text-text-primary";
                      const hueBg = agent ? HUE_TO_BG[agent.hue] : "bg-accent";

                      return (
                        <tr key={`${rule.agent_id}-${rule.min_edge}`}>
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${hueBg}`}
                                aria-hidden="true"
                              />
                              <span className={`text-sm ${hueTxt}`}>
                                {rule.agent_name}
                              </span>
                            </div>
                            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                              {rule.stake_mode.replace("_", " ")}
                            </div>
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {edgePoints(rule.min_edge)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofStatusClass(rule.proof_status)}`}
                            >
                              {rule.proof_status_label}
                            </span>
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {int(rule.resolved_trades)}
                            {ledgerRule && ledgerRule.break_even_win_rate !== null ? (
                              <div className="mt-1 text-[10px] text-text-muted">
                                {pct(ledgerRule.win_rate, 0)} win / BE{" "}
                                {pct(ledgerRule.break_even_win_rate, 0)}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {int(rule.open_signals)}
                            {rule.open_signals > 0 ? (
                              <div className="mt-1 text-[10px] text-text-muted">
                                BE{" "}
                                {rule.break_even_open_wins_required === null
                                  ? "n/a"
                                  : `${int(
                                      rule.break_even_open_wins_required
                                    )}/${int(rule.open_signals)}`}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {runwayRule ? (
                              <div className="flex flex-col items-end gap-1">
                                <span
                                  className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${agentEdgeRunwayStatusClass(
                                    runwayRule.status
                                  )}`}
                                >
                                  {runwayRule.status_label}
                                </span>
                                <span className="mono text-[10px] text-text-muted">
                                  cap {int(runwayRule.pending_resolution_capacity)} / gap{" "}
                                  {int(runwayRule.sample_gap_after_open)}
                                </span>
                              </div>
                            ) : (
                              <span className="mono text-text-muted">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 mono text-right text-warn">
                            {int(rule.skipped_trades)}
                            {rule.skipped_resolved_trades > 0 ? (
                              <div className="mt-1 text-[10px] text-text-muted">
                                {int(rule.skipped_resolved_trades)} resolved
                              </div>
                            ) : null}
                          </td>
                          <td
                            className={`py-3 px-3 mono text-right ${pnlClass(
                              rule.skipped_resolved_net_pnl_usd
                            )}`}
                          >
                            {dollars(rule.skipped_resolved_net_pnl_usd, 0)}
                            {rule.skipped_profitable_resolved_trades > 0 ? (
                              <div className="mt-1 text-[10px] text-warn">
                                capacity leak
                              </div>
                            ) : null}
                          </td>
                          <td
                            className={`py-3 px-3 mono text-right ${pnlClass(
                              rule.resolved_net_pnl_usd
                            )}`}
                          >
                            {dollars(rule.resolved_net_pnl_usd, 0)}
                            {rule.pending_pnl_counts_as_proof === false &&
                            rule.open_signals > 0 ? (
                              <div className="mt-1 text-[10px] text-text-muted">
                                pending not proof
                              </div>
                            ) : null}
                          </td>
                          <td
                            className={`py-3 px-3 mono text-right ${pnlClass(
                              rule.resolved_roi_on_stake
                            )}`}
                          >
                            {pct(rule.resolved_roi_on_stake, 1)}
                            {ledgerRule && ledgerRule.win_rate_edge !== null ? (
                              <div
                                className={`mt-1 text-[10px] ${pnlClass(
                                  ledgerRule.win_rate_edge
                                )}`}
                              >
                                BE edge {pct(ledgerRule.win_rate_edge, 1)}
                              </div>
                            ) : null}
                          </td>
                          <td
                            className={`py-3 pl-3 mono text-right ${pnlClass(
                              rule.open_expected_pnl_usd
                            )}`}
                          >
                            {dollars(rule.open_expected_pnl_usd, 0)}
                            {rule.open_signals > 0 ? (
                              <div
                                className={`mt-1 text-[10px] ${pnlClass(
                                  rule.model_expected_total_pnl_usd
                                )}`}
                              >
                                total{" "}
                                {dollars(rule.model_expected_total_pnl_usd, 0)}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel px-5 py-5 flex flex-col gap-4 min-w-0 lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="heading text-base text-text-primary">
                  Agent-edge profit attribution
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Resolved paper P&amp;L grouped by source, category, and market.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={agentEdgeAttributionJsonHref}
                  className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
                >
                  attribution json
                </Link>
                <span
                  className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${attributionStatusClass(
                    agentEdgeAttribution.status
                  )}`}
                >
                  {agentEdgeAttribution.status_label}
                </span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Resolved
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(agentEdgeAttribution.total_resolved_trades)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  P&amp;L
                </div>
                <div
                  className={`heading text-xl mt-1 ${pnlClass(
                    agentEdgeAttribution.total_net_pnl_usd
                  )}`}
                >
                  {dollars(agentEdgeAttribution.total_net_pnl_usd, 0)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Profitable
                </div>
                <div className="heading text-xl text-positive mt-1">
                  {int(agentEdgeAttribution.profitable_rule_count)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Concentrated
                </div>
                <div className="heading text-xl text-warn mt-1">
                  {int(agentEdgeAttribution.concentrated_rule_count)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Diversified
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(agentEdgeAttribution.diversified_rule_count)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Threshold
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {pct(
                    agentEdgeAttribution.rules.topPnlShareConcentrationThreshold,
                    0
                  )}
                </div>
              </div>
            </div>
            {agentEdgeAttribution.rules_by_strategy.length === 0 ? (
              <div className="text-sm text-text-muted mono">
                [no canonical agent-edge attribution rows yet]
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-border-subtle pt-3">
                <table
                  className="w-full"
                  aria-label="Agent-edge profit attribution"
                >
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Rule</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Status</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">P&amp;L</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Sources</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Markets</th>
                      <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Top market</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {agentEdgeAttribution.rules_by_strategy
                      .slice(0, 8)
                      .map((rule) => (
                        <tr key={rule.strategy_id}>
                          <td className="py-3 pr-3">
                            <div className="text-sm text-text-primary">
                              {rule.agent_name} / {edgePoints(rule.min_edge)}
                            </div>
                            <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                              {rule.concentration_flags[0] ??
                                "attribution collecting"}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${attributionStatusClass(
                                rule.status
                              )}`}
                            >
                              {rule.status_label}
                            </span>
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {int(rule.resolved_trades)}/
                            {int(rule.required_resolved_trades)}
                          </td>
                          <td
                            className={`py-3 px-3 mono text-right ${pnlClass(
                              rule.net_pnl_usd
                            )}`}
                          >
                            {dollars(rule.net_pnl_usd, 0)}
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {int(rule.distinct_sources)}
                            {rule.by_source[0] ? (
                              <div className="mt-1 text-[10px] text-text-muted">
                                top {pct(rule.by_source[0].pnl_share, 0)}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {int(rule.distinct_markets)}
                          </td>
                          <td className="py-3 pl-3 mono text-right text-text-secondary">
                            {pct(rule.top_market_pnl_share, 0)}
                            {rule.top_markets[0] ? (
                              <div className="mt-1 text-[10px] text-text-muted truncate max-w-[180px]">
                                {rule.top_markets[0].market_source}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-border-subtle pt-3 text-xs text-text-muted">
              {agentEdgeAttribution.next_required_action}
            </div>
          </div>
          <div className="panel px-5 py-5 flex flex-col gap-4 min-w-0 lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="heading text-base text-text-primary">
                  Selected rule dossier
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  {agentEdgeDossier.selection.strategy_label ??
                    "No selected agent-edge rule"}{" "}
                  / {agentEdgeDossier.source_label.toLowerCase()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={agentEdgeDossierJsonHref}
                  className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
                >
                  dossier json
                </Link>
                <span
                  className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${readinessStatusClass(
                    agentEdgeDossier.status
                  )}`}
                >
                  {agentEdgeDossier.status_label}
                </span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Days
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(agentEdgeDossier.summary.captured_days)}/
                  {int(agentEdgeDossier.summary.required_captured_days)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Resolved
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(agentEdgeDossier.summary.resolved_trades)}/
                  {int(agentEdgeDossier.summary.required_resolved_trades)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  P&amp;L
                </div>
                <div
                  className={`heading text-xl mt-1 ${pnlClass(
                    agentEdgeDossier.summary.window_pnl_usd
                  )}`}
                >
                  {dollars(agentEdgeDossier.summary.window_pnl_usd, 0)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  ROI
                </div>
                <div
                  className={`heading text-xl mt-1 ${pnlClass(
                    agentEdgeDossier.summary.window_roi_on_stake
                  )}`}
                >
                  {pct(agentEdgeDossier.summary.window_roi_on_stake, 1)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Open
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(agentEdgeDossier.summary.tradable_open_signals)}/
                  {int(agentEdgeDossier.summary.open_signals)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Gap
                </div>
                <div className="heading text-xl text-warn mt-1">
                  {int(agentEdgeDossier.summary.sample_gap_after_open)}
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-5 gap-3 border-t border-border-subtle pt-3">
              {agentEdgeDossier.checks.map((item) => (
                <div key={item.id} className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="mono text-[10px] uppercase tracking-wider text-text-muted truncate">
                      {item.label}
                    </div>
                    <span
                      className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${readinessStatusClass(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="heading text-lg text-text-primary mt-2">
                    {item.current}
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">
                    target {item.target}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-border-subtle pt-3">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Open capacity
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  {int(agentEdgeDossier.summary.pending_resolution_capacity)}{" "}
                  tickets pending resolution
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Recent evidence
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  {int(agentEdgeDossier.summary.recent_evidence_day_count)} days
                  / {int(agentEdgeDossier.summary.recent_resolved_trade_count)}{" "}
                  resolved tickets
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Missed P&amp;L
                </div>
                <div
                  className={`text-sm mt-1 ${pnlClass(
                    agentEdgeDossier.summary.skipped_resolved_net_pnl_usd
                  )}`}
                >
                  {dollars(
                    agentEdgeDossier.summary.skipped_resolved_net_pnl_usd,
                    0
                  )}{" "}
                  excluded from proof
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Next action
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  {agentEdgeDossier.next_required_action}
                </div>
              </div>
            </div>
          </div>

          <div className="panel px-5 py-5 flex flex-col gap-4 min-w-0 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="heading text-base text-text-primary">Agent-edge evidence timeline</h2>
              <div className="flex items-center gap-3">
                <Link
                  href={agentEdgeEvidenceJsonHref}
                  className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
                >
                  evidence json
                </Link>
                <span
                  className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${readinessStatusClass(
                    agentEdgeEvidenceTimeline.status
                  )}`}
                >
                  {agentEdgeEvidenceTimeline.status_label}
                </span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Days
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(agentEdgeEvidenceTimeline.complete_days)}/
                  {int(agentEdgeEvidenceTimeline.required_days)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Rule-days
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(agentEdgeEvidenceTimeline.captured_rule_days)}/
                  {int(agentEdgeEvidenceTimeline.total_expected_rule_days)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Proven
                </div>
                <div className="heading text-xl text-positive mt-1">
                  {int(agentEdgeEvidenceTimeline.rules_with_profitability_proven)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Positive thin
                </div>
                <div className="heading text-xl text-warn mt-1">
                  {int(agentEdgeEvidenceTimeline.rules_positive_but_unproven)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Resolved
                </div>
                <div className="heading text-xl text-text-primary mt-1">
                  {int(agentEdgeEvidenceTimeline.total_resolved_trades)}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                  Window P&amp;L
                </div>
                <div
                  className={`heading text-xl mt-1 ${pnlClass(
                    agentEdgeEvidenceTimeline.total_window_pnl_usd
                  )}`}
                >
                  {dollars(agentEdgeEvidenceTimeline.total_window_pnl_usd, 0)}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto border-t border-border-subtle pt-3">
              <table className="w-full" aria-label="Agent-edge evidence timeline">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Rule</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Captures</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Latest delta</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">P&amp;L</th>
                    <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {agentEdgeEvidenceTimeline.rules.slice(0, 8).map((rule) => {
                    const latestDay = rule.recent_days.find(
                      (day) => day.has_rule_snapshot
                    );
                    return (
                      <tr key={rule.strategy_id}>
                        <td className="py-3 pr-3">
                          <div className="text-sm text-text-primary">
                            {rule.agent_name} / {edgePoints(rule.min_edge)}
                          </div>
                          <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                            {rule.profitability_status_label}
                          </div>
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {int(rule.captured_days)}/{int(rule.required_captured_days)}
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {int(rule.resolved_trades)}/{int(rule.required_resolved_trades)}
                        </td>
                        <td
                          className={`py-3 px-3 mono text-right ${pnlClass(
                            latestDay?.delta_resolved_net_pnl_usd ?? 0
                          )}`}
                        >
                          {dollars(latestDay?.delta_resolved_net_pnl_usd ?? 0, 0)}
                          <div className="mt-1 text-[10px] text-text-muted">
                            {latestDay?.snapshot_date ?? "-"}
                          </div>
                        </td>
                        <td
                          className={`py-3 px-3 mono text-right ${pnlClass(
                            rule.window_pnl_usd
                          )}`}
                        >
                          {dollars(rule.window_pnl_usd, 0)}
                        </td>
                        <td className="py-3 pl-3 mono text-right text-warn">
                          {int(rule.missing_capture_days)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel px-5 py-5 flex flex-col gap-4 min-w-0 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="heading text-base text-text-primary">Strategy daily evidence</h2>
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                capped 30d replay
              </span>
            </div>
            {liveDailyEvidenceRows.length === 0 ? (
              <div className="text-sm text-text-muted mono py-8">
                [no live strategy evidence yet]
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Strategy daily evidence">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Strategy</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Latest</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Days</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Locked</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Open risk</th>
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Cum P&amp;L</th>
                      <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Avg/day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {liveDailyEvidenceRows.map((row) => (
                      <tr key={row.series.strategy_id}>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-text-primary">
                              {row.series.strategy_label}
                            </span>
                            <span
                              className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${proofStatusClass(row.series.proof_status)}`}
                            >
                              {row.series.proof_status_label}
                            </span>
                          </div>
                          <div className="text-xs text-text-muted leading-relaxed max-w-md">
                            {row.strategy?.description ?? "Custom selected strategy"}
                          </div>
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {row.latestDay?.date ?? "-"}
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {int(row.series.days.length)}
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {int(row.lockedTrades)}
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {int(row.resolvedTrades)}
                        </td>
                        <td className="py-3 px-3 mono text-right text-text-secondary">
                          {dollars(row.strategy?.open_exposure_usd ?? 0, 0)}
                        </td>
                        <td
                          className={`py-3 px-3 mono text-right ${pnlClass(
                            row.latestDay?.cumulative_pnl_usd ?? 0
                          )}`}
                        >
                          {dollars(row.latestDay?.cumulative_pnl_usd ?? 0, 0)}
                        </td>
                        <td
                          className={`py-3 pl-3 mono text-right ${pnlClass(
                            row.avgDailyPnl
                          )}`}
                        >
                          {dollars(row.avgDailyPnl, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="panel panel-live">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between gap-3">
            <h2 className="heading text-base text-text-primary">Trader leaderboard</h2>
            <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
              sorted by net paper P&amp;L
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Paper trading leaderboard">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted">
                  <th className="px-4 py-2 text-left mono text-[10px] uppercase tracking-wider">Rank</th>
                  <th className="px-4 py-2 text-left mono text-[10px] uppercase tracking-wider">Agent</th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">Trades</th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">Win %</th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">Net P&amp;L</th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">ROI</th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">Avg edge</th>
                  <th className="px-4 py-2 text-right mono text-[10px] uppercase tracking-wider">
                    <Tooltip tip="Largest peak-to-trough paper P&L decline in this sample. Lower is better.">
                      Max DD
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshot.agent_summaries.map((s) => {
                  const agent = AGENTS.find((a) => a.id === s.agent_id);
                  const hueTxt = agent ? HUE_TO_TEXT[agent.hue] : "text-text-primary";
                  const hueBg = agent ? HUE_TO_BG[agent.hue] : "bg-accent";
                  return (
                    <tr key={s.agent_id} className="border-b border-border-subtle/60 panel-hover">
                      <td className="px-4 py-3 mono text-text-secondary">
                        {String(s.rank).padStart(2, "0")}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/agents/${s.agent_id}`} className="flex items-center gap-3 group">
                          <span
                            className={`w-2 h-2 rounded-full ring-2 ring-offset-2 ring-offset-panel ${hueBg}`}
                            aria-hidden="true"
                          />
                          <span className={`text-sm group-hover:text-accent ${hueTxt}`}>
                            {s.agent_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 mono text-right text-text-secondary">
                        {int(s.trades)}
                      </td>
                      <td className="px-4 py-3 mono text-right text-text-secondary">
                        {pct(s.win_rate, 1)}
                      </td>
                      <td className={`px-4 py-3 mono text-right ${pnlClass(s.net_pnl_usd)}`}>
                        {dollars(s.net_pnl_usd, 2)}
                      </td>
                      <td className={`px-4 py-3 mono text-right ${pnlClass(s.roi_on_stake)}`}>
                        {pct(s.roi_on_stake, 1)}
                      </td>
                      <td className="px-4 py-3 mono text-right text-text-secondary">
                        {pct(s.avg_edge, 1)}
                      </td>
                      <td className="px-4 py-3 mono text-right text-text-muted">
                        {dollars(s.max_drawdown_usd, 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid lg:grid-cols-[1fr_1.1fr] gap-5">
          <div className="panel px-5 py-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="heading text-base text-text-primary">Scenario matrix</h2>
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                resolved only
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Paper trading scenarios">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Scenario</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Trades</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">P&amp;L</th>
                    <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {snapshot.scenario_summaries.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 pr-3">
                        <div className="text-sm text-text-primary">{s.label}</div>
                        <div className="mono text-[10px] text-text-muted">
                          avg edge {pct(s.avg_edge, 1)} - avg stake {dollars(s.avg_stake_usd, 0)}
                        </div>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(s.trades)}
                      </td>
                      <td className={`py-3 px-3 mono text-right ${pnlClass(s.net_pnl_usd)}`}>
                        {dollars(s.net_pnl_usd, 0)}
                      </td>
                      <td className={`py-3 pl-3 mono text-right ${pnlClass(s.roi_on_stake)}`}>
                        {pct(s.roi_on_stake, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel px-5 py-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="heading text-base text-text-primary">Open paper tickets</h2>
              <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
                selected config
              </span>
            </div>
            {selectedOpenSignals.length === 0 ? (
              <div className="text-sm text-text-muted mono py-8">
                [no open paper signals for selected config]
              </div>
            ) : (
              <div className="divide-y divide-border-subtle/60">
                {selectedOpenSignals.slice(0, 6).map((t) => (
                  <div key={t.prediction_id} className="py-3 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${sideClass(t.side)}`}
                      >
                        {t.side}
                      </span>
                      <Link
                        href={`/markets/${t.market_id}`}
                        className="text-sm text-text-primary hover:text-accent transition-colors line-clamp-2"
                      >
                        {t.market_question}
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mono text-[11px] text-text-muted">
                      <span className="text-text-primary">{t.agent_name}</span>
                      <span>edge {signed(t.edge, 2)}</span>
                      <span>stake {dollars(t.stake_usd, 0)}</span>
                      <span>max loss {dollars(t.max_loss_usd, 0)}</span>
                      <span className={pnlClass(t.expected_pnl_usd)}>
                        EV {dollars(t.expected_pnl_usd, 2)}
                      </span>
                      <span suppressHydrationWarning>
                        locked {relativeTime(t.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="heading text-base text-text-primary">Daily evidence snapshots</h2>
            <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
              latest {snapshot.config.dailyWindowDays}d
            </span>
          </div>
          {evidenceRows.length === 0 ? (
            <div className="text-sm text-text-muted mono py-8">
              [no paper tickets locked yet]
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Daily evidence snapshots">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="text-left py-2 pr-3 mono text-[10px] uppercase tracking-wider">Date</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Locked</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Resolved</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Open risk</th>
                    <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">Day P&amp;L</th>
                    <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Cum P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {evidenceRows.slice(0, 10).map((row) => (
                    <tr key={`${row.sample}-${row.date}`}>
                      <td className="py-3 pr-3">
                        <div className="mono text-sm text-text-primary">{row.date}</div>
                        <div className="mono text-[10px] text-text-muted uppercase tracking-wider">
                          {row.sample.replace("_", " ")}
                        </div>
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(row.locked_trades)}
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {int(row.resolved_trades)}
                      </td>
                      <td className="py-3 px-3 mono text-right text-text-secondary">
                        {dollars(row.open_exposure_usd, 0)}
                      </td>
                      <td className={`py-3 px-3 mono text-right ${pnlClass(row.net_pnl_usd)}`}>
                        {dollars(row.net_pnl_usd, 0)}
                      </td>
                      <td className={`py-3 pl-3 mono text-right ${pnlClass(row.cumulative_pnl_usd)}`}>
                        {dollars(row.cumulative_pnl_usd, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-3">
          <h2 className="heading text-base text-text-primary">Ticket math</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-text-secondary leading-relaxed">
            <p>
              A forecast becomes eligible when the agent differs from the market by at
              least <span className="text-text-primary">{pct(snapshot.config.minEdge, 0)}</span>.
              Positive edge buys YES; negative edge buys NO.
            </p>
            <p>
              Stake size uses quarter Kelly, capped at{" "}
              <span className="text-text-primary">
                {dollars(snapshot.config.maxStakeUsd, 0)}
              </span>{" "}
              per ticket. The whole ticket is the maximum loss.
            </p>
            <p>
              Resolved P&amp;L uses binary-share payoff: a correct YES bought at{" "}
              <span className="mono text-text-primary">{prob(0.4)}</span> earns{" "}
              <span className="mono text-text-primary">1/0.4 - 1</span> on the stake;
              an incorrect ticket loses the stake.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-subtle">
            <p className="mono text-[10px] uppercase tracking-wider text-text-muted">
              Paper only - no wallet, no broker, no execution path.
            </p>
            <Link
              href={jsonHref}
              className="mono text-[11px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
            >
              JSON feed
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
