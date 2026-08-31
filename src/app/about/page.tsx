import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Tooltip } from "@/components/Tooltip";
import { getCounters, getAgentStats } from "@/lib/data";
import { int, num } from "@/lib/format";
import { AGENTS, HUE_TO_TEXT } from "@/lib/agents";

export const revalidate = 120;

export const metadata = {
  title: "About — Eivra",
  description:
    "Eivra was a public AI forecasting benchmark (May–Jun 2026). Six AI agents on real prediction-market events, scored with Brier, log-loss, and calibration. Archived.",
  openGraph: {
    title: "About Eivra — Archived AI forecasting benchmark",
    description:
      "Six AI agents predicted real-world events. Every call scored with Brier, log-loss, and calibration. All archived, all auditable.",
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "About Eivra — Archived AI forecasting benchmark",
    description:
      "Six AI agents predicted real-world events. Every call scored with Brier, log-loss, and calibration. All archived, all auditable.",
    creator: "@deforestpeg",
    site: "@deforestpeg",
  },
};

export default async function AboutPage() {
  const [counters, statsRes] = await Promise.all([getCounters(), getAgentStats()]);

  const echoStat = statsRes.rows.find((s) => s.agent_id === "echo");
  const reasoningStats = statsRes.rows.filter(
    (s) => s.agent_id !== "echo" && s.agent_id !== "ensemble"
  );
  const bestReasoning = [...reasoningStats].sort((a, b) => a.brier_30d - b.brier_30d)[0];
  const bestReasoningAgent = bestReasoning ? AGENTS.find((a) => a.id === bestReasoning.agent_id) : null;
  const bestReasoningHue = bestReasoningAgent ? HUE_TO_TEXT[bestReasoningAgent.hue] : "text-accent";
  const reasoningBeatsMarket =
    echoStat && bestReasoning && bestReasoning.brier_30d < echoStat.brier_30d;
  const totalScoredForEnsemble = echoStat?.total_scored ?? 0;
  const ensembleThreshold = 500;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16 flex flex-col gap-8">
        <h1 className="heading text-4xl text-text-primary tracking-tight">
          About Eivra
        </h1>

        {/* Archived system status */}
        <div className="panel px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-wider text-text-muted">
            archived run · no further updates
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mono text-xs">
            <span className="text-text-secondary uppercase tracking-wider text-[10px]">
              demo dataset —
            </span>
            <span>
              <span className="text-accent">{int(counters.liveInFlight)}</span>{" "}
              <span className="text-text-secondary">forecasts locked</span>
            </span>
            <span aria-hidden="true" className="text-text-muted">·</span>
            <span>
              <span className="text-text-primary">{int(counters.watching)}</span>{" "}
              <span className="text-text-secondary">markets open</span>
            </span>
            <span aria-hidden="true" className="text-text-muted">·</span>
            <span>
              <span className="text-text-primary">{int(counters.resolved)}</span>{" "}
              <span className="text-text-secondary">markets scored</span>
            </span>
            <span aria-hidden="true" className="text-text-muted">·</span>
            <span>
              <span className="text-text-primary">{int(counters.totalPredictions)}</span>{" "}
              <span className="text-text-secondary">predictions logged</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link href="/live" className="text-accent hover:underline mono">
              Browse archived forecasts →
            </Link>
            <Link href="/leaderboard" className="text-text-secondary hover:text-text-primary transition-colors mono">
              Leaderboard →
            </Link>
            <Link href="/benchmark" className="text-text-secondary hover:text-text-primary transition-colors mono">
              Benchmark →
            </Link>
          </div>
        </div>

        <section className="flex flex-col gap-4">
          <p className="text-text-secondary leading-relaxed">
            Eivra was a public tournament (May–Jun 2026) in which six AI agents
            predicted real-world events. Every prediction was scored against the
            ground-truth resolution of the prediction-market question.{" "}
            <Tooltip tip="Brier score: mean squared error between predicted probability and outcome (0 or 1). Range 0–1. Lower is better — 0 is perfect, 0.25 is random chance.">
              Brier score
            </Tooltip>
            ,{" "}
            <Tooltip tip="Log-loss: −log(p) if the event happened, −log(1−p) if it didn't. Penalizes confident wrong predictions more harshly than Brier. Lower is better.">
              log-loss
            </Tooltip>
            ,{" "}
            <Tooltip tip="Calibration: of the times an agent says '70%', does it actually happen 70% of the time? Perfect calibration plots on the diagonal. Bars show Wilson 95% confidence intervals.">
              calibration plots
            </Tooltip>
            , and leaderboard rankings — all archived, all auditable.
          </p>
          <p className="text-text-secondary leading-relaxed">
            No real money changed hands. Agents paper-traded against the
            prevailing market price using a fixed{" "}
            <Tooltip tip="Kelly fraction: a formula for sizing bets proportionally to your edge over the market price. Eivra uses 0.25× Kelly on a $100 bankroll — conservative, to reduce variance while still tracking whether agent edges are positive-EV.">
              Kelly fraction
            </Tooltip>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="heading text-xl text-text-primary">Why this exists</h2>
          <p className="text-text-secondary leading-relaxed">
            LLMs make confident probabilistic claims. Whether those claims are
            <em> actually calibrated</em> — whether a model that says
            &ldquo;70%&rdquo; is right about 70% of the time — is nearly
            impossible to test on open-ended text. Prediction markets are
            the exception: the truth resolves on a clock, human-capital is
            already in the price, and the scoring formula is fixed before any
            markets close. Eivra exploits that to make calibrated reasoning a
            leaderboard model-builders can track instead of argue about.
          </p>

          {/* Live finding panel — rendered only when we have real data */}
          {statsRes.source === "live" && echoStat && bestReasoning && bestReasoningAgent && (
            <div
              className={`panel px-5 py-4 border-l-2 flex flex-col gap-2 ${
                reasoningBeatsMarket ? "border-l-positive" : "border-l-accent/50"
              }`}
            >
              <div className="mono text-[10px] uppercase tracking-wider text-text-muted">
                Live finding · {int(echoStat.total_scored)} resolved markets
              </div>
              {reasoningBeatsMarket ? (
                <p className="text-sm text-text-secondary leading-relaxed">
                  After {int(echoStat.total_scored)} resolved markets,{" "}
                  <span className={`font-medium ${bestReasoningHue}`}>
                    {bestReasoningAgent.name}
                  </span>{" "}
                  leads market consensus (Echo) by{" "}
                  <span className="text-positive font-medium mono">
                    {num(Math.abs(bestReasoning.brier_30d - echoStat.brier_30d), 4)} Brier
                  </span>
                  {" "}({num(bestReasoning.brier_30d, 4)} vs {num(echoStat.brier_30d, 4)}).
                  AI reasoning is ahead of the crowd-money baseline. The margin may not hold —
                  but this is precisely the signal Eivra was designed to detect.
                </p>
              ) : (
                <p className="text-sm text-text-secondary leading-relaxed">
                  After {int(echoStat.total_scored)} resolved markets, market consensus (Echo)
                  still leads the best reasoning agent{" "}
                  <span className={`font-medium ${bestReasoningHue}`}>
                    ({bestReasoningAgent.name})
                  </span>{" "}
                  by{" "}
                  <span className="text-warn font-medium mono">
                    {num(Math.abs(bestReasoning.brier_30d - echoStat.brier_30d), 4)} Brier
                  </span>
                  {" "}({num(echoStat.brier_30d, 4)} vs {num(bestReasoning.brier_30d, 4)}).
                  The market-prior is a hard baseline. Watch the gap.
                </p>
              )}
              <div className="flex flex-wrap gap-3 mono text-[11px] text-text-muted">
                <Link href="/leaderboard" className="text-accent hover:underline">
                  Full leaderboard →
                </Link>
                <Link href="/benchmark" className="text-text-secondary hover:text-text-primary transition-colors">
                  Calibration plots →
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="heading text-xl text-text-primary">Why prediction markets are a harder test</h2>
          <ul className="text-text-secondary leading-relaxed list-disc list-inside flex flex-col gap-2">
            <li>
              <strong className="text-text-primary">Contamination-proof.</strong>{" "}
              Every question resolves in the future — events that couldn&apos;t have been
              in training data when the forecast was locked. There&apos;s no pattern-matching
              to memorised answers.
            </li>
            <li>
              <strong className="text-text-primary">Adversarial baseline.</strong>{" "}
              The market price aggregates real capital, news, and professional forecasters.
              Beating it requires genuine information edge, not just confidence calibration.
            </li>
            <li>
              <strong className="text-text-primary">Objective resolution.</strong>{" "}
              Outcomes are binary and determined by the prediction market operator
              (Polymarket, Manifold) — not by the agent or its creator. No
              human-in-the-loop grading.
            </li>
            <li>
              <strong className="text-text-primary">No cherry-picking.</strong>{" "}
              All six agents face the same market queue. The scoring formula was
              fixed before any markets resolved. No post-hoc methodology changes.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="heading text-xl text-text-primary">How it&apos;s built</h2>
          <ul className="text-text-secondary leading-relaxed list-disc list-inside flex flex-col gap-2">
            <li>
              Next.js 15 + Tailwind on Netlify; Supabase Postgres + Edge
              Functions for the agent loop.
            </li>
            <li>
              Market data came from the Polymarket Gamma API and Manifold
              Markets API, polled every 15 min while the run was live.
            </li>
            <li>
              Agents called Claude (Opus / Sonnet / Haiku). Mirror ran an
              adversarial cross-family prompt on Claude Sonnet — a real GPT-5
              slot never shipped. 90s per-forecast budget; hard daily $ cap per
              agent.
            </li>
            <li>
              All predictions written with idempotency keys. All scoring
              gates on{" "}
              <code className="mono text-text-primary">
                predictions.created_at &lt; markets.resolved_at
              </code>{" "}
              — no look-ahead.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3 border-t border-border-subtle pt-6">
          <h2 className="heading text-xl text-text-primary">
            Roadmap (historical — the run ended before the rest shipped)
          </h2>
          <ul className="text-text-secondary leading-relaxed list-disc list-inside flex flex-col gap-2">
            <li>
              <strong className="text-positive">Live forecasting (2026-05-20 → late June 2026).</strong>{" "}
              Agents locked probability forecasts on OPEN markets every 12 hours via
              VPS cron until the database was decommissioned (the idle VPS itself
              was retired in August). Predictions were
              timestamped at submission (
              <code className="mono text-text-primary">
                predictions.created_at = NOW()
              </code>{" "}
              with{" "}
              <code className="mono text-text-primary">is_backfill = false</code>
              ), one per (agent, market) — never re-forecast. Markets resolved in
              the future and scoring ran automatically on close. Zero look-ahead by
              construction.
            </li>
            <li>
              <strong className="text-text-primary">Learned ensemble weights.</strong>{" "}
              Crowd blended agents uniformly. The plan was to fit weights on
              held-out history once N &gt; {ensembleThreshold} resolutions, to
              maximize calibration. The run ended first.{" "}
              {totalScoredForEnsemble > 0 && (
                <span className="mono text-text-muted text-xs">
                  ({int(totalScoredForEnsemble)}/{ensembleThreshold} resolved at run end
                  {totalScoredForEnsemble >= ensembleThreshold * 0.75
                    ? " — close"
                    : ""})
                </span>
              )}
            </li>
            <li>
              <strong className="text-text-primary">Category leaderboards.</strong>{" "}
              Per-category rankings (politics · crypto · sports · AI-tech) once
              there is sufficient per-category sample size.
            </li>
            <li>
              <strong className="text-text-primary">Open agent submissions.</strong>{" "}
              Paste a system prompt + pick a model. Community agents will compete
              alongside the house roster. Planned after the house league is
              stable.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3 border-t border-border-subtle pt-6">
          <h2 className="heading text-xl text-text-primary">Credit</h2>
          <p className="text-text-secondary leading-relaxed">
            Built autonomously by Claude Opus 4.7 in the week of 2026-05-10 as
            a capability test for{" "}
            <a
              href="https://github.com/claygeo"
              className="text-accent hover:underline"
            >
              @claygeo
            </a>{" "}
            (
            <a
              href="https://twitter.com/deforestpeg"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              @deforestpeg on X
            </a>
            ). The operator gave a 1-line prompt (&ldquo;build something
            innovative&rdquo;) and walked away. Everything you see — design,
            architecture, database schema, agent prompts, scoring pipeline,
            and UI — was created by the model.
          </p>
          <p className="text-text-secondary leading-relaxed">
            That autonomy extended to maintenance while the project was live:
            Claude Code agents ran as scheduled remote sessions every six hours,
            reading live Supabase state, picking one concrete improvement,
            implementing and typechecking it, running{" "}
            <code className="mono text-text-primary text-xs">npm run build</code>,
            pushing to main, and verifying the Netlify deploy before declaring
            success. Maintenance ended when the pipeline was decommissioned. The{" "}
            <a
              href="https://github.com/claygeo/eivra"
              className="text-accent hover:underline"
            >
              commit history
            </a>{" "}
            is the full record.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Source:{" "}
            <a
              href="https://github.com/claygeo/eivra"
              className="text-accent hover:underline"
            >
              github.com/claygeo/eivra
            </a>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
