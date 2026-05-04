#!/usr/bin/env bash
set -euo pipefail

# CompliGuard Update Script
# Usage: sudo ./scripts/update.sh
# Run as root or with sudo when using systemd.

INSTALL_DIR="${INSTALL_DIR:-/opt/compliguard}"
SERVICE_USER="${SERVICE_USER:-compliguard}"
SERVICE_NAME="compliguard"

# ─── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ─── Pre-flight ───────────────────────────────────────────────────────────────
[[ -d "${INSTALL_DIR}" ]] || error "Install directory not found: ${INSTALL_DIR}"
[[ -f "${INSTALL_DIR}/package.json" ]] || error "Not a valid CompliGuard installation: missing package.json"

CURRENT_VERSION=$(cat "${INSTALL_DIR}/package.json" | grep '"version"' | head -1 | cut -d'"' -f4 || echo 'unknown')
info "Starting CompliGuard update"
info "Current version : ${CURRENT_VERSION}"
info "Install dir     : ${INSTALL_DIR}"
echo ""

# ─── Step 1: Backup before update ────────────────────────────────────────────
info "Creating pre-update backup..."
if [[ -f "${INSTALL_DIR}/scripts/backup.sh" ]]; then
  INSTALL_DIR="${INSTALL_DIR}" bash "${INSTALL_DIR}/scripts/backup.sh" || warn "Backup failed, continuing anyway..."
  success "Pre-update backup complete"
else
  warn "Backup script not found, skipping backup"
fi

# ─── Step 2: Pull latest from git ────────────────────────────────────────────
info "Pulling latest changes from git..."
cd "${INSTALL_DIR}"

# Stash any local changes to non-config files
if ! sudo -u "${SERVICE_USER}" git diff --quiet 2>/dev/null; then
  warn "Local changes detected, stashing..."
  sudo -u "${SERVICE_USER}" git stash --include-untracked || true
fi

sudo -u "${SERVICE_USER}" git fetch --all
sudo -u "${SERVICE_USER}" git pull origin main

NEW_VERSION=$(cat "${INSTALL_DIR}/package.json" | grep '"version"' | head -1 | cut -d'"' -f4 || echo 'unknown')
success "Pulled latest code (version: ${NEW_VERSION})"

# ─── Step 3: Install / update dependencies ───────────────────────────────────
info "Installing Node.js dependencies..."
cd "${INSTALL_DIR}"
sudo -u "${SERVICE_USER}" npm install --legacy-peer-deps --silent
success "Dependencies updated"

# ─── Step 4: Run database migrations ─────────────────────────────────────────
info "Running database migrations..."
cd "${INSTALL_DIR}"
sudo -u "${SERVICE_USER}" npx drizzle-kit push
success "Database migrations complete"

# ─── Step 5: Rebuild Next.js ──────────────────────────────────────────────────
info "Rebuilding Next.js application (this may take a few minutes)..."
cd "${INSTALL_DIR}"
sudo -u "${SERVICE_USER}" npm run build
success "Application rebuilt"

# ─── Step 6: Restart systemd service ─────────────────────────────────────────
info "Restarting CompliGuard service..."
if systemctl is-active --quiet "${SERVICE_NAME}"; then
  systemctl restart "${SERVICE_NAME}"
  sleep 3
  if systemctl is-active --quiet "${SERVICE_NAME}"; then
    success "Service restarted successfully"
  else
    error "Service failed to restart. Check logs: journalctl -u ${SERVICE_NAME} -n 50"
  fi
else
  warn "Service '${SERVICE_NAME}' is not running. Starting it now..."
  systemctl start "${SERVICE_NAME}"
  success "Service started"
fi

# ─── Step 7: Health check ────────────────────────────────────────────────────
info "Performing health check..."
sleep 5

source "${INSTALL_DIR}/.env" 2>/dev/null || true
APP_PORT="${PORT:-3030}"
HEALTH_URL="http://localhost:${APP_PORT}/api/health"

if curl -sf "${HEALTH_URL}" &>/dev/null; then
  success "Health check passed: ${HEALTH_URL}"
else
  warn "Health check failed at ${HEALTH_URL}. The app may still be starting up."
  info "Check status with: sudo journalctl -u ${SERVICE_NAME} -f"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "CompliGuard updated successfully!"
echo "  Previous version : ${CURRENT_VERSION}"
echo "  New version      : ${NEW_VERSION}"
echo ""
echo "  Service status   : sudo systemctl status ${SERVICE_NAME}"
echo "  Live logs        : sudo journalctl -u ${SERVICE_NAME} -f"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
