#!/usr/bin/env bash
# ============================================================
# CompliGuard v2 — Linux Installer
# Installs as a systemd service with PostgreSQL, Redis, MinIO
# Supports: Ubuntu 22.04+, Debian 12+, RHEL/CentOS 9+
# Usage:  sudo bash install.sh [--help] [--uninstall] [--upgrade]
# ============================================================
set -euo pipefail

# ── Variables ─────────────────────────────────────────────
APP_NAME="compliguard"
APP_DIR="/opt/compliguard"
DATA_DIR="/var/lib/compliguard"
LOG_DIR="/var/log/compliguard"
CONFIG_DIR="/etc/compliguard"
UPLOADS_DIR="${DATA_DIR}/uploads"
APP_USER="compliguard"
APP_GROUP="compliguard"
APP_PORT="${APP_PORT:-3000}"
REPO_URL="https://github.com/saichand04/compliguard-v2"
NODE_VERSION="20"

# ── Colors ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Helpers ───────────────────────────────────────────────
log()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()  { echo -e "${RED}[ERROR]${NC} $1" >&2; }
header() { echo -e "\n${BLUE}══ $1 ══${NC}"; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Try: sudo bash install.sh"
    exit 1
  fi
}

detect_os() {
  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    OS_ID="${ID}"
    OS_VERSION="${VERSION_ID:-}"
  else
    error "Cannot detect OS. /etc/os-release not found."
    exit 1
  fi
  log "Detected OS: ${OS_ID} ${OS_VERSION}"
}

check_dependencies() {
  local missing=()
  for cmd in curl git openssl; do
    command -v "$cmd" &>/dev/null || missing+=("$cmd")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing required tools: ${missing[*]}"
    error "Install them and re-run: apt-get install -y ${missing[*]}"
    exit 1
  fi
}

# ── Install Functions ─────────────────────────────────────
install_node() {
  header "Installing Node.js ${NODE_VERSION}"
  if command -v node &>/dev/null && node --version | grep -q "^v${NODE_VERSION}"; then
    log "Node.js ${NODE_VERSION} already installed: $(node --version)"
    return
  fi
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  case "${OS_ID}" in
    ubuntu|debian)
      apt-get install -y nodejs ;;
    rhel|centos|fedora|rocky|almalinux)
      dnf install -y nodejs ;;
    *)
      error "Unsupported OS for Node.js install: ${OS_ID}"
      exit 1 ;;
  esac
  log "Node.js installed: $(node --version)"
}

install_postgresql() {
  header "Installing PostgreSQL 16"
  if command -v psql &>/dev/null; then
    log "PostgreSQL already installed: $(psql --version)"
    return
  fi
  case "${OS_ID}" in
    ubuntu|debian)
      apt-get install -y postgresql postgresql-contrib
      systemctl enable --now postgresql ;;
    rhel|centos|fedora|rocky|almalinux)
      dnf install -y postgresql-server postgresql-contrib
      postgresql-setup --initdb
      systemctl enable --now postgresql ;;
    *)
      error "Unsupported OS for PostgreSQL install: ${OS_ID}"
      exit 1 ;;
  esac
  log "PostgreSQL installed"
}

install_redis() {
  header "Installing Redis"
  if command -v redis-server &>/dev/null; then
    log "Redis already installed: $(redis-server --version)"
    return
  fi
  case "${OS_ID}" in
    ubuntu|debian)
      apt-get install -y redis-server
      systemctl enable --now redis-server ;;
    rhel|centos|fedora|rocky|almalinux)
      dnf install -y redis
      systemctl enable --now redis ;;
    *)
      warn "Cannot auto-install Redis for ${OS_ID}. Skipping — install manually."
      return ;;
  esac
  log "Redis installed"
}

create_system_user() {
  header "Creating system user: ${APP_USER}"
  if id "${APP_USER}" &>/dev/null; then
    log "User '${APP_USER}' already exists"
    return
  fi
  useradd --system --no-create-home --shell /usr/sbin/nologin \
    --home-dir "${APP_DIR}" --comment "CompliGuard service account" \
    "${APP_USER}"
  log "User '${APP_USER}' created"
}

create_directories() {
  header "Creating directories"
  for dir in "${APP_DIR}" "${DATA_DIR}" "${LOG_DIR}" "${CONFIG_DIR}" "${UPLOADS_DIR}"; do
    mkdir -p "${dir}"
    chown "${APP_USER}:${APP_GROUP}" "${dir}"
    chmod 750 "${dir}"
    log "Created: ${dir}"
  done
}

clone_or_update_app() {
  header "Deploying application"
  if [[ -d "${APP_DIR}/.git" ]]; then
    log "Existing install detected — pulling latest code"
    cd "${APP_DIR}"
    sudo -u "${APP_USER}" git pull origin main
  else
    log "Cloning from ${REPO_URL}"
    git clone "${REPO_URL}" "${APP_DIR}"
    chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
  fi
}

install_npm_dependencies() {
  header "Installing npm dependencies"
  cd "${APP_DIR}"
  sudo -u "${APP_USER}" npm ci --legacy-peer-deps --omit=dev
  log "npm dependencies installed"
}

build_app() {
  header "Building Next.js application"
  cd "${APP_DIR}"
  sudo -u "${APP_USER}" npm run build
  log "Build complete"
}

generate_secrets() {
  header "Generating secrets"
  local jwt_secret
  jwt_secret=$(openssl rand -hex 32)
  local pg_password
  pg_password=$(openssl rand -base64 24 | tr -d '/+=')
  echo "${jwt_secret}" > "${CONFIG_DIR}/.jwt_secret"
  echo "${pg_password}" > "${CONFIG_DIR}/.pg_password"
  chmod 600 "${CONFIG_DIR}/.jwt_secret" "${CONFIG_DIR}/.pg_password"
  chown "${APP_USER}:${APP_GROUP}" "${CONFIG_DIR}/.jwt_secret" "${CONFIG_DIR}/.pg_password"
  log "Secrets generated in ${CONFIG_DIR}"
}

setup_database() {
  header "Setting up PostgreSQL database"
  local pg_password
  pg_password=$(cat "${CONFIG_DIR}/.pg_password")

  sudo -u postgres psql -c "
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${APP_USER}') THEN
        CREATE ROLE ${APP_USER} WITH LOGIN PASSWORD '${pg_password}';
      END IF;
    END
    \$\$;
  " 2>/dev/null || true

  sudo -u postgres psql -c "
    CREATE DATABASE compliguard OWNER ${APP_USER};
  " 2>/dev/null || log "Database 'compliguard' already exists"

  log "Database ready"
}

write_env_file() {
  header "Writing environment configuration"
  local jwt_secret
  jwt_secret=$(cat "${CONFIG_DIR}/.jwt_secret")
  local pg_password
  pg_password=$(cat "${CONFIG_DIR}/.pg_password")
  local app_url
  app_url="${NEXT_PUBLIC_APP_URL:-http://$(hostname -f):${APP_PORT}}"

  cat > "${CONFIG_DIR}/.env" <<ENV
# CompliGuard v2 — Runtime Environment
# Generated by install.sh on $(date)
# Edit this file to configure your installation.

NODE_ENV=production
NEXT_PUBLIC_APP_URL=${app_url}
PORT=${APP_PORT}

# Database
DATABASE_URL=postgresql://${APP_USER}:${pg_password}@127.0.0.1:5432/compliguard

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Auth
JWT_SECRET=${jwt_secret}
NEXTAUTH_SECRET=${jwt_secret}

# Storage (local by default — change to s3, azure-blob, or onedrive)
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=${UPLOADS_DIR}

# Email (configure after install)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_placeholder
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME=CompliGuard

# AI (configure after install)
# OPENAI_API_KEY=sk-...
# AZURE_OPENAI_ENDPOINT=https://...
# AZURE_OPENAI_KEY=...

# Logging
LOG_LEVEL=info
# SENTRY_DSN=https://...
ENV

  chmod 600 "${CONFIG_DIR}/.env"
  chown "${APP_USER}:${APP_GROUP}" "${CONFIG_DIR}/.env"

  # Symlink .env into app dir
  ln -sf "${CONFIG_DIR}/.env" "${APP_DIR}/.env"
  chown -h "${APP_USER}:${APP_GROUP}" "${APP_DIR}/.env"

  log "Environment file written to ${CONFIG_DIR}/.env"
}

run_migrations() {
  header "Running database migrations"
  cd "${APP_DIR}"
  sudo -u "${APP_USER}" bash -c "source ${CONFIG_DIR}/.env && npm run db:migrate"
  log "Migrations complete"
}

run_seed() {
  header "Seeding framework data"
  cd "${APP_DIR}"
  sudo -u "${APP_USER}" bash -c "source ${CONFIG_DIR}/.env && npm run db:seed" || \
    warn "Seed failed or already seeded — continuing"
}

install_systemd_service() {
  header "Installing systemd service"
  cat > /etc/systemd/system/compliguard.service <<SERVICE
[Unit]
Description=CompliGuard v2 — AI-powered GRC Platform
Documentation=https://github.com/saichand04/compliguard-v2
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${CONFIG_DIR}/.env
ExecStart=/usr/bin/node ${APP_DIR}/.next/standalone/server.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=10
StandardOutput=append:${LOG_DIR}/app.log
StandardError=append:${LOG_DIR}/error.log
SyslogIdentifier=compliguard
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=${DATA_DIR} ${LOG_DIR}
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable compliguard
  systemctl start compliguard
  log "systemd service installed and started"
}

configure_logrotate() {
  cat > /etc/logrotate.d/compliguard <<LOGROTATE
${LOG_DIR}/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        systemctl kill -s HUP compliguard.service 2>/dev/null || true
    endscript
}
LOGROTATE
  log "Log rotation configured"
}

print_post_install() {
  local app_url
  app_url="${NEXT_PUBLIC_APP_URL:-http://$(hostname -f):${APP_PORT}}"
  echo -e "\n${GREEN}════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  CompliGuard v2 installation complete!${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════${NC}"
  echo -e ""
  echo -e "  App URL:    ${BLUE}${app_url}${NC}"
  echo -e "  Config:     ${CONFIG_DIR}/.env"
  echo -e "  Logs:       ${LOG_DIR}/"
  echo -e "  Service:    systemctl status compliguard"
  echo -e ""
  echo -e "  ${YELLOW}Next steps:${NC}"
  echo -e "  1. Edit ${CONFIG_DIR}/.env and set RESEND_API_KEY, AI keys, etc."
  echo -e "  2. Open ${app_url} to complete the setup wizard"
  echo -e "  3. Review the admin account created during setup"
  echo -e ""
  echo -e "${GREEN}════════════════════════════════════════════════${NC}\n"
}

uninstall() {
  header "Uninstalling CompliGuard v2"
  systemctl stop compliguard 2>/dev/null || true
  systemctl disable compliguard 2>/dev/null || true
  rm -f /etc/systemd/system/compliguard.service
  systemctl daemon-reload
  rm -rf "${APP_DIR}"
  rm -rf "${LOG_DIR}"
  rm -f /etc/logrotate.d/compliguard
  warn "Data in ${DATA_DIR} and ${CONFIG_DIR} preserved. Remove manually if needed."
  log "Uninstall complete"
}

upgrade() {
  header "Upgrading CompliGuard v2"
  systemctl stop compliguard
  clone_or_update_app
  install_npm_dependencies
  build_app
  run_migrations
  systemctl start compliguard
  log "Upgrade complete"
}

# ── Main ──────────────────────────────────────────────────
main() {
  case "${1:-}" in
    --help|-h)
      echo "Usage: sudo bash install.sh [--uninstall] [--upgrade]"
      exit 0 ;;
    --uninstall)
      require_root
      uninstall
      exit 0 ;;
    --upgrade)
      require_root
      detect_os
      upgrade
      exit 0 ;;
  esac

  require_root
  detect_os
  check_dependencies

  header "CompliGuard v2 Installer"
  log "Starting installation..."

  install_node
  install_postgresql
  install_redis
  create_system_user
  create_directories
  clone_or_update_app
  install_npm_dependencies
  build_app
  generate_secrets
  setup_database
  write_env_file
  run_migrations
  run_seed
  install_systemd_service
  configure_logrotate
  print_post_install
}

main "$@"
