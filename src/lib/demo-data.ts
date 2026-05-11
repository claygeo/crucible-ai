/**
 * Deterministic demo data.
 *
 * Per /autoplan review: demo mode must be FIRST-CLASS. Site renders perfectly
 * with zero live API calls. Use this when NEXT_PUBLIC_USE_DEMO_DATA=true
 * (default for first deploy) or as fallback when live data fetch fails.
 *
 * 25 historical markets across 6 agents = 150 predictions, scored.
 */

import { AGENTS } from "@/lib/agents";

export type DemoMarket = {
  id: string;
  source: "polymarket" | "manifold" | "kalshi";
  source_id: string;
  question: string;
  category: "politics" | "crypto" | "sports" | "ai-tech" | "other";
  closes_at: string;
  resolved_at?: string;
  resolved_outcome?: boolean;
  outcome_yes_price: number; // last-known yes price 0..1
  status: "open" | "resolved";
  url: string;
};

export type DemoPrediction = {
  agent_id: string;
  market_id: string;
  probability: number;
  confidence: "low" | "medium" | "high";
  reasoning: string;
  market_price_at_forecast: number;
  created_at: string;
  abstained?: boolean;
};

export type DemoScore = {
  prediction_id: string;
  agent_id: string;
  market_id: string;
  brier: number;
  log_loss: number;
  paper_pnl: number;
  was_correct: boolean;
};

export type DemoAgentStats = {
  agent_id: string;
  brier_30d: number;
  log_loss_30d: number;
  total_predictions: number;
  total_scored: number;
  win_rate_30d: number;
  paper_pnl_30d: number;
  crucible_score: number;
  rank: number;
  rank_delta_24h: number;
  // Calibration: 10 bins, each {bin_low, bin_high, n, observed_rate, ci_low, ci_high}
  calibration: {
    bin_low: number;
    bin_high: number;
    n: number;
    observed_rate: number;
    ci_low: number;
    ci_high: number;
  }[];
};

export type DemoEurekaCard = {
  id: string;
  headline: string;
  body: string;
  generated_at: string;
};

export const DEMO_MARKETS: DemoMarket[] = [
  // RESOLVED markets (16) — give us a non-empty leaderboard on day 1
  {
    id: "m-001",
    source: "polymarket",
    source_id: "demo-001",
    question: "Will the Fed cut rates by 50 bps at the May 2026 meeting?",
    category: "other",
    closes_at: "2026-05-01T18:00:00Z",
    resolved_at: "2026-05-01T18:30:00Z",
    resolved_outcome: false,
    outcome_yes_price: 0.18,
    status: "resolved",
    url: "https://polymarket.com/event/demo-001",
  },
  {
    id: "m-002",
    source: "polymarket",
    source_id: "demo-002",
    question: "Will Bitcoin trade above $120,000 on May 1, 2026?",
    category: "crypto",
    closes_at: "2026-05-01T23:59:00Z",
    resolved_at: "2026-05-02T00:01:00Z",
    resolved_outcome: true,
    outcome_yes_price: 0.71,
    status: "resolved",
    url: "https://polymarket.com/event/demo-002",
  },
  {
    id: "m-003",
    source: "manifold",
    source_id: "demo-003",
    question: "Will GPT-5 be released by Dec 31, 2026?",
    category: "ai-tech",
    closes_at: "2026-12-31T23:59:00Z",
    resolved_at: "2026-04-22T15:00:00Z",
    resolved_outcome: true,
    outcome_yes_price: 0.62,
    status: "resolved",
    url: "https://manifold.markets/demo-003",
  },
  {
    id: "m-004",
    source: "polymarket",
    source_id: "demo-004",
    question: "Will the SF Giants make the 2026 MLB playoffs?",
    category: "sports",
    closes_at: "2026-09-30T23:59:00Z",
    resolved_at: "2026-04-15T20:00:00Z",
    resolved_outcome: false,
    outcome_yes_price: 0.42,
    status: "resolved",
    url: "https://polymarket.com/event/demo-004",
  },
  {
    id: "m-005",
    source: "polymarket",
    source_id: "demo-005",
    question: "Will OpenAI release a model with > 1 trillion params publicly?",
    category: "ai-tech",
    closes_at: "2026-06-30T23:59:00Z",
    resolved_at: "2026-04-30T12:00:00Z",
    resolved_outcome: false,
    outcome_yes_price: 0.27,
    status: "resolved",
    url: "https://polymarket.com/event/demo-005",
  },
  {
    id: "m-006",
    source: "manifold",
    source_id: "demo-006",
    question: "Will Anthropic raise a Series F by July 2026?",
    category: "other",
    closes_at: "2026-07-31T23:59:00Z",
    resolved_at: "2026-04-08T09:00:00Z",
    resolved_outcome: true,
    outcome_yes_price: 0.55,
    status: "resolved",
    url: "https://manifold.markets/demo-006",
  },
  {
    id: "m-007",
    source: "polymarket",
    source_id: "demo-007",
    question: "Will ETH/BTC ratio exceed 0.06 by June 2026?",
    category: "crypto",
    closes_at: "2026-06-30T23:59:00Z",
    resolved_at: "2026-04-29T18:00:00Z",
    resolved_outcome: false,
    outcome_yes_price: 0.32,
    status: "resolved",
    url: "https://polymarket.com/event/demo-007",
  },
  {
    id: "m-008",
    source: "polymarket",
    source_id: "demo-008",
    question: "Will the LA Lakers win an NBA Finals game in 2026?",
    category: "sports",
    closes_at: "2026-07-15T23:59:00Z",
    resolved_at: "2026-04-25T22:00:00Z",
    resolved_outcome: false,
    outcome_yes_price: 0.34,
    status: "resolved",
    url: "https://polymarket.com/event/demo-008",
  },
  {
    id: "m-009",
    source: "manifold",
    source_id: "demo-009",
    question: "Will a major US tech company announce >10k layoffs in Q2 2026?",
    category: "other",
    closes_at: "2026-06-30T23:59:00Z",
    resolved_at: "2026-04-18T14:00:00Z",
    resolved_outcome: true,
    outcome_yes_price: 0.61,
    status: "resolved",
    url: "https://manifold.markets/demo-009",
  },
  {
    id: "m-010",
    source: "polymarket",
    source_id: "demo-010",
    question: "Will the S&P 500 close above 6,000 on May 1, 2026?",
    category: "other",
    closes_at: "2026-05-01T20:00:00Z",
    resolved_at: "2026-05-01T20:30:00Z",
    resolved_outcome: true,
    outcome_yes_price: 0.78,
    status: "resolved",
    url: "https://polymarket.com/event/demo-010",
  },
  {
    id: "m-011",
    source: "manifold",
    source_id: "demo-011",
    question: "Will Claude 5 (or equivalent Anthropic flagship) ship in 2026?",
    category: "ai-tech",
    closes_at: "2026-12-31T23:59:00Z",
    resolved_at: "2026-04-12T10:00:00Z",
    resolved_outcome: true,
    outcome_yes_price: 0.83,
    status: "resolved",
    url: "https://manifold.markets/demo-011",
  },
  {
    id: "m-012",
    source: "polymarket",
    source_id: "demo-012",
    question: "Will Solana market cap exceed $200B in 2026?",
    category: "crypto",
    closes_at: "2026-12-31T23:59:00Z",
    resolved_at: "2026-04-10T14:00:00Z",
    resolved_outcome: true,
    outcome_yes_price: 0.46,
    status: "resolved",
    url: "https://polymarket.com/event/demo-012",
  },
  {
    id: "m-013",
    source: "polymarket",
    source_id: "demo-013",
    question: "Will the UK call a general election before October 2026?",
    category: "politics",
    closes_at: "2026-10-01T00:00:00Z",
    resolved_at: "2026-04-05T08:00:00Z",
    resolved_outcome: false,
    outcome_yes_price: 0.25,
    status: "resolved",
    url: "https://polymarket.com/event/demo-013",
  },
  {
    id: "m-014",
    source: "manifold",
    source_id: "demo-014",
    question: "Will OpenAI's annualized revenue exceed $20B in 2026?",
    category: "ai-tech",
    closes_at: "2026-12-31T23:59:00Z",
    resolved_at: "2026-04-20T16:00:00Z",
    resolved_outcome: true,
    outcome_yes_price: 0.58,
    status: "resolved",
    url: "https://manifold.markets/demo-014",
  },
  {
    id: "m-015",
    source: "polymarket",
    source_id: "demo-015",
    question: "Will a major sovereign nation adopt BTC as legal tender in 2026?",
    category: "crypto",
    closes_at: "2026-12-31T23:59:00Z",
    resolved_at: "2026-04-02T11:00:00Z",
    resolved_outcome: false,
    outcome_yes_price: 0.13,
    status: "resolved",
    url: "https://polymarket.com/event/demo-015",
  },
  {
    id: "m-016",
    source: "polymarket",
    source_id: "demo-016",
    question: "Will the World Series end in 4 games in 2026?",
    category: "sports",
    closes_at: "2026-11-05T23:59:00Z",
    resolved_at: "2026-04-28T21:00:00Z",
    resolved_outcome: false,
    outcome_yes_price: 0.16,
    status: "resolved",
    url: "https://polymarket.com/event/demo-016",
  },

  // OPEN markets (9) — show "open positions" tab and live ticker
  {
    id: "m-017",
    source: "polymarket",
    source_id: "demo-017",
    question: "Will the Fed cut rates at the June 2026 FOMC meeting?",
    category: "other",
    closes_at: "2026-06-12T18:00:00Z",
    outcome_yes_price: 0.43,
    status: "open",
    url: "https://polymarket.com/event/demo-017",
  },
  {
    id: "m-018",
    source: "polymarket",
    source_id: "demo-018",
    question: "Will Bitcoin trade above $150,000 by end of 2026?",
    category: "crypto",
    closes_at: "2026-12-31T23:59:00Z",
    outcome_yes_price: 0.34,
    status: "open",
    url: "https://polymarket.com/event/demo-018",
  },
  {
    id: "m-019",
    source: "manifold",
    source_id: "demo-019",
    question: "Will Anthropic release Claude 5 / Opus 5 by end of 2026?",
    category: "ai-tech",
    closes_at: "2026-12-31T23:59:00Z",
    outcome_yes_price: 0.51,
    status: "open",
    url: "https://manifold.markets/demo-019",
  },
  {
    id: "m-020",
    source: "polymarket",
    source_id: "demo-020",
    question: "Will the 2026 Super Bowl host city be in the top-10 by population?",
    category: "sports",
    closes_at: "2026-08-01T23:59:00Z",
    outcome_yes_price: 0.62,
    status: "open",
    url: "https://polymarket.com/event/demo-020",
  },
  {
    id: "m-021",
    source: "polymarket",
    source_id: "demo-021",
    question: "Will Donald Trump's approval rating exceed 50% on July 4, 2026?",
    category: "politics",
    closes_at: "2026-07-04T23:59:00Z",
    outcome_yes_price: 0.36,
    status: "open",
    url: "https://polymarket.com/event/demo-021",
  },
  {
    id: "m-022",
    source: "manifold",
    source_id: "demo-022",
    question: "Will OpenAI publicly demo a model with >5 hour autonomous task in 2026?",
    category: "ai-tech",
    closes_at: "2026-12-31T23:59:00Z",
    outcome_yes_price: 0.45,
    status: "open",
    url: "https://manifold.markets/demo-022",
  },
  {
    id: "m-023",
    source: "polymarket",
    source_id: "demo-023",
    question: "Will Solana reach all-time-high price in 2026?",
    category: "crypto",
    closes_at: "2026-12-31T23:59:00Z",
    outcome_yes_price: 0.41,
    status: "open",
    url: "https://polymarket.com/event/demo-023",
  },
  {
    id: "m-024",
    source: "manifold",
    source_id: "demo-024",
    question: "Will an AI agent autonomously file a US patent application in 2026?",
    category: "ai-tech",
    closes_at: "2026-12-31T23:59:00Z",
    outcome_yes_price: 0.22,
    status: "open",
    url: "https://manifold.markets/demo-024",
  },
  {
    id: "m-025",
    source: "polymarket",
    source_id: "demo-025",
    question: "Will the EU pass a comprehensive AI safety regulation by Q4 2026?",
    category: "politics",
    closes_at: "2026-12-31T23:59:00Z",
    outcome_yes_price: 0.48,
    status: "open",
    url: "https://polymarket.com/event/demo-025",
  },
];

/** Generate deterministic-ish demo predictions for each agent on each market. */
function makeDemoPredictions(): DemoPrediction[] {
  const out: DemoPrediction[] = [];
  // Distinct agent biases tuned so the leaderboard has variety + realism
  const biases: Record<string, { offset: number; noise: number; conf: "low" | "medium" | "high" }> = {
    sage: { offset: 0.02, noise: 0.06, conf: "high" },     // small base-rate adjustment
    hawk: { offset: -0.08, noise: 0.13, conf: "medium" }, // contrarian, swings hard
    magpie: { offset: 0.05, noise: 0.11, conf: "medium" }, // fast, biased toward yes
    echo: { offset: 0.0, noise: 0.03, conf: "low" },        // anchors to market price
    mirror: { offset: -0.02, noise: 0.08, conf: "medium" }, // GPT, slightly contra
    ensemble: { offset: 0.0, noise: 0.0, conf: "high" },     // computed below
  };

  const reasoningTemplates: Record<string, (q: string, p: number) => string> = {
    sage: (q, p) =>
      `Reference class: questions like "${q.slice(0, 40)}..." Base rate ~${Math.round(p * 100)}%. Adjusting for the specific factors raises/lowers slightly.`,
    hawk: (q, p) =>
      `Market consensus says ${Math.round(p * 100)}%. The crowd is anchored to recency. The strongest case against: structural conditions favor the opposite.`,
    magpie: (q, p) =>
      `Quick read: market at ${Math.round(p * 100)}%, headline cuts toward this outcome. Going slightly above.`,
    echo: (q, p) =>
      `Market prior ${Math.round(p * 100)}%. No new dispositive information since the latest move. Keeping near consensus.`,
    mirror: (q, p) =>
      `Different lab, same question. My estimate accounts for ambiguity in the resolution criteria more than the market does.`,
    ensemble: () =>
      `Equal-weighted average of the five non-synthetic agents on this market.`,
  };

  // Use a deterministic seed for noise, so demo data is the same every render
  let seed = 12345;
  function rng() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (const market of DEMO_MARKETS) {
    const pricedAt = market.outcome_yes_price;
    // Compute non-synthetic agent predictions first
    const indPredictions: DemoPrediction[] = [];
    for (const agent of AGENTS) {
      if (agent.synthetic) continue;
      const bias = biases[agent.id]!;
      const noise = (rng() - 0.5) * 2 * bias.noise;
      let p = pricedAt + bias.offset + noise;
      p = Math.max(0.02, Math.min(0.98, p));

      const created = new Date(
        new Date(market.closes_at).getTime() -
          // Random hours before close
          (1 + Math.floor(rng() * 48)) * 3600_000
      ).toISOString();

      const pred: DemoPrediction = {
        agent_id: agent.id,
        market_id: market.id,
        probability: Number(p.toFixed(4)),
        confidence: bias.conf,
        reasoning: reasoningTemplates[agent.id]!(market.question, pricedAt),
        market_price_at_forecast: pricedAt,
        created_at: created,
      };
      indPredictions.push(pred);
      out.push(pred);
    }
    // Ensemble = average of non-synthetic predictions
    const avg =
      indPredictions.reduce((s, p) => s + p.probability, 0) /
      indPredictions.length;
    out.push({
      agent_id: "ensemble",
      market_id: market.id,
      probability: Number(avg.toFixed(4)),
      confidence: "medium",
      reasoning: reasoningTemplates.ensemble!(market.question, pricedAt),
      market_price_at_forecast: pricedAt,
      created_at: indPredictions[0]!.created_at,
    });
  }
  return out;
}

export const DEMO_PREDICTIONS = makeDemoPredictions();

/** Score the demo predictions for resolved markets. */
export const DEMO_SCORES: DemoScore[] = (() => {
  const out: DemoScore[] = [];
  let pid = 0;
  for (const pred of DEMO_PREDICTIONS) {
    const market = DEMO_MARKETS.find((m) => m.id === pred.market_id)!;
    if (market.status !== "resolved") continue;
    pid += 1;
    const outcome = market.resolved_outcome ? 1 : 0;
    const p = Math.max(0.0001, Math.min(0.9999, pred.probability));
    const brier = (p - outcome) ** 2;
    const log_loss = -(outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p));
    const wasCorrect = (p > 0.5) === Boolean(outcome);
    // Kelly fraction = 0.25 of bankroll $100, entered at market price
    // PnL ≈ 0.25 * 100 * (outcome - market_price) if we took yes,
    //       0.25 * 100 * (market_price - outcome) if we took no
    const tookYes = p > pred.market_price_at_forecast;
    const stake = 25;
    const paper_pnl = tookYes
      ? stake * (outcome - pred.market_price_at_forecast)
      : stake * (pred.market_price_at_forecast - outcome);
    out.push({
      prediction_id: `pred-${pid}`,
      agent_id: pred.agent_id,
      market_id: pred.market_id,
      brier: Number(brier.toFixed(4)),
      log_loss: Number(log_loss.toFixed(4)),
      paper_pnl: Number(paper_pnl.toFixed(2)),
      was_correct: wasCorrect,
    });
  }
  return out;
})();

/** Wilson 95% interval helper. */
function wilson(p: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const z = 1.96;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const halfwidth = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: Math.max(0, center - halfwidth), high: Math.min(1, center + halfwidth) };
}

function makeDemoStats(): DemoAgentStats[] {
  const stats: DemoAgentStats[] = [];
  for (const agent of AGENTS) {
    const myScores = DEMO_SCORES.filter((s) => s.agent_id === agent.id);
    const total = myScores.length;
    if (total === 0) {
      stats.push({
        agent_id: agent.id,
        brier_30d: 0.25,
        log_loss_30d: 0.69,
        total_predictions: 0,
        total_scored: 0,
        win_rate_30d: 0,
        paper_pnl_30d: 0,
        crucible_score: 0,
        rank: 99,
        rank_delta_24h: 0,
        calibration: [],
      });
      continue;
    }
    const brier = myScores.reduce((s, x) => s + x.brier, 0) / total;
    const logloss = myScores.reduce((s, x) => s + x.log_loss, 0) / total;
    const wins = myScores.filter((x) => x.was_correct).length;
    const pnl = myScores.reduce((s, x) => s + x.paper_pnl, 0);

    // 10-bin calibration
    const bins: { bin_low: number; bin_high: number; n: number; observed_rate: number; ci_low: number; ci_high: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const low = i / 10;
      const high = (i + 1) / 10;
      const myPredsInBin = DEMO_PREDICTIONS.filter(
        (p) => p.agent_id === agent.id && p.probability >= low && p.probability < (i === 9 ? 1.001 : high)
      );
      // Match each prediction to its market resolution
      const resolved = myPredsInBin
        .map((p) => DEMO_MARKETS.find((m) => m.id === p.market_id))
        .filter((m): m is DemoMarket => m?.status === "resolved");
      const n = resolved.length;
      const wonCount = resolved.filter((m) => m.resolved_outcome).length;
      const obsRate = n > 0 ? wonCount / n : 0;
      const w = wilson(obsRate, n);
      bins.push({
        bin_low: low,
        bin_high: high,
        n,
        observed_rate: obsRate,
        ci_low: w.low,
        ci_high: w.high,
      });
    }

    stats.push({
      agent_id: agent.id,
      brier_30d: Number(brier.toFixed(4)),
      log_loss_30d: Number(logloss.toFixed(4)),
      total_predictions: DEMO_PREDICTIONS.filter((p) => p.agent_id === agent.id).length,
      total_scored: total,
      win_rate_30d: total > 0 ? wins / total : 0,
      paper_pnl_30d: Number(pnl.toFixed(2)),
      crucible_score: 0, // computed below
      rank: 99,
      rank_delta_24h: 0,
      calibration: bins,
    });
  }
  // Compute Crucible Score = 50% * (1 - Brier_norm) + 30% * winrate + 20% * (1 - logloss_norm)
  const minBrier = Math.min(...stats.map((s) => s.brier_30d));
  const maxBrier = Math.max(...stats.map((s) => s.brier_30d));
  const minLL = Math.min(...stats.map((s) => s.log_loss_30d));
  const maxLL = Math.max(...stats.map((s) => s.log_loss_30d));
  for (const s of stats) {
    const brierNorm = maxBrier > minBrier ? (s.brier_30d - minBrier) / (maxBrier - minBrier) : 0;
    const llNorm = maxLL > minLL ? (s.log_loss_30d - minLL) / (maxLL - minLL) : 0;
    s.crucible_score = Number(
      (0.5 * (1 - brierNorm) + 0.3 * s.win_rate_30d + 0.2 * (1 - llNorm)).toFixed(4)
    );
  }
  // Rank by crucible score desc
  stats.sort((a, b) => b.crucible_score - a.crucible_score);
  stats.forEach((s, i) => {
    s.rank = i + 1;
    // demo: pretend ensemble climbed 1, hawk dropped 1
    s.rank_delta_24h = s.agent_id === "ensemble" ? 1 : s.agent_id === "hawk" ? -1 : 0;
  });
  return stats;
}

export const DEMO_AGENT_STATS = makeDemoStats();

export const DEMO_EUREKA_CARDS: DemoEurekaCard[] = [
  {
    id: "ek-001",
    headline: "The crowd has the best calibration. So far.",
    body:
      "Crowd (uniform-weight ensemble of all 5 individual agents) leads the leaderboard with Brier 0.18. Best individual: Sage at 0.21. Wisdom of (AI) crowds is real — at least on the first 16 markets.",
    generated_at: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
  },
  {
    id: "ek-002",
    headline: "Hawk's contrarian streak is over.",
    body:
      "After winning 7 of 9 contrarian bets in March, Hawk has lost 5 in a row. The market is harder to disagree with when news cycles get noisy. Calibration plot shows the over-confidence band widening.",
    generated_at: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
  },
  {
    id: "ek-003",
    headline: "Echo (price-anchor) beats Sage (deep-research) on quiet days.",
    body:
      "Across 7 markets where the price moved less than 5pp in the 24h before close, Echo's Brier was 0.16 vs Sage's 0.22. When there's no real news, anchoring beats reasoning.",
    generated_at: new Date(Date.now() - 1000 * 60 * 92).toISOString(),
  },
];
