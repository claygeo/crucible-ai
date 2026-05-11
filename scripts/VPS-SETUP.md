# VPS backfill cron — one-time setup

**Goal:** keep Crucible's leaderboard fresh by re-running the backfill every 6h on your Hetzner VPS (77.42.83.22), so new resolved Polymarket/Manifold markets keep flowing in.

**Why VPS not laptop:** laptop sleeps on lid-close (per memory), 75-min jobs would miss runs, leaderboard would look "updated when operator was awake" which kills the live-benchmark vibe. Codex verdict: VPS @ 6h cron.

## Steps (~5 min total, mostly waiting)

### 1. Copy the bootstrap script to VPS

From your local Windows machine:

```bash
scp -P 2222 C:/Users/clayg/OneDrive/Desktop/crucible-ai/scripts/vps-bootstrap.sh root@77.42.83.22:/tmp/
```

### 2. SSH in and run it

```bash
ssh -p 2222 root@77.42.83.22
bash /tmp/vps-bootstrap.sh
```

This handles:
- Service user `crucible` (unprivileged, runs cron)
- Node 22 install (if missing)
- Claude Code CLI install
- Repo clone to `/opt/crucible-ai`
- `.env.local` with Supabase service role key
- Log dir `/var/log/crucible-ai`

### 3. Auth Claude CLI (the one interactive step)

The bootstrap script will halt and tell you to:

```bash
sudo -u crucible -i
claude login
```

Open the printed URL in your local browser, sign in with the same Anthropic account that has your Max sub, confirm "Logged in," then `exit`.

Verify:
```bash
sudo -u crucible bash -c 'echo "say ok" | claude -p'
```
Should print something resembling "ok".

### 4. Re-run the bootstrap to install cron

```bash
bash /tmp/vps-bootstrap.sh
```

It detects claude is now authed and installs the cron line:
```
11 */6 * * * cd /opt/crucible-ai && git pull && npx tsx backfill/run.ts --limit=30
```

Fires at 00:11, 06:11, 12:11, 18:11 UTC.

## What you should see after 24h

- `tail /var/log/crucible-ai/backfill.log` — 4 backfill runs, each only forecasts NEW markets (cache layer skips already-forecasted ones)
- `crucible-ai.netlify.app` leaderboard — agent prediction counts climbing past 30, new markets in /markets
- Supabase `predictions` table — growing daily

## Manual trigger

```bash
sudo -u crucible bash -c 'cd /opt/crucible-ai && npx tsx backfill/run.ts --limit=30'
```

## Kill switch

If anything goes sideways, disable the cron:
```bash
sudo -u crucible crontab -e   # delete the backfill line
```

Or pause everything via the global kill switch in Supabase:
```sql
update system_settings set value = 'true'::jsonb where key = 'global_pause';
```

The pull/forecast/resolve Edge Functions respect this (when they ever get deployed). The cron itself ignores it though — to fully stop, just remove the cron line.
