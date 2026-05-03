# CompliGuard v2

**AI-powered GRC Compliance Platform** — Microsoft/Azure-native, self-hosted, multi-tenant.

[![CI](https://github.com/saichand04/compliguard-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/saichand04/compliguard-v2/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)

---

## Overview

CompliGuard v2 is a fully self-hosted, enterprise-grade Governance, Risk, and Compliance (GRC) platform built for organizations that need to manage multiple compliance frameworks simultaneously — SOC 2, ISO 27001, HIPAA, GDPR, PCI DSS, FedRAMP, CMMC, and 15+ others.

**Key differentiators:**
- **Self-hosted** — your data never leaves your infrastructure
- **AI-powered** — evidence analysis, risk scoring, and gap detection via OpenAI or Azure OpenAI
- **Microsoft-native** — deep Teams, Azure Sentinel, and Entra ID integration
- **OpenClaw MCP** — structured machine-readable compliance context for AI agent workflows
- **Multi-tenant** — full organization isolation from day one

---

## Features

| Feature | Status |
|---------|--------|
| Multi-framework compliance management | Phase 0 (scaffold) |
| 9-step setup wizard | Phase 0 |
| JWT auth + bcrypt + RBAC (5 roles) | Phase 0 |
| Pluggable storage (Local/S3/MinIO/Azure Blob/OneDrive) | Phase 0 |
| Evidence collection (upload + inbound email) | Phase 0 |
| Risk register with scoring | Phase 0 |
| Policy lifecycle management | Phase 0 |
| Vendor risk management | Phase 0 |
| Docker Compose deployment | Phase 0 |
| Linux installer (systemd) | Phase 0 |
| 21 framework seed files | Phase 0 |
| OpenClaw MCP manifest | Phase 0 |
| AI risk scoring | Phase 1 |
| Azure Sentinel integration | Phase 1 |
| Microsoft Teams bot | Phase 1 |
| Automated evidence collection | Phase 2 |
| Audit report generation | Phase 3 |

---

## Quick Start

### Docker Compose (recommended)

```bash
# 1. Clone the repo
git clone https://github.com/saichand04/compliguard-v2
cd compliguard-v2

# 2. Copy environment file and set required values
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET

# 3. Start the stack
docker compose up -d

# 4. Run migrations + seed (first time only)
docker compose --profile migrate up db-migrate

# 5. Open the setup wizard
open http://localhost:3000
```

### Linux Installer (systemd)

```bash
curl -fsSL https://raw.githubusercontent.com/saichand04/compliguard-v2/main/install.sh | sudo bash
```

### Development

```bash
# Prerequisites: Node.js 20+, PostgreSQL 16, Redis

git clone https://github.com/saichand04/compliguard-v2
cd compliguard-v2

npm install --legacy-peer-deps

cp .env.example .env.local
# Edit .env.local with your local database URL

npm run db:migrate
npm run db:seed
npm run dev
```

---

## Environment Variables

See `.env.example` for the full reference. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | 32+ char random secret for JWT signing |
| `STORAGE_PROVIDER` | Yes | `local`, `s3`, `azure-blob`, or `onedrive` |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of your CompliGuard instance |
| `RESEND_API_KEY` | No | For outbound email (notifications, invites) |
| `OPENAI_API_KEY` | No | For AI-powered features |
| `AZURE_OPENAI_ENDPOINT` | No | Azure OpenAI endpoint (alternative to OpenAI) |

---

## Architecture

```
compliguard-v2/
├── app/                    # Next.js 15 App Router
│   ├── (auth)/             # Sign in, sign up, forgot password
│   ├── (setup)/            # 9-step setup wizard
│   ├── (dashboard)/        # Main application dashboard
│   └── api/                # API routes
├── components/             # Shared React components
│   ├── dashboard/          # Dashboard layout components
│   └── setup-wizard/       # Setup wizard components
├── lib/
│   ├── auth/               # JWT + RBAC
│   ├── db/
│   │   ├── index.ts        # Drizzle client
│   │   └── schema/         # 50+ Drizzle schema files
│   ├── email/              # Resend (outbound) + Postmark (inbound)
│   └── storage/            # Pluggable storage abstraction
│       └── providers/      # Local, S3, Azure Blob, OneDrive
├── seed/
│   ├── seed.ts             # Database seeder
│   └── frameworks/         # 21 framework JSON files
├── tests/
│   ├── unit/               # Vitest unit tests
│   └── e2e/                # Playwright E2E scaffold
├── .github/workflows/      # CI/CD pipelines
├── docker-compose.yml      # Full stack: app + postgres + minio + redis
├── Dockerfile              # Multi-stage production image
└── install.sh              # Linux systemd installer
```

---

## Supported Frameworks (Phase 0 seed data)

| Framework | Category |
|-----------|----------|
| SOC 2 Type II | Security |
| ISO/IEC 27001:2022 | Security |
| HIPAA Security Rule | Healthcare |
| GDPR | Privacy |
| PCI DSS v4.0 | Financial |
| NIST Cybersecurity Framework 2.0 | Security |
| FedRAMP Moderate | Government |
| CCPA / CPRA | Privacy |
| Sarbanes-Oxley (SOX) | Financial |
| HITRUST CSF v11 | Healthcare |
| FERPA | Privacy |
| ISO 9001:2015 | Quality |
| NIST SP 800-53 Rev 5 | Security |
| NIST SP 800-171 Rev 2 | Government |
| CMMC 2.0 Level 2 | Government |
| CIS Controls v8 | Security |
| COBIT 2019 | Governance |
| ISO/IEC 27017:2015 | Cloud Security |
| ISO/IEC 27018:2019 | Cloud Privacy |
| ISO 22301:2019 | Resilience |
| NERC CIP v7 | Critical Infrastructure |

---

## RBAC Roles

| Role | Description |
|------|-------------|
| `super_admin` | Full system access including org management |
| `admin` | Full operational access, user management |
| `compliance_manager` | Create/edit frameworks, evidence, risks, policies |
| `auditor` | Read-only + audit logs + report generation |
| `user` | Basic read + evidence upload + task management |

---

## Development Scripts

```bash
npm run dev              # Start dev server with Turbo
npm run build            # Production build
npm run typecheck        # TypeScript check (no emit)
npm run lint             # ESLint
npm run test             # Vitest unit tests
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright E2E
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Apply migrations
npm run db:push          # Push schema directly (dev only)
npm run db:seed          # Seed framework data
npm run db:studio        # Drizzle Studio (DB UI)
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

---

## License

Apache License 2.0. See [LICENSE](LICENSE).
