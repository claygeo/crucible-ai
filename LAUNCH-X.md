# X / Twitter launch — @claygdev

## Goal

Land in front of ML twitter, calibration researchers, prediction-market nerds, AI engineering folks. Set up the Show HN follow-up.

## Visual assets to attach

- **Tweet 1:** screenshot of `/benchmark` page hero — "best agent Hawk, 0.037 Brier across 28 resolved" headline panel
- **Tweet 2:** screenshot of full leaderboard table (all 6 agents, Brier / log-loss / win % / paper P&L)
- **Tweet 3:** screenshot of one agent's calibration plot (Sage's is good — 10-bin reliability with Wilson intervals)
- **Tweet 4:** screenshot of disagreement chain — agents spread out on a single market
- **Tweet 5:** code shot or terminal showing `npm run build` succeed, or commit graph

Take screenshots at 1440x900 viewport, dark mode native to the site.

## The thread (5 tweets)

### Tweet 1 — the hook

> Built Eivra: six AI agents publicly bet on real prediction-market events. Polymarket + Manifold. Every prediction scored with Brier, log-loss, calibration plots.
>
> Best agent so far: Hawk (contrarian) at 0.037 Brier across 28 resolved markets.
>
> https://crucible-ai.netlify.app

*(attach /benchmark hero screenshot)*

### Tweet 2 — the cast

> Six agents, five distinct strategies + one ensemble:
>
> 🧠 Sage — deliberative, base-rate-anchored (Opus)
> 🦅 Hawk — contrarian, swings hard against consensus (Opus)
> 🐦 Magpie — snap forecasts, speed over depth (Sonnet)
> 🪞 Echo — anchors to market price, small Bayesian moves (Haiku)
> 🔍 Mirror — cross-family control (GPT-5 stand-in)
> 👥 Crowd — uniform-weight ensemble of the rest

*(attach leaderboard table screenshot)*

### Tweet 3 — calibration is where this gets interesting

> The leaderboard isn't the point. Calibration is.
>
> Of the times an agent says "70%", does it actually win 70% of the time?
>
> Each agent gets a 10-bin reliability plot with Wilson 95% intervals. Hollow dots = sparse bin, no over/under-confidence labeling. Stats-honest.

*(attach Sage's calibration plot)*

### Tweet 4 — the methodology card (this kills "AI hype" objections)

> Caveats I'm transparent about, displayed on every page:
>
> – Backfill mode: agents may have seen training-data news for some resolved markets. Flagged `is_backfill=true`.
> – No real money. Paper P&L at Kelly fraction 0.25 of $100.
> – Probs clamped to [1e-4, 1-1e-4] so log-loss doesn't explode on confident wrongs.

*(attach methodology card screenshot from /benchmark)*

### Tweet 5 — the build context

> Built this in a week. The backfill runs locally via `claude -p` subprocess — no Anthropic API spend, just Max sub. New resolved markets get scored every 6h on a Hetzner VPS.
>
> All code public:
> https://github.com/claygeo/crucible-ai
>
> Next: opening it to user-submitted agents. Send me prompts.

*(attach a screenshot of the cron + commit graph, or the homepage with live counters)*

## Posting notes

- **Don't quote-tweet @anthropicai or @openai** — looks thirsty
- Tag @Polymarket and @manifoldmarkets only if it's relevant to a specific market you reference
- Time the post for **Tuesday-Thursday 9am-11am ET** (max ML-twitter eyeballs)
- After ~6h, if it's not gaining traction: don't engagement-bait. Drop a screenshot of an interesting Eureka card as a reply tweet.
- Save the Show HN post for **24-48h after the X thread** so the social proof of "got X retweets" can be referenced in the HN comments

## Reply prep

Anticipate these critiques + prepared responses:

**"This is just a Claude wrapper."**
> The novelty isn't the LLM call, it's the public scoring rig: Brier/log-loss/calibration/ELO computed on real prediction-market resolutions. The infra is the product — pull → forecast → resolve → score → rank, all idempotent, all auditable in Supabase.

**"How do you prevent data leakage / training-data look-ahead?"**
> Resolution-date filter limits markets to post-training-cutoff resolutions where possible, and every backfill prediction is flagged `is_backfill=true`. The next milestone is live-mode forecasting on markets that resolve in the future — that's where the lookahead concern fully disappears.

**"Why no GPT? It's just Claude variants."**
> Mirror is the GPT-5 slot. Currently runs as Sonnet-with-different-prompt because operator is on a Claude Max sub and we're not paying for the OpenAI API yet. The agent card discloses this honestly. If OpenAI sponsors a key, Mirror gets upgraded — and that A/B test becomes interesting.

**"Solhunt + Eivra — are you the AI guy?"**
> They're complementary: Solhunt does adversarial security on Solidity contracts. Eivra does rigorous evaluation of AI forecasters. Together: "build autonomous systems and evaluate them honestly." That's the niche.
