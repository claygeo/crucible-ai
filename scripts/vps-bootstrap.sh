#!/bin/bash
# VPS bootstrap script for Crucible.AI backfill cron.
#
# RUN ONCE on the Hetzner VPS (SSH port 2222).
# After this completes successfully, the backfill runs every 6 hours autonomously.
#
# Prereqs assumed:
#   - Node 20+ already installed (most Hetzner Ubuntu images have it)
#   - git installed
#   - The operator has the Supabase service role key on hand to paste
#
# Usage:
#   scp -P 2222 vps-bootstrap.sh root@YOUR-VPS-IP:/tmp/
#   ssh -p 2222 root@YOUR-VPS-IP 'bash /tmp/vps-bootstrap.sh'
#   The script prompts for SUPABASE_SERVICE_ROLE_KEY if it is not already set.

set -e

CRUCIBLE_DIR="/opt/crucible-ai"
SERVICE_USER="crucible"
LOG_DIR="/var/log/crucible-ai"

echo "=== Crucible.AI VPS bootstrap ==="
echo "Target dir: $CRUCIBLE_DIR"
echo "Service user: $SERVICE_USER"
echo

# ───────────────────────────────────────────────────────────────────────────
# 1. Create unprivileged service user (claude OAuth shouldn't run as root)
# ───────────────────────────────────────────────────────────────────────────

if ! id "$SERVICE_USER" &>/dev/null; then
  echo "[1/8] Creating service user $SERVICE_USER..."
  useradd -m -s /bin/bash "$SERVICE_USER"
else
  echo "[1/8] Service user $SERVICE_USER exists ✓"
fi

# ───────────────────────────────────────────────────────────────────────────
# 2. Install Node 22 (LTS) if missing or older
# ───────────────────────────────────────────────────────────────────────────

NODE_OK=$(node --version 2>/dev/null | grep -oE 'v[0-9]+' | head -1 | tr -d 'v' || echo 0)
if [ "$NODE_OK" -lt 20 ]; then
  echo "[2/8] Installing Node 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo "[2/8] Node $(node --version) ✓"
fi

# ───────────────────────────────────────────────────────────────────────────
# 3. Install Claude Code CLI (operator's Max sub auth)
# ───────────────────────────────────────────────────────────────────────────

if ! sudo -u "$SERVICE_USER" command -v claude &>/dev/null; then
  echo "[3/8] Installing Claude Code CLI..."
  npm install -g @anthropic-ai/claude-code
else
  echo "[3/8] claude $(sudo -u "$SERVICE_USER" claude --version) ✓"
fi

# ───────────────────────────────────────────────────────────────────────────
# 4. Clone repo + install deps
# ───────────────────────────────────────────────────────────────────────────

mkdir -p "$CRUCIBLE_DIR"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$CRUCIBLE_DIR"

if [ ! -d "$CRUCIBLE_DIR/.git" ]; then
  echo "[4/8] Cloning repo..."
  sudo -u "$SERVICE_USER" git clone https://github.com/claygeo/crucible-ai.git "$CRUCIBLE_DIR"
else
  echo "[4/8] Repo exists, pulling latest..."
  sudo -u "$SERVICE_USER" bash -c "cd $CRUCIBLE_DIR && git pull --rebase"
fi

echo "  Installing npm deps..."
sudo -u "$SERVICE_USER" bash -c "cd $CRUCIBLE_DIR && npm install --no-audit --no-fund 2>&1 | tail -3"

# ───────────────────────────────────────────────────────────────────────────
# 5. Set up Supabase service role key (.env.local)
# ───────────────────────────────────────────────────────────────────────────

ENV_FILE="$CRUCIBLE_DIR/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "[5/8] Creating .env.local..."
  if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    read -rsp "Supabase service role key: " SUPABASE_SERVICE_ROLE_KEY
    echo
  fi
  if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    echo "SUPABASE_SERVICE_ROLE_KEY is required to create $ENV_FILE." >&2
    exit 1
  fi

  cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YOUR_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
EOF
  chown "$SERVICE_USER":"$SERVICE_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  echo "[5/8] .env.local exists ✓"
fi

# ───────────────────────────────────────────────────────────────────────────
# 6. Log directory
# ───────────────────────────────────────────────────────────────────────────

mkdir -p "$LOG_DIR"
chown "$SERVICE_USER":"$SERVICE_USER" "$LOG_DIR"
echo "[6/8] Log dir $LOG_DIR ready"

# ───────────────────────────────────────────────────────────────────────────
# 7. Claude OAuth — INTERACTIVE STEP (operator runs this manually)
# ───────────────────────────────────────────────────────────────────────────

echo
echo "[7/8] Claude OAuth setup — operator action required:"
echo
echo "  Run as the service user:"
echo "    sudo -u $SERVICE_USER -i"
echo "    claude login"
echo
echo "  Follow the URL printed. Sign in with your Max-sub Anthropic account."
echo "  Once you see 'Logged in', exit back to root:  exit"
echo
echo "  Verify auth works:"
echo "    sudo -u $SERVICE_USER claude --version  # should print version"
echo "    sudo -u $SERVICE_USER bash -c 'echo \"test\" | claude -p'  # should respond"
echo
echo "  When OAuth is verified, re-run this script to finish cron setup."
echo

# Skip cron setup if claude isn't authed yet
if ! sudo -u "$SERVICE_USER" bash -c 'echo "ping" | timeout 30 claude -p' &>/dev/null; then
  echo "  ⚠ claude -p not yet usable for $SERVICE_USER. Halting before cron setup."
  echo "  Complete OAuth, then re-run: bash /tmp/vps-bootstrap.sh"
  exit 0
fi

# ───────────────────────────────────────────────────────────────────────────
# 8. Install cron entry — backfill every 6h
# ───────────────────────────────────────────────────────────────────────────

CRON_LINE="11 */6 * * * cd $CRUCIBLE_DIR && /usr/bin/git pull --rebase >> $LOG_DIR/git.log 2>&1; /usr/bin/npx tsx backfill/run.ts --limit=30 >> $LOG_DIR/backfill.log 2>&1"
echo "[8/8] Installing cron entry for $SERVICE_USER..."

# Idempotent: only add if not already present
sudo -u "$SERVICE_USER" bash -c "
  ( crontab -l 2>/dev/null | grep -v 'backfill/run.ts' ; echo '$CRON_LINE' ) | crontab -
"

echo
echo "=== Bootstrap complete ✓ ==="
echo
echo "Cron entry:"
echo "  $CRON_LINE"
echo
echo "Logs:"
echo "  $LOG_DIR/backfill.log    # backfill output"
echo "  $LOG_DIR/git.log         # git pull output"
echo
echo "First run will fire at the next :11 of an even-multiple-of-6 hour"
echo "(00:11, 06:11, 12:11, 18:11 UTC)."
echo
echo "Manual trigger:"
echo "  sudo -u $SERVICE_USER bash -c 'cd $CRUCIBLE_DIR && npx tsx backfill/run.ts --limit=30'"
echo
echo "Verify cron is loaded:"
echo "  sudo -u $SERVICE_USER crontab -l"
