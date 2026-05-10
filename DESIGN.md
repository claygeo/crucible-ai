# Crucible — Design System

> Aesthetic direction: **Bloomberg terminal meets Linear app meets a forensic case file.** Confident, dense, technical. No fluff, no playful illustrations, no rounded-corner consumer vibes.

## Core feel

- **Dark by default.** Light mode is a stretch.
- **Information density is a feature, not a bug.** This is a tool for people who like data.
- **Mono typography is prominent.** Anywhere we show numbers, agent reasoning, or live updates, JetBrains Mono.
- **One accent color.** Used sparingly for *active*, *confirmed*, *current focus*. Never decorative.

## Color tokens

```
--bg-canvas:     #0A0B0D    /* near-black, slight warmth */
--bg-panel:      #111317    /* card / panel bg */
--bg-panel-hi:   #161A20    /* hover / active */
--border-subtle: #1F242C    /* hairlines */
--border-strong: #2A313B    /* divider */
--text-primary:  #E6E9EE    /* body text */
--text-secondary:#9AA4B2    /* labels, meta */
--text-muted:    #7B8595    /* captions, timestamps — bumped from #5C6573 to pass WCAG AA (4.6:1 on bg-canvas) */
--accent:        #00C2A8    /* mint-teal, the ONLY accent */
--accent-soft:   #00C2A833  /* alpha overlay for accent washes */
--positive:      #4ADE80    /* P&L positive, correct prediction */
--negative:      #F87171    /* used SPARINGLY — only for resolved-wrong */
--warn:          #FBBF24    /* used SPARINGLY — only for low-confidence flags */
```

## Type stack

- **Headings:** `IBM Plex Sans` (500 / 600 weights, slightly tightened tracking)
- **Body:** `Inter` (400 / 500)
- **Mono / data / reasoning:** `JetBrains Mono` (400 / 500, 1.35 line-height, slight letter-spacing -0.01em)
- **Display (hero only):** `IBM Plex Sans` 700 with -2% tracking

## Layout grid

- 12-col grid, 24px gutter, 1280px max-width on desktop
- Panel = single card with `bg-panel`, 1px `border-subtle`, no shadow, optional 1px `accent-soft` top border for "live"
- Tables = full-width, mono for numbers, right-aligned numerics, sticky header

## Components — first batch

### Live ticker (bottom strip)
Fixed bottom bar, 56px tall, `bg-panel-hi`, mono, scrolling left-to-right with newest agent forecast. Format: `[AGENT] · [MARKET TITLE TRUNCATED] · [P=0.34] · [REASONING SNIPPET …]`. Accent dot pulse on the leftmost item.

**Accessibility / motion fallback:** when `prefers-reduced-motion: reduce`, the ticker switches to **discrete cycling**: shows one forecast at a time with a 4s dwell + 200ms cross-fade. No marquee scroll. Mobile (<480px): same discrete-cycle behavior unconditionally; marquee not rendered. Screen-reader: ticker is `aria-live="polite"` with each item announced as it appears.

### Leaderboard table
Columns: `RANK | AGENT | BRIER ↓ | LOG-LOSS ↓ | ELO | 7D Δ | P&L | LAST PICK`. Numeric columns mono right-aligned. Top row gets a 2px `accent` left border. Rank changes since yesterday shown as `▲2` / `▼1` in `accent` / `text-muted` respectively.

### Agent card
220×320 panel. Top: agent name in IBM Plex Sans 600 + 1-line "personality" tag in mono `text-muted`. Middle: 60×60 sparkline of last-30 predictions (correct=accent line up, wrong=text-muted line down). Bottom: stats grid (Brier / ELO / Picks 7d) + last-pick mono one-liner.

### Market detail
Header: market title (IBM Plex Sans 700) + close date + source pill (`POLYMARKET` / `MANIFOLD` / `KALSHI` mono). Body: market description in body type + question framing. Below: "AGENT FORECASTS" section — table with each agent's prob, sized as a horizontal bar (mono 0.34 next to the bar), reasoning expandable. Right column: "MARKET MOVEMENT" mini-chart (price over time, agent forecasts as dots).

### Evidence trail (per-prediction expansion)
JetBrains Mono, 13px, 1.35 line-height. Indented timeline:
```
2026-05-12T14:32:11Z  PULL    market_id=0x9b3a... title="Will GPT-5 ship in May?"
2026-05-12T14:32:13Z  CITE    https://news.ycombinator.com/item?id=...
2026-05-12T14:32:14Z  CITE    https://www.theverge.com/2026/05/...
2026-05-12T14:32:18Z  REASON  base rate of model launches in announced months: ~62%...
2026-05-12T14:32:22Z  CONCLUDE p=0.41  conf=medium  reasoning_tokens=2,140
```

Indicators:
- `CONCLUDE` line gets a left accent bar (the decision)
- `CITE` lines indent and use `text-secondary`
- `REASON` lines wrap, `text-primary`
- `ABSTAIN` (when an agent declines) gets a hollow `text-muted` x-marker, never red

### Calibration plot
10 bins on X (0-10%, 10-20%, ..., 90-100%). Y = realized win rate. Plot perfect-calibration diagonal in `border-strong`. Dots = bin centers in `accent`, sized by N predictions in that bin. Text annotation under-confidence / over-confidence regions.

**Statistical honesty:** every bin shows a **Wilson 95% interval** as a vertical bar through the dot. Bins with N<5 are rendered as hollow dots in `text-muted` (not accent) and excluded from the over/under-confidence region label. Bin counts annotated below the X axis (`n=12  n=8  n=21 …`). A "sample size" disclosure under the chart: `Total predictions in window: N · Resolved: M`. Without these, a 10-bin plot with 3 predictions per bin looks like noise.

### Disagreement chart (market detail page primary view)
Horizontal stacked bars, one row per agent, sorted by absolute distance from the market's current price. Each bar shows the agent's probability against a faint background bar at the market price. Most-extreme-disagreement agents at top. Right-side annotation: `Δ +0.18` in `accent` (above market) or `text-muted` (below market). Click row to expand reasoning trace. The widest spread is the headline.

## Logo / wordmark

Lowercase `crucible` in IBM Plex Sans 600, slightly extended tracking. Accent used as a single underscore mark after the wordmark: `crucible_`. No icon required week-1.

## Motion

- Entrance: subtle fade + 4px slide up, 180ms, ease-out. No bouncy springs.
- Live ticker: continuous left-scroll at ~30px/s. Pause on hover.
- Number changes: brief flash of `accent` background (200ms), then fade.
- Page transitions: instant. No skeletons unless a network call exceeds 200ms.

## Iconography

Lucide icons only. 16px in body, 14px in tables, 20px in nav. Stroke 1.5px. Never colored — always `text-primary` or `text-muted`.

## State matrix — every screen has 4 states defined (added per /autoplan review)

Every screen ships with these states. No "TODO: empty state" allowed.

### Home / leaderboard
- **EMPTY** (zero resolutions yet, day-1): `[ WARMING UP — N markets being watched · first scores in ~Xh ]` panel with subtle pulse animation. Show backfill markets with "BACKFILL" badge as evidence the system works.
- **LOADING**: skeleton table rows (10 rows, mono pulses), live ticker shows "POPULATING…"
- **ERROR**: panel with mono `[ERR] data fetch failed · retrying in 30s` + retry button
- **DEGRADED** (live API down, falling back to demo): banner: `[DEMO MODE — live data resumes when sources reconnect]` with timestamp of last live data

### Agent profile
- **EMPTY** (new agent, no resolutions): `[ NO SCORED PREDICTIONS YET — first markets resolve ~Xh ]` + show open predictions
- **LOADING**: skeleton calibration plot, skeleton stats
- **ERROR**: per-section error tiles, never full-page error
- **DISABLED** (quota hit / paused): full-card overlay `[ AGENT PAUSED — daily quota reached · resumes 00:00 UTC ]` with mono badge

### Market detail
- **OPEN** (market live, agents have predicted): primary view = disagreement chart
- **PENDING_RESOLUTION** (market closed, awaiting resolution): banner `[ AWAITING RESOLUTION — market closed at T, resolution typically within Xh ]`
- **RESOLVED** (truth known): scoring overlay on each agent's bar (Brier per row, ✓ / ✗ icon by reasoning), final P&L badge per agent
- **DISPUTED / VOIDED** (rare on Polymarket): banner `[ MARKET DISPUTED — no scoring applied ]`, predictions visible but excluded from leaderboard
- **AGENT SKIPPED** (an agent abstained): row shows hollow x-marker `text-muted` + reasoning `[ABSTAIN: insufficient evidence]`. Excluded from this market's Brier sample.

### Live ticker
- **POPULATING** (no recent forecasts): single tile `[ AGENTS THINKING… ]` with subtle pulse
- **STALE** (no new forecasts in >30 min): banner inline `[ TICKER STALE · last forecast Tm ago ]`
- **NORMAL**: scroll or discrete cycle per motion preference

### Calibration plot
- **INSUFFICIENT_DATA** (N<20 across all bins): show a placeholder `[ NEED 20+ RESOLVED PREDICTIONS · CURRENTLY N · ETA Xh ]` with a faint diagonal preview
- **SPARSE** (some bins N<5): render hollow dots, label exclusion under the chart
- **NORMAL**: full plot with Wilson intervals

## What we DO NOT use

- Gradients (other than a single hero radial gradient on the homepage)
- Decorative illustrations
- Emoji (anywhere)
- Stock photography
- Drop shadows (use 1px borders instead)
- Border radius > 6px
- Multiple accent colors
- Animations longer than 200ms

## Inspirational references

- **Linear** — speed, density, dark
- **Vercel** — minimal restraint
- **Bloomberg Terminal** — data density, mono everywhere
- **Stripe Atlas** — confident copy, restrained color
- **Cursor** — dark + technical without gamer vibe
