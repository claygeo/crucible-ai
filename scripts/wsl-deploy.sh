#!/bin/bash
# Deploy script run inside WSL Ubuntu (Linux build of crucible-ai).
# Requires NETLIFY_AUTH_TOKEN env var.
set -e
export PATH="$HOME/node22/bin:$PATH"
cd /mnt/c/Users/clayg/OneDrive/Desktop/crucible-ai

# Stash any local churn (e.g. WSL npm install lockfile diff) before pulling
git stash push -u -m "wsl-deploy-stash" 2>&1 | tail -2 || true
# Pull latest main so we always deploy what's pushed
git pull --rebase origin main 2>&1 | tail -3 || true

echo "=== node $(node --version) · netlify $(netlify --version) ==="
echo "=== clean rebuild ==="
rm -rf .next
npm install --no-audit --no-fund 2>&1 | tail -2
npm run build 2>&1 | tail -3

echo "=== deploy ==="
netlify deploy \
  --build \
  --prod \
  --skip-functions-cache \
  --site 9916de8a-1d65-4fca-8034-befbb1429e61
