# Eivra — Operator Handoff (2026-05-12)

Clay — picking up where you left off. Old name **Crucible.AI** killed because of the existing AI workflow company collision. New name: **Eivra** (AY-vrah). All the work below is shipped + verified live.

---

## What landed since you stepped away

| commit  | what                                                                              |
|---------|-----------------------------------------------------------------------------------|
| `8b212df` | global rename Crucible → Eivra (27 files, DB column migration, package.json)     |
| `b341555` | cloud routine fixed LAUNCH-X.md tweet 1 hook (CRUCIBLE → Eivra cleaner casing) |
| `ffc05c5` | sharper hero copy + OG image: "AI makes predictions. Eivra scores them in public." |

**Live verification:**
- Site renders `eivra_` wordmark site-wide ✅
- Leaderboard shows all 6 agents with `eivra_score` column ✅
- OG images (Twitter cards) render new tagline + H1 ✅
- Cron auto-running (pull-open @15min, backfill @6h, generate-eureka @daily) ✅
- Cloud routine (`trig_0174fCScRWdDfnJjzCw43DNJ`) renamed + prompt updated, next fire 2026-05-12T06:07Z

---

## Why Eivra

`/codex` audit ruled out:
- **Stochos** (originally a contender): collides with `stochosdigital.com` + `stochosfintech.com` + Probaligence STOCHOS engineering product
- **Kairos**: PyPI `kairos` package + kairos.com face-recognition company already dominant
- **Kleros**: prominent crypto/arbitration protocol

Eivra is **invented** (no dictionary baggage), evokes `evidence + vera/truth`, has zero PyPI/AI-startup/crypto residue surfaced in collision search. Pronunciation `AY-vrah`.

Backup picks if Eivra fails closer trademark check: **Draevor**, **Kaeldra**, **Scyr**.

---

## What you still need to decide

These are the ones Claude can't do alone — they affect your accounts or wallet:

1. **Domain purchase.** DNS check 2026-05-12:
   - `eivra.com` — **TAKEN** (Swedish hosting `ns1.egensajt.se`, serving nginx, likely small business)
   - `eivra.ai` — appears unregistered, available
   - `eivra.io` — appears unregistered, available
   - `eivra.app` — appears unregistered, available
   - **Recommend:** grab `eivra.ai` (~$70-200/yr) since the .com is taken and .ai signals AI-product clearly. After purchase: update `metadataBase` in `src/app/layout.tsx`, configure custom domain in Netlify dashboard.

2. **GitHub repo rename.** Currently still `claygeo/crucible-ai`. One command:
   ```bash
   gh repo rename eivra --repo claygeo/crucible-ai
   ```
   GitHub auto-redirects old URLs for ~6mo. After that I can sweep code refs to point at `github.com/claygeo/eivra`.

3. **Twitter handle.** `@eivra` / `@eivra_ai` / `@useeivra` — check availability before launch. The thread is drafted in `LAUNCH-X.md`.

4. **Resume.** You said you're keeping `crucible-ai.netlify.app` on the resume "for now." That URL still works and the page now reads Eivra — once you have the new domain you can swap the resume link in one edit.

5. **VPS rename (optional).** `/opt/crucible-ai` + user `crucible` are still the active paths. I left them alone because renaming risks breaking the live cron. If you want clean naming end-to-end, do this manually after the next backfill window.

---

## Screenshots ready for Twitter

`C:\Users\clayg\OneDrive\Desktop\eivra-screenshots\`:
- `01-eivra-hero-og.png` — old hook ("Watch six AI agents...")
- `05-eivra-hero-v2.png` — **new hook** ("AI makes predictions. Eivra scores them in public.") — use this one
- `02-hawk-leader-og.png` — Hawk #1 profile card (rank, Brier, win rate)
- `03-sage-og.png` — Sage profile card
- `04-mirror-og.png` — Mirror profile card

For tweet body (not card), you'll want full-page screenshots of `/`, `/benchmark`, `/leaderboard`, one calibration plot. Easiest: open `https://crucible-ai.netlify.app/` in Chrome, F12 → device toolbar → 1440×900 → screenshot.

---

## Files touched this session

- `src/app/page.tsx` — new hero copy
- `src/app/opengraph-image.tsx` — new H1 + tagline + alt text
- `src/app/layout.tsx` — title, openGraph, twitter card all rewritten
- `src/app/about/page.tsx` — description metadata
- `src/components/Footer.tsx` — tagline
- `src/components/Header.tsx` — wordmark `crucible` → `eivra`
- `README.md` — top-line tagline
- `DESIGN.md` — wordmark spec
- `backfill/run.ts`, `backfill/pull-open.ts` — user-agent strings
- `supabase/functions/*` — user-agent strings
- `package.json` — `"name": "eivra"`
- Supabase migration `rename_crucible_score_to_eivra_score` (applied to project `atxtnpgwrcesifejltah`)

---

## Recovery checkpoint

Detailed state in `~/.claude/projects/.../memory/project_eivra_rename_2026_05_11.md`. If this chat is compacted, that's the read-first file.

Site is auto-running. Cloud routine will continue polishing every 6h. Nothing's blocked.
