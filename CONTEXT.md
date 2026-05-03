# CompliGuard v2 — Project Context & Session History

> **Purpose:** This file is the single source of truth for all decisions, architecture, conversation history, and feature tracking for CompliGuard v2. Any AI session (Claude, GPT, Gemini, or OpenClaw agent) that reads this file should be able to fully understand where this project came from, what has been built, what is in progress, and what comes next — and pick up development without any additional context.

> **Last updated:** May 3, 2026 — Phase 0 build clean, controls mapping engine architecture added

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Origin & Motivation](#2-origin--motivation)
3. [Competitive Analysis Summary](#3-competitive-analysis-summary)
4. [Full Conversation History](#4-full-conversation-history)
5. [Frozen Feature Plan — All 7 Phases](#5-frozen-feature-plan--all-7-phases)
6. [Architecture Decisions](#6-architecture-decisions)
7. [Tech Stack](#7-tech-stack)
8. [Database Schema](#8-database-schema)
9. [Deployment Targets](#9-deployment-targets)
10. [Evidence Storage Design](#10-evidence-storage-design)
11. [Setup Wizard Design](#11-setup-wizard-design)
12. [OpenClaw MCP Server Design](#12-openclaw-mcp-server-design)
13. [Microsoft Teams Bot Design](#13-microsoft-teams-bot-design)
14. [Controls Mapping Engine Architecture](#14-controls-mapping-engine-architecture)
15. [Development Progress Tracker](#15-development-progress-tracker)
16. [Technical Debt Log](#16-technical-debt-log)
17. [Environment Variables Reference](#17-environment-variables-reference)
18. [Repo Structure](#18-repo-structure)

---

## 1. Project Overview

**CompliGuard v2** is an AI-powered GRC (Governance, Risk & Compliance) platform for managing, tracking, and achieving compliance across multiple regulatory frameworks. It is the enhanced successor to the V0-prototype at `saichand04/compliance-with-ai`.

**Tagline (working):** _"The compliance platform built for Microsoft 365 and Azure shops."_

**Key differentiators vs competitors (Vanta, Drata, trycomp.ai):**
- Microsoft/Azure-native depth: Entra ID, Intune, Defender for Cloud, Sentinel, Purview — nobody else does this deeply
- Self-hosting simplicity: single Next.js monolith + Postgres, `docker compose up` or `install.sh` on Linux
- OpenClaw MCP integration: compliance queries from any messaging channel via AI agent
- Microsoft Teams bot: proactive compliance alerts, slash commands, approval-from-card
- Pluggable storage: Local filesystem, AWS S3, Azure Blob, OneDrive, MinIO — user selects at setup
- Inbound email → evidence: reply to a compliance email with an attachment, evidence auto-ingests
- 58 features across 7 phases — the most comprehensive open-core GRC platform for Microsoft shops

**Two deployment targets:**
1. **Linux Standalone** — Node.js process + Postgres, systemd service, `install.sh` script
2. **Docker** — `docker compose up`, all services containerized including MinIO for storage

---

## 2. Origin & Motivation

The original prototype (`saichand04/compliance-with-ai`) was built with V0.dev in ~4 days. It established the GRC core but had critical gaps:
- No actual file storage (placeholder `// In a real app, upload to blob storage first`)
- No external integrations
- SQL injection stubs in `db.ts`
- Migration naming collision (two `003-*.sql` files)
- No test suite
- No `.env.example`
- No notifications UI (table existed, no UI)
- AI control mapping used cosine similarity only, no actual LLM call

The v2 project was initiated on May 3, 2026 after a thorough competitive analysis against trycomp.ai (Bubba AI Inc.), which revealed both the maturity gap and the strategic opportunity in the Microsoft/Azure-native compliance space.

---

## 3. Competitive Analysis Summary

### CompliGuard v1 vs trycomp.ai

**trycomp.ai facts:**
- Company: Bubba AI Inc. d/b/a Comp AI, San Francisco
- GitHub: `trycompai/comp`, 1,529 stars, 297 forks, AGPLv3 license, 15 months old
- Stack: Turborepo, Next.js (frontend), NestJS (API), Prisma, PostgreSQL, Trigger.dev, Upstash Redis, Better Auth, Vercel, S3, Sentry
- Positioning: "Compliance that helps you close deals" — Vanta & Drata alternative
- Proof: 600+ companies, 4.9/5 rating, #1 Product Hunt, 7 published case studies
- Integrations: AWS, Azure, GCP, GitHub, Google Workspace, JumpCloud, Rippling, Vercel, Aikido (9 total)
- Unique features: device agent, cloud scanning (40+ AWS services), AI chat with tool use, vendor risk, pentest with billing, background checks, trust portal, questionnaire builder, SOA, org chart, Stripe billing, Browserbase visual verifier, Sentry, Redis, scheduled background jobs via Trigger.dev

**Where CompliGuard v1 was ahead:**
- 50+ frameworks vs trycomp's 6 headline frameworks
- Self-hosting simplicity (single app vs Turborepo multi-service)
- Azure Entra integration already started

**Critical gaps identified:**
- No cloud security scanning
- No real LLM in control mapping
- No trust portal
- No vendor risk module
- Zero external integrations
- No task management, AI assistant, SOA, device agent, pentest, findings

**Strategic angle:** Microsoft/Azure-native compliance — trycomp has zero Intune, Sentinel, Defender, Purview depth. Largest undefended segment in GRC tooling.

**Full analysis report:** `docs/competitive-analysis-2026-04-30.md`

---

## 4. Full Conversation History

### Session 1 — April 30, 2026 (Perplexity Computer)

**User:** Introduced the CompliGuard project (`saichand04/compliance-with-ai`) and provided the full product description. Asked to explore the GitHub repo, understand the codebase, and wait for next prompt.

**AI Actions:**
- Loaded GitHub CLI skill
- Explored full repo file tree, package.json, auth-server.ts, rbac.ts, ai-provider.ts, control mapping route, Dockerfile, middleware.ts, next.config.mjs, framework-controls.ts (1,315 lines), all SQL migration scripts
- Identified key architectural facts:
  - Custom JWT auth via `jose`, not NextAuth
  - Raw Neon SQL, no ORM
  - AI control mapping is cosine similarity only, no LLM call
  - `lib/evidence.ts` is placeholder (no actual file storage)
  - Two `003-*.sql` migration files (naming collision)
  - `next.config.mjs` has `output: 'standalone'` (Docker-valid)
  - `lib/framework-controls.ts` is 1,315 lines (50+ frameworks static data)

**Key findings noted:**
- Buggy placeholder methods in `db.ts` (SQL injection risk, unused)
- No `.env.example`
- Evidence upload dialog has `// In a real app, upload to blob storage first` — no storage implemented
- `notifications` table exists but no UI

---

### Session 2 — April 30, 2026 (Competitive Analysis)

**User:** Introduced trycomp.ai (`https://www.trycomp.ai/`) and asked for a thorough feature comparison and suggestions for what to develop.

**AI Actions:**
- Browsed trycomp.ai website (full hero, features, pricing, integrations, frameworks, AI capabilities, testimonials, nav structure, free tools, company info)
- Explored `trycompai/comp` GitHub repo (full file tree, app modules, API modules, integration manifests, Prisma schema)
- Ran web searches for reviews, changelog, feature announcements
- Identified all top-level app modules: overview, frameworks, controls, documents, evidence-forms, cloud-tests, integrations, vendors, people, risk, policies, questionnaire, tasks, trust, settings, auditor, admin, knowledge-base, security
- Identified all NestJS API modules (40+): admin-feature-flags, assistant-chat, background-checks, cloud-security, comments, device-agent, findings, framework-editor, knowledge-base, org-chart, penetration-tests, questionnaire, risks, secrets, soa, stripe, task-management, timelines, trust-portal, vector-store, vendors, etc.
- Identified integration manifests: aikido, aws, azure, gcp, github, google-workspace, jumpcloud, rippling, vercel

**Output:** Full competitive analysis report (`compliguard-vs-trycompai-analysis.md`) with:
- Feature comparison table (50+ rows, ✅⚠️❌ status indicators)
- Gap analysis (Critical, Major, Nice-to-Have)
- Prioritized recommendations (Tier 1/2/3)
- Strategic recommendations (Azure-native wedge, self-hosting, bundled audit pricing, free tools, open-core licensing)
- Technical debt list (12 items)

**Key strategic recommendation:** Microsoft/Azure-native compliance is the single most defensible wedge. trycomp.ai has zero Intune, Sentinel, Defender, Purview depth. CompliGuard's founder has deep expertise in all of them.

---

### Session 3 — May 3, 2026 (Feature List Finalization)

**User:** Provided the finalized list of features to implement (selected from the comparison table). Requested:
1. A new GitHub repo for the enhanced version
2. Both standalone Linux and Docker deployment targets
3. All work tracked in a CONTEXT.md file in the repo
4. Execution plan review before development starts

**AI Response:** Produced the full 7-phase, 58-feature execution plan. User approved the plan structure and asked to add two more items before finalizing.

---

### Session 4 — May 3, 2026 (OpenClaw + Teams Bot Research)

**User:** Asked to add:
1. OpenClaw integration (with required OpenClaw skills/MCP server)
2. Microsoft Teams chatbot (get compliance updates from Teams)

**AI Research Findings:**

**OpenClaw:**
- Open-source personal AI agent runtime built on Model Context Protocol (MCP)
- Architecture: User (any channel) → OpenClaw Gateway → Agent Runtime → Skills/MCP Tools → CompliGuard API
- Skills are MCP tool manifests registered with the OpenClaw gateway
- CompliGuard needs to expose an MCP Server with a skill manifest
- 10 tools planned: `get_control_status`, `get_risk_summary`, `submit_evidence`, `get_compliance_score`, `get_findings`, `assign_task`, `get_policy_status`, `run_nl_test`, `get_vendor_risk`, `get_audit_trail`
- Authentication: per-org API keys scoped to OpenClaw agent access

**Microsoft Teams Bot:**
- Current recommended stack: Teams AI SDK v2 (TypeScript, Sept 2025 release, successor to TeamsFX)
- Azure Bot Service handles webhook relay from Teams → Next.js API route
- Bot logic lives at `app/api/teams-bot/route.ts`
- Adaptive Cards for rich compliance dashboards
- Proactive messaging requires storing `conversationReference` objects in Postgres
- Slash commands: `/compliance`, `/control`, `/risks`, `/tasks`, `/findings`, `/policy`
- Key capabilities: proactive alerts, approval-from-card (approve/reject evidence in Teams), daily digest

**Added to plan:** Phase 6 (OpenClaw MCP) and Phase 7 (Teams Bot)

---

### Session 5 — May 3, 2026 (Evidence Storage Design)

**User:** Flagged that evidence storage was not covered. Proposed: AWS S3, Azure Blob, local storage, OneDrive. Also proposed a platform email identity for evidence collection and notification triggers where users reply with attachments.

**AI Research Findings (from reading actual codebase):**
- `upload-evidence-dialog.tsx` has literal comment: `// In a real app, upload to blob storage first` — no storage implemented
- `app/api/evidence/route.ts` just stores a `file_url` string — no file upload
- `lib/evidence.ts` defines the interface but no storage logic
- No `.env.example` — no storage env vars configured

**Storage design decided:**
- Pluggable provider abstraction: `lib/storage/index.ts` with `StorageProvider` interface
- 5 backends: Local filesystem, AWS S3, Azure Blob Storage, OneDrive/SharePoint (Microsoft Graph API), MinIO (S3-compatible, bundled in Docker)
- `STORAGE_PROVIDER=local|s3|azure-blob|onedrive|minio` env var
- Docker edition: MinIO bundled in `docker-compose.yml` as default
- Linux standalone: Local filesystem default at `/data/evidence/`

**Email design decided:**
- Platform mailbox: `compliance@[orgdomain]` 
- Outbound: Resend or SendGrid for transactional (assignments, approvals, alerts)
- Inbound: Postmark Inbound Parse for attachment extraction from reply emails
- Flow: System sends evidence request → user replies with attachment → Postmark webhook → file extracted → uploaded to storage → evidence record created

**Added to plan:** Phase 2 items 2.12–2.15

---

### Session 6 — May 3, 2026 (Setup Wizard Design)

**User:** Requested a setup wizard for initial/on-demand run. Requirements:
- Very user-friendly, asks required questions
- Ingests inputs to config and env files
- Captures: org name, admins, auditors, domain, email setup, storage setup, and all required settings
- Users can edit any missed details in Settings at any time
- Wizard re-invokable on-demand from Settings at any point

**AI Design Decisions:**
- First-run detection: `setup_completed` flag in `system_settings` table
- Middleware redirect: every request → check flag → if false, redirect to `/setup`
- Config persistence: sensitive (API keys) → `.env` file on disk; platform config → `system_settings` table
- 9-step wizard:
  1. Welcome (platform name, deployment type)
  2. Organization (name, domain, industry, size, logo)
  3. Administrator Account (first super_admin creation)
  4. Additional Users (invite auditors, compliance managers — optional)
  5. Email Setup (provider choice, API key, from-address)
  6. Storage Setup (provider choice, credentials, connection test)
  7. AI Provider (OpenAI/Gemini, API key, model, test call)
  8. Integrations (Azure Entra, AWS, GitHub — optional, skippable)
  9. Review & Launch (summary, test all connections, set setup_completed = true)

- UX behaviors: skip optional steps, connection test buttons, resume interrupted setup, re-invoke from Settings, incomplete setup banner, non-destructive re-run
- Every wizard step maps 1:1 to a Settings section

**Added to plan:** Phase 0 item 0.9

---

### Session 7 — May 3, 2026 (Development Approved)

**User:** "Yes, record this entire discussion char history in context.md file, make all conversation and your responses are captured. Now proceed to start developing, you have my approval. I'm thinking very big on your work, lets see."

**Status:** Development started. Phase 0 in progress.

---

## 5. Frozen Feature Plan — All 7 Phases

> **Status legend:** ⬜ Not started | 🔄 In progress | ✅ Complete | ⏸ Blocked

### Phase 0 — Foundation & Repo Setup

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 0.1 | New GitHub repo `compliguard-v2` | 🔄 | |
| 0.2 | CONTEXT.md — full session history, feature tracker, architecture | 🔄 | This file |
| 0.3 | Tech debt sweep (SQL migrations, db.ts injection stubs, rate limiting, audit log coverage, FK policies, org_id indexes) | ⬜ | |
| 0.4 | Vitest + Playwright test scaffold + GitHub Actions CI | ⬜ | |
| 0.5 | Structured logging (logger.ts) + Sentry scaffold | ⬜ | |
| 0.6 | Drizzle ORM integration for type-safe SQL | ⬜ | |
| 0.7 | Framework seed data as reproducible JSON in `seed/` | ⬜ | |
| 0.8 | Docker Compose + Linux `install.sh` scaffolds | ⬜ | |
| 0.9 | Setup Wizard (9-step, `/setup` route, middleware-gated, resume, re-invokable) | ⬜ | |

### Phase 1 — Core UX Completeness

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1.1 | Notifications UI (bell icon, mark-as-read, event triggers) | ⬜ | `notifications` table exists in v1 |
| 1.2 | Comments on Controls & Evidence (@mentions, threads, notifications) | ⬜ | |
| 1.3 | Risk Assessment Report + Audit Trail Report (PDF/CSV export) | ⬜ | Was "coming soon" in v1 |
| 1.4 | Statement of Applicability — SOA per framework, PDF export | ⬜ | Required for ISO 27001 |
| 1.5 | Auditor View + Evidence Export (ZIP download) | ⬜ | |
| 1.6 | Trust Portal — public read-only `/trust/[orgSlug]` | ⬜ | |
| 1.7 | AI-powered Control Mapping (real LLM, `mapping_rationale`, `confidence`) | ⬜ | Was cosine-only in v1 |

### Phase 2 — Operational Backbone

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 2.1 | Task Management (Kanban, linked to controls, My Tasks widget) | ⬜ | |
| 2.2 | Vendor / Third-Party Risk (inherent/residual risk, DPA tracking) | ⬜ | |
| 2.3 | Questionnaire Builder (templates, send to vendors/internal) | ⬜ | |
| 2.4 | Evidence Forms (structured collection templates) | ⬜ | |
| 2.5 | Findings (cross-source, severity, triage, link to controls/evidence) | ⬜ | |
| 2.6 | Org Chart | ⬜ | |
| 2.7 | RBAC Custom Roles (role builder, custom permission sets) | ⬜ | |
| 2.8 | Framework Editor (admin, versions, publish/rollback) | ⬜ | |
| 2.9 | AI Assistant Chat (permission-scoped tools, streamed responses) | ⬜ | |
| 2.10 | Context Hub (org stack/processes/risk tolerance → feeds AI) | ⬜ | |
| 2.11 | Timelines / Roadmap (compliance phases, admin-editable templates) | ⬜ | |
| 2.12 | Pluggable Storage (Local / AWS S3 / Azure Blob / OneDrive / MinIO) | ⬜ | See Section 10 |
| 2.13 | Platform Mailbox (compliance@ address, outbound transactional email) | ⬜ | |
| 2.14 | Inbound Email → Evidence (reply-to-collect, attachment auto-ingestion) | ⬜ | |
| 2.15 | Evidence Request Emails (secure single-use upload links per control) | ⬜ | |

### Phase 3 — Integrations & Automation

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 3.1 | GitHub Integration (branch protection, secret scanning → evidence) | ⬜ | |
| 3.2 | AWS Integration (40+ service checks → findings + evidence) | ⬜ | |
| 3.3 | Azure Integration (AKS, App Service, Entra, Key Vault, SQL, Storage, VM) | ⬜ | |
| 3.4 | GCP Integration (compute, IAM, storage, Cloud Logging) | ⬜ | |
| 3.5 | Slack Integration (notifications, evidence submission from Slack) | ⬜ | |
| 3.6 | Jira Integration (findings → tickets, task sync) | ⬜ | |
| 3.7 | Automated NL Tests ("check SSL on domain" style, scheduled) | ⬜ | |

### Phase 4 — Microsoft/Azure-Native Deep

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 4.1 | Azure Entra ID deep (groups, MFA, Conditional Access, sign-in risk, privileged roles) | ⬜ | v1 had basic sync |
| 4.2 | Microsoft Intune (device compliance, BitLocker, app protection, OS version) | ⬜ | |
| 4.3 | Defender for Cloud / XDR (Secure Score, recommendations, alerts) | ⬜ | |
| 4.4 | Azure Sentinel (incident correlation, watchlist, SIEM → audit trail) | ⬜ | Founder's core expertise |
| 4.5 | Microsoft Purview (DLP signals, information protection labels) | ⬜ | |
| 4.6 | Microsoft Compliance Manager (score sync, assessment evidence mapping) | ⬜ | |
| 4.7 | Azure-native Compliance Scanning (scheduled, all sources, AI remediation) | ⬜ | |

### Phase 5 — Platform Completeness

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 5.1 | Penetration Testing Module (credits, AI scan, findings, remediation) | ⬜ | |
| 5.2 | Public API + API Keys + Webhooks (`/api/v1/*`, scoped keys, outbound events) | ⬜ | |
| 5.3 | Self-Hosted Edition (Linux systemd + Docker Compose with MinIO) | ⬜ | |
| 5.4 | Sentinel / Defender XDR advanced (real-time relay, enriched audit trail) | ⬜ | |
| 5.5 | People sync (Google Workspace, Rippling, JumpCloud) | ⬜ | |
| 5.6 | Background Checks module | ⬜ | |
| 5.7 | Security Training module | ⬜ | |
| 5.8 | Knowledge Base (vector-store backed) | ⬜ | |
| 5.9 | Secrets Vault | ⬜ | |
| 5.10 | Stripe Billing (tiers, AI usage metering, pentest credits) | ⬜ | |

### Phase 6 — OpenClaw MCP Server

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 6.1 | CompliGuard MCP Server (HTTP, skill manifest, 10 tool handlers) | ⬜ | See Section 12 |
| 6.2 | OpenClaw Skill Pack (manifest for ClawHub / self-hosted registration) | ⬜ | |
| 6.3 | OpenClaw Auth (per-org API key scoping for agent access) | ⬜ | |
| 6.4 | NL Query Skill (natural language → AI Assistant → response via OpenClaw) | ⬜ | |

### Phase 7 — Microsoft Teams Bot

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 7.1 | Azure Bot Service registration + Teams app manifest | ⬜ | See Section 13 |
| 7.2 | Bot API route (`/api/teams-bot`) — incoming messages, slash commands | ⬜ | |
| 7.3 | Slash commands (`/compliance`, `/control`, `/risks`, `/tasks`, `/findings`, `/policy`) | ⬜ | |
| 7.4 | Adaptive Cards (framework progress, control detail, risk summary) | ⬜ | |
| 7.5 | Proactive notifications (overdue, evidence rejected, critical finding, policy expiry) | ⬜ | |
| 7.6 | Approval actions from Teams (approve/reject evidence from card) | ⬜ | |
| 7.7 | Daily digest card (scheduled morning summary) | ⬜ | |
| 7.8 | Conversation reference storage (Postgres table for proactive messaging) | ⬜ | |

---

## 6. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Frontend framework** | Next.js 15 (App Router) | Same as v1; fast iteration, API routes, RSC |
| **Backend** | Next.js API routes (monolith) | Simpler than NestJS split; easier self-hosting |
| **Database** | PostgreSQL (Neon serverless for cloud; local Postgres for self-hosted) | Proven, familiar, serverless-compatible |
| **ORM** | Drizzle ORM | Type-safe SQL, compile-time schema validation, replaces raw Neon queries from v1 |
| **Auth** | Custom JWT via `jose` + bcrypt (kept from v1) + Better Auth evaluation | v1 auth was solid; Drizzle makes it type-safe |
| **UI** | shadcn/ui + Tailwind v4 | Consistent with v1; composable, accessible |
| **AI SDK** | Vercel `ai` SDK (OpenAI + Gemini) | Already a dependency in v1; supports tool use and streaming |
| **Storage abstraction** | Custom `StorageProvider` interface | See Section 10 |
| **Email outbound** | Resend (primary) | TypeScript-first, modern, Next.js ecosystem standard |
| **Email inbound** | Postmark Inbound Parse | Cleanest attachment webhook; file bytes in payload |
| **Background jobs** | `node-cron` (self-hosted) / Vercel Cron (cloud) | No Trigger.dev dependency (keeps self-hosting simple) |
| **Teams Bot SDK** | Teams AI SDK v2 (`@microsoft/teams-ai`) | Current recommended (Sept 2025); TypeScript, isomorphic |
| **OpenClaw** | MCP Server (HTTP + JSON manifest) | Standard MCP pattern; works with any OpenClaw gateway |
| **Logging** | Pino (structured JSON logger) | Fast, Next.js-compatible, integrates with Sentry |
| **Error tracking** | Sentry | Industry standard; self-hosted Sentry/GlitchTip option for privacy |
| **Testing** | Vitest (unit) + Playwright (E2E) | Fast, TypeScript-native |
| **CI/CD** | GitHub Actions | Free for public repos; familiar |
| **License** | Apache 2.0 (open-core) | Friendlier to enterprise self-hosting than AGPL (trycomp); commercial premium connectors remain proprietary |

---

## 7. Tech Stack

```
Frontend:       Next.js 15, React 19, TypeScript 5, Tailwind v4, shadcn/ui
Backend:        Next.js API Routes (monolith)
Database:       PostgreSQL via Drizzle ORM
  Cloud:        Neon Serverless Postgres
  Self-hosted:  Local PostgreSQL (bundled in Docker Compose)
Auth:           Custom JWT (jose), bcrypt, OAuth (Google, GitHub, Azure Entra SSO)
AI:             Vercel ai SDK — OpenAI GPT-4o / Google Gemini Flash
Storage:        Pluggable (Local | AWS S3 | Azure Blob | OneDrive | MinIO)
Email Out:      Resend
Email In:       Postmark Inbound Parse
Background:     node-cron (self-hosted) / Vercel Cron (cloud)
Teams Bot:      @microsoft/teams-ai v2, Azure Bot Service
OpenClaw:       MCP Server (HTTP JSON manifest)
Azure SDKs:     @azure/identity, @azure/arm-*, @microsoft/microsoft-graph-client
AWS SDK:        @aws-sdk/client-* (v3)
Logging:        Pino
Error:          Sentry
Testing:        Vitest, Playwright
CI/CD:          GitHub Actions
Docker:         Docker Compose (app + postgres + minio + redis)
Linux:          install.sh (systemd service)
```

---

## 8. Database Schema

### Tables from v1 (retained, migrated to Drizzle)
- `users` — user accounts with RBAC
- `organizations` — multi-tenant org data
- `frameworks` — compliance frameworks
- `controls` — individual compliance controls
- `organization_frameworks` — org ↔ framework junction
- `control_assignments` — control-to-user assignments with status
- `evidence` — evidence documents (now with real storage_key + storage_provider)
- `control_certifications` — e-signature certifications
- `audit_logs` — system audit trail
- `risk_assessments` — risk register
- `policies` — policy documents
- `notifications` — user notifications (had no UI in v1)
- `system_settings` — global config (extended significantly for v2)

### New tables for v2
- `custom_roles` — custom RBAC role definitions
- `custom_role_permissions` — permission sets per custom role
- `tasks` — atomic work items linked to controls
- `task_automation` — per-task AI automation config
- `vendors` — vendor/third-party register
- `vendor_risk_assessments` — inherent/residual risk per vendor
- `questionnaires` — questionnaire templates
- `questionnaire_questions` — individual questions
- `questionnaire_responses` — responses per vendor/assessment
- `findings` — cross-source findings (cloud scan, pentest, integration)
- `finding_templates` — reusable finding templates
- `evidence_forms` — structured evidence collection templates
- `comments` — threaded comments on any entity
- `comment_mentions` — @mention tracking
- `soa_entries` — Statement of Applicability per framework/control
- `org_chart_nodes` — org chart structure
- `framework_versions` — framework editor versioning
- `framework_templates` — admin-managed framework templates
- `control_templates` — admin-managed control templates
- `timelines` — compliance roadmap phases
- `timeline_phases` — individual phases per timeline
- `context_hub` — org context for AI (stack, processes, risk tolerance)
- `integrations` — configured integration instances per org
- `integration_scan_results` — results from automated integration scans
- `nl_tests` — natural language automated test definitions
- `nl_test_results` — results per NL test run
- `evidence_upload_tokens` — single-use tokens for secure email upload links
- `teams_conversation_refs` — Teams bot conversation references for proactive messaging
- `api_keys` — public API keys per org
- `webhooks` — webhook endpoint registrations
- `webhook_deliveries` — webhook delivery log
- `subscriptions` — Stripe subscription data
- `pentest_sessions` — penetration test sessions
- `pentest_credits` — credit wallet per org
- `background_checks` — employee background check requests
- `training_modules` — security training content
- `training_completions` — employee training completion records
- `knowledge_base_entries` — knowledge base articles (vector-indexed)
- `secrets` — encrypted secrets vault
- `mcp_api_keys` — OpenClaw MCP server API keys per org
- `setup_wizard_state` — tracks wizard step completion

---

## 9. Deployment Targets

### Target 1: Linux Standalone

```bash
# Installation
curl -fsSL https://get.compliguard.app/install.sh | bash

# Or manual
git clone https://github.com/saichand04/compliguard-v2
cd compliguard-v2
chmod +x install.sh
./install.sh
```

**What `install.sh` does:**
1. Checks Node.js 20+ and PostgreSQL are installed
2. Runs `npm ci --omit=dev`
3. Prompts for DATABASE_URL if not in `.env`
4. Runs `npm run db:migrate`
5. Runs `npm run db:seed`
6. Creates systemd service `compliguard.service`
7. Starts the service
8. Prints the setup wizard URL

**Storage default:** Local filesystem at `/var/lib/compliguard/evidence/`

**Service management:**
```bash
systemctl start compliguard
systemctl stop compliguard
systemctl status compliguard
journalctl -u compliguard -f
```

### Target 2: Docker Compose

```bash
git clone https://github.com/saichand04/compliguard-v2
cd compliguard-v2
cp .env.example .env
# Edit .env with your values
docker compose up -d
```

**Services in `docker-compose.yml`:**
- `app` — Next.js application (port 3000)
- `postgres` — PostgreSQL 16 (port 5432, internal only)
- `minio` — MinIO object storage (port 9000 API, port 9001 console)
- `redis` — Redis for rate limiting + caching (port 6379, internal only)

**Storage default:** MinIO (S3-compatible, `http://minio:9000`)

---

## 10. Evidence Storage Design

### Provider Abstraction

```typescript
// lib/storage/types.ts
export interface StorageProvider {
  upload(buffer: Buffer, key: string, mimeType: string, orgId: string): Promise<UploadResult>
  download(key: string, orgId: string): Promise<Buffer>
  delete(key: string, orgId: string): Promise<void>
  getSignedUrl(key: string, expiresIn: number, orgId: string): Promise<string>
  testConnection(): Promise<{ ok: boolean; message: string }>
}

export interface UploadResult {
  key: string       // storage key (not the full URL — URL is derived at read time)
  size: number
  mimeType: string
  provider: StorageProviderType
}

export type StorageProviderType = 'local' | 's3' | 'azure-blob' | 'onedrive' | 'minio'
```

### Provider Implementations
- `lib/storage/providers/local.ts` — stores at `STORAGE_LOCAL_PATH` (default `/var/lib/compliguard/evidence/`)
- `lib/storage/providers/s3.ts` — `@aws-sdk/client-s3` with presigned URLs; also used for MinIO via `STORAGE_S3_ENDPOINT` override
- `lib/storage/providers/azure-blob.ts` — `@azure/storage-blob`; SAS token generation
- `lib/storage/providers/onedrive.ts` — `@microsoft/microsoft-graph-client`; stores in a dedicated SharePoint document library

### Storage Key Format
```
evidence/{orgId}/{year}/{month}/{uuid}-{filename}
```

### Evidence DB columns (v2 additions to `evidence` table)
```sql
storage_provider  VARCHAR(20)   -- 'local' | 's3' | 'azure-blob' | 'onedrive' | 'minio'
storage_key       TEXT          -- storage key (NOT a URL)
storage_bucket    VARCHAR(255)  -- bucket/container name at time of upload
```

### Inbound Email → Evidence Flow
1. System sends evidence request email with `Reply-To: evidence+{token}@inbound.compliguard.app`
2. User replies with file attachment
3. Postmark Inbound Parse POSTs to `/api/inbound-email`
4. Handler validates token against `evidence_upload_tokens` table
5. Extracts attachments, validates MIME type and size
6. Uploads to configured storage provider via abstraction
7. Creates evidence record linked to control assignment
8. Marks token as used (single-use)
9. Sends confirmation email to user

---

## 11. Setup Wizard Design

### First-Run Detection
```typescript
// middleware.ts
const settings = await getSystemSettings()
if (!settings.setup_completed && !request.nextUrl.pathname.startsWith('/setup')) {
  return NextResponse.redirect(new URL('/setup', request.url))
}
```

### 9 Wizard Steps

| Step | Route | Optional | Writes To |
|------|-------|----------|-----------|
| 1. Welcome | `/setup/welcome` | No | `system_settings` |
| 2. Organization | `/setup/organization` | No | `organizations` |
| 3. Admin Account | `/setup/admin` | No | `users` |
| 4. Invite Users | `/setup/users` | Yes | `users`, invite queue |
| 5. Email Setup | `/setup/email` | No | `.env` + `system_settings` |
| 6. Storage Setup | `/setup/storage` | No | `.env` + `system_settings` |
| 7. AI Provider | `/setup/ai` | No | `.env` + `system_settings` |
| 8. Integrations | `/setup/integrations` | Yes | `.env` + `system_settings` |
| 9. Review & Launch | `/setup/review` | No | `system_settings.setup_completed = true` |

### Wizard State Persistence
- `system_settings.setup_step` (int) — last completed step
- `system_settings.setup_completed` (bool) — wizard fully done
- Each step saves independently via `/api/setup/step/[n]` PATCH endpoint
- On app restart, middleware reads `setup_step` and redirects to the correct step

### Re-invocation
- Settings → General → "Re-run Setup Wizard" button
- Opens wizard in full-page overlay (not a new route) — all fields pre-populated with current values
- Non-destructive: never deletes data, only updates config

### Incomplete Setup Banner
- If `setup_completed = false` but user is in the app: persistent yellow banner with step count and link to resume

### Settings Parity
Every wizard step maps to a Settings section:
- Step 1 → Settings → General
- Step 2 → Settings → Organization
- Step 3 → Settings → Users → Profile
- Step 4 → Settings → Users → Team
- Step 5 → Settings → Integrations → Email
- Step 6 → Settings → Integrations → Storage
- Step 7 → Settings → Integrations → AI Provider
- Step 8 → Settings → Integrations → [each provider]
- Step 9 → Settings → General → System Health

---

## 12. OpenClaw MCP Server Design

### Architecture
```
OpenClaw Gateway → MCP HTTP Request → /api/mcp/[tool] → CompliGuard DB → Response
```

### Skill Manifest Location
`public/mcp-manifest.json` — publicly accessible at `https://yourhost/mcp-manifest.json`

### 10 MCP Tools

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `get_control_status` | List controls by framework, status, assignee | `orgId`, optional: `frameworkId`, `status`, `assigneeId` |
| `get_risk_summary` | Open risks by severity and owner | `orgId`, optional: `severity`, `status` |
| `submit_evidence` | Create an evidence record (file URL or text) | `orgId`, `controlAssignmentId`, `title`, `evidenceType` |
| `get_compliance_score` | Framework completion % and overdue task count | `orgId`, optional: `frameworkId` |
| `get_findings` | Open findings from cloud scans / pentest | `orgId`, optional: `severity`, `source` |
| `assign_task` | Assign a task to a user | `orgId`, `taskId`, `assigneeId`, `dueDate` |
| `get_policy_status` | Policy lifecycle status, next review dates | `orgId`, optional: `status` |
| `run_nl_test` | Trigger a natural language automated test | `orgId`, `testId` or `query` |
| `get_vendor_risk` | Vendor risk scores and status | `orgId`, optional: `vendorId` |
| `get_audit_trail` | Recent activity log for a framework or org | `orgId`, optional: `frameworkId`, `limit` |

### Authentication
- All MCP requests require `Authorization: Bearer {mcp_api_key}` header
- Keys stored in `mcp_api_keys` table, scoped per org and per permission set
- Generated in Settings → Integrations → OpenClaw

---

## 13. Microsoft Teams Bot Design

### Architecture
```
Teams User → Azure Bot Service → /api/teams-bot → Bot Logic → CompliGuard DB → Adaptive Card Response
CompliGuard Event → /api/teams-bot/notify → Teams Bot Service → Proactive Card to User/Channel
```

### Tech Stack
- `@microsoft/teams-ai` v2 SDK (TypeScript)
- Azure Bot Service (webhook relay)
- Azure App Registration (bot identity)
- Adaptive Cards v1.5

### Slash Commands

| Command | Response |
|---------|----------|
| `/compliance` | Framework progress adaptive card with % bars |
| `/compliance [framework]` | Single framework deep-dive card |
| `/control [id]` | Control detail: status, assignee, evidence count, due date |
| `/risks` | Top 5 open Critical/High risks card |
| `/tasks` | My assigned tasks due in next 7 days |
| `/findings` | Open findings from latest scans |
| `/policy [name]` | Policy status, version, effective date, next review |
| `/help` | Command reference card |

### Proactive Notification Triggers

| Event | Who Gets Notified |
|-------|------------------|
| Control overdue | Assignee + Compliance Manager |
| Evidence rejected | Evidence uploader |
| New Critical finding | All Compliance Managers |
| Policy expiring in 30 days | Policy owner + Admin |
| New high risk identified | Risk owner + Admin |
| Task due tomorrow | Task assignee |
| Daily digest (9am) | All users with tasks/assigned controls |

### Approval-from-Card
- Evidence pending approval → Teams card with Approve / Request Changes buttons
- Button click → `Action.Execute` → `/api/teams-bot/action` → updates DB → confirmation card

### Database
```sql
-- teams_conversation_refs table
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
org_id          UUID REFERENCES organizations(id)
conversation_ref JSONB   -- full ConversationReference object from Teams SDK
service_url     TEXT
tenant_id       TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

---

## 14. Controls Mapping Engine Architecture

> **Status:** Designed. Implementation starts Phase 1. This is the most critical differentiator in CompliGuard.

### Problem Statement

HITRUST, ARC-AMPE, NIST CSF, and dozens of other frameworks all reference NIST 800-53 — but their control IDs, subsection numbering, and supplemental requirements differ dramatically from each other and from the raw NIST source. Naive string matching fails. Evidence collected for one framework needs to propagate to equivalent controls in every other active framework automatically.

### 4-Layer Architecture

```
Layer 1: Canonical Control Store
Layer 2: Mapping Graph
Layer 3: Evidence Inheritance Engine
Layer 4: AI Mapping Engine
```

#### Layer 1 — Canonical Control Store

Every ingested control is normalized into a universal schema:

```typescript
interface CanonicalControl {
  id: string                    // UUID
  frameworkId: string           // FK → frameworks.id
  controlId: string             // Raw ID from source (e.g. "AC-2", "0201.09j1Org.124")
  nist80053Refs: string[]       // NIST 800-53 Rev 5 anchors (e.g. ["AC-2", "AC-2(1)"])
  scfRefs: string[]             // SCF metaframework IDs
  tags: string[]                // Normalized topic tags (e.g. "access-control", "mfa")
  rawText: string               // Original control text, unmodified
  title: string
  guidance?: string
  testProcedure?: string
  supplementalRequirements?: string[]  // Framework-specific extras on top of NIST
}
```

**Key rule:** Every control gets tagged with `nist80053Refs[]` at ingestion — this is the universal anchor for cross-framework mapping.

#### Layer 2 — Mapping Graph

Directed graph where edges represent relationships between controls:

```typescript
type MappingEdgeType =
  | 'EQUIVALENT'    // Functionally identical — safe to share evidence
  | 'PARTIAL'       // Overlapping but not complete — evidence may partially satisfy
  | 'SUBSUMES'      // A contains B — A's evidence satisfies B, not vice versa
  | 'REFERENCES'    // A cites B — informational, no evidence propagation
  | 'CONFLICTS'     // Contradictory requirements — evidence from one fails the other

interface MappingEdge {
  id: string
  sourceControlId: string
  targetControlId: string
  edgeType: MappingEdgeType
  confidenceScore: number          // 0.0–1.0
  mappingBasis: string             // 'nist_anchor' | 'scf_lookup' | 'user_crosswalk' | 'llm_semantic' | 'id_pattern'
  isVerified: boolean              // Human-reviewed
  isDetached: boolean              // User explicitly broke this mapping (permanent until re-linked)
  supplementalRequirements: string[] // What extra evidence target needs beyond source
  scopeDelta: string | null        // Narrative description of scope difference
  requiresAdditionalEvidence: boolean  // Always true for ARC-AMPE targets
}
```

#### Layer 3 — Evidence Inheritance Engine

When evidence is approved for Control A:
1. Walk all outbound `EQUIVALENT` edges from A (depth ≤ 2, configurable)
2. For each reachable control B:
   - If `requiresAdditionalEvidence = false` → mark B as partially satisfied, inherit evidence reference
   - If `requiresAdditionalEvidence = true` → create a task: "Evidence from [source framework] satisfies base requirement — provide supplemental evidence for [target framework]'"
   - If `isDetached = true` → skip (user broke this link intentionally)
3. Log all propagation events in audit trail with `propagated_from: controlId`

**Detach is permanent** — once a user detaches a mapping, evidence will never auto-propagate across that edge again unless manually re-linked.

**Depth cap = 2** to prevent exponential propagation across deeply chained frameworks. Configurable via system settings.

#### Layer 4 — AI Mapping Engine

Multi-signal pipeline, run at framework ingestion time:

| Signal | Weight | Description |
|--------|--------|-------------|
| NIST 800-53 anchor | 0.40 | Both controls share NIST refs → strong match |
| SCF metaframework | 0.30 | Both controls appear in same SCF row |
| User crosswalk file | 1.00 | User-provided mapping file → ground truth override |
| LLM semantic | 0.20 | Embedding cosine similarity on control text |
| ID pattern matching | 0.10 | Decoded HITRUST/ISO/NIST ID patterns |

Final `confidenceScore` = weighted sum, capped at 1.0. User crosswalk = instant 1.0 override, bypasses all other signals.

### Framework-Specific ID Decoding Rules

#### HITRUST CSF

HITRUST control IDs encode ISO 27001 section numbers:

```
0201.09j1Organizational.124
├── 02 = Control Category (02 = Endpoint Protection)
├── 01 = Control number within category
├── 09j = ISO 27001 section 9.j (A.9.4 – System and Application Access)
├── 1 = Control level (1/2/3 = broad/medium/specific)
├── Organizational = Control type
└── .124 = Sub-requirement index
```

**HITRUST decode algorithm:**
1. Extract ISO 27001 section from characters 5-7 (e.g. `09j`)
2. Map ISO 27001 section → NIST 800-53 refs via ISO↔NIST crosswalk table
3. Tag `nist80053Refs` accordingly
4. Cross-check with SCF lookup for confidence boost

**ISO 27001 → NIST 800-53 crosswalk** is stored as a static lookup table in `lib/mapping/crosswalks/iso27001-nist80053.json`.

#### ARC-AMPE (CMS)

ARC-AMPE reuses NIST 800-53 control IDs **verbatim** — but every control has CMS-specific supplemental requirements on top of the base NIST control.

**Critical rule: Same ID ≠ Equivalent**
- ARC-AMPE `AC-2` is NOT equivalent to NIST `AC-2`
- ARC-AMPE `AC-2` SUBSUMES NIST `AC-2` (base + CMS additions)
- Evidence satisfying NIST `AC-2` satisfies ARC-AMPE `AC-2` **partially only**
- `requiresAdditionalEvidence = true` on ALL ARC-AMPE target edges
- ARC-AMPE controls always need a supplemental evidence task generated

This is the root of the HITRUST/ARC-AMPE confusion the user flagged — even when IDs match exactly, ARC-AMPE always demands more.

#### NIST CSF 2.0

NIST CSF 2.0 uses a function.category.subcategory structure (`GV.OC-01`, `PR.AA-01`, etc.). NIST provides an official CSF↔800-53 crosswalk Excel file — this is loaded at startup as a static mapping table.

### Framework Upload Pipeline

Users can upload their own framework control sets when the framework is not publicly downloadable.

**Supported input formats:**
- `xlsx` — Excel spreadsheet (most common: NIST 800-53 catalog, ARC-AMPE, HITRUST summary)
- `csv` — Comma-separated values
- `json` — Pre-structured JSON array of controls
- `pdf` — PDF with tabular data (OCR + table extraction via `pdf-parse`)

**Ingestion flow:**
1. User uploads file at `/frameworks/upload`
2. Column mapper UI presents detected columns → user maps to: `controlId`, `title`, `description`, `guidance`, `nistRefs`, `category`
3. User confirms mapping, clicks "Ingest"
4. Background job normalizes rows → inserts into `controls` table with `frameworkId`
5. Mapping engine runs automatically on all newly ingested controls
6. User sees progress indicator; framework appears in the library when complete

**Auto-parsers for known formats** (skip column mapper, parse directly):
- NIST 800-53 Rev 5 Excel from csrc.nist.gov
- ARC-AMPE v2 xlsx from cms.gov
- NIST CSF 2.0 Excel + JSON from nist.gov
- HITRUST PDF summary (best-effort; full HITRUST requires license and manual download)

### Source Files (to be created in Phase 1)

```
lib/mapping/
├── engine.ts              # Main MappingEngine class
├── signals/
│   ├── nist-anchor.ts     # NIST 800-53 anchor signal
│   ├── scf-lookup.ts      # SCF metaframework lookup
│   ├── llm-semantic.ts    # LLM embedding similarity
│   ├── id-pattern.ts      # HITRUST/ISO/NIST ID decoder
│   └── user-crosswalk.ts  # User-uploaded crosswalk override
├── crosswalks/
│   ├── iso27001-nist80053.json    # Static ISO 27001 ↔ NIST 800-53 map
│   ├── csf20-nist80053.json       # NIST CSF 2.0 ↔ 800-53 (official NIST file)
│   └── scf-master.json            # SCF metaframework (from securecontrolsframework.com)
├── evidence-inheritance.ts        # Layer 3 propagation engine
├── detach.ts                      # Permanent detach logic
└── upload/
    ├── parser.ts          # Format detection + dispatch
    ├── xlsx-parser.ts     # Excel parser
    ├── csv-parser.ts      # CSV parser
    ├── json-parser.ts     # JSON parser
    └── pdf-parser.ts      # PDF table extractor
```

---

## 15. Development Progress Tracker

### Phase 0 — Foundation & Repo Setup (✅ COMPLETE — May 3, 2026)
- [x] 0.1 GitHub repo created (saichand04/compliguard-v2, private)
- [x] 0.2 CONTEXT.md written (1,100+ lines)
- [x] 0.3 TypeScript build clean — 33/33 static pages, all API routes compile
- [x] 0.4 Schema extended: frameworks table + authority, website, logoUrl, controls columns
- [x] 0.5 Proxy (Next.js 16 middleware) — JWT auth + setup cookie gating
- [x] 0.6 Setup wizard — 9-step flow at /setup/*, re-invokable from Settings
- [x] 0.7 Controls mapping engine architecture designed + documented
- [ ] 0.8 Tests + CI (deferred to Phase 1)
- [ ] 0.9 Logging + Sentry (deferred to Phase 1)

_(Phases 1–7 tracked above in Section 5)_

---

## 15. Technical Debt Log

Items identified from v1 codebase (`saichand04/compliance-with-ai`):

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Two `003-*.sql` migration files | High | Rename to `003-control-framework-mapping.sql` and `004-add-name-column.sql` |
| 2 | `db.ts` placeholder methods with string-concatenated SQL | High | Delete unused methods; all queries use parameterized Drizzle |
| 3 | No `.env.example` | High | Create with all required vars (see Section 16) |
| 4 | No test suite | High | Vitest + Playwright, GH Actions CI |
| 5 | No rate limiting on auth routes | High | Redis-based rate limiter on `/api/auth/*` |
| 6 | Evidence upload is placeholder (`file_url = /uploads/${file.name}`) | Critical | Full storage abstraction (see Section 10) |
| 7 | No mobile-responsive QA | Medium | Tailwind responsive pass at 375px |
| 8 | No structured logging | Medium | Pino logger + Sentry |
| 9 | No `ON DELETE` policies on FK constraints | Medium | Drizzle schema migration |
| 10 | Missing `org_id` indexes on high-query tables | Medium | Drizzle migration |
| 11 | No `CONTRIBUTING.md` or `CODE_OF_CONDUCT.md` | Low | Add for open-core strategy |
| 12 | Framework seed data only in DB rows | Low | Move to `seed/frameworks/` JSON files |
| 13 | AI control mapping uses cosine similarity only | Critical | Real LLM call via `ai` SDK |
| 14 | `notifications` table has no UI | Medium | Phase 1.1 |

---

## 16. Environment Variables Reference

```bash
# ─── Database ───────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/compliguard

# ─── Authentication ─────────────────────────────────────────
JWT_SECRET=                        # 32+ char random string
JWT_EXPIRES_IN=7d

# ─── OAuth Providers ────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ─── AI Providers ───────────────────────────────────────────
AI_PROVIDER=openai                 # openai | gemini
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

# ─── Storage ────────────────────────────────────────────────
STORAGE_PROVIDER=local             # local | s3 | azure-blob | onedrive | minio

# Local
STORAGE_LOCAL_PATH=/var/lib/compliguard/evidence

# AWS S3 / MinIO (same vars, MinIO adds STORAGE_S3_ENDPOINT)
STORAGE_S3_BUCKET=
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY_ID=
STORAGE_S3_SECRET_ACCESS_KEY=
STORAGE_S3_ENDPOINT=              # MinIO only: http://minio:9000

# Azure Blob Storage
STORAGE_AZURE_CONNECTION_STRING=
STORAGE_AZURE_CONTAINER=

# OneDrive / SharePoint (Microsoft Graph)
STORAGE_ONEDRIVE_TENANT_ID=
STORAGE_ONEDRIVE_CLIENT_ID=
STORAGE_ONEDRIVE_CLIENT_SECRET=
STORAGE_ONEDRIVE_DRIVE_ID=

# ─── Email Outbound (Resend) ────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=compliance@yourdomain.com
EMAIL_REPLY_TO=

# ─── Email Inbound (Postmark) ───────────────────────────────
POSTMARK_INBOUND_WEBHOOK_TOKEN=
POSTMARK_INBOUND_EMAIL=evidence@inbound.yourdomain.com

# ─── Error Tracking ─────────────────────────────────────────
SENTRY_DSN=
SENTRY_ENVIRONMENT=production

# ─── Microsoft Azure ────────────────────────────────────────
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_SUBSCRIPTION_ID=

# ─── Teams Bot ──────────────────────────────────────────────
TEAMS_BOT_ID=
TEAMS_BOT_PASSWORD=
TEAMS_BOT_APP_ID=

# ─── Redis (rate limiting + caching) ────────────────────────
REDIS_URL=redis://localhost:6379

# ─── Application ────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
APP_VERSION=2.0.0
```

---

## 17. Repo Structure

```
compliguard-v2/
├── CONTEXT.md                          ← THIS FILE — AI session history + full plan
├── CHANGELOG.md
├── README.md
├── LICENSE                             ← Apache 2.0
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── .env.example
├── .gitignore
├── docker-compose.yml                  ← Docker target (app + postgres + minio + redis)
├── Dockerfile
├── install.sh                          ← Linux standalone install script
├── next.config.mjs
├── package.json
├── tsconfig.json
├── drizzle.config.ts
│
├── app/
│   ├── (auth)/                         ← Sign in, sign up, forgot password
│   ├── (setup)/                        ← Setup wizard (/setup/*)
│   ├── (dashboard)/                    ← Main app (requires auth + setup_completed)
│   │   ├── dashboard/
│   │   ├── frameworks/
│   │   ├── controls/
│   │   ├── control-mapping/
│   │   ├── evidence/
│   │   ├── risks/
│   │   ├── policies/
│   │   ├── tasks/
│   │   ├── vendors/
│   │   ├── questionnaires/
│   │   ├── findings/
│   │   ├── people/
│   │   ├── reports/
│   │   ├── timelines/
│   │   ├── knowledge-base/
│   │   ├── assistant/
│   │   ├── integrations/
│   │   ├── settings/
│   │   └── profile/
│   ├── (public)/
│   │   └── trust/[orgSlug]/            ← Public trust portal (no auth)
│   └── api/
│       ├── auth/
│       ├── setup/
│       ├── controls/
│       ├── evidence/
│       ├── frameworks/
│       ├── risks/
│       ├── policies/
│       ├── tasks/
│       ├── vendors/
│       ├── findings/
│       ├── reports/
│       ├── integrations/
│       ├── teams-bot/                  ← Teams bot webhook + actions
│       ├── mcp/                        ← OpenClaw MCP server endpoints
│       ├── inbound-email/              ← Postmark inbound webhook
│       └── v1/                         ← Public REST API
│
├── lib/
│   ├── auth/
│   │   ├── index.ts
│   │   ├── jwt.ts
│   │   └── rbac.ts
│   ├── db/
│   │   ├── index.ts                    ← Drizzle client
│   │   └── schema/                     ← All Drizzle table definitions
│   ├── storage/
│   │   ├── index.ts                    ← Provider factory
│   │   ├── types.ts
│   │   └── providers/
│   │       ├── local.ts
│   │       ├── s3.ts
│   │       ├── azure-blob.ts
│   │       ├── onedrive.ts
│   │       └── minio.ts
│   ├── email/
│   │   ├── outbound.ts                 ← Resend client
│   │   └── inbound.ts                 ← Postmark inbound parser
│   ├── ai/
│   │   ├── index.ts                    ← Provider factory (OpenAI/Gemini)
│   │   ├── tools.ts                    ← AI assistant tool definitions
│   │   └── mapping.ts                 ← Control mapping with LLM
│   ├── integrations/
│   │   ├── azure/
│   │   │   ├── entra.ts
│   │   │   ├── intune.ts
│   │   │   ├── sentinel.ts
│   │   │   ├── defender.ts
│   │   │   └── purview.ts
│   │   ├── aws/
│   │   ├── gcp/
│   │   ├── github/
│   │   ├── slack/
│   │   └── jira/
│   ├── teams-bot/
│   │   ├── bot.ts
│   │   ├── commands.ts
│   │   └── cards.ts
│   ├── mcp/
│   │   ├── server.ts
│   │   └── tools.ts
│   └── logger.ts                       ← Pino logger
│
├── components/
│   ├── ui/                             ← shadcn/ui components
│   ├── setup-wizard/                   ← Wizard step components
│   ├── dashboard/
│   ├── controls/
│   ├── evidence/
│   ├── risks/
│   ├── policies/
│   ├── tasks/
│   ├── vendors/
│   ├── findings/
│   └── teams/                          ← Teams adaptive card schemas
│
├── middleware.ts                        ← Auth + setup-completion check
│
├── drizzle/
│   └── migrations/                     ← Drizzle-generated SQL migrations
│
├── seed/
│   ├── frameworks/                     ← JSON files per framework (50+)
│   │   ├── soc2.json
│   │   ├── iso27001.json
│   │   ├── hipaa.json
│   │   └── ...
│   └── seed.ts                         ← Seed runner
│
├── public/
│   └── mcp-manifest.json               ← OpenClaw skill manifest (publicly accessible)
│
├── tests/
│   ├── unit/
│   └── e2e/
│
├── docs/
│   ├── competitive-analysis-2026-04-30.md
│   ├── api.md
│   └── architecture.md
│
└── .github/
    └── workflows/
        ├── ci.yml
        └── release.yml
```

---

*This document is auto-updated by AI sessions working on CompliGuard v2. If you are an AI reading this: update the Development Progress Tracker (Section 14) and the feature status table (Section 5) as work is completed. Append new sessions to Section 4 (Full Conversation History). Never truncate existing history.*
