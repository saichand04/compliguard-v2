#!/bin/bash
# CompliGuard Dev Restart Script
# Usage: bash scripts/dev-restart.sh
#
# Run this whenever you deploy new files or hit the Turbopack stale-cache error:
#   "Cannot find module '../chunks/ssr/[turbopack]_runtime.js'"
#
# Root cause: Next.js Turbopack caches chunk references in .next/ that go stale
# when new source files are added. Fix = wipe .next + .turbo, restart clean.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/cg-nextjs.log"

echo "RESTART_$(date +%s)" > "$LOG_FILE"
echo "=== CompliGuard Dev Restart ===" | tee -a "$LOG_FILE"
echo "  Project: $PROJECT_DIR" | tee -a "$LOG_FILE"
echo "  Log:     $LOG_FILE" | tee -a "$LOG_FILE"

# --- Step 1: Kill anything on port 3030 ---
echo "" | tee -a "$LOG_FILE"
echo "[1/3] Killing existing processes on port 3030..." | tee -a "$LOG_FILE"
lsof -ti:3030 | xargs kill -9 2>/dev/null || true
sleep 1
lsof -ti:3030 | xargs kill -9 2>/dev/null || true
echo "  ✓ Port 3030 free" | tee -a "$LOG_FILE"

# --- Step 2: Wipe ALL caches ---
echo "" | tee -a "$LOG_FILE"
echo "[2/3] Wiping build caches (.next, .turbo)..." | tee -a "$LOG_FILE"
rm -rf "$PROJECT_DIR/.next"
rm -rf "$PROJECT_DIR/.turbo"
rm -rf /tmp/turbopack* 2>/dev/null || true
echo "  ✓ Caches cleared" | tee -a "$LOG_FILE"

# --- Step 3: Start server (foreground, piped to log) ---
echo "" | tee -a "$LOG_FILE"
echo "[3/3] Starting Next.js dev server..." | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"
exec npm run dev 2>&1 | tee -a "$LOG_FILE"
