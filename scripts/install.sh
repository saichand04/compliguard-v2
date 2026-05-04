#!/usr/bin/env bash
set -euo pipefail

# CompliGuard Self-Hosted Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/saichand04/compliguard-v2/main/scripts/install.sh | bash

COMPLIGUARD_VERSION="${COMPLIGUARD_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/opt/compliguard}"
DATA_DIR="${DATA_DIR:-/var/lib/compliguard}"
SERVICE_USER="compliguard"
REPO_URL="https://github.com/saichand04/compliguard-v2.git"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo "  ██████╗ ██████╗ ███╗   ███╗██████╗ ██╗     ██╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ "
echo " ██╔════╝██╔═══██╗████╗ ████║██╔══██╗██║     ██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗"
echo " ██║     ██║   ██║██╔████╔██║██████╔╝██║     ██║██║  ███╗██║   ██║███████║██████╔╝██║  ██║"
echo " ██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██║     ██║██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║"
echo " ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ███████╗██║╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝"
echo "  ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚══════╝╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ "
echo ""
echo "  Self-Hosted Installer  |  Version: ${COMPLIGUARD_VERSION}"
echo "  Install Directory: ${INSTALL_DIR}"
echo ""

# ─── Step 1: Check OS ─────────────────────────────────────────────────────────
info "Checking operating system..."
if [[ ! -f /etc/os-release ]]; then
  error "Cannot detect OS. This installer requires Ubuntu 22.04/24.04 or Debian 11/12."
fi

source /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
  error "Unsupported OS: ${PRETTY_NAME}. Only Ubuntu 22.04/24.04 and Debian 11/12 are supported."
fi

# Check version
case "$VERSION_ID" in
  "22.04"|"24.04"|"11"|"12") success "OS supported: ${PRETTY_NAME}" ;;
  *) warn "Untested OS version: ${PRETTY_NAME}. Proceeding anyway..." ;;
esac

# Check root or sudo
if [[ $EUID -ne 0 ]]; then
  error "This installer must be run as root or with sudo."
fi

# ─── Step 2: Install Dependencies ─────────────────────────────────────────────
info "Updating package lists..."
apt-get update -qq

info "Installing system dependencies..."
apt-get install -y -qq \
  curl \
  git \
  wget \
  gnupg \
  ca-certificates \
  lsb-release \
  apt-transport-https \
  software-properties-common \
  openssl

# Node.js 20 LTS
if ! command -v node &>/dev/null || [[ "$(node -e 'process.exit(parseInt(process.versions.node) < 20 ? 1 : 0)' 2>/dev/null; echo $?)" == "1" ]]; then
  info "Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  success "Node.js $(node --version) installed"
else
  success "Node.js $(node --version) already installed"
fi

# PostgreSQL 16
if ! command -v psql &>/dev/null; then
  info "Installing PostgreSQL 16..."
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -y postgresql-16
  systemctl enable postgresql
  systemctl start postgresql
  success "PostgreSQL 16 installed"
else
  success "PostgreSQL already installed: $(psql --version)"
fi

# Docker (optional)
read -r -p "Install Docker for container support? [y/N] " install_docker
if [[ "$install_docker" =~ ^[Yy]$ ]]; then
  if ! command -v docker &>/dev/null; then
    info "Installing Docker..."
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
    success "Docker installed"
  else
    success "Docker already installed: $(docker --version)"
  fi
fi

# ─── Step 3: Create Service User ──────────────────────────────────────────────
info "Creating service user '${SERVICE_USER}'..."
if id "${SERVICE_USER}" &>/dev/null; then
  success "User '${SERVICE_USER}' already exists"
else
  useradd --system --shell /bin/bash --create-home --home-dir "${INSTALL_DIR}" "${SERVICE_USER}"
  success "User '${SERVICE_USER}' created"
fi

# ─── Step 4: Clone / Download Repository ─────────────────────────────────────
info "Setting up application directory at ${INSTALL_DIR}..."
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  info "Repository already exists. Pulling latest changes..."
  sudo -u "${SERVICE_USER}" git -C "${INSTALL_DIR}" pull
else
  if [[ "$COMPLIGUARD_VERSION" == "latest" ]]; then
    sudo -u "${SERVICE_USER}" git clone --depth=1 "${REPO_URL}" "${INSTALL_DIR}"
  else
    sudo -u "${SERVICE_USER}" git clone --branch "${COMPLIGUARD_VERSION}" --depth=1 "${REPO_URL}" "${INSTALL_DIR}"
  fi
fi
success "Repository ready at ${INSTALL_DIR}"

# ─── Step 5: Configure Environment ───────────────────────────────────────────
info "Configuring environment variables..."
if [[ ! -f "${INSTALL_DIR}/.env" ]]; then
  cp "${INSTALL_DIR}/.env.example" "${INSTALL_DIR}/.env"

  # Generate secrets
  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  JWT_SECRET=$(openssl rand -base64 32)

  # Prompt for required values
  echo ""
  read -r -p "Enter your domain/hostname (e.g., compliance.yourdomain.com) [localhost]: " domain
  domain="${domain:-localhost}"

  read -r -s -p "Enter PostgreSQL password [auto-generate]: " pg_password
  echo ""
  if [[ -z "$pg_password" ]]; then
    pg_password=$(openssl rand -base64 24 | tr -d '=+/')
    info "Generated PostgreSQL password: ${pg_password}"
  fi

  read -r -p "Enter port [3030]: " app_port
  app_port="${app_port:-3030}"

  # Update .env
  sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEXTAUTH_SECRET}|" "${INSTALL_DIR}/.env"
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "${INSTALL_DIR}/.env"
  sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=http://${domain}:${app_port}|" "${INSTALL_DIR}/.env"
  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pg_password}|" "${INSTALL_DIR}/.env"
  sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://compliguard:${pg_password}@localhost:5432/compliguard|" "${INSTALL_DIR}/.env"
  sed -i "s|PORT=.*|PORT=${app_port}|" "${INSTALL_DIR}/.env"

  chown "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}/.env"
  chmod 600 "${INSTALL_DIR}/.env"
  success ".env configured"
else
  warn ".env already exists, skipping configuration"
fi

# ─── PostgreSQL: Create DB and User ──────────────────────────────────────────
info "Setting up PostgreSQL database..."
source "${INSTALL_DIR}/.env"
PG_PASS="${POSTGRES_PASSWORD:-compliguard}"

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='compliguard'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER compliguard WITH PASSWORD '${PG_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='compliguard'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE compliguard OWNER compliguard;"

success "PostgreSQL database ready"

# ─── Step 6: Install Dependencies & Build ────────────────────────────────────
info "Installing Node.js dependencies (this may take a few minutes)..."
cd "${INSTALL_DIR}"
sudo -u "${SERVICE_USER}" npm install --legacy-peer-deps --silent
success "Dependencies installed"

info "Building Next.js application (this may take several minutes)..."
sudo -u "${SERVICE_USER}" npm run build
success "Application built"

# ─── Step 7: Database Migration ──────────────────────────────────────────────
info "Running database migrations..."
cd "${INSTALL_DIR}"
sudo -u "${SERVICE_USER}" npx drizzle-kit push
success "Database migrations complete"

# ─── Step 8: Seed NIST Data ──────────────────────────────────────────────────
info "Seeding NIST compliance data..."
cd "${INSTALL_DIR}"
sudo -u "${SERVICE_USER}" npx tsx seed/seed-nist.ts
success "NIST data seeded"

# ─── Step 9: Create Admin User ───────────────────────────────────────────────
info "Creating admin user..."
cd "${INSTALL_DIR}"
sudo -u "${SERVICE_USER}" npx tsx seed/create-admin.ts
success "Admin user created"

# ─── Step 10: Install Systemd Service ────────────────────────────────────────
info "Installing systemd service..."
cp "${INSTALL_DIR}/systemd/compliguard.service" /etc/systemd/system/compliguard.service

# Update WorkingDirectory if different from default
if [[ "${INSTALL_DIR}" != "/opt/compliguard" ]]; then
  sed -i "s|WorkingDirectory=/opt/compliguard|WorkingDirectory=${INSTALL_DIR}|g" /etc/systemd/system/compliguard.service
  sed -i "s|EnvironmentFile=/opt/compliguard/.env|EnvironmentFile=${INSTALL_DIR}/.env|g" /etc/systemd/system/compliguard.service
  sed -i "s|ReadWritePaths=/opt/compliguard/data|ReadWritePaths=${INSTALL_DIR}/data|g" /etc/systemd/system/compliguard.service
fi

# Create data directory
mkdir -p "${INSTALL_DIR}/data"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}/data"

systemctl daemon-reload
systemctl enable compliguard
systemctl start compliguard
success "CompliGuard service installed and started"

# ─── Success Message ──────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "CompliGuard installation complete!"
echo ""
source "${INSTALL_DIR}/.env"
APP_PORT="${PORT:-3030}"
echo "  Access your instance: http://${domain:-localhost}:${APP_PORT}"
echo ""
echo "  Useful commands:"
echo "    sudo systemctl status compliguard    # Check service status"
echo "    sudo journalctl -u compliguard -f    # View live logs"
echo "    sudo systemctl restart compliguard   # Restart the service"
echo "    ${INSTALL_DIR}/scripts/backup.sh     # Run a backup"
echo "    ${INSTALL_DIR}/scripts/update.sh     # Update to latest version"
echo ""
echo "  Data directory: ${INSTALL_DIR}/data"
echo "  Logs: journalctl -u compliguard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
