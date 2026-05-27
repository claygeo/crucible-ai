import type { PublishedPaperTradingArtifactProof } from "@/lib/trading-artifacts";
import type {
  ResolutionWatchSignal,
  TradeSide,
  TradingResolutionWatch,
} from "@/lib/trading";

export type ResolutionReviewQueueSource =
  | "current_snapshot"
  | "published_artifact_proof";

export type ResolutionReviewQueueItem = {
  source: ResolutionReviewQueueSource;
  source_label: string;
  source_labels: string[];
  source_run_id: string | null;
  source_run_ids: string[];
  source_generated_at: string | null;
  source_count: number;
  seen_in_current_snapshot: boolean;
  seen_in_published_artifact: boolean;
  prediction_id: string;
  market_id: string;
  market_question: string;
  market_source: string | null;
  market_url: string | null;
  market_status: string | null;
  agent_id: string;
  agent_name: string;
  side: TradeSide;
  stake_usd: number;
  expected_pnl_usd: number;
  market_closes_at: string | null;
  created_at: string;
  close_status: ResolutionWatchSignal["close_status"];
  tradability_status: ResolutionWatchSignal["tradability_status"];
  days_until_close: number | null;
  age_days: number;
  action: string;
};

export type ResolutionReviewQueue = {
  status: "blocked" | "clear" | "unavailable";
  status_label: string;
  generated_at: string;
  message: string;
  next_required_action: string;
  paper_only: true;
  real_money_execution_allowed: false;
  current_review_required: number;
  published_review_required: number;
  item_count: number;
  evidence_item_count: number;
  duplicate_item_count: number;
  current_snapshot_items: ResolutionReviewQueueItem[];
  published_artifact_items: ResolutionReviewQueueItem[];
  items: ResolutionReviewQueueItem[];
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function tradeSideValue(value: unknown): TradeSide {
  return value === "NO" ? "NO" : "YES";
}

function closeStatusValue(
  value: unknown,
): ResolutionWatchSignal["close_status"] {
  if (
    value === "overdue" ||
    value === "closing_next_7d" ||
    value === "future" ||
    value === "unknown_close"
  ) {
    return value;
  }
  return "unknown_close";
}

function currentSignalToQueueItem(
  signal: ResolutionWatchSignal,
): ResolutionReviewQueueItem {
  return {
    source: "current_snapshot",
    source_label: "Current snapshot",
    source_labels: ["Current snapshot"],
    source_run_id: null,
    source_run_ids: [],
    source_generated_at: null,
    source_count: 1,
    seen_in_current_snapshot: true,
    seen_in_published_artifact: false,
    prediction_id: signal.prediction_id,
    market_id: signal.market_id,
    market_question: signal.market_question,
    market_source: signal.market_source,
    market_url: signal.market_url,
    market_status: signal.market_status,
    agent_id: signal.agent_id,
    agent_name: signal.agent_name,
    side: signal.side,
    stake_usd: signal.stake_usd,
    expected_pnl_usd: signal.expected_pnl_usd,
    market_closes_at: signal.market_closes_at,
    created_at: signal.created_at,
    close_status: signal.close_status,
    tradability_status: signal.tradability_status,
    days_until_close: signal.days_until_close,
    age_days: signal.age_days,
    action:
      signal.close_status === "unknown_close"
        ? "Find the source market close time or mark the market untradable in review."
        : "Check the source market resolution and update Eivra only after the source is settled.",
  };
}

function workflowRunId(
  publishedArtifactProof: PublishedPaperTradingArtifactProof | null | undefined,
): string | null {
  const run = publishedArtifactProof?.workflow_run;
  if (!isRecord(run)) return null;
  const id = run.id;
  if (typeof id === "number") return String(id);
  return stringValue(id);
}

function publishedReviewRequiredCount(
  publishedArtifactProof: PublishedPaperTradingArtifactProof | null | undefined,
): number | null {
  const runway = publishedArtifactProof?.proof_runway;
  if (!isRecord(runway)) return null;
  return typeof runway.review_required_live_signals === "number" &&
    Number.isFinite(runway.review_required_live_signals)
    ? runway.review_required_live_signals
    : null;
}

function publishedResolutionEvidence(
  publishedArtifactProof: PublishedPaperTradingArtifactProof | null | undefined,
): UnknownRecord[] {
  const readiness = publishedArtifactProof?.proof_readiness;
  if (!isRecord(readiness) || !Array.isArray(readiness.items)) return [];

  const resolutionItem = readiness.items.find(
    (item) => isRecord(item) && item.id === "resolution_hygiene",
  );
  if (!isRecord(resolutionItem) || !Array.isArray(resolutionItem.evidence)) {
    return [];
  }

  return resolutionItem.evidence.filter(isRecord);
}

function publishedEvidenceToQueueItem(
  evidence: UnknownRecord,
  publishedArtifactProof: PublishedPaperTradingArtifactProof,
): ResolutionReviewQueueItem | null {
  const predictionId = stringValue(evidence.prediction_id);
  const marketId = stringValue(evidence.market_id);
  const marketQuestion = stringValue(evidence.market_question);
  const agentId = stringValue(evidence.agent_id);
  const agentName = stringValue(evidence.agent_name);
  const createdAt = stringValue(evidence.created_at);

  if (!predictionId || !marketId || !marketQuestion || !agentId || !createdAt) {
    return null;
  }

  const closeStatus = closeStatusValue(evidence.close_status);
  const sourceRunId = workflowRunId(publishedArtifactProof);
  return {
    source: "published_artifact_proof",
    source_label: "Published artifact",
    source_labels: ["Published artifact"],
    source_run_id: sourceRunId,
    source_run_ids: [sourceRunId].filter((value): value is string =>
      Boolean(value),
    ),
    source_generated_at: publishedArtifactProof.generated_at,
    source_count: 1,
    seen_in_current_snapshot: false,
    seen_in_published_artifact: true,
    prediction_id: predictionId,
    market_id: marketId,
    market_question: marketQuestion,
    market_source: stringValue(evidence.market_source),
    market_url: stringValue(evidence.market_url),
    market_status: stringValue(evidence.market_status),
    agent_id: agentId,
    agent_name: agentName ?? agentId,
    side: tradeSideValue(evidence.side),
    stake_usd: numberValue(evidence.stake_usd),
    expected_pnl_usd: numberValue(evidence.expected_pnl_usd),
    market_closes_at: stringValue(evidence.market_closes_at),
    created_at: createdAt,
    close_status: closeStatus,
    tradability_status: "needs_review",
    days_until_close:
      typeof evidence.days_until_close === "number" &&
      Number.isFinite(evidence.days_until_close)
        ? evidence.days_until_close
        : null,
    age_days: numberValue(evidence.age_days),
    action:
      closeStatus === "unknown_close"
        ? "Find the source market close time before trusting this open EV."
        : "Check the source market resolution before trusting this open EV.",
  };
}

function sortQueueItems(
  items: ResolutionReviewQueueItem[],
): ResolutionReviewQueueItem[] {
  return items.slice().sort((a, b) => {
    const sourceRank =
      a.source === b.source ? 0 : a.source === "current_snapshot" ? -1 : 1;
    if (sourceRank !== 0) return sourceRank;
    const aClose = a.market_closes_at
      ? Date.parse(a.market_closes_at)
      : Infinity;
    const bClose = b.market_closes_at
      ? Date.parse(b.market_closes_at)
      : Infinity;
    if (aClose !== bClose) return aClose - bClose;
    return b.expected_pnl_usd - a.expected_pnl_usd;
  });
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function queueItemKey(item: ResolutionReviewQueueItem): string {
  return (
    item.prediction_id ||
    `${item.market_id}-${item.agent_id}-${item.created_at}`
  );
}

function mergeQueueItemPair(
  left: ResolutionReviewQueueItem,
  right: ResolutionReviewQueueItem,
): ResolutionReviewQueueItem {
  const primary =
    left.source === "current_snapshot" || right.source !== "current_snapshot"
      ? left
      : right;
  const secondary = primary === left ? right : left;
  const sourceLabels = uniqueStrings([
    ...primary.source_labels,
    ...secondary.source_labels,
  ]);
  const sourceRunIds = uniqueStrings([
    ...primary.source_run_ids,
    ...secondary.source_run_ids,
  ]);

  return {
    ...primary,
    source_labels: sourceLabels,
    source_run_ids: sourceRunIds,
    source_count: primary.source_count + secondary.source_count,
    seen_in_current_snapshot:
      primary.seen_in_current_snapshot || secondary.seen_in_current_snapshot,
    seen_in_published_artifact:
      primary.seen_in_published_artifact ||
      secondary.seen_in_published_artifact,
  };
}

function dedupeQueueItems(
  items: ResolutionReviewQueueItem[],
): ResolutionReviewQueueItem[] {
  const byKey = new Map<string, ResolutionReviewQueueItem>();
  for (const item of sortQueueItems(items)) {
    const key = queueItemKey(item);
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeQueueItemPair(existing, item) : item);
  }
  return sortQueueItems(Array.from(byKey.values()));
}

export function buildResolutionReviewQueue(args: {
  resolutionWatch?: TradingResolutionWatch | null;
  publishedArtifactProof?: PublishedPaperTradingArtifactProof | null;
}): ResolutionReviewQueue {
  const currentSnapshotItems =
    args.resolutionWatch?.signals
      .filter((signal) => signal.tradability_status === "needs_review")
      .map(currentSignalToQueueItem) ?? [];
  const publishedArtifactItems = args.publishedArtifactProof
    ? publishedResolutionEvidence(args.publishedArtifactProof)
        .map((item) =>
          publishedEvidenceToQueueItem(item, args.publishedArtifactProof!),
        )
        .filter((item): item is ResolutionReviewQueueItem => Boolean(item))
    : [];
  const evidenceItemCount =
    currentSnapshotItems.length + publishedArtifactItems.length;
  const items = dedupeQueueItems([
    ...currentSnapshotItems,
    ...publishedArtifactItems,
  ]);
  const currentReviewRequired =
    args.resolutionWatch?.review_required_live_signals ??
    currentSnapshotItems.length;
  const publishedReviewRequired =
    publishedReviewRequiredCount(args.publishedArtifactProof) ??
    publishedArtifactItems.length;
  const unavailable =
    args.resolutionWatch === undefined &&
    (!args.publishedArtifactProof ||
      args.publishedArtifactProof.status === "unavailable");
  const status =
    currentReviewRequired + publishedReviewRequired > 0
      ? "blocked"
      : unavailable
        ? "unavailable"
        : "clear";
  const message =
    status === "blocked"
      ? "Resolution hygiene is blocking the proof lab until the listed live paper markets are reviewed."
      : status === "unavailable"
        ? "Resolution review evidence is unavailable."
        : "No review-required live paper markets are present in the checked evidence.";

  return {
    status,
    status_label:
      status === "blocked"
        ? "Review required"
        : status === "unavailable"
          ? "Unavailable"
          : "Clear",
    generated_at: new Date().toISOString(),
    message,
    next_required_action:
      status === "blocked"
        ? "Review source-market resolution for every queued item before trusting open EV."
        : status === "unavailable"
          ? "Restore current or published paper proof evidence."
          : "Continue daily paper-only collection.",
    paper_only: true,
    real_money_execution_allowed: false,
    current_review_required: currentReviewRequired,
    published_review_required: publishedReviewRequired,
    item_count: items.length,
    evidence_item_count: evidenceItemCount,
    duplicate_item_count: Math.max(0, evidenceItemCount - items.length),
    current_snapshot_items: sortQueueItems(currentSnapshotItems),
    published_artifact_items: sortQueueItems(publishedArtifactItems),
    items,
  };
}
