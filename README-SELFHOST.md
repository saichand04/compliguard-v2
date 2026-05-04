# CompliGuard — Self-Hosting Guide

A complete guide to running CompliGuard on your own infrastructure.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Compose Quick Start](#docker-compose-quick-start)
3. [Manual Installation (systemd)](#manual-installation-systemd)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Database Setup](#database-setup)
6. [Storage Options](#storage-options)
7. [Email Configuration](#email-configuration)
8. [AI Provider Setup](#ai-provider-setup)
9. [Nginx Reverse Proxy](#nginx-reverse-proxy)
10. [SSL/TLS Configuration](#ssltls-configuration)
11. [Backup and Restore](#backup-and-restore)
12. [Upgrading](#upgrading)
13. [Troubleshooting](#troubleshooting)
14. [Security Hardening Checklist](#security-hardening-checklist)

---

## Prerequisites

### Hardware (minimum)
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU      | 2 vCPUs | 4 vCPUs    |
| RAM      | 2 GB    | 4 GB        |
| Disk     | 20 GB   | 50 GB SSD   |

### Software
- **OS**: Ubuntu 22.04 LTS / 24.04 LTS or Debian 11/12
- **Docker**: 24.x+ with Docker Compose v2 (for Docker path)
- **Node.js**: 20 LTS (for bare-metal path)
- **PostgreSQL**: 16 (for bare-metal path)
- **Git**: 2.x+

---

## Docker Compose Quick Start

The fastest way to get CompliGuard running.

### 1. Clone the repository

```bash
git clone https://github.com/saichand04/compliguard-v2.git
cd compliguard-v2
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env   # Edit required values (see Environment Variables Reference)
```

At minimum, set:
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `JWT_SECRET` — generate with `openssl rand -base64 32`
- `POSTGRES_PASSWORD` — a strong password
- `NEXTAUTH_URL` — your public URL (e.g. `https://compliance.yourcompany.com`)

### 3. Start the stack

```bash
docker compose up -d
```

### 4. Run database migrations and seed data

```bash
docker compose exec app npx drizzle-kit push
docker compose exec app npx tsx seed/seed-nist.ts
docker compose exec app npx tsx seed/create-admin.ts
```

### 5. Access CompliGuard

Open your browser to `http://localhost:3030` (or the URL you configured).

---

### Docker Compose Services

| Service    | Port(s)      | Purpose                         |
|------------|--------------|----------------------------------|
| `app`      | 3030         | Next.js application              |
| `postgres` | internal     | PostgreSQL 16 database           |
| `redis`    | internal     | Redis cache / session store      |
| `minio`    | 9000, 9001   | S3-compatible object storage     |
| `nginx`    | 80, 443      | Reverse proxy + SSL termination  |

### Development mode

```bash
# Use override file (auto-loaded by Docker Compose)
docker compose up app postgres redis
# nginx is excluded in dev via profiles
```

---

## Manual Installation (systemd)

For production deployments without Docker, or air-gapped environments.

### Automated installer (Ubuntu/Debian)

```bash
curl -fsSL https://raw.githubusercontent.com/saichand04/compliguard-v2/main/scripts/install.sh | sudo bash
```

### Manual step-by-step

#### 1. Install system dependencies

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# PostgreSQL 16
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | sudo tee /usr/share/keyrings/postgresql-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update && sudo apt-get install -y postgresql-16
```

#### 2. Create service user and install directory

```bash
sudo useradd --system --shell /bin/bash --create-home --home-dir /opt/compliguard compliguard
```

#### 3. Clone and configure

```bash
sudo -u compliguard git clone https://github.com/saichand04/compliguard-v2.git /opt/compliguard
sudo -u compliguard cp /opt/compliguard/.env.example /opt/compliguard/.env
sudo -u compliguard nano /opt/compliguard/.env
sudo chmod 600 /opt/compliguard/.env
```

#### 4. PostgreSQL setup

```bash
sudo -u postgres psql -c "CREATE USER compliguard WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "CREATE DATABASE compliguard OWNER compliguard;"
```

#### 5. Build and migrate

```bash
cd /opt/compliguard
sudo -u compliguard npm install --legacy-peer-deps
sudo -u compliguard npm run build
sudo -u compliguard npx drizzle-kit push
sudo -u compliguard npx tsx seed/seed-nist.ts
sudo -u compliguard npx tsx seed/create-admin.ts
```

#### 6. Install systemd service

```bash
sudo cp /opt/compliguard/systemd/compliguard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable compliguard
sudo systemctl start compliguard
```

#### 7. Verify

```bash
sudo systemctl status compliguard
sudo journalctl -u compliguard -f
curl http://localhost:3030/api/health
```

---

## Environment Variables Reference

| Variable               | Default             | Required | Description |
|------------------------|---------------------|----------|-------------|
| `NEXTAUTH_SECRET`      | —                   | ✅       | 32+ char secret for session signing |
| `JWT_SECRET`           | —                   | ✅       | 32+ char JWT signing secret |
| `NEXTAUTH_URL`         | `http://localhost:3030` | ✅   | Public URL of the app |
| `POSTGRES_PASSWORD`    | `compliguard`       | ✅       | PostgreSQL password |
| `DATABASE_URL`         | —                   | ✅       | Full PostgreSQL connection URL |
| `STORAGE_PROVIDER`     | `local`             | ❌       | `local`, `s3`, `minio`, `azure_blob`, `onedrive` |
| `LOCAL_STORAGE_PATH`   | `/data/uploads`     | ❌       | Path for local file storage |
| `EMAIL_PROVIDER`       | `mock`              | ❌       | `mock`, `postmark`, `smtp` |
| `AI_PROVIDER`          | `openai`            | ❌       | `openai`, `gemini`, `claude`, `ollama` |
| `PORT`                 | `3030`              | ❌       | Application port |
| `PLATFORM_NAME`        | `CompliGuard`       | ❌       | Custom platform name |
| `ALLOW_REGISTRATIONS`  | `false`             | ❌       | Allow public sign-ups |
| `REDIS_URL`            | `redis://localhost:6379` | ❌  | Redis connection URL |
| `OLLAMA_ENDPOINT`      | `http://localhost:11434` | ❌  | Ollama API endpoint |

---

## Database Setup

CompliGuard uses PostgreSQL 16 with Drizzle ORM.

### Migrations

```bash
# Apply schema changes
npx drizzle-kit push

# Generate migration files
npx drizzle-kit generate

# Open Drizzle Studio (database GUI)
npx drizzle-kit studio
```

### Seeding

```bash
# Seed NIST 800-53 controls
npx tsx seed/seed-nist.ts

# Create initial admin account (prompts for email/password)
npx tsx seed/create-admin.ts
```

### Connection pooling

For high-traffic deployments, add PgBouncer:

```bash
sudo apt-get install pgbouncer
```

Then point `DATABASE_URL` at PgBouncer's port (typically 6432) instead of PostgreSQL directly.

---

## Storage Options

### Local storage (default)

Files stored on disk. Good for single-server deployments.

```env
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=/data/uploads
```

### MinIO (self-hosted S3-compatible)

Included in the Docker Compose stack. Good for multi-server or high-volume.

```env
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=compliguard
MINIO_ROOT_PASSWORD=your-strong-password
```

Access MinIO console at `http://localhost:9001`.

### Amazon S3

```env
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name
```

### Azure Blob Storage

```env
STORAGE_PROVIDER=azure_blob
AZURE_STORAGE_ACCOUNT=youraccount
AZURE_STORAGE_KEY=your-key
AZURE_CONTAINER_NAME=compliguard
```

### OneDrive / SharePoint

```env
STORAGE_PROVIDER=onedrive
MICROSOFT_CLIENT_ID=your-app-id
MICROSOFT_CLIENT_SECRET=your-secret
MICROSOFT_TENANT_ID=your-tenant-id
```

---

## Email Configuration

### Mock (development / testing)

Logs emails to console. No real email is sent.

```env
EMAIL_PROVIDER=mock
```

### Postmark (recommended for production)

```env
EMAIL_PROVIDER=postmark
POSTMARK_TOKEN=your-postmark-server-token
EMAIL_FROM=compliance@yourdomain.com
```

Sign up at [postmarkapp.com](https://postmarkapp.com).

### SMTP (generic)

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=compliance@yourdomain.com
```

Works with any SMTP server including Gmail, SendGrid, Mailgun, and self-hosted Postfix.

---

## AI Provider Setup

### OpenAI (default)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Google Gemini

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key
```

### Anthropic Claude

```env
AI_PROVIDER=claude
CLAUDE_API_KEY=your-key
```

### Ollama (fully air-gapped / on-premises)

Run AI locally with no external API calls. Ideal for regulated environments.

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model (e.g., Llama 3.1 8B)
ollama pull llama3.1:8b

# Or use a larger model for better results
ollama pull llama3.1:70b
```

```env
AI_PROVIDER=ollama
OLLAMA_ENDPOINT=http://localhost:11434
```

Ollama runs on CPU by default; GPU acceleration is supported for NVIDIA and AMD.

---

## Nginx Reverse Proxy

The included `deploy/nginx.conf` configures nginx as a reverse proxy with:
- HTTP → HTTPS redirect
- Rate limiting (30 req/min on `/api/`, 10 req/s on general routes)
- Security headers (HSTS, X-Frame-Options, CSP, etc.)
- WebSocket support

### Enable nginx with Docker Compose

Nginx is excluded from dev mode. For production:

```bash
# First generate SSL certs (see SSL/TLS section)
docker compose --profile prod-only up -d nginx
```

### Custom domain

Edit `deploy/nginx.conf`, replace `server_name _` with your domain:

```nginx
server_name compliance.yourcompany.com;
```

---

## SSL/TLS Configuration

See [`deploy/ssl/README.md`](deploy/ssl/README.md) for full instructions.

### Quick self-signed cert

```bash
openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
  -keyout deploy/ssl/key.pem \
  -out deploy/ssl/cert.pem \
  -subj "/CN=localhost"
```

### Let's Encrypt

```bash
sudo apt-get install certbot
sudo certbot certonly --standalone -d compliance.yourcompany.com
sudo cp /etc/letsencrypt/live/compliance.yourcompany.com/fullchain.pem deploy/ssl/cert.pem
sudo cp /etc/letsencrypt/live/compliance.yourcompany.com/privkey.pem deploy/ssl/key.pem
```

Auto-renewal cron:

```bash
echo "0 */12 * * * root certbot renew --quiet --deploy-hook 'docker compose -f /path/to/docker-compose.yml restart nginx'" | sudo tee /etc/cron.d/certbot
```

---

## Backup and Restore

### Run a backup

```bash
./scripts/backup.sh
```

Creates a timestamped archive at `/var/backups/compliguard/compliguard-backup-YYYYMMDD-HHMMSS.tar.gz` containing:
- Full PostgreSQL dump (compressed)
- Upload files archive
- Backup metadata JSON

### Automated backups (cron)

```bash
# Daily at 2 AM
echo "0 2 * * * compliguard /opt/compliguard/scripts/backup.sh >> /var/log/compliguard-backup.log 2>&1" | sudo tee /etc/cron.d/compliguard-backup
```

### Upload to S3/MinIO

```env
UPLOAD_TO_S3=true
S3_BUCKET=my-backup-bucket
S3_ENDPOINT=http://localhost:9000   # Omit for real AWS S3
```

### Restore

```bash
# Extract the archive
mkdir -p /tmp/restore
tar -xzf compliguard-backup-20240101-120000.tar.gz -C /tmp/restore

# Restore database
PGPASSWORD=your-password pg_restore \
  -h localhost -U compliguard -d compliguard \
  /tmp/restore/compliguard-backup-*/database.dump

# Restore uploads
tar -xzf /tmp/restore/compliguard-backup-*/uploads.tar.gz -C /opt/compliguard/data
```

---

## Upgrading

### Docker Compose

```bash
docker compose pull
docker compose up -d
docker compose exec app npx drizzle-kit push
```

### Systemd (bare-metal)

```bash
sudo ./scripts/update.sh
```

The update script:
1. Creates a backup
2. Pulls latest code from git
3. Runs `npm install`
4. Runs database migrations
5. Rebuilds Next.js
6. Restarts the systemd service
7. Performs a health check

---

## Troubleshooting

### App won't start

```bash
# Check service status
sudo systemctl status compliguard

# View recent logs
sudo journalctl -u compliguard -n 100 --no-pager

# Follow live logs
sudo journalctl -u compliguard -f
```

### Database connection errors

```bash
# Test connection
psql postgresql://compliguard:password@localhost:5432/compliguard -c "\l"

# Check PostgreSQL is running
sudo systemctl status postgresql
```

### Port already in use

```bash
# Find what's using port 3030
sudo lsof -i :3030
sudo ss -tlnp | grep 3030
```

### Build failures

```bash
# Clear Next.js cache and rebuild
rm -rf .next
npm run build
```

### Docker: Out of disk space

```bash
# Remove unused Docker objects
docker system prune -a --volumes

# Check disk usage
docker system df
```

### Reset admin password

```bash
# Bare-metal
cd /opt/compliguard && sudo -u compliguard npx tsx seed/create-admin.ts

# Docker
docker compose exec app npx tsx seed/create-admin.ts
```

### Common environment issues

| Error | Fix |
|-------|-----|
| `NEXTAUTH_SECRET must be at least 32 chars` | Regenerate: `openssl rand -base64 32` |
| `Cannot reach database` | Check `DATABASE_URL` and PostgreSQL is running |
| `EACCES: permission denied` | Ensure `compliguard` user owns `/opt/compliguard/data` |
| `Module not found` | Run `npm install --legacy-peer-deps` |

---

## Security Hardening Checklist

### Application
- [ ] `NEXTAUTH_SECRET` is at least 32 random characters
- [ ] `JWT_SECRET` is at least 32 random characters (different from `NEXTAUTH_SECRET`)
- [ ] `POSTGRES_PASSWORD` is strong and unique
- [ ] `ALLOW_REGISTRATIONS=false` (unless you want open registration)
- [ ] `.env` file permissions: `chmod 600 .env`

### Network
- [ ] Firewall rules: only expose ports 80 and 443 publicly
- [ ] PostgreSQL port 5432 is not publicly accessible
- [ ] Redis port 6379 is not publicly accessible
- [ ] MinIO ports 9000/9001 are restricted or not publicly accessible

### SSL/TLS
- [ ] Valid SSL certificate (not self-signed for production)
- [ ] TLSv1.2 and TLSv1.3 only (no TLS 1.0 or 1.1)
- [ ] HSTS header enabled (configured in nginx.conf)
- [ ] Test with [SSL Labs](https://www.ssllabs.com/ssltest/) — aim for A or A+

### System
- [ ] CompliGuard runs as non-root `compliguard` user
- [ ] `NoNewPrivileges=true` in systemd unit
- [ ] System packages are up to date: `sudo apt-get update && sudo apt-get upgrade`
- [ ] Automatic security updates: `sudo apt-get install unattended-upgrades`
- [ ] SSH key-only authentication (no password logins)

### Backups
- [ ] Automated daily backups configured
- [ ] Backups stored off-site (S3/MinIO remote, or external location)
- [ ] Backup restore tested at least once
- [ ] Backup retention policy configured (`RETENTION_DAYS`)

### Monitoring
- [ ] Systemd service auto-restarts on failure (`Restart=on-failure`)
- [ ] Log rotation configured (systemd journal handles this by default)
- [ ] Uptime monitoring set up (e.g., Uptime Kuma, Better Uptime)
- [ ] Disk space alerts configured

---

## Support

- GitHub Issues: https://github.com/saichand04/compliguard-v2/issues
- Documentation: https://github.com/saichand04/compliguard-v2/wiki

---

*CompliGuard Self-Hosting Guide — Phase 5C*
