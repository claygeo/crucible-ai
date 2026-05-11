#!/bin/bash
# Deploy script run inside WSL Ubuntu (Linux build of crucible-ai).
# Requires NETLIFY_AUTH_TOKEN env var passed in.
set -e
export PATH="$HOME/node22/bin:$PATH"
cd /mnt/c/Users/clayg/OneDrive/Desktop/crucible-ai
echo "node: $(node --version)"
echo "netlify: $(netlify --version)"
netlify deploy \
  --build \
  --prod \
  --skip-functions-cache \
  --site 9916de8a-1d65-4fca-8034-befbb1429e61
