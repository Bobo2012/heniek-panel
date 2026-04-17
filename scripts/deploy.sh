#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/apps/heniek-panel"
APP_NAME="al-panel"

cd "$APP_DIR"

echo ">>> Pull latest"
git pull --ff-only

echo ">>> Install deps"
npm install

echo ">>> Build"
npm run build

if command -v pm2 >/dev/null 2>&1; then
  echo ">>> Restart via PM2"
  pm2 startOrReload ecosystem.config.cjs --update-env
  pm2 save || true
else
  echo ">>> PM2 not found - restart manually"
  echo "Run: npm run start -- --hostname 0.0.0.0 --port 3000"
fi

echo ">>> Done"
