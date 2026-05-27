import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Tooltip } from "@/components/Tooltip";
import { AGENTS, HUE_TO_BG, HUE_TO_TEXT } from "@/lib/agents";
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
import { loadPaperTradingSnapshotHistory } from "@/lib/trading-snapshots";

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
  const [snapshot, persisted] = await Promise.all([
    getTradingSnapshot(controls),
    loadPaperTradingSnapshotHistory(360),
  ]);
  const leader = snapshot.agent_summaries[0];
  const liveResolved =
    snapshot.totals.live_resolved_trades > 0
      ? `${int(snapshot.totals.live_resolved_trades)} live`
      : "live pending";
  const livePnlPending = snapshot.totals.live_resolved_trades === 0;
  const liveLeader = snapshot.live_agent_summaries[0];
  const liveStrategyRows = snapshot.strategy_variants.filter(
    (strategy) => strategy.sample === "live_only"
  );
  const evidenceRows = snapshot.selected_daily_snapshots;
  const selectedStrategy = snapshot.selected_strategy;
  const selectedProof = selectedStrategy.proof_gate;
  const exposureLedger = snapshot.selected_exposure_ledger;
  const skippedExposureEntries = exposureLedger.recent_entries.filter(
    (entry) => entry.status === "skipped_exposure_cap"
  );
  const selectedQuery = tradingControlsToQuery(snapshot.controls);
  const jsonHref = `/api/trading.json?${selectedQuery}`;
  const snapshotJsonHref = "/api/trading-snapshots?limit=360";
  const edgeOptions = Array.from(
    new Set([...TRADING_MIN_EDGE_OPTIONS, snapshot.controls.min_edge])
  ).sort((a, b) => a - b);
  const selectedOpenSignals = snapshot.selected_open_signals;
  const latestPersistedSnapshots = persisted.snapshots.slice(0, 8);
  const persistedRollups = persisted.strategy_rollups.slice(0, 8);
  const captureHealth = persisted.capture_health;
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
              bankroll:{" "}
              <span className="text-text-primary">
                {dollars(snapshot.config.bankrollUsd, 0)}
              </span>
            </span>
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
                min={snapshot.config.maxStakeUsd}
                max={snapshot.config.bankrollUsd}
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 border-t border-border-subtle pt-4">
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
          </div>
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="heading text-base text-text-primary">30-day proof gate</h2>
            <span
              className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded ${proofStatusClass(selectedProof.status)}`}
            >
              {selectedProof.status_label}
            </span>
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
        </section>

        <section className="panel px-5 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="heading text-base text-text-primary">Persisted proof log</h2>
            <Link
              href={snapshotJsonHref}
              className="mono text-[10px] uppercase tracking-wider text-accent hover:text-text-primary transition-colors"
            >
              json feed
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
              <div className="heading text-2xl text-text-primary mt-1">
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
              <div className="heading text-2xl text-text-primary mt-1">
                {relativeTime(captureHealth.next_expected_capture_at)}
              </div>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-3 flex flex-wrap gap-x-4 gap-y-2 mono text-[11px] text-text-muted">
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
          {latestPersistedSnapshots.length === 0 ? (
            <div className="text-sm text-text-muted mono">
              [{persisted.message}]
            </div>
          ) : (
            <div className="flex flex-col gap-5">
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
                      <th className="text-right py-2 px-3 mono text-[10px] uppercase tracking-wider">P&amp;L</th>
                      <th className="text-right py-2 pl-3 mono text-[10px] uppercase tracking-wider">Open risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {persistedRollups.map((rollup) => {
                      const durableGate = rollup.durable_proof_gate;
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
                            {durableGate.blockers[0] ? (
                              <div className="mt-1 mono text-[10px] text-text-muted normal-case tracking-normal">
                                {durableGate.blockers[0]}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3 mono text-right text-text-secondary">
                            {int(durableGate.resolved_trades)}
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
                          </td>
                          <td className="py-3 pl-3 mono text-right text-text-secondary">
                            {dollars(rollup.latest_open_exposure_usd, 0)}
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
                        <td className="py-3 pr-3 mono text-text-secondary">
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
              cannot hide capacity problems.
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
                        <span className="text-warn">skipped</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                      <span>locked {relativeTime(t.created_at)}</span>
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
