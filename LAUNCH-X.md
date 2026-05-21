# X / Twitter launch — @deforestpeg (Thursday 9-11am ET)

## Account context

- `@claygdev` got suspended while operator was in Germany. No appeal.
- Rebranded `@deforestpeg` (existing acct, ~763 cold followers from May-2022)
- Current state: bio still says "23. building AI security tooling. solhunt: autonomous DeFi exploit agent."
- Pinned tweet: solhunt 67.7% hook
- Most recent tweet (2026-05-17 + bridge tweet 2026-05-20): "One month since solhunt-duel..." + "verifier gate insight kept paying off..."
- Account brand = solhunt → Eivra is the chapter-3 transition

## Recommended bio update before launch

Replace bio with:
```
building agent eval rigs. solhunt (defi exploit) → solhunt-duel (red/blue verifier gates) → eivra (LLM forecasting benchmark, live).
eivra.xyz · github.com/claygeo
```

That carries the narrative arc and surfaces Eivra without sounding salesy.

## What shipped while operator was in Germany

**2026-05-20 (today):**
- `dfdfcb7` — solhunt-duel-style dense OG hero (full leaderboard table + stack badges)
- `d7dc3a7` — **LIVE MODE FORECASTING SHIPPED.** Agents now lock predictions on OPEN markets every 12h via VPS cron. No look-ahead by construction.
- `bb7e64d` — Live counter on homepage hero + LIVE/BACKFILL badges on /markets/[id]
- `3493752` — OG image shows "50 live in flight" prominently
- Plus 17 cloud-routine polish commits that had been silently broken (build was failing on `getCalibrationData` import). Fixed → all of it now deployed.
- VPS rotation patch — the May 5–20 "no new predictions" outage was a bug where cron always picked the same 30 cached markets. Fixed.
- 50 live forecasts on 10 open markets: Lakers/Spurs NBA Finals · Bitcoin $85K May 2026 · Trump-Greenland-2027 · Arsenal EPL · Hunter Biden 2028 · Bitcoin $90K · next Gemini vs Opus 4.7/GPT-5

**Current live numbers (eivra.xyz):**
- 52 resolved markets, 50 live forecasts in flight, 113 open markets watched
- **Hawk leads at 98% win rate, 0.027 Brier across 49 resolutions**
- $0 Anthropic API spend (Max sub via `claude -p` subprocess)

## The thread (5 tweets, in @deforestpeg voice)

**Tweet 1** — the hook (attach `og-card-v3-live.png` or `01-home.png`)

```
Built eivra: six AI agents forecast Polymarket + Manifold. Every call scored with Brier + log-loss + calibration.

NEW: live mode. Agents now lock probability forecasts on OPEN markets every 12h. Zero look-ahead.

Hawk leads at 0.027 Brier, 98% win on 49 resolutions.

$0 API cost. Max sub via `claude -p`.

https://eivra.xyz
```

**Tweet 2** — the cast (attach `03-leaderboard.png`)

```
Six agents, distinct system prompts:

Sage (Opus 4.7, deliberative)
Hawk (Opus 4.7, contrarian)
Magpie (Sonnet 4.6, snap forecasts)
Echo (Haiku 4.5, market-anchored)
Mirror (cross-family control)
Crowd (uniform ensemble)

Hawk's edge: steelman both sides, take positions more extreme than the market when it finds real mispricings, abstain otherwise.
```

**Tweet 3** — the live mode anti-lookahead pitch (attach `06-markets.png` showing a market detail with LIVE badge)

```
The skeptical move on any AI benchmark is "did the model see this in training?"

eivra now writes live forecasts on OPEN markets — 50 in flight as of this tweet. predictions.created_at = NOW(), is_backfill = false. Scoring runs only after the market resolves.

The lock is the receipt.
```

**Tweet 4** — calibration is the second question (attach `02-benchmark.png` showing the 6 calibration plots)

```
The leaderboard isn't the whole point. Calibration is.

When an agent says "70%", does it win 70% of the time?

Per-agent 10-bin reliability plots with Wilson 95% intervals. Hollow dots = n<5 sparse bins, not counted toward over/under-confidence. Stats-honest.
```

**Tweet 5** — the build context (attach the homepage commit graph if available, or `01-home.png`)

```
Built in ~2 weeks. claude -p subprocess on a Hetzner VPS (€4.69/mo). Max sub auth, $0 Anthropic API.

4 crons: open-market pull (15m) · backfill scoring (6h) · live forecasting (12h, just shipped) · insight cards (24h).

All code:
https://github.com/claygeo/eivra

Next: open agent submissions.
```

## Screenshot files (`Desktop/eivra-screenshots/`)

| Tweet | File | Shows |
|---|---|---|
| 1 hook | `og-card-v3-live.png` (preferred) or `01-home.png` | OG card with 50 live in flight + full leaderboard, OR homepage hero |
| 2 cast | `03-leaderboard.png` | All 6 agents with EIVRA/Brier/Win/P&L columns |
| 3 live | `06-markets.png` | Markets list with mix of resolved + open |
| 4 calibration | `02-benchmark.png` | 6 calibration plots + Top Disagreements panel |
| 5 build | `01-home.png` | Homepage with counter row visible |

Alt agent profile screenshots: `05-hawk.png` shows Hawk's full page with calibration plot + recent forecasts.

## Reply prep (anticipated critiques)

**"Is this just a Claude wrapper?"**
> Six different prompts + four model families + a uniform ensemble that gets beaten by 5 of the 6 individuals. The novelty is the scoring rig: Brier/log-loss/calibration/ELO on real prediction-market resolutions, with live-mode lock-and-wait so there's no training-data leak. Infra is the product.

**"Backfill = lookahead, this is meaningless."**
> Backfill predictions are flagged `is_backfill=true` and contribute to the historical aggregate. As of 2026-05-20 there are also 50 LIVE forecasts (`is_backfill=false`, locked at submission time on still-open markets). Those become the lookahead-free training data over the coming weeks.

**"Mirror isn't really GPT-5."**
> Mirror's "GPT-5" slot currently runs as Sonnet-with-different-prompt. Operator is on Claude Max, no OpenAI API. Disclosed on the agent card. If OpenAI sponsors a key, Mirror becomes a real cross-family A/B.

**"How are you running this for $0?"**
> `claude -p` subprocess on a Hetzner VPS. Operator's Max subscription handles auth. The subprocess inherits the session, makes the call, emits JSON. No `ANTHROPIC_API_KEY` set. Total fixed cost: €4.69/mo VPS.

## Posting notes

- **Time:** Thursday 9-11am ET for max ML-twitter eyeballs
- **Tag in body:** mention `@anthropicai` and `@OpenRouter` ONLY if you specifically discuss model choice — don't quote-tweet
- **Tag in replies:** `@manifoldmarkets` / `@Polymarket` if someone asks about a specific market
- **After ~6h:** if traction is thin, drop one of the calibration plot images as a reply tweet — never engagement-bait
- **Show HN:** schedule for 24-48h after the X thread so HN comments can ref the thread's signal

## DM follow-up template

For the random replier from 2026-05-20 who asked about security tooling and offered "love cyber and AI":

```
mostly smart contract stuff. solhunt is an AI agent that reads solidity, writes a foundry exploit test, runs it on forked mainnet, iterates. hit 67.7% on a curated DeFiHackLabs subset, 13% on a random one. that gap drove the verifier-gate design in solhunt-duel.
```

If he engages on Eivra: send the eivra.xyz link with "applied the same `agents-can't-grade-themselves` insight to forecasting — the prediction market IS the verifier."
