#!/usr/bin/env bash
set -euo pipefail

# CompliGuard Backup Script
# Usage: ./scripts/backup.sh
# Environment variables (can be set in .env or passed directly):
#   BACKUP_DIR        - Where to store backups (default: /var/backups/compliguard)
#   RETENTION_DAYS    - How many days to keep backups (default: 30)
#   UPLOAD_TO_S3      - Set to "true" to upload to S3/MinIO after backup
#   S3_BUCKET         - S3/MinIO bucket name
#   S3_ENDPOINT       - MinIO endpoint URL (e.g. http://localhost:9000)
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY - S3 credentials

INSTALL_DIR="${INSTALL_DIR:-/opt/compliguard}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/compliguard}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
UPLOAD_TO_S3="${UPLOAD_TO_S3:-false}"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_NAME="compliguard-backup-${TIMESTAMP}"
BACKUP_TMP="/tmp/${BACKUP_NAME}"
BACKUP_ARCHIVE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

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

# ─── Load environment ─────────────────────────────────────────────────────────
if [[ -f "${INSTALL_DIR}/.env" ]]; then
  set -a
  source "${INSTALL_DIR}/.env"
  set +a
fi

# Parse DATABASE_URL for pg_dump
if [[ -n "${DATABASE_URL:-}" ]]; then
  # Extract components from postgresql://user:pass@host:port/dbname
  DB_USER=$(echo "$DATABASE_URL" | sed 's|postgresql://||' | cut -d: -f1)
  DB_PASS=$(echo "$DATABASE_URL" | sed 's|postgresql://[^:]*:||' | cut -d@ -f1)
  DB_HOST=$(echo "$DATABASE_URL" | cut -d@ -f2 | cut -d: -f1)
  DB_PORT=$(echo "$DATABASE_URL" | cut -d@ -f2 | cut -d: -f2 | cut -d/ -f1)
  DB_NAME=$(echo "$DATABASE_URL" | cut -d/ -f4)
else
  DB_USER="${DB_USER:-compliguard}"
  DB_PASS="${POSTGRES_PASSWORD:-compliguard}"
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"
  DB_NAME="${DB_NAME:-compliguard}"
fi

DATA_DIR="${LOCAL_STORAGE_PATH:-${INSTALL_DIR}/data}"

# ─── Preflight checks ────────────────────────────────────────────────────────
command -v pg_dump &>/dev/null || error "pg_dump not found. Install postgresql-client."

mkdir -p "${BACKUP_DIR}" "${BACKUP_TMP}"

info "Starting CompliGuard backup: ${BACKUP_NAME}"
echo "  Install dir : ${INSTALL_DIR}"
echo "  Backup dir  : ${BACKUP_DIR}"
echo "  Retention   : ${RETENTION_DAYS} days"
echo ""

# ─── Step 1: PostgreSQL Dump ──────────────────────────────────────────────────
info "Dumping PostgreSQL database '${DB_NAME}'..."
PGPASSWORD="${DB_PASS}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --file="${BACKUP_TMP}/database.dump"
success "Database dump complete ($(du -sh "${BACKUP_TMP}/database.dump" | cut -f1))"

# ─── Step 2: Upload files ─────────────────────────────────────────────────────
if [[ -d "${DATA_DIR}" ]]; then
  info "Archiving upload files from ${DATA_DIR}..."
  tar -czf "${BACKUP_TMP}/uploads.tar.gz" -C "$(dirname "${DATA_DIR}")" "$(basename "${DATA_DIR}")" 2>/dev/null || true
  success "Uploads archived ($(du -sh "${BACKUP_TMP}/uploads.tar.gz" | cut -f1))"
else
  warn "Upload directory not found at ${DATA_DIR}, skipping"
fi

# ─── Step 3: Bundle into final archive ───────────────────────────────────────
info "Creating final backup archive..."
# Include metadata
cat > "${BACKUP_TMP}/backup-info.json" <<EOF
{
  "version": "1",
  "timestamp": "${TIMESTAMP}",
  "database": "${DB_NAME}",
  "host": "$(hostname)",
  "compliguard_version": "$(cat "${INSTALL_DIR}/package.json" 2>/dev/null | grep '"version"' | head -1 | cut -d'"' -f4 || echo 'unknown')"
}
EOF

tar -czf "${BACKUP_ARCHIVE}" -C /tmp "${BACKUP_NAME}"
rm -rf "${BACKUP_TMP}"
success "Backup archive created: ${BACKUP_ARCHIVE} ($(du -sh "${BACKUP_ARCHIVE}" | cut -f1))"

# ─── Step 4: Upload to S3/MinIO ──────────────────────────────────────────────
if [[ "${UPLOAD_TO_S3}" == "true" ]]; then
  if [[ -z "${S3_BUCKET:-}" ]]; then
    warn "UPLOAD_TO_S3=true but S3_BUCKET is not set. Skipping upload."
  else
    info "Uploading backup to S3/MinIO bucket '${S3_BUCKET}'..."

    S3_KEY="backups/${BACKUP_NAME}.tar.gz"
    AWS_ARGS=()
    if [[ -n "${S3_ENDPOINT:-}" ]]; then
      AWS_ARGS+=("--endpoint-url" "${S3_ENDPOINT}")
    fi

    if command -v aws &>/dev/null; then
      aws s3 cp "${BACKUP_ARCHIVE}" "s3://${S3_BUCKET}/${S3_KEY}" "${AWS_ARGS[@]+"${AWS_ARGS[@]}"}"
      success "Uploaded to s3://${S3_BUCKET}/${S3_KEY}"
    else
      warn "aws CLI not found. Skipping S3 upload. Install with: pip install awscli"
    fi
  fi
fi

# ─── Step 5: Rotate old backups ──────────────────────────────────────────────
info "Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "${BACKUP_DIR}" -name "compliguard-backup-*.tar.gz" -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)
if [[ "$DELETED" -gt 0 ]]; then
  success "Deleted ${DELETED} old backup(s)"
else
  info "No old backups to clean up"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "Backup complete!"
echo "  File: ${BACKUP_ARCHIVE}"
echo "  Size: $(du -sh "${BACKUP_ARCHIVE}" | cut -f1)"
echo ""
echo "  To restore, run:"
echo "    ./scripts/restore.sh ${BACKUP_ARCHIVE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
