# Changelog

All notable changes to CompliGuard v2 are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.1.0] — Phase 0 Foundation Scaffold — 2026-05-03

### Added

**Infrastructure & Configuration**
- Next.js 15 with TypeScript, Tailwind CSS v4, and App Router
- `next.config.mjs` with standalone output for Docker deployment
- Drizzle ORM configuration (`drizzle.config.ts`) targeting PostgreSQL 16
- Full `.env.example` reference covering all 30+ environment variables
- Comprehensive `.gitignore` for Node, Next.js, env files, and IDE artifacts

**Database Schema (50+ tables)**
- Organizations, users, system settings
- Frameworks and controls (with JSON controls column for Phase 0)
- Evidence with storage metadata (key, provider, size, MIME type)
- Risk register with CVSS-style scoring
- Policy lifecycle management
- Tasks and assignments
- Vendor risk management
- Findings and remediations
- Notifications (multi-channel)
- Audit logs (immutable append-only)
- Integrations catalog
- Microsoft Teams bot sessions
- API keys (hashed)
- Org chart
- Billing records
- Training completions
- Knowledge base articles

**Authentication**
- Custom JWT implementation (`lib/auth/jwt.ts`) using `jose` library
- Session cookies: `cg-session` (JWT) and `cg-setup` (setup flag)
- bcrypt password hashing with configurable work factor
- RBAC system (`lib/auth/rbac.ts`) with 5 roles and 50+ permissions
- Sign in, sign up, forgot password auth pages and API routes
- Rate limiting on auth endpoints (5 req / 15 min per IP)

**Storage Abstraction**
- `StorageProvider` interface (`lib/storage/types.ts`)
- Storage key format: `evidence/{orgId}/{year}/{month}/{uuid}-{filename}`
- Local filesystem provider (default)
- AWS S3 provider (also supports MinIO via `STORAGE_S3_ENDPOINT`)
- Azure Blob Storage provider
- OneDrive / SharePoint provider (via Microsoft Graph API)
- Singleton factory with environment-driven provider selection

**Email**
- Outbound email via Resend API (`lib/email/outbound.ts`)
  - 8 email functions: welcome, invitation, password reset, evidence collected, task assigned, risk alert, audit reminder, setup complete
- Inbound evidence collection via Postmark webhook (`lib/email/inbound.ts`)
  - Parses sender, subject, body, attachments from webhook payload

**Middleware**
- `middleware.ts` — JWT session verification on all protected routes
- Setup wizard redirect: unsetup tenants redirected to `/setup/*`
- Public path exclusions: auth, setup, inbound webhook, Teams bot, MCP manifest

**Setup Wizard (9 steps)**
- Step 0: Welcome and introduction
- Step 1: Organization profile (name, industry, size, domain)
- Step 2: Admin account creation (email, password, name)
- Step 3: User invitation (initial team members)
- Step 4: Email configuration (Resend / SMTP)
- Step 5: Storage configuration (Local / S3 / Azure / OneDrive)
- Step 6: AI configuration (OpenAI / Azure OpenAI)
- Step 7: Integrations (Teams, Sentinel, Intune, GitHub, Jira)
- Step 8: Review and complete
- API routes for each step + test-email, test-storage, test-ai, complete endpoints
- Setup progress stored in `system_settings.setup_step`

**Dashboard**
- Dashboard layout with sidebar navigation and top header
- Overview page with stats cards and framework progress
- Sidebar with nested navigation for all major modules
- Stats components: StatsCard, FrameworkProgressCard

**Core API Routes**
- `GET/POST /api/frameworks` — list and create frameworks
- `GET/POST /api/controls` — list and create controls
- `GET/POST /api/evidence` — list and create evidence records
- `POST /api/evidence/upload` — multipart file upload to storage
- `GET/POST /api/risks` — risk register CRUD
- `GET/POST /api/policies` — policy lifecycle management
- `GET/POST /api/notifications` — notification management
- `GET /api/audit-logs` — immutable audit log viewer

**MCP (OpenClaw)**
- `public/mcp-manifest.json` — machine-readable compliance context manifest
- Defines 8 tool schemas for AI agent integration (list_frameworks, get_controls, search_evidence, etc.)

**Deployment**
- Multi-stage `Dockerfile` (deps -> builder -> runner) using Next.js standalone output
- `docker-compose.yml` with app, PostgreSQL 16, MinIO, Redis, and optional db-migrate service
- `.dockerignore` tuned for optimal layer caching
- `install.sh` — full Linux installer for Ubuntu/Debian/RHEL with systemd service

**CI/CD**
- `.github/workflows/ci.yml` — lint, typecheck, unit tests, integration tests (with PostgreSQL service), build, and Docker image push to GHCR
- `.github/workflows/release.yml` — automated GitHub Release on tag push with Docker image tagging

**Seed Data**
- `seed/seed.ts` — idempotent seeder (upsert by slug)
- 21 compliance framework JSON files with full control lists:
  SOC 2, ISO 27001, HIPAA, GDPR, PCI DSS v4.0, NIST CSF 2.0, FedRAMP Moderate, CCPA/CPRA, SOX, HITRUST CSF, FERPA, ISO 9001, NIST 800-53 Rev 5, NIST 800-171 Rev 2, CMMC 2.0, CIS Controls v8, COBIT 2019, ISO 27017, ISO 27018, ISO 22301, NERC CIP v7
- System settings defaults (14 settings covering setup, security, registration, AI, notifications)

**Testing**
- `vitest.config.ts` with path aliases, coverage thresholds (60%), and node environment
- `tests/unit/setup.ts` — global mocks for `next/headers`, `next/navigation`, Pino logger
- `tests/unit/rbac.test.ts` — 30+ tests for RBAC permission hierarchy
- `tests/unit/storage.test.ts` — storage key generation and provider config tests
- `tests/unit/rate-limiter.test.ts` — sliding window rate limit logic tests
- `tests/unit/jwt.test.ts` — JWT sign/verify round-trip tests
- `tests/e2e/` directory scaffolded for Playwright

**Documentation**
- `README.md` — full project overview, quick start, architecture, framework list, scripts
- `CHANGELOG.md` — this file
- `LICENSE` — Apache License 2.0
- `CONTRIBUTING.md` — development workflow and code standards
- `CODE_OF_CONDUCT.md` — Contributor Covenant

---

[Unreleased]: https://github.com/saichand04/compliguard-v2/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/saichand04/compliguard-v2/releases/tag/v0.1.0
