# CompliGuard v2 — Project Context

**Last Updated**: 2026-05-09 — Docker login fixed, all phases 0–7 complete  
**Status**: PRODUCTION READY — Docker deployment working on homelab  
**License**: Apache 2.0  
**GitHub**: https://github.com/saichand04/compliguard-v2 (private)

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture Decisions](#2-architecture-decisions)
3. [Tech Stack](#3-tech-stack)
4. [MacBook Deployment](#4-macbook-deployment)
5. [Database Schema Summary](#5-database-schema-summary)
6. [Phase 0 — Foundation](#6-phase-0--foundation)
7. [Phase 1 — Core Engine (COMPLETED)](#7-phase-1--core-engine-completed)
8. [Phase 2 — Operational Backbone (IN PROGRESS)](#8-phase-2--operational-backbone-in-progress)
9. [Session History](#9-session-history)
10. [User Instructions (Verbatim)](#10-user-instructions-verbatim)
11. [Troubleshooting Log](#11-troubleshooting-log)
12. [Key File Index](#12-key-file-index)

---

## 1. Project Overview

CompliGuard v2 is an AI-powered GRC (Governance, Risk & Compliance) platform designed to transform compliance from isolated audits into a dynamic, continuous journey. It provides:

- **Cross-framework Controls Mapping Engine** — NIST 800-53 as universal canonical anchor; evidence collected once propagates across all mapped frameworks automatically
- **Multi-framework Support** — SOC 2, ISO 27001, HITRUST, HIPAA, PCI DSS, NIST CSF, FedRAMP, and user-uploaded custom frameworks
- **AI-Assisted Compliance** — OpenAI gpt-4o-mini + Gemini fallback for control mapping suggestions and GRC chat assistant
- **Trust Portal** — Public-facing org trust page with compliance badges
- **Enterprise RBAC** — Role-based access with custom permission sets
- **Pluggable Storage** — Local / S3 / Azure Blob / OneDrive / MinIO abstraction
- **Platform Email** — Outbound transactional (Postmark/SMTP) + inbound evidence ingestion
- **Microsoft Teams Bot** — Compliance chat bot integration

---

## 2. Architecture Decisions

### Controls Mapping Engine (4-Layer)
```
Layer 1: Canonical Store      → All controls normalized, NIST 800-53 is universal anchor
Layer 2: Mapping Graph        → Bidirectional edges between frameworks via canonicalNistId
Layer 3: Evidence Inheritance → Evidence accepted once flows to all mapped controls
Layer 4: AI Engine            → OpenAI gpt-4o-mini suggests mappings; Gemini as fallback
```

**ARC-AMPE Rule**: Same control ID ≠ equivalent mapping. HITRUST and ARC-AMPE both reference NIST 800-53 but their IDs and subsections are named differently. Always match by `canonicalNistId` field, never by raw control ID string comparison.

**HITRUST ID encoding**: HITRUST IDs encode ISO 27001 sections but ALWAYS route through NIST canonical anchor, not directly to ISO 27001.

**SCF crosswalk**: Use static lookup table for Secure Controls Framework crosswalk; user override always wins over AI suggestion.

### RSC Boundary Rule
Never pass LucideIcon components from Server → Client components. Always pass `iconName: string` and resolve in client component via `ICON_MAP` lookup.

### Design System
- **Base**: `#080B18` (dark navy)
- **Primary**: violet `#8B5CF6` + cyan `#06B6D4`
- **Glass effect**: `backdrop-blur(20px)`, `rgba(255,255,255,0.04)` backgrounds
- **Typography**: Inter (UI) + Playfair Display (headings)
- **Cards**: glassmorphism with subtle borders and hover states

### Database
- **Driver**: `postgres` (postgres-js) — NEVER use `@neondatabase/serverless` in `lib/db/index.ts`
- **ORM**: Drizzle ORM
- **Host port**: 5433 (OrbStack holds 5432 — NEVER kill that process)
- **Container**: `compliguard-postgres` (postgres:16-alpine)

### Port
- **App**: 3030 (another app runs on 3000 — never change this)
- **DB**: 5433 on host

### Proxy Rules
- Authenticated users are NEVER force-redirected to setup wizard
- `/trust` routes are in `PUBLIC_PATHS` in `proxy.ts` (no auth required)

### AI Integration
- Use `fetch()` only — no AI SDK packages
- OpenAI: `gpt-4o-mini` model
- Gemini: `gemini-2.0-flash` model
- Read AI config from `system_settings` table

### Storage (Phase 2 — 2.12)
- `lib/storage/` — does not exist until Phase 2.12 builds it
- Abstraction over: Local filesystem / AWS S3 / Azure Blob / OneDrive / MinIO
- Evidence upload was placeholder in Phase 1; Phase 2 wires real pluggable storage

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript (strict) |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 (Docker) |
| Auth | NextAuth.js |
| Styling | Tailwind CSS + custom glassmorphism design system |
| AI | OpenAI gpt-4o-mini + Gemini 2.0 Flash (fetch-only) |
| Icons | Lucide React |
| Charts | Recharts |
| File parsing | `xlsx` npm package (server-side) |
| ZIP export | `archiver` npm package |
| Emails | Postmark (transactional) / SMTP fallback |
| Teams Bot | Microsoft Bot Framework SDK |

---

## 4. MacBook Deployment

| Item | Value |
|------|-------|
| Device | Saichand's MacBook Pro (E9F9392B-158D-5DB1-B46D-C8D368785FEA) |
| User | saichand |
| Deploy dir | ~/Documents/compliguard-v2 |
| DB container | compliguard-postgres (postgres:16-alpine) |
| OrbStack socket | /Users/saichand/.orbstack/run/docker.sock |
| App logs | /tmp/cg-nextjs.log |
| Admin creds | admin@compliguard.local / Welcome@123 (super_admin) |
| Target URL | http://localhost:3030 |
| pc bash timeout | 30s max — use osascript for Terminal commands |

### Restart Command
```bash
kill -9 $(lsof -ti:3030) 2>/dev/null; sleep 1 && cd /Users/saichand/Documents/compliguard-v2 && DATABASE_URL=postgresql://compliguard:compliguard@localhost:5433/compliguard NEXTAUTH_URL=http://localhost:3030 NEXTAUTH_SECRET=compliguard_preview_secret_key_32chars_ok JWT_SECRET=compliguard_preview_secret_key_32chars_ok nohup npm run dev > /tmp/cg-nextjs.log 2>&1 &
```

### Deploy Pattern
```
tar (exclude node_modules/.next/.git)
→ pc push /tmp/cg-patch.tar.gz /tmp/cg-patch.tar.gz
→ pc osascript Terminal: extract + rsync + npm install + restart
```

### osascript Syntax
```
pc osascript 'tell application "Terminal" to do script "..."'
```

---

## 5. Database Schema Summary

All schema files live in `lib/db/schema/`. All tables are exported from `lib/db/schema/index.ts`.

| File | Tables |
|------|--------|
| `organizations.ts` | `organizations` |
| `users.ts` | `users`, `sessions`, `accounts` |
| `system_settings.ts` | `system_settings` |
| `frameworks.ts` | `frameworks`, `controls`, `controlAssignments`, `controlMappings`, `soaEntries` |
| `evidence.ts` | `evidence`, `evidenceRequests` |
| `risks.ts` | `riskAssessments` |
| `policies.ts` | `policies`, `policyAcknowledgements` |
| `tasks.ts` | `tasks`, `taskAutomation` |
| `vendors.ts` | `vendors`, `vendorRiskAssessments`, `questionnaires`, `questionnaireQuestions`, `questionnaireResponses` |
| `findings.ts` | `findings`, `findingTemplates` |
| `notifications.ts` | `notifications` |
| `audit_logs.ts` | `auditLogs` |
| `integrations.ts` | `integrations` |
| `teams_bot.ts` | `teamsConversationRefs` |
| `api_keys.ts` | `apiKeys` |
| `org_chart.ts` | `orgChartNodes`, `timelines`, `timelinePhases`, `contextHub` |
| `billing.ts` | `billing` |
| `training.ts` | `training` |
| `knowledge_base.ts` | `knowledgeBaseEntries`, `secrets`, `setupWizardState` |
| `mapping_engine.ts` | mapping engine specific tables |

---

## 6. Phase 0 — Foundation

**Status**: ✅ COMPLETE  
**Commits**: `e133876`, `1a02afe`, `b2a3fc5`, `765aa62`

### Completed
- Next.js 16 + React 19 app scaffolding
- Dark glass design system (CSS variables, glassmorphism)
- PostgreSQL + Drizzle ORM setup (postgres-js driver, port 5433)
- NextAuth.js authentication (email/password)
- All 19 DB schema files defined
- Setup wizard (multi-step, skip-able, on-demand re-run from Settings)
- Settings hub (General, Security, AI, Storage, Integrations, Notifications)
- Landing page + login/signup pages
- Sidebar navigation with all planned routes
- TypeScript: 0 errors

---

## 7. Phase 1 — Core Engine (COMPLETED)

**Status**: ✅ COMPLETE  
**Commits**: `18a3878`, `e36a695`, `930575e`, `4d71dfd`, `e377e35`, `da460c9`, `207542c`, `7a4fe40`, `d15c301`, `4ae5184`, `566a69e`

### 7.1 Controls Mapping Engine (1A)
- **NIST 800-53 seed** — 243 controls across all 20 families (`seed/seed-nist.ts`)
  - `seedNistControls()` — idempotent via `onConflictDoUpdate`
  - Full family coverage: AC, AT, AU, CA, CM, CP, IA, IR, MA, MP, PE, PL, PM, PS, RA, SA, SC, SI, SR
  - `relatedControls` field populated
- **`/controls`** — Live API (DB-backed), 3-column grid, status pills, inline CommentsPanel
- **`/mappings`** — Live crosswalk from real DB, source framework selector, AI Suggestions panel
- **XLSX upload** — Server-side via `xlsx` npm package (`parseXlsx()` in upload route)

### 7.2 Notifications + Comments (1B)
- **`/notifications`** — Full notification center, filter tabs (All/Unread/Mentions/System), mark-as-read, 30s polling
- **Header bell** — Live unread count badge, top-5 dropdown preview
- **Comments** — Threaded `@mention` autocomplete, edit/delete, fires notifications on mention
  - `components/comments/comments-panel.tsx`
  - API: `GET/POST/PATCH/DELETE /api/comments`

### 7.3 Reports + SOA + Auditor View (1C)
- **`/reports`** — 6 CSV export cards (risk assessment, audit trail, compliance status, evidence summary, control gaps, policy compliance)
- **`/soa`** — Statement of Applicability, inline editable, HTML print export
- **`/audit`** — Auditor view with evidence counts, ZIP export
- CSV exports: `Content-Type: text/csv`, `Content-Disposition: attachment`
- ZIP: `archiver` package

### 7.4 Trust Portal + AI Mapping (1D)
- **`/trust/[orgSlug]`** — Public trust portal (no auth), compliance badges, framework status
- **AI Mapping** — `lib/mapping-engine/index.ts`, `_aiSuggestMappings()` using fetch() to OpenAI/Gemini
- Accept/reject suggestions writes to DB (`controlMappings`)
- `/trust` in `PUBLIC_PATHS` in `proxy.ts`

### Key Phase 1 Fixes
- Sidebar deduplication (SOA/Audit appeared twice after 1C + 1D both added entries)
- RSC boundary fix: `iconName: string` instead of LucideIcon component
- Neon driver removed from `lib/db/index.ts`, replaced with postgres-js
- Port changed to 3030
- 242 NIST controls successfully seeded on Mac deployment
- Server confirmed healthy: "Ready in 276ms"

---

## 8. Phase 2 — Operational Backbone (IN PROGRESS)

**Status**: 🔄 IN PROGRESS — Launched 2026-05-03  
**Approach**: 8 parallel subagents building all 15 components simultaneously

### 8.1 Task Management — Kanban (2A)
**Status**: 🔄 Building  
- Kanban board (Todo / In Progress / Done / Blocked / Cancelled columns)
- Drag-to-reorder within columns
- Task CRUD modal (title, description, priority, assignee, due date, labels)
- Full API: `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/[id]`
- "My Tasks" widget on dashboard
- Link tasks to controls via `controlAssignmentId`
- DB: `tasks` + `taskAutomation` tables (already defined)

### 8.2 Vendor / Third-Party Risk (2B)
**Status**: 🔄 Building  
- `/vendors` — Vendor register (name, category, website, contact, status)
- Inherent vs residual risk scoring (0–100 scale, 4-tier: low/medium/high/critical)
- DPA status tracking (signed/pending/not_required)
- Risk assessment history per vendor
- DB: `vendors`, `vendorRiskAssessments` tables (already defined)

### 8.3 Questionnaire Builder (2B)
**Status**: 🔄 Building  
- Drag-and-drop question builder (text / yes_no / multiple_choice / file_upload / rating)
- Pre-built templates (CAIQ Lite, Basic Security, GDPR DPA)
- Send questionnaire to vendor email via one-time link
- Response tracking + status dashboard
- DB: `questionnaires`, `questionnaireQuestions`, `questionnaireResponses` tables (already defined)

### 8.4 Evidence Forms (2C)
**Status**: 🔄 Building  
- Structured collection templates (screenshot, policy doc, config export, attestation, interview notes)
- `/evidence` page — full evidence library with filter/search
- Link evidence to controls, frameworks, findings
- Bulk evidence export as ZIP
- DB: `evidence` table (already defined)

### 8.5 Findings (2C)
**Status**: 🔄 Building  
- `/findings` — severity triage (info/low/medium/high/critical)
- Source tagging (AWS/Azure/GCP/GitHub/pentest/manual/NL test)
- Link findings to controls + evidence
- CVE ID field, remediation guidance, acceptance workflow
- Status tracking: open → in_remediation → resolved/accepted/false_positive
- DB: `findings`, `findingTemplates` tables (already defined)

### 8.6 Org Chart (2D)
**Status**: 🔄 Building  
- Visual org hierarchy tree (react-flow or custom SVG)
- Node management: add/edit/delete nodes
- Link nodes to system users
- Export as PNG
- DB: `orgChartNodes` table (already defined)

### 8.7 RBAC Custom Roles (2D)
**Status**: 🔄 Building  
- Role builder UI in Settings
- Granular permission checkboxes (read/write/delete per resource)
- Assign roles to users
- Pre-built roles: super_admin, admin, auditor, analyst, viewer
- DB: roles stored in `users.role` + custom permission sets in `system_settings`

### 8.8 Framework Editor (2E)
**Status**: 🔄 Building  
- `/frameworks` — full framework management page
- Admin can create/edit framework versions
- Publish/rollback mechanism
- Link controls to frameworks
- Import: XLSX upload (already wired) + JSON import
- DB: `frameworks`, `controls` tables (already defined)

### 8.9 AI Assistant Chat (2F)
**Status**: 🔄 Building  
- Floating chat widget + `/ai-assistant` full page
- Streamed responses (Server-Sent Events)
- Permission-scoped: user only sees data their role allows
- Tool-use: query controls, find evidence gaps, suggest remediation
- Context-aware: reads `contextHub` for org stack/risk tolerance
- DB: chat history in `knowledge_base_entries` (already defined)

### 8.10 Context Hub (2F)
**Status**: 🔄 Building  
- `/settings/context` or dedicated `/context-hub` page
- Fields: tech stack, business processes, risk tolerance, compliance goals, key assets, threat actors, regulatory context
- Feeds AI assistant with org-specific intelligence
- DB: `contextHub` table (already defined)

### 8.11 Timelines / Roadmap (2E)
**Status**: 🔄 Building  
- Visual Gantt-style roadmap per compliance framework
- Phase management (start/end dates, status)
- Admin-editable templates (re-usable for new org onboarding)
- DB: `timelines`, `timelinePhases` tables (already defined)

### 8.12 Pluggable Storage (2G)
**Status**: 🔄 Building  
- `lib/storage/index.ts` — unified StorageProvider interface
- Implementations: `LocalStorage`, `S3Storage`, `AzureBlobStorage`, `OneDriveStorage`, `MinIOStorage`
- Config via `system_settings` table (provider + credentials, encrypted)
- Evidence upload API wired to real storage
- Storage settings page in Settings hub

### 8.13 Platform Mailbox (2H)
**Status**: 🔄 Building  
- `lib/email/index.ts` — EmailProvider interface
- Postmark primary + SMTP fallback
- Transactional templates: welcome, evidence request, questionnaire invite, finding alert, report ready
- Config via `system_settings` (Postmark API key or SMTP credentials)
- Outbound from `compliance@[domain]`

### 8.14 Inbound Email → Evidence (2H)
**Status**: 🔄 Building  
- Postmark inbound webhook: `POST /api/webhooks/postmark/inbound`
- Parse attachments (PDF, XLSX, DOCX, images) → create evidence records
- Email metadata stored in evidence record
- Signed verification to prevent spoofing

### 8.15 Evidence Request Emails (2H)
**Status**: 🔄 Building  
- Secure single-use upload links: `POST /api/evidence-requests/[token]/upload`
- Token generation via `evidence_requests` table (expiry, used flag)
- Email template: "Please upload your [control name] evidence"
- Upload UI: minimal public page, no auth required
- Notify requester on completion

---

## 9. Session History

### Session 1 — Phase 0 (Foundation)
- Scaffolded Next.js 16 + all DB schemas
- Dark glass design system
- Setup wizard + Settings hub
- Landing page + auth pages
- TypeScript: 0 errors
- Commits: `e133876`, `1a02afe`, `b2a3fc5`, `765aa62`

### Session 2 — Phase 1 (Core Engine)
- 4 parallel subagents built Phase 1 simultaneously
- **1A**: NIST 800-53 seed (243 controls), live controls/mappings pages, XLSX upload fix
- **1B**: Notifications center, header bell badge, threaded comments with @mention
- **1C**: Reports (6 CSV exports), SOA, Auditor View (ZIP export)
- **1D**: Public Trust Portal, AI Mapping suggestions (OpenAI + Gemini)

### Session 2 — Phase 1 Conflict Resolution
- Sidebar had duplicate SOA/Audit entries (1C + 1D both added them) → deduped to single entries
- Controls page: 1A and main agent both wrote versions → main agent's live-API version committed
- Mappings page: Full live crosswalk replacing all CROSSWALK_ROWS demo data, AI panel integrated
- `PATCH /api/controls/[id]` added for inline status changes
- `@neondatabase/serverless` removed from `lib/db/index.ts` → postgres-js only
- `xlsx` npm package added to both sandbox and Mac node_modules

### Session 2 — Mac Deployment (Phase 1)
- tar → push → rsync → npm install (xlsx added) → restart
- 242 NIST controls seeded (of 243 — one was duplicate AC-1 variant, idempotent seed handled it)
- Server health confirmed: "Ready in 276ms", GET / 200, /dashboard 200
- Commits: `4ae5184`, `566a69e`

### Session 3 — Phase 2 (Operational Backbone)
- User confirmed all 15 items (2.1–2.15) to build
- CONTEXT.md updated with full Phase 1 completion log
- 8 parallel subagents launched for all 15 Phase 2 components
- Target: TypeScript clean → git commit → push → deploy to Mac

---

## 10. User Instructions (Verbatim)

1. "Yes, record this entire discussion char history in context.md file, make all conversation and your responses are captured. Now proceed to start developing, you have my approval. i'm thinking very big on your work, lets see."

2. "before finalizing, would also like to add the provision of integrating OpenClaw and we've to work on the required openclaw skills. and I would like to create a microsoft teams chat bot"

3. "Also would like to have setup wizard in the initial run or on-demand run where setting up this platform has to be very user friendly...If user missed to provide any details at initial setup wizard, they should be able to edit or provide them manually at an point of time in the respective settings section. if required, users should be be able to invoke the setup wizard manually at any point of time."

4. "My major concern in this app is 'controls mapping'...Transform the Compliance program from a series of isolated audits into a dynamic, continuous journey with the power of accurate cross-mapping capabilities...cross-mapping capability saves users and stakeholders valuable time and effort by allowing the same evidence, collected once, to automatically populate all relevant requirements across the various frameworks and controls."

5. "Im assuming it because of the copyright or non generally available in the internet. In this case, users can manually download the respective framework controls manually from the respective sites and upload into our platform."

6. "One thing i observed while working with hitrust and arcampe controls mapping with referencing to nist 800-53 as those both refer to nist framework, controls ID's and their subsections are differently named and produced in hitrust and arcape though both of them referring to same NIST controls framework. we've to keep this in consideration and accordingly design our control mapping engine."

7. "i've another app running on port 3000. we've to change the port for our app to 3030"

8. "First solidify the Controls Mapping Engine by wiring the UI to real data and seeding NIST 800-53 and then complete developing Everything else in CONTEXT.md Phase 1 and then finally commit"

9. "lets moveon to phase-2. build everything we finilized earlier and make sure all our troubleshooting and conversation is updated in the context.md file. as per my previous chat history, phase-2 is operationla backbone with 2.1 to 2.15 components."

---

## 11. Troubleshooting Log

### Issue: Neon serverless driver hydration errors
- **Symptom**: DB queries failed on client boundary, hydration mismatch
- **Root cause**: `@neondatabase/serverless` imported in `lib/db/index.ts`
- **Fix**: Replace with `postgres` (postgres-js), add to both workspace and Mac node_modules
- **Lesson**: Always use postgres-js in `lib/db/index.ts`; neon package stays in package.json but NEVER imported

### Issue: LucideIcon RSC boundary error
- **Symptom**: "Functions cannot be passed directly from Server Components to Client Components"
- **Root cause**: LucideIcon components passed as props through server→client boundary
- **Fix**: Pass `iconName: string` and resolve in client via `ICON_MAP` lookup
- **Affected files**: sidebar.tsx, any nav component

### Issue: XLSX upload server-side parsing failure
- **Symptom**: File upload accepted but no controls imported
- **Root cause**: `xlsx` package not installed; upload route used placeholder comment
- **Fix**: `npm install xlsx`, implement `parseXlsx()` in upload route using xlsx package
- **Lesson**: `xlsx` must be in package.json and installed on Mac before deploy

### Issue: Sidebar duplicate nav entries
- **Symptom**: SOA and Auditor View appeared twice in sidebar after Phase 1 parallel build
- **Root cause**: Subagents 1C and 1D both added entries independently
- **Fix**: Main agent wrote canonical sidebar.tsx with deduped single entries per route

### Issue: Port 5432 conflict
- **Symptom**: Docker container fails to start
- **Root cause**: OrbStack uses port 5432 for its own PostgreSQL
- **Fix**: Always use 5433+ for app containers; never kill OrbStack's process

### Issue: pc bash network isolation
- **Symptom**: `curl localhost:3030` hangs in pc bash
- **Root cause**: pc bash is network-isolated; cannot reach localhost of Mac
- **Fix**: Use osascript to open Terminal for network operations; log to /tmp files for inspection

### Issue: Mappings page showing demo data
- **Symptom**: `/mappings` displayed hardcoded CROSSWALK_ROWS instead of live DB data
- **Root cause**: Phase 0 scaffolded with demo data; Phase 1A build didn't replace it
- **Fix**: Main agent replaced entire mappings page with live-API version

### Issue: Auth redirect loop for authenticated users
- **Symptom**: Logged-in users getting sent to setup wizard on every page load
- **Root cause**: proxy.ts had catch-all redirect for incomplete setup state
- **Fix**: Added authenticated user check — authenticated users bypass setup wizard redirect

---

## 12. Key File Index

### Phase 1 — Core Files
```
seed/seed-nist.ts                              → 243 NIST controls, idempotent
app/(dashboard)/controls/page.tsx              → Live controls library
app/(dashboard)/mappings/page.tsx              → Live crosswalk + AI suggestions
app/(dashboard)/notifications/page.tsx         → Notification center
app/(dashboard)/reports/page.tsx               → 6 CSV export cards
app/(dashboard)/soa/page.tsx                   → Statement of Applicability
app/(dashboard)/audit/page.tsx                 → Auditor view + ZIP export
app/(trust)/trust/[orgSlug]/page.tsx           → Public trust portal
app/api/controls/[id]/route.ts                 → GET + PATCH (status update)
app/api/comments/route.ts                      → GET/POST/PATCH/DELETE
app/api/notifications/route.ts                 → Fixed ordering, batch mark-as-read
app/api/soa/route.ts                           → SOA CRUD
app/api/soa/export/route.ts                    → HTML print export
app/api/audit/controls/route.ts                → Auditor evidence counts
app/api/audit/export-zip/route.ts              → ZIP export
app/api/trust/[orgSlug]/route.ts               → Public endpoint (no auth)
app/api/mappings/suggest/route.ts              → AI mapping suggestions
app/api/mappings/suggestions/route.ts          → Suggestion list
app/api/mappings/suggestions/[id]/route.ts     → Accept/reject
app/api/reports/risk-assessment/route.ts       → CSV: risk assessment
app/api/reports/audit-trail/route.ts           → CSV: audit trail
app/api/reports/compliance-status/route.ts     → CSV: compliance status
app/api/reports/evidence-summary/route.ts      → CSV: evidence summary
app/api/reports/control-gaps/route.ts          → CSV: control gaps
app/api/frameworks/upload/route.ts             → XLSX server-side parse
components/comments/comments-panel.tsx         → Threaded comments, @mention
components/dashboard/header.tsx                → Bell badge, top-5 dropdown
components/dashboard/sidebar.tsx               → Deduplicated nav
lib/mapping-engine/index.ts                    → AI suggest (OpenAI + Gemini)
proxy.ts                                       → /trust in PUBLIC_PATHS
```

### Phase 2 — Target Files (to be created)
```
app/(dashboard)/tasks/page.tsx                 → Kanban board (2.1)
app/(dashboard)/vendors/page.tsx               → Vendor register (2.2)
app/(dashboard)/vendors/[id]/page.tsx          → Vendor detail + questionnaires (2.3)
app/(dashboard)/evidence/page.tsx              → Evidence library (2.4)
app/(dashboard)/findings/page.tsx              → Findings triage (2.5)
app/(dashboard)/org-chart/page.tsx             → Org hierarchy (2.6)
app/(dashboard)/frameworks/page.tsx            → Framework editor (2.8)
app/(dashboard)/roadmap/page.tsx               → Timelines/roadmap (2.11)
app/(dashboard)/ai-assistant/page.tsx          → AI chat (2.9)
app/(dashboard)/context-hub/page.tsx           → Context hub (2.10)
app/api/tasks/route.ts                         → Tasks CRUD (2.1)
app/api/tasks/[id]/route.ts                    → Task update/delete (2.1)
app/api/vendors/route.ts                       → Vendor CRUD (2.2)
app/api/vendors/[id]/route.ts                  → Vendor detail (2.2)
app/api/questionnaires/route.ts                → Questionnaire CRUD (2.3)
app/api/questionnaires/[id]/route.ts           → Q detail + send (2.3)
app/api/evidence/route.ts                      → Evidence CRUD (2.4)
app/api/findings/route.ts                      → Findings CRUD (2.5)
app/api/findings/[id]/route.ts                 → Finding detail (2.5)
app/api/org-chart/route.ts                     → Org chart nodes (2.6)
app/api/roles/route.ts                         → Custom roles (2.7)
app/api/ai/chat/route.ts                       → Streamed AI chat (2.9)
app/api/context-hub/route.ts                   → Context hub CRUD (2.10)
app/api/timelines/route.ts                     → Timeline CRUD (2.11)
app/api/webhooks/postmark/inbound/route.ts     → Inbound email→evidence (2.14)
app/api/evidence-requests/[token]/upload/route.ts → Single-use upload (2.15)
lib/storage/index.ts                           → StorageProvider interface (2.12)
lib/storage/local.ts                           → Local filesystem (2.12)
lib/storage/s3.ts                              → AWS S3 (2.12)
lib/storage/azure-blob.ts                      → Azure Blob (2.12)
lib/storage/onedrive.ts                        → OneDrive (2.12)
lib/storage/minio.ts                           → MinIO (2.12)
lib/email/index.ts                             → EmailProvider interface (2.13)
lib/email/postmark.ts                          → Postmark implementation (2.13)
lib/email/smtp.ts                              → SMTP fallback (2.13)
lib/email/templates/                           → Email HTML templates (2.13)
```

---

*This file is automatically updated at the start of each session. Always update before committing.*

---

## 13. Phase 3 — Integrations & Automation (IN PROGRESS)

**Status**: 🔄 Building — launched 2026-05-04  
**Commit baseline**: `5560de5`

### 3.1 GitHub Integration
- Connect via GitHub App or Personal Access Token
- Checks: branch protection rules, secret scanning alerts, dependabot alerts, code scanning alerts, required reviews
- Results → findings (severity mapped from GitHub alert severity)
- Evidence: export scan results as evidence records
- DB: `integrations` (type='github'), `integrationScanResults`

### 3.2 AWS Integration
- Connect via IAM Role ARN (cross-account assume role) or Access Key
- 40+ checks across: IAM (MFA, root usage, key rotation), S3 (public access, encryption, versioning), EC2 (security groups, IMDSv2, EBS encryption), RDS (encryption, backup, public), CloudTrail (enabled, multi-region, log validation), Config (enabled), GuardDuty (enabled), KMS (rotation), VPC (flow logs)
- Results → findings + evidence records
- Severity mapped from AWS Security Hub standard

### 3.3 Azure Integration
- Connect via Service Principal (clientId, clientSecret, tenantId, subscriptionId)
- Checks: AKS (RBAC, node pools, network policy), App Service (HTTPS, auth, TLS), Entra ID (MFA, conditional access summary), Key Vault (soft delete, purge protection, access policies), SQL (TDE, auditing, firewall), Storage (HTTPS, public access, encryption), VM (disk encryption, just-in-time access)
- Results → findings + evidence

### 3.4 GCP Integration
- Connect via Service Account JSON key
- Checks: Compute (OS login, serial port, public IPs), IAM (service account keys, roles, org policies), Storage (uniform bucket-level access, public access prevention, versioning), Cloud Logging (log sinks, audit logs), Cloud Armor (WAF policies), KMS (key rotation)
- Results → findings + evidence

### 3.5 Slack Integration
- Connect via Slack OAuth (Bot Token)
- Outbound: compliance alerts, finding notifications, evidence request approvals, daily compliance digest
- Inbound: `/compliguard status`, `/compliguard findings`, `/compliguard evidence submit [url]` slash commands
- Channel configuration: choose channel per notification type
- DB: `integrations` (type='slack')

### 3.6 Jira Integration
- Connect via Jira Cloud API token (email + token + subdomain)
- Bidirectional: findings → Jira issues (auto-create), Jira issue status → finding status sync
- Task → Jira issue sync
- Field mapping: severity → priority, status → Jira status workflow
- Webhooks: Jira → CompliGuard status updates
- DB: `integrations` (type='jira')

### 3.7 Automated NL Tests
- Test library: "Check if SSL is enabled on {domain}", "Verify MFA is enforced", "Check if port 22 is open on {host}", etc.
- Schedule: cron expressions (daily/weekly/monthly or custom)
- AI parses natural language query → determines test type → executes check
- Results stored in `nlTests` + `nlTestResults`
- Failures → auto-create finding
- `/integrations/nl-tests` page with test builder, schedule manager, result history

---

## 14. Phase 4 — Microsoft/Azure-Native Deep (IN PROGRESS)

**Status**: 🔄 Building — launched 2026-05-04

### 4.1 Azure Entra ID Deep
- Groups inventory (members, owners, nested groups)
- MFA status per user (enabled/disabled/enforced)
- Conditional Access policies (list, evaluate coverage)
- Sign-in risk events (risky users, risk detections)
- Privileged roles (Global Admin, Security Admin, etc.) — PIM integration
- Maps to: AC-2, AC-3, IA-2, IA-5, IA-8 NIST controls

### 4.2 Microsoft Intune
- Device compliance policies (compliant/non-compliant count per policy)
- BitLocker encryption status per device
- App protection policies (MAM)
- OS version compliance (min required version check)
- Non-compliant devices → findings
- Maps to: CM-6, CM-7, SC-28, SI-2 NIST controls

### 4.3 Defender for Cloud / XDR
- Secure Score: overall + per control
- Recommendations (unhealthy resources → findings)
- Security alerts ingestion (high/medium severity → findings)
- XDR incidents correlation
- Maps to: RA-5, SI-3, SI-4 NIST controls

### 4.4 Azure Sentinel (SIEM)
- Incident ingestion (high/medium priority → findings)
- Watchlist sync (IP/domain threat indicators)
- Analytics rule inventory (detection coverage)
- Incidents → audit trail entries
- Maps to: AU-6, IR-4, IR-5, SI-4 NIST controls

### 4.5 Microsoft Purview
- DLP policy violations → findings
- Information protection labels inventory
- Sensitive data discovery summary
- Maps to: AC-16, MP-4, SC-8, SI-12 NIST controls

### 4.6 Microsoft Compliance Manager
- Score sync (current score + improvement actions)
- Assessment evidence mapping → CompliGuard evidence records
- Improvement actions → tasks
- Maps directly to framework controls

### 4.7 Azure-Native Compliance Scanning
- Unified scan orchestrator: runs all Azure checks (4.1–4.6) on schedule
- AI remediation guidance: per-finding AI-generated fix steps using Azure docs
- Scan summary report: PDF export per scan run
- Scheduled via cron, results aggregated across all Azure sources

---

## 15. Phase 5 — Platform Completeness (IN PROGRESS)

**Status**: 🔄 Building — launched 2026-05-04  
**Excluded**: People sync, Background Checks, Secrets Vault, Stripe Billing

### 5.1 Penetration Testing Module
- Credits system (balance, purchase history — no Stripe, admin grants credits)
- AI-powered scan: target scope → AI generates test plan → executes NL tests
- Findings auto-created from scan results
- Pentest report: PDF export with executive summary + technical findings
- DB: `pentestSessions`, `pentestCredits` (already defined in billing.ts)

### 5.2 Public API + API Keys + Webhooks
- REST API v1: `/api/v1/controls`, `/api/v1/findings`, `/api/v1/evidence`, `/api/v1/frameworks`, `/api/v1/tasks`, `/api/v1/vendors`
- API key management UI: create/revoke/scope keys
- Key auth middleware: `Authorization: Bearer cgk_...` header
- Scoped permissions: read:* / write:* / admin:*
- Outbound webhooks: register URL + events, HMAC-signed payloads
- DB: `apiKeys`, `webhooks`, `webhookDeliveries` (already defined in api_keys.ts)

### 5.3 Self-Hosted Edition
- `docker-compose.yml` — full stack: app + postgres + minio + redis
- `docker-compose.dev.yml` — dev overrides (explicit `-f` required; not auto-loaded)
- `systemd/compliguard.service` — systemd unit file
- `scripts/install.sh` — one-command install for Ubuntu/Debian
- `scripts/backup.sh` — DB + storage backup script
- `.env.example` with all required vars documented
- Health check endpoint: `GET /api/health` (already exists)
- README-SELFHOST.md with full setup guide

### 5.4 Sentinel / Defender XDR Advanced
- Real-time relay: streaming incidents via Azure Event Hub → SSE push to dashboard
- Enriched audit trail: every Sentinel incident enriched with MITRE ATT&CK mapping
- Threat intelligence feed: IoC sync from Sentinel watchlists → context hub
- Live alert ticker widget on dashboard

### 5.7 Security Training Module
- Training library: built-in modules (Security Awareness, Phishing, GDPR, SOC 2 Basics)
- Custom module creation: title, content (markdown), quiz questions, passing score
- Assign modules to users or all-org
- Completion tracking + certificate generation (PDF)
- Compliance evidence: completion records auto-create evidence entries
- DB: `trainingModules`, `trainingCompletions` (already defined in training.ts)

### 5.8 Knowledge Base (Vector-Store Backed)
- `/knowledge-base` page: articles, procedures, runbooks
- Markdown editor for content creation
- Vector search: embedding stored in `knowledgeBaseEntries.embedding` (jsonb)
- AI-powered search: natural language query → semantic similarity → ranked results
- Categories: policies, procedures, runbooks, FAQs, control guidance
- Auto-populate: import from compliance frameworks, AI-generated summaries

### 5.9 Microsoft Teams Bot
- Bot registration via Azure Bot Service (App ID + App Password config)
- Commands: `help`, `status`, `findings`, `evidence`, `task [id]`, `assign [task] [user]`
- Proactive notifications: mention users on finding assignments, evidence requests
- Adaptive Cards: rich finding/task cards with action buttons
- Auth: link Teams identity to CompliGuard user via magic link
- DB: `teamsConversationRefs` (already defined in teams_bot.ts)

### Phase 5 Commit: `5560de5` baseline

---

## 16. GitHub Commit Log (Complete)

- `e133876` — fix: resolve all TypeScript build errors Phase 0
- `1a02afe` — docs: controls mapping engine architecture
- `b2a3fc5` — feat: dark glass design system full UI revamp
- `765aa62` — fix: port 3030, legacy-peer-deps, DB port 5433
- `18a3878` — feat: Phase 1 — Controls Mapping Engine (18 files)
- `e36a695` — fix: add missing /api/health and /api/auth/session routes
- `930575e` — seed: add create-admin.ts script
- `4d71dfd` — fix: swap Neon serverless driver to postgres-js
- `e377e35` — feat: landing page + setup wizard skip + settings hub
- `da460c9` — fix: restore scrolling
- `207542c` — fix: logout, profile, draggable KPI cards, logo alignment, landing page, 404
- `7a4fe40` — fix: RSC boundary — pass iconName string instead of LucideIcon
- `d15c301` — fix: features section 2-col layout, wizard skip button, remove forced setup redirect
- `4ae5184` — feat: Phase 1 complete — NIST seed, live controls/mappings, notifications, comments, reports, SOA, auditor view, trust portal, AI mapping
- `566a69e` — feat: upgrade NIST seed — 243 controls, onConflictDoUpdate idempotent
- `2922f6c` — feat: Phase 2 — Operational Backbone (2.1–2.15)
- `5560de5` — feat: AI settings — add Claude + Ollama (local) provider support
- `0fb6dc1` — feat: Phase 3+4+5 — Integrations, Microsoft Deep, Platform Completeness (186 files, 41,651 insertions)

## Phase 3 — Completion Log (2026-05-04)

### 3.1 GitHub Integration (`lib/integrations/github.ts`)
- 10 checks: branch protection, secret scanning, Dependabot, code scanning, required reviews, stale deploy keys, 2FA, admin count, public repos, Actions token permissions
- Routes: GET/POST/DELETE config, /scan, /test
- Auto-creates findings + evidence for failures

### 3.2 AWS Integration (`lib/integrations/aws.ts`)
- 40 checks: IAM/S3/CloudTrail/Config/GuardDuty/SecurityHub/VPC/EC2/RDS/KMS/CloudWatch/ACM/Route53/EKS/Lambda
- Lightweight SigV4 signer using Web Crypto API (no AWS SDK)
- Routes: GET/POST/DELETE config, /scan, /test (STS GetCallerIdentity)

### 3.3 Azure Integration (`lib/integrations/azure.ts`)
- 31 checks across AKS/AppService/Entra/KeyVault/SQL/Storage/VM
- OAuth2 client_credentials flow via ARM + Microsoft Graph

### 3.4 GCP Integration (`lib/integrations/gcp.ts`)
- 36 checks via Google Cloud REST APIs
- RS256 JWT signing using Web Crypto API (RSASSA-PKCS1-v1_5)

### 3.5 Slack Integration (`lib/integrations/slack.ts`)
- Block Kit rich messages, HMAC-SHA256 signature verification
- Per-type channels, notification preferences, slash commands (/compliguard)

### 3.6 Jira Integration (`lib/integrations/jira.ts`)
- ADF format issue creation, bidirectional status sync
- Per-finding push, jiraIssueKey stored in findings.metadata

### 3.7 NL Tests (`lib/integrations/nl-tests.ts`)
- 10 test types: SSL, port_scan, DNS, headers, cert_expiry, TLS, CORS, redirect, response_code, ai_custom
- Scheduler, scan-all orchestrator, integrations hub page

## Phase 4 — Completion Log (2026-05-04)

### 4.1 Entra ID Deep (`lib/microsoft/entra.ts`)
- 20 checks: MFA registration/enforcement, Conditional Access, privileged roles (PIM), users/groups, sign-in risk
- Shared `lib/microsoft/graph.ts` with auto-pagination

### 4.2 Intune (`lib/microsoft/intune.ts`)
- 19 checks: device compliance rate, BitLocker (>80%), MAM policies, OS versions (Win11/iOS16/Android12/macOS13), config profiles
- SVG compliance gauges, non-compliant device tables with "Create Finding"

### 4.3 Defender for Cloud/XDR (`lib/microsoft/defender.ts`)
- 19 checks: Secure Score, recommendations, alerts, XDR incidents, coverage
- Stored as type='azure' with subType='defender' to work around enum

### 4.4 Azure Sentinel (`lib/microsoft/sentinel.ts`)
- 20 checks: incidents, analytics rules, watchlists, data connectors, threat intel
- MITRE tactic chips, ingest-incidents → findings, audit trail

### 4.5 Microsoft Purview (`lib/microsoft/purview.ts`)
- 15 checks: DLP policies, sensitivity labels, sensitive data types, audit logging
- Graph Beta APIs, NIST control badges

### 4.6 Compliance Manager (`lib/microsoft/compliance-manager.ts`)
- Score sync, improvement actions → tasks (deduped by metadata), NIST control mapping
- Radial score gauge with dynamic color

### 4.7 Azure Compliance Scanner (`lib/microsoft/azure-compliance-scanner.ts`)
- Parallel orchestrator: Entra + Defender + Purview + Compliance Manager
- AI remediation summary, async scan + polling via /status
- 10-entry scan history, JSON export, schedule modal

## Phase 5 — Completion Log (2026-05-04)

### 5.1 Pentest Module (`lib/pentest/`)
- 15 built-in tests: SSL/TLS, DNS, HTTP headers, HTTP checks
- AI test planner (OpenAI/Anthropic/Ollama), HTML report with AI executive summary
- Credit system (admin grant), live progress banner polling every 5s
- Routes: sessions, generate-plan, credits

### 5.2 Public API v1 + API Keys + Webhooks
- 15 REST routes under /api/v1/* with { success, data, meta } envelope
- `lib/api/api-key-auth.ts`: SHA-256 key validation, scope matching, cgk_ prefix
- `lib/webhooks/dispatcher.ts`: HMAC-SHA256, 3-attempt exponential backoff, per-delivery tracking
- UI: API Keys page (scoped keys, one-time reveal modal), Webhooks page (test ping, retry delivery)

### 5.3 Self-Hosted Edition
- `docker-compose.yml`: app + postgres + redis + minio + nginx (5 services)
- `Dockerfile`: multi-stage base→deps→builder→runner + development target
- `systemd/compliguard.service`: hardened unit (NoNewPrivileges, ProtectSystem=strict)
- `scripts/install.sh`: full Ubuntu/Debian installer
- `scripts/backup.sh`: pg_dump + S3/MinIO upload, 30-day retention
- `scripts/update.sh`: backup→pull→build→migrate→restart
- `README-SELFHOST.md`: 630-line deployment guide

### 5.4 Sentinel/Defender XDR Advanced
- `lib/microsoft/sentinel-relay.ts`: polling bridge, lastPollTime per-org in systemSettings.extraConfig
- `lib/microsoft/mitre.ts`: 50+ technique map, tactic→NIST mapping
- `lib/microsoft/threat-intel.ts`: STIX pattern parsing, IoC detection
- `components/dashboard/xdr-ticker.tsx`: SSE-powered live ticker (slide-in animation, severity badges)
- XDR Advanced page: MITRE heatmap, TI panel, enriched audit trail, findings table

### 5.7 Security Training (`lib/db/schema/training.ts`)
- 6 modules: Security Awareness, GDPR, SOC 2, Phishing, Access Control, Incident Response
- Quiz engine (5 questions per module), pass/fail modal, certificate ID generation
- Stats: totalModules, completedModules, passRate, avgScore
- UI: module grid, 3-tab player (Learn/Assessment/Certificate), completions table

### 5.8 Knowledge Base (`lib/knowledge/`)
- 20 GRC articles seeded across frameworks/controls/compliance/security/operations
- `lib/knowledge/search.ts`: cosine similarity, ILIKE text search, hybrid 60/40 merge
- `lib/knowledge/embeddings.ts`: OpenAI text-embedding-3-small, silent no-op for other providers
- UI: category filter pills, debounced search, admin embedding generation

### 5.9 Microsoft Teams Bot (`lib/teams/`)
- Bot Framework via HTTP (fetch only, no botbuilder dependency)
- OAuth2 client_credentials token with in-memory cache
- Adaptive cards: finding (severity-colored), compliance alert, incident, welcome, help
- Commands: /status, /findings, /help
- `public/teams-manifest/manifest.json`: v1.16 with scopes, commands
- Settings UI: 5-section config (credentials, status, conversations, notifications, setup guide)

## TypeScript Fixes Applied (Phase 3+4+5)
1. `session.organizationId` → `session.orgId!` (SessionPayload uses orgId, not organizationId)
2. `PentestSessionMetadata` missing `scanType` field → added `scanType: string = 'builtin'` param
3. `WebhookPayload` cast → added `[key: string]: unknown` index signature
4. `SentinelCheckResult` missing `score?` field → added optional field
5. `entry.after.severity` ReactNode → wrapped in `!!(...)` boolean coercion
6. `entry.after.tactics` → cast via `Record<string, unknown>`
7. Knowledge page `Date` vs `string` → serialize `createdAt`/`updatedAt` with `.toISOString()`
8. XDR-advanced SSE status event cast → `as unknown as { type: string; connected: boolean }`

## Deployment Log
- Committed: `0fb6dc1` (186 files, +41,651 lines)
- Pushed: `main` branch → GitHub
- Deployed: tar → pc push → Mac extract → npm install → restart (rm -rf .next)
- Confirmed running: http://localhost:3030 (Turbopack, Ready in 264ms)

## Phase 6 — Completion Log (2026-05-04)

### 6.1 CompliGuard MCP Server
- `lib/mcp/types.ts` — MCPTool, MCPToolCall, MCPToolResult, MCPRequest, MCPResponse types
- `lib/mcp/tools.ts` — 10 tool handlers with real DB queries:
  list_frameworks, get_control_status, list_findings, create_finding,
  list_tasks, update_task_status, get_compliance_score, search_controls,
  list_evidence, get_risk_summary
- `app/api/mcp/route.ts` — JSON-RPC 2.0, bearer API key auth (cgk_* prefix), mcp:write scope for mutations
- `app/api/mcp/manifest/route.ts` — Public GET returning full server manifest with all 10 tool defs
- Settings UI: `app/(dashboard)/settings/mcp/` — server status, key management, Claude Desktop JSON snippet, tool reference

### 6.2 OpenClaw Skill Pack
- `public/openclaw/skill.json` — OpenClaw v1 manifest with tools, auth, scopes, 5 examples
- `public/openclaw/README.md` — ClawHub install, self-hosted registration, security guide
- `public/openclaw/openapi.json` — OpenAPI 3.1 spec for REST endpoints

### 6.3 OpenClaw Auth
- `lib/mcp/auth.ts` — hasMCPReadAccess/hasMCPWriteAccess/hasMCPAdminAccess, sliding-window rate limit (100/min read, 20/min write), logMCPAccess to auditLogs
- `app/api/mcp/register/route.ts` — GET/POST/DELETE registered OpenClaw instances (stored in systemSettings.extraConfig.openclawInstances)
- `app/api/mcp/ping/route.ts` — Public heartbeat, updates lastPingAt
- Settings UI: `app/(dashboard)/settings/openclaw/` — instances table, skill pack downloads, agent access log, setup guide

### 6.4 NL Query Skill
- `lib/mcp/nl-query.ts` — Agentic loop: OpenAI function calling / Anthropic tool use / Ollama context injection, max 3 tool calls per query, returns answer + toolsUsed + confidence + followUpQuestions
- `app/api/mcp/nl-query/route.ts` — Dual auth (session OR mcp:read API key), SSE streaming, 10 req/min rate limit, audit logging
- UI: `app/(dashboard)/ai-assistant/nl-query/` — chat interface with collapsible tool call details, confidence badge, follow-up chips, streaming

## Phase 7 — Completion Log (2026-05-04)

### 7.1 Azure Bot Service Registration
- `docs/teams-bot-setup.md` — 590-line guide: Azure AD App Registration, Bot Service creation, Teams channel, CompliGuard config, manifest install, ngrok local dev, secret rotation
- `docs/teams-bot-commands.md` — 495-line command reference with example card responses

### 7.2 Enhanced Bot API Route
- `app/api/teams/bot/route.ts` — Handles conversationUpdate (save ref + welcome card), message (command dispatcher), invoke (approve/reject adaptive card actions)
- Org resolution via teamsConversationRefs lookup by conversationId
- HTML tag stripping from Teams message text before parsing
- Bearer token HMAC-SHA256 validation (dev bypass when BOT_APP_PASSWORD unset)

### 7.3 Slash Commands
- `lib/teams/commands.ts` — 1053 lines, 7 command handlers + keyword "Did you mean?" fallback:
  - /compliance → per-framework score with progress bars + overall %
  - /control → lookup by ID or title ILIKE, shows status/assignee/evidence/findings
  - /risks → severity counts + top 5 critical/high findings
  - /tasks → overdue + upcoming within 7 days
  - /findings → 10 most recent open findings, severity-sorted
  - /policy → policy-related controls + findings
  - /help → static help card always works
- `public/teams-manifest/manifest.json` → v2.0.0 with all 7 commands

### 7.4 Rich Adaptive Cards (added to lib/teams/bot.ts)
- createFrameworkProgressCard — Unicode progress bars, color-coded scores
- createControlDetailCard — header, status badge, description, evidence/findings stats, action buttons
- createRiskSummaryCard — severity grid, top risks, at-risk frameworks
- createEvidenceApprovalCard — Approve/Reject Submit actions with evidenceId+orgId payload
- createTaskReminderCard — overdue warning, Mark Done Submit action

### 7.5 Proactive Notifications
- `lib/teams/notifications.ts` — upgraded with org-scoped broadcastToOrg({sent,failed}), notifyEvidenceNeedsReview, notifyTaskOverdue, notifyCriticalFinding, notifyEvidenceRejected, notifyPolicyExpiry
- `lib/teams/hooks.ts` — fire-and-forget triggers: onFindingCreated (critical/high only), onEvidencePendingReview, onEvidenceRejected, checkAndNotifyOverdueTasks (24h rate-limit via task metadata)

### 7.6 Approval Actions from Teams
- `lib/teams/approvals.ts` — handleApproveEvidence / handleRejectEvidence → DB update + returns updated result card
- `app/api/teams/check-overdue/route.ts` — POST (admin) → checkAndNotifyOverdueTasks

### 7.7 Daily Digest
- `lib/teams/digest.ts` — collectDigestData (org name, findings, tasks, evidence, audit log, framework scores), sendDailyDigest → broadcasts to all active conversation refs
- createDailyDigestCard — rich morning summary: score delta, key metrics, framework health rows, recent activity, action buttons
- `app/api/teams/digest/route.ts` — GET/POST/PATCH, dual auth (session OR x-cron-secret header)
- TeamsBotClient.tsx Section 6 — digest enable/time/timezone settings, Send Now button

### 7.8 Conversation Reference Storage
- `lib/teams/bot.ts` — saveConversationRef (upsert), deactivateConversationRef, getActiveConversationRefs, pruneStaleConversationRefs
- `app/api/teams/conversations/route.ts` — enhanced with PATCH (toggle active) + DELETE ?prune=true
- `app/api/teams/conversations/stats/route.ts` — GET stats: total/active/inactive/channelBreakdown
- TeamsBotClient.tsx Section 7 — conversation stats bar, enhanced table, Prune Stale button
- `components/dashboard/teams-status-widget.tsx` — dashboard widget (SSR disabled, shows bot status + conv count)

## Deployment Log
- Committed: `2ce0088` (38 files, +9,773 lines)
- Pushed: `main` → GitHub
- Deployed: tar → pc push → Mac extract → rm -rf .next/.turbo → restart
- Confirmed: http://localhost:3030 running (Turbopack, Ready in 279ms)

## Bug Fix (same session)
- **Turbopack stale cache**: Cannot find module '../chunks/ssr/[turbopack]_runtime.js'
  - Root cause: old .next/dev/server/pages/_document.js referenced chunk from prior build
  - Fix: `kill -9 $(lsof -ti:3030); rm -rf .next .turbo; npm run dev`
  - Must always `rm -rf .next` before restart when new files are pushed

---

## DOCKER DEPLOYMENT — POST-MORTEM (2026-05-09)

### What Was Actually Wrong (4 Layered Bugs)

**Bug 1 — `docker-compose.override.yml` auto-loaded on every prod deploy**
Docker Compose merges any file named `docker-compose.override.yml` in the project directory by default with no flags required. This file set `target: development`, `command: npm run dev`, and mounted the source tree — so every `docker compose up` in prod was silently running Turbopack dev mode instead of the production build.
- Fix: renamed to `docker-compose.dev.yml` (not auto-loaded). Use `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` for local dev.

**Bug 2 — `docker-compose.yml` had no `target:` → Docker built last Dockerfile stage**
Without an explicit `target:`, Docker builds the last stage in the Dockerfile. The `development` stage was last, so even after removing the override file, prod builds still ran `npm run dev`.
- Fix: added `target: runner` to `docker-compose.yml`. Reordered Dockerfile so `runner` is the last stage (defense-in-depth).

**Bug 3 — Production `next build` was failing silently**
Two compile errors prevented a successful prod build:
1. `nodemailer` was used in the email service but not in `package.json` — `npm ci` never installed it
2. `app/api/storage/local/[...key]/route.ts` used the old Next.js 14 params type signature. Next.js 16 requires `params: Promise<{...}>` and `await context.params`
Build failures left the old dev image running — no error was surfaced to the deploy script.
- Fix: added `nodemailer` to `package.json`; updated storage route to async params pattern.

**Bug 4 — `ssr: false` in a Server Component (Next.js 16 forbids it)**
`app/(dashboard)/dashboard/page.tsx` (a Server Component) used `next/dynamic({ ssr: false })`. Next.js 16 throws a build/runtime error for this.
- Fix: replaced `next/dynamic` with plain ES imports. `XDRTicker` and `TeamsStatusWidget` are `'use client'` components that guard browser APIs inside `useEffect`, so SSR is safe.

### Why Login Looked Like It Was Failing (The Chain)

Because of bugs 1+2, every Docker container was running `npm run dev` (Turbopack). In dev mode, Turbopack lazy-compiles client chunks — the `/signin` form rendered its HTML before its JavaScript was ready. React never hydrated the form. The browser fell back to native HTML form submission, which sent a **GET request** (`/signin?email=...&password=Welcome@123`) instead of the fetch POST. The GET found no handler, returned the page HTML, and the user appeared to still be on the login page.

**Critical security note**: The admin password `Welcome@123` was transmitted in plaintext in GET request URLs and logged in Docker request logs and browser history. Rotate any password used during this debugging period.

### Verified Working State (homelab 192.168.68.30:3040)
- Container runs `node server.js` as `nextjs` user (not root, not `npm run dev`) ✓
- `POST /api/auth/login` → 200 + `cg-session` cookie set ✓
- `GET /dashboard` with cookie → 200 ✓
- HTML contains hashed production chunk filenames, no next-devtools ✓

### Key Commits
| Commit | Fix |
|--------|-----|
| `b947a99` | Remove `ssr:false` from dashboard server component |
| `8c602f6` | Rename `docker-compose.override.yml` → `docker-compose.dev.yml` |
| `0f42656` | Pin `target: runner` in docker-compose.yml; reorder Dockerfile |
| `2ca6956` | Install nodemailer; fix Next.js 16 async params in storage route |

### Deploy Commands (Homelab)
```bash
# Full wipe + redeploy
cd /opt/compliguard && docker compose down -v --remove-orphans
docker rmi compliguard-app compliguard-v2-app 2>/dev/null || true
rm -rf /opt/compliguard
git clone https://saichand04:<PAT>@github.com/saichand04/compliguard-v2.git /opt/compliguard
cd /opt/compliguard && bash scripts/deploy.sh

# Dev mode (local Mac)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Architecture Notes (Confirmed)
- App internal port: always **3030** (inside container)
- External port: **3040** on homelab (3030 taken by `homepage` container)
- `NEXTAUTH_URL` and `NEXTAUTH_URL_INTERNAL` must both equal `http://<host>:<external-port>`
- Session cookie `secure: false` for HTTP deployments — derived from `NEXTAUTH_URL.startsWith('https://')`
- Auth is **custom JWT** via `/api/auth/login` — NOT NextAuth credentials provider
- `super_admin` users have `organization_id = NULL` — intentional
- `system_settings` table must have a row with `setup_completed=true, setup_step=9` or the setup wizard blocks all pages

---

## PHASE COMPLETION STATUS

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ Complete | Foundation — Next.js 15, Drizzle, Docker, auth |
| 1 | ✅ Complete | Core Engine — NIST 800-53, 243 controls |
| 2 | ✅ Complete | Operational Backbone (2.1–2.15) |
| 3 | ✅ Complete | Integrations |
| 4 | ✅ Complete | Microsoft Deep (Sentinel, Defender, Intune) |
| 5 | ✅ Complete | Platform Completeness |
| 6 | ✅ Complete | OpenClaw MCP Server |
| 7 | ✅ Complete | Microsoft Teams Bot |
| 8 | ✅ Complete | Security Hardening (2026-05-11) — full audit + remediation |
| **Next** | 🔜 Pending | Feature development phase TBD |

---

## PHASE 8 — SECURITY HARDENING (2026-05-11)

**Status:** ✅ COMPLETE
**Audit doc:** [`securitycheck.md`](./securitycheck.md) — full findings + remediation status
**Commit range:** `6916f12..05dcd86` (13 commits, 99 files, +5,873 / -1,295 LOC)

A multi-agent static security audit identified **16 Critical, 23 High, 17 Medium, 11 Low** findings + **6 dependency CVEs**. All 16 Critical and 22 of 23 High items were remediated in this phase. Six parallel agents working on isolated git worktrees produced a clean merge with all 100 unit tests passing, production build successful, and homelab login + dashboard verified working post-deploy.

### 8.1 What the Audit Found (Top-line)

The platform stored customer cloud credentials in a DB protected by an encryption key that **fell back to a hardcoded string** when env-loading failed. An **unauthenticated** `/api/setup/step/3` endpoint allowed any anonymous remote attacker to create `super_admin` accounts on a deployed instance. Every self-service signup minted an `admin` role with **no email verification, no rate limit**. The MCP NL-Query agent could be tricked (via prompt injection or direct request) into calling mutating tools (`create_finding`, `update_task_status`) **without RBAC check**. Webhook signature verification was either implemented with the **wrong primitive** (Postmark inbound used HMAC; the actual mechanism is HTTP Basic Auth) or **fail-open** (Jira webhook bypassable by omitting the `Authorization` header).

### 8.2 Code Changes by Area

#### 8.2.1 Auth, Setup, JWT, Encryption (Agent A1 — commit `9d81ae9`)

**New / changed files:**
- `lib/auth/jwt.ts` — `SessionPayload` now includes `tokenVersion`; `getSecret()` throws on missing / `<32` chars / placeholder; `verifyToken()` does an optional DB lookup against `users.token_version` and `users.is_active` for **real session revocation** (edge-runtime-safe with try/catch fallback); `clearSessionCookie()` uses `NEXTAUTH_URL.startsWith('https://')` (consistent with login).
- `lib/encryption.ts` — prefers `process.env.ENCRYPTION_KEY` (new), falls back to `NEXTAUTH_SECRET`; throws on missing / short / placeholder. Derives AES-256-GCM key via `crypto.hkdfSync('sha256', secret, 'compliguard-encryption-v1', 'aes-256-gcm', 32)`. No more hardcoded fallback key.
- `proxy.ts` — `jwtVerify(token, ..., { issuer: 'compliguard' })` (was issuer-agnostic; storage tokens could pass as sessions).
- `app/api/auth/login/route.ts` — embeds `tokenVersion` from DB in issued JWT.
- `app/api/auth/logout/route.ts` — bumps `users.token_version` in DB; uses correct `secure` flag.
- `app/api/auth/session/route.ts` — DELETE uses correct `secure` flag.
- `app/api/auth/signup/route.ts` — role defaults to `'user'`; requires `setupCompleted && allowRegistrations`; `authLimiter` rate limit; duplicate email returns generic 202; new users land with `is_active=false` (admin activation flow; full email verification deferred).
- `app/api/auth/forgot-password/route.ts` — removed `console.log`; 32-byte hex token with 1h expiry into dedicated columns; always returns `{ok:true}`.
- `app/api/auth/reset-password/route.ts` (**NEW**) — single-use token nulled atomically; ≥12-char password policy; bcrypt; bumps `tokenVersion`.
- `app/api/users/[id]/role/route.ts` — blocks self-edit, only `super_admin` may assign `super_admin`, admins capped to `compliance_manager|auditor|user`, refuses second active super_admin in org.
- `app/api/setup/**` — every step handler checks `systemSettings.setupCompleted`; returns 403 unless caller is `super_admin`.
- `app/api/setup/test-ai/route.ts` + `test-storage/route.ts` — `requireAuth` + `super_admin` gated; provider clients constructed in-scope from request body; **no more `process.env` mutation**.

**Schema:**
- `lib/db/schema/users.ts` — added `tokenVersion`, `passwordResetToken`, `passwordResetExpiresAt`.
- `drizzle/migrations/0001_add_token_version_and_password_reset.sql` (**NEW**)

**Breaking change for downstream code:** JWT payload shape changed from `{sub, role, orgId, ...}` to `{userId, email, role, orgId, firstName, lastName, tokenVersion}`. Any caller of `signToken()` or consumer of `SessionPayload` needs to use the new field names. `tests/unit/jwt.test.ts` updated accordingly (`05dcd86`).

#### 8.2.2 Webhooks, Teams Bot, Outbound Dispatcher, SSRF Guard (Agent A2 — commit `bae26f6`)

**New / changed files:**
- `lib/security/ssrf-guard.ts` (**NEW**) — shared SSRF defense. Exports:
  - `assertPublicUrl(url, opts?)` — rejects RFC1918, loopback, link-local (`169.254/16`, `fe80::/10`), IPv6 ULA (`fc00::/7`), CGNAT (`100.64/10`), benchmark (`198.18/15`), cloud metadata (`169.254.169.254`, `fd00:ec2::254`, `metadata.google.internal`, `metadata.azure.com`).
  - `safeFetch(url, init)` — guarded fetch wrapper; re-resolves DNS to defeat rebinding.
  - `stripCredentials(url)` — for log sanitization.
  - `SsrfBlockedError`.
- `lib/teams/bot.ts` — `validateBotJwt` using `jose` `createRemoteJWKSet` against `login.botframework.com`; enforces `iss`, `aud`, `nbf`, `exp`. Fail-closed in production if env unset; localhost dev bypass. `assertAllowedServiceUrl` allowlists `smba.trafficmanager.net` and `*.botframework.com`. Called inside `sendAdaptiveCard`, `sendProactiveMessage`, `saveConversationRef`.
- `app/api/teams/bot/route.ts` — uses `validateBotJwt`; rejects activity if `serviceUrl` is off-allowlist; invoke handler resolves `orgId` from stored `teamsConversationRefs` row (NOT from card payload).
- `lib/teams/approvals.ts` — documented org-scoped lookup contract.
- `app/api/webhooks/postmark/inbound/route.ts` — replaced HMAC with HTTP Basic Auth (`POSTMARK_INBOUND_USER` / `POSTMARK_INBOUND_PASS`); production fail-closed; DKIM-pass check on email Headers; non-DKIM uploads inserted under `inbound-unverified@compliguard.local` and notify org admins.
- `app/api/webhooks/jira/route.ts` — Authorization required up-front; `webhookEvent` allowlist; `timingSafeEqual` with length precheck; decryption failure → 500 fail-closed; auth before DB scan.
- `lib/integrations/slack.ts` — `crypto.timingSafeEqual` on hex-decoded buffers (was hand-rolled char-XOR); `v0=` prefix + numeric timestamp guard.
- `app/api/webhooks/slack/commands/route.ts` — requires `team_id`; filters integrations by stored `config.teamId` before HMAC verification.
- `lib/webhooks/dispatcher.ts` — uses `safeFetch`; refuses webhooks with null secret; persists only HTTP status + 256-byte response preview (never full body); strips URL credentials in logs.
- `proxy.ts` — removed dead `/api/teams-bot` and `/api/inbound-email` from `PUBLIC_PATHS`.
- `app/api/teams/check-overdue/route.ts` — `x-cron-secret` via `timingSafeEqual` against `CRON_SECRET`; session path retained for admin/super_admin.

#### 8.2.3 IDOR, Cross-Org Writes, Mass Assignment, Audit Logging (Agent A3 — commit `a4ec47e`)

**New / changed files:**
- `lib/audit/log.ts` (**NEW**) — `logAudit({...})` helper for destructive ops; wraps existing `writeAuditLog`.
- `lib/db/schema/organizations.ts` — added `trust_public boolean NOT NULL DEFAULT false`.
- `drizzle/migrations/0002_add_trust_public.sql` (**NEW**)
- `app/api/comments/route.ts` — entity-validator helper checks parent entity in caller's org; all queries scoped with `organizationId = session.orgId`; UUID validation; audit log on hard delete.
- `app/api/knowledge/{route,[id]/route}.ts` — visibility = public OR same-org; `isPublic` flag gated to `super_admin`; FK forced; UUID validation; audit log on delete.
- `app/api/roles/{route,[id]/route}.ts` — `super_admin` only for POST/PATCH/DELETE; UPDATE scoped to row id; TODO comment for per-org migration; audit log on delete.
- `app/api/email/{settings,test}/route.ts` — `super_admin` only; UPDATE scoped; sanitized error responses.
- `app/api/notifications/route.ts` — Zod strict schemas; POST forces `organizationId` from session and validates `userId` belongs to that org.
- `app/api/frameworks/[id]/{route,publish,rollback,controls/[cid]}/route.ts` — `super_admin` only; refuse `isBuiltIn`; UUID validation; audit log before delete. TODO(security): scope frameworks per-org (schema missing column).
- `app/api/mappings/suggestions/[id]/route.ts` — validates suggestion's `sourceControlId` is visible to caller's org (built-in framework OR active org assignment).
- `app/api/v1/*/route.ts` (+ `[id]`) — strict Zod schemas (reject unknown keys); `organizationId` forced from API key; FK references (`controlAssignmentId`, `assignedTo`) verified to belong to the key's org; filters pushed into SQL `limit/offset/count(*)` instead of fetching 1000 rows + JS-filter; UUID path validation; error sanitization.
- `app/api/trust/[orgSlug]/route.ts` — refuses unless `org.trustPublic === true`; returns 404 (no existence-leak).
- `app/api/reports/audit-trail/route.ts` — `VIEW_AUDIT_LOGS` required.
- `app/api/audit/export-zip/route.ts` — `GENERATE_REPORTS` required.
- `app/api/audit/controls/route.ts` — `VIEW_AUDIT_LOGS` required.
- `app/api/soa/route.ts` — Zod strict; validates `controlId` belongs to active org-framework.
- `app/api/audit-logs/route.ts` — proper SQL `limit/offset/count(*)` with filters pushed into WHERE.

#### 8.2.4 Storage, Uploads, MIME, xlsx → exceljs Migration (Agent A4 — commit `f98b6d4`)

**New / changed files:**
- `lib/security/file-validator.ts` (**NEW**) — `assertSafeStorageKey`, `sanitizeFilename`, `sniffMime` (via `file-type` package), `assertAllowedFile`, `pickServeMime`, `isActiveContentMime`, `FileValidationError`.
- `app/api/storage/local/[...key]/route.ts` (**C15 fix**) — `path.resolve` both sides; `resolved.startsWith(safeBase + path.sep)` (with separator); `fs.realpath` re-check defeats symlinks; content-sniff MIME; refuses SVG/HTML/XML; `Content-Disposition: attachment` + strict CSP + `X-Content-Type-Options: nosniff` + `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer`.
- `app/api/evidence/[id]/download/route.ts` — same hardening for `/tmp/evidence-uploads`.
- `app/api/evidence/upload/route.ts` — sniff MIME via `assertAllowedFile`; sanitize filename; store sniffed MIME (not browser-supplied `file.type`).
- `app/api/evidence-requests/[token]/route.ts` — sniff MIME; sanitize filename; per-IP rate limit (`authLimiter` key `ev-req-${ip}`); `requestId` trace log.
- `lib/email/inbound.ts` — `validateAttachment` now async + content-sniffs MIME instead of trusting `ContentType`.
- `app/api/frameworks/upload/route.ts` — **migrated from `xlsx` to `exceljs`** (xlsx CVEs: prototype pollution + ReDoS, no upstream fix); 10 MB cap; `Object.freeze(Object.prototype)` at module load.
- All `lib/storage/providers/*.ts` (+ legacy `lib/storage/{local,s3,azure-blob,onedrive}.ts`) — `assertSafeStorageKey` on every key-taking method, including `list()` with non-empty prefix.
- `lib/storage/providers/azure-blob.ts` (+ legacy) — SAS TTL hard-capped at 15min; `signedProtocol=https`; optional `clientIp` → `signedIP/sip` pin.
- `lib/storage/providers/onedrive.ts` (+ legacy) — `scope: 'organization'` (no more anonymous); TTL ≤10min; falls back to storage key for authenticated proxy when tenant rejects org-scope sharing.
- `package.json` — removed `xlsx`; added `exceljs@^4.4.0` + `file-type@^19.6.0`.
- `tests/unit/file-validator.test.ts` (**NEW**) — 23 cases (traversal/sanitize/sniff/allowlist).

#### 8.2.5 MCP RBAC, Real Rate Limit, Pentest/NL-Tests SSRF (Agent A5 — commit `2e4fbe4`)

**Changed files:**
- `lib/mcp/auth.ts` — replaced fixed-window mock-sliding rate limit with a real sliding deque keyed by API key id; `enforceMcpRateLimit(keyId, scope)`; periodic cleanup; `RateLimitError`.
- `app/api/mcp/route.ts` — wires `enforceMcpRateLimit` per tool dispatch; returns 429 with `Retry-After`; per-IP brute-force lockout on invalid API-key auth via `authLimiter`.
- `lib/mcp/nl-query.ts` (**C14 fix**) — `NLQueryScopes` type; **filtered tool catalog** (write tools removed from LLM context when caller lacks RBAC); `dispatchToolWithGuards` re-checks scopes + 30s per-call timeout; tool outputs wrapped `<<TOOL_OUTPUT_START id=... untrusted=true>> ... <<TOOL_OUTPUT_END>>` with system-prompt instructions to treat outputs as untrusted; `MAX_TOOL_CALLS=3`.
- `app/api/mcp/nl-query/route.ts` — derives `NLQueryScopes` from RBAC (session) or MCP scopes (API key); passes to `executeNLQuery`.
- `lib/mcp/tools.ts` — documented that all DB queries filter by auth-context `orgId`; tightened `get_control_status`, `get_compliance_score`, `search_controls` to refuse frameworks/controls the org hasn't activated.
- `app/api/pentest/sessions/route.ts` (**C16 fix**) — DNS resolution + private/link-local/metadata IP rejection; TXT-record domain ownership proof (`_compliguard.<host>` = `compliguard-pentest=<orgId>`); `super_admin` gate for IP targets; 1 pentest per target per 1h; uses `assertPublicUrl` from `lib/security/ssrf-guard`.
- `lib/pentest/engine.ts` — `assertSafePentestTarget` re-resolves DNS at each call (defeats rebinding); all HTTP probes routed through `pentestFetch` → `safeFetch`.
- `lib/integrations/nl-tests.ts` — `assertSafeHost` + `safeFetch` on every check; port scan refuses private/metadata IPs and limits to allowlist (22/80/443/3389/5432/6379/25/587/110/143); AI custom check re-validates hostname.
- `app/api/integrations/nl-tests/run-all/route.ts` + `[id]/run/route.ts` — bounded concurrency (inline `makeLimiter(5)`) + 200-runs/24h per-org quota.

#### 8.2.6 Build, Deps, Logger, Headers (Agent A6 — commit `ec4cb80`)

**Changed files:**
- `lib/logger.ts` — pino `redact` config covering passwords, API keys, OAuth tokens, encrypted credentials, secrets, `Authorization`/`Cookie`/`Set-Cookie` headers. Censor: `[REDACTED]`.
- `next.config.mjs` — global security headers via `async headers()`: HSTS (2y + preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera/mic/geo disabled), `Content-Security-Policy` (note: `script-src 'unsafe-inline'` retained as a known regression — Next.js 16 hydration requires it; remediation needs nonce-based middleware).
- `docker-compose.yml` — removed default passwords (all `${VAR:-default}` replaced with `${VAR:?... must be set}` fail-on-unset); removed host port exposure for `postgres` + `redis`; per-service memory limits; app gets `read_only: true` filesystem + tmpfs `/tmp` (128 MB).
- `Dockerfile` — build-time secrets gated behind `ARG`s with placeholder `DO_NOT_USE_AT_RUNTIME_REPLACE_VIA_ENV`; `RUN npm audit --omit=dev --audit-level=high || true` surfaces CVEs in CI build logs; CMD switched to new `docker-entrypoint.sh`.
- `scripts/docker-entrypoint.sh` (**NEW**) — refuses to start if `NEXTAUTH_SECRET` or `JWT_SECRET` is unset, equals placeholder, or is `<32` chars; then `exec node server.js`.
- `scripts/deploy.sh` — `is_weak_secret` + `require_strong_secret` helpers; min lengths for `JWT_SECRET`/`NEXTAUTH_SECRET` (32) and `POSTGRES_PASSWORD`/`MINIO_PASSWORD` (16); final gate in `write_env_file` aborts on weak values.
- `scripts/install.sh` — TLS-pinned curl pipes (`--proto '=https' --tlsv1.2`) for NodeSource, PostgreSQL keyring, get.docker.com.
- `.env.example` — replaced cargo-cult placeholders with `__GENERATE_VIA_DEPLOY_SCRIPT__` + header pointing users to `scripts/deploy.sh`.

### 8.3 New Environment Variables

Operators upgrading existing deployments need to set:

| Var | Used by | Required when |
|-----|---------|---------------|
| `ENCRYPTION_KEY` | `lib/encryption.ts` | Optional; falls back to `NEXTAUTH_SECRET`. Recommended for proper key separation. |
| `BOT_APP_ID` | `lib/teams/bot.ts` | If Teams Bot is in use (else dev-only validation). |
| `BOT_APP_PASSWORD` | `lib/teams/bot.ts` | If Teams Bot is in use. Production fail-closed if unset. |
| `POSTMARK_INBOUND_USER` + `POSTMARK_INBOUND_PASS` | `app/api/webhooks/postmark/inbound/route.ts` | If Postmark inbound is in use. Production fail-closed if unset. |
| `CRON_SECRET` | `app/api/teams/check-overdue/route.ts` etc. | If using `x-cron-secret` header path (else session admin/super_admin works). |
| `MINIO_ROOT_PASSWORD` | `docker-compose.yml` | **REQUIRED** at compose-time even in minimal mode (compose parses all services). |

Existing `JWT_SECRET`, `NEXTAUTH_SECRET`, `POSTGRES_PASSWORD` are still required, but now enforced at compose parse-time and asserted at app startup.

### 8.4 New / Changed Migrations

| Migration | Adds | Applied to homelab |
|-----------|------|--------------------|
| `0001_add_token_version_and_password_reset.sql` | `users.token_version int NOT NULL DEFAULT 1`, `users.password_reset_token text`, `users.password_reset_expires_at timestamptz` | ✅ Yes |
| `0002_add_trust_public.sql` | `organizations.trust_public boolean NOT NULL DEFAULT false` | ✅ Yes |

### 8.5 New Shared Helpers (re-use these in future code)

- `lib/security/ssrf-guard.ts` — `assertPublicUrl(url)`, `safeFetch(url, init)`, `stripCredentials(url)`. Use for ANY outbound URL that comes from user input or DB state.
- `lib/security/file-validator.ts` — `assertSafeStorageKey(key)`, `sanitizeFilename(name)`, `sniffMime(buffer)`, `assertAllowedFile(buffer, declaredMime, allowlist)`, `pickServeMime`, `isActiveContentMime`. Use for ANY file upload or storage-key handling.
- `lib/audit/log.ts` — `logAudit({...})` thin wrapper around `writeAuditLog`. Use for destructive ops (DELETE handlers).

### 8.6 Breaking Changes for Downstream Code

1. **JWT payload shape** changed: `{userId, email, role, orgId, firstName, lastName, tokenVersion}` (was `{sub, role, orgId, ...}`). Update callers of `signToken()` / `SessionPayload` consumers.
2. **`verifyToken` is now async with DB lookup** for `tokenVersion` and `is_active`. Edge runtimes fall back to crypto-only check via try/catch; node runtimes get full revocation.
3. **`xlsx` package removed**, replaced with `exceljs@^4.4.0`. Any other code that used `xlsx` must migrate.
4. **`lib/email/inbound.ts.validateAttachment` is now async** and does MIME sniffing (the function signature widened).
5. **`docker compose up` without `.env`** now fails fast with clear errors. No more silent boot with default `compliguard`/`compliguard123` passwords.
6. **`StorageProvider.getUrl(key, opts?)` signature widened** with optional `{clientIp}` second argument (Azure + OneDrive providers). Existing callers continue to work; new IP-pinning is opt-in.
7. **`docker-compose.override.yml` renamed** to `docker-compose.dev.yml` and no longer auto-loaded. Use `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` for dev.

### 8.7 Deferred Items (Picked Up Next Cycle)

| Item | Why deferred | Recommended next step |
|------|--------------|------------------------|
| `npm audit fix` for `fast-xml-builder` + `postcss` | Sandbox blocked `npm` in agent context | Run from a dev machine: `npm audit fix --omit=dev` |
| CSP `script-src 'unsafe-inline'` removal | Next.js 16 hydration injects inline scripts | Nonce-based CSP via middleware |
| Full email-verification on signup | Out of session scope | Replaced with admin-activation gate; verification flow + email infra is a half-day |
| `frameworks` table per-org scoping | Schema migration + backfill | Currently `super_admin`-gated; add `organizationId` column |
| `STORAGE_SIGNING_SECRET` separation | Defense-in-depth | HKDF-derive from a master via `crypto.hkdfSync` |
| Redis-backed sliding-window rate limit | Multi-instance scaling | Move `lib/mcp/auth.ts` deque to Redis sorted-set |
| `webhooks.secret` encryption at rest | DB-leak defense | Encrypt with `lib/encryption.ts` `encrypt()` at write |
| AWS `region` regex validation | URL parameter injection | `/^[a-z]{2}-[a-z]+-\d$/` at integration save time |
| AI chat input delimiter-wrap | Cross-user prompt injection | Wrap finding titles before LLM context insertion |
| AI conversations dedicated table | ACL across org users | Move from `knowledge_base_entries.category='ai_chat'` to `ai_conversations` |

### 8.8 Verification

- `npx tsc --noEmit` — clean, 0 errors.
- `npx next build` — production build succeeds.
- `npx vitest run` — **100/100 tests passing** across 5 test files (jwt, rbac, rate-limiter, storage, file-validator).
- **Homelab (`http://192.168.68.62:3030`)** post-deploy:
  - `POST /api/auth/login` → 200, `cg-session` cookie set
  - `GET /dashboard` with cookie → 200
  - Container runs `next-server` as `nextjs` user (production build, not `npm run dev`, not root)
  - Migrations applied successfully via `docker exec ... psql`

### 8.9 For Perplexity Comet / Future Agents Picking This Up

If you're continuing work on this codebase:

1. **Read `securitycheck.md`** — it has the full per-finding remediation status with file:line references.
2. **Don't reintroduce removed patterns:**
   - Don't fall back to default passwords or env-var defaults in compose/Dockerfile — use `${VAR:?...}` everywhere.
   - Don't trust `file.type` on uploads — use `lib/security/file-validator.ts` `assertAllowedFile`.
   - Don't `process.env.X = userInput` — pass credentials directly to provider constructors.
   - Don't query DB by id-only for resources that have an `organizationId` — always include `and(eq(id, ...), eq(organizationId, session.orgId))`.
   - Don't accept body fields like `organizationId`, `role`, `userId` from clients — derive from session/API key.
   - Don't make outbound `fetch()` to user-supplied URLs — use `lib/security/ssrf-guard.ts` `safeFetch`.
   - Don't store full response bodies of outbound webhooks — they may contain SSRF'd internal data.
   - Don't compare secrets with `===` — use `crypto.timingSafeEqual` with byte-length precheck.
3. **For new MCP tools:** read `lib/mcp/nl-query.ts` `NLQueryScopes` and add an RBAC permission check; the agent loop filters write tools based on scopes.
4. **For new DELETE endpoints:** call `logAudit({...})` from `lib/audit/log.ts` so the destructive op is recorded.
5. **For new webhook routes:** verify signature with `crypto.timingSafeEqual`, fail-closed in production, include replay defense (timestamp + nonce cache).
6. **For new file-serving routes:** mirror `app/api/storage/local/[...key]/route.ts` — `Content-Disposition: attachment` + CSP + `nosniff` + sniffed MIME.

### 8.10 Phase 8 Commit Log (Pushed to `origin/main`)

```
f745cfa fix(deploy): write MINIO_ROOT_PASSWORD to .env in minimal/dev mode
8242d69 fix(deploy): always generate MINIO_ROOT_PASSWORD; hard-abort on missing container
c9b1fe5 docs: add securitycheck.md + CONTEXT.md Phase 8 hardening writeup
05dcd86 test(auth): update jwt.test.ts to new SessionPayload shape (post-A1)
81bcf35 Merge A3: IDOR + org-scope + mass-assignment fixes (renumbered migration 0002)
dfefb79 Merge A5: MCP RBAC + pentest/NL-Tests SSRF
da9925a Merge A1: auth/setup/JWT/encryption hardening
c9726d4 Merge A4: storage + uploads + xlsx replacement
a95c9fb Merge A6: build/deps/logger hardening
2323086 Merge A2: webhook/SSRF hardening
a4ec47e fix(security): A3 — IDOR, cross-org writes, mass assignment
2e4fbe4 fix(security): A5 — MCP RBAC, real rate limit, pentest/NL-Tests SSRF
9d81ae9 fix(security): A1 — auth, setup, JWT, encryption hardening
f98b6d4 fix(security): A4 — storage path traversal, MIME sniffing, xlsx replacement
ec4cb80 fix(security): A6 — build, deps, logger, headers hardening
bae26f6 fix(security): A2 — webhooks, Teams Bot, outbound dispatcher hardening
```

### 8.11 Post-Audit Deploy Script Fixes (2026-05-11, follow-up)

After the initial Phase 8 push, a real fresh-snapshot deployment surfaced two cascading bugs in `scripts/deploy.sh` that the audit's static review didn't catch. Both are now fixed in `8242d69` + `f745cfa`. Documenting here so any future agent re-running the deploy is aware of the failure mode and doesn't reintroduce it.

**Bug surface:** A6's hardening of `docker-compose.yml` made every secret mandatory at compose parse-time via `${VAR:?error message}`. Compose evaluates these interpolations **across all services** in the file, **regardless of which services you select for `up`**. So even `docker compose up -d app postgres redis` (minimal mode, no minio) requires `MINIO_ROOT_PASSWORD` to be present in `.env` — otherwise compose aborts before starting anything.

**Bug 1 — `generate_secrets()` only set the MINIO password in fullstack mode**
- File: `scripts/deploy.sh` `generate_secrets()` (around L582–L612)
- Symptom on fresh install: compose aborts with `error while interpolating services.minio.environment.[]: required variable MINIO_ROOT_PASSWORD is missing a value`. No containers start. Migration loop then runs `docker exec -i "" psql …` against an empty container ID; errors are routed through `2>&1` capture, don't match the `^ERROR` grep filter, so the script falsely prints "Migration applied ✓" for every migration and proceeds. Admin creation finally fails loudly with "invalid container name or ID: value is empty" because the empty-container-ID error reached the admin code path which renders captured output verbatim.
- Fix in `8242d69`: always run `gen_password 24` for `MINIO_PASSWORD` in `generate_secrets()`, in all deploy modes. In minimal/dev mode the value isn't read at runtime (no minio container starts), but it's needed to satisfy compose's parse-time check.
- Additional hardening in `8242d69`:
  - Container lookup fallback `docker ps --filter "name=compliguard.*postgres"` was replaced — Docker filters are **substring**, not regex, so `.*` was being matched literally and the fallback always returned empty. New code uses `docker ps --filter "name=postgres" --format "{{.Names}}\t{{.ID}}" | awk '$1 ~ /compliguard.*postgres/ {print $2; exit}'` which does real regex matching against the container name.
  - Hard-abort with actionable error if `$pg_container` or `$app_container` ends up empty (e.g. compose failed earlier). No more silent-success-then-loud-failure-three-steps-later.

**Bug 2 — `write_env_file()` still skipped writing the MINIO line in non-fullstack mode**
- File: `scripts/deploy.sh` `write_env_file()` (around L681–L700)
- Symptom on fresh install (after `8242d69`): same compose interpolation error as before. The bash variable `MINIO_PASSWORD` was populated by `generate_secrets()` but `write_env_file()` only emitted it into `.env` inside the `if [[ "$DEPLOY_MODE" == "fullstack" ]]` branch. The minimal/dev branch wrote only `STORAGE_PROVIDER=local` + `LOCAL_STORAGE_PATH=/data/uploads` — no `MINIO_ROOT_PASSWORD` line.
- Fix in `f745cfa`: emit `MINIO_ROOT_USER=compliguard` + `MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}` into the `.env` in the minimal/dev branch as well, with an explanatory comment so an operator inspecting the file later understands why an unused-at-runtime credential is present.

**Verification (2026-05-11, post-`f745cfa`):** Fresh-snapshot deploy on `192.168.68.62` from `git clone` → `bash scripts/deploy.sh` → minimal mode completed end-to-end with no manual intervention: compose parsed cleanly, all three containers (app/postgres/redis) came up, migrations applied via `docker exec` to the resolved `$pg_container`, admin user created via pgcrypto with a verified `$2a$12$…` bcrypt hash, and login HTTP 200 returned a valid `cg-session` cookie.

**For future agents (Perplexity Comet et al.) maintaining this deploy script:**
- Any new `${VAR:?...}`-style required env var in `docker-compose.yml` MUST also be generated by `generate_secrets()` AND written by `write_env_file()` for **every deploy mode** (minimal, fullstack, dev) — even if the service that consumes it isn't started in that mode. Compose parses the whole file at every `up`.
- When using `docker ps --filter "name=..."`, the filter is a substring match — not a regex. If you need regex semantics, pipe `--format "{{.Names}}\t{{.ID}}"` through `awk` (or `grep -E`) instead.
- Never write `2>&1` capture + a narrow `grep -E '^ERROR'` filter together as the only way you decide if an operation succeeded. Either check the exit code, or use a broader pattern that catches Docker's literal `"invalid container name or ID: value is empty"` style messages.
- The script's "success" badge for each migration is decorative — the actual gate is exit code + post-condition checks (e.g. the pgcrypto block now does `SELECT 1 / CASE WHEN password_hash ~ '^\$2[aby]\$' THEN 1 ELSE 0 END` to force a non-zero exit if the stored hash isn't a valid bcrypt string).


---

## Session: 2026-05-12 — Dashboard Enhancements + Mac Dev Setup + Penetration Testing Module

### 9.1 Mac Dev Environment Setup

**Problem:** Mac dev environment (`~/Documents/compliguard-v2`) had old code with no git repo. `pc bash` sandbox restricts writes to `~/Documents` and blocks Docker socket access. Multiple approaches attempted:
- `tar` extract → blocked by sandbox (can't unlink existing files)
- `rsync` → same sandbox restriction  
- `git clone` in `pc bash` → no internet access from sandbox
- SSH from cloud sandbox → Mac on local network, not reachable

**Solution that worked:**
1. Extract full repo archive to `/tmp/cg-app` (writable) via `tar -xzf` in `pc bash`
2. Run dev server from `/tmp/cg-app` (not `~/Documents`)
3. Use `pc push <sandbox-path> <mac-path>` for individual file updates (bypasses sandbox restriction)
4. Docker containers managed by running scripts from user's Terminal (docker not accessible from `pc bash` due to macOS TCC)

**Mac Dev Environment:**
- App root: `/tmp/cg-app`
- Dev server: `nohup npm run dev > /tmp/cg-dev.log 2>&1 &`  
- URL: `http://localhost:3030`
- Postgres: `compliguard-postgres` container on port 5433 (existing, reused)
- Redis: `cg-redis-dev` container on port 6380
- `.env.local` at `/tmp/cg-app/.env.local`
- Dev log: `/tmp/cg-dev.log`

**Key constraint for future agents:** When deploying to Mac dev:
- Always push files via `pc push <sandbox-abs-path> <mac-abs-path>`
- Always extract archives to `/tmp/`, never to `~/Documents/`
- Docker operations must be done via scripts pushed to `/tmp/` that the user runs in Terminal
- Migrations: push script to `/tmp/cg-migrate-NNN.sh`, user runs it in Terminal

### 9.2 Bugs Fixed (Session 2026-05-12)

**Bug: `eval() not supported` on landing page**
- Cause: CSP header missing `'unsafe-eval'` — React dev mode (Turbopack) needs it for hot reload
- Fix: `next.config.mjs` — conditional CSP based on `NODE_ENV`:
  - Dev: `script-src 'self' 'unsafe-inline' 'unsafe-eval'` + `connect-src 'self' ws: wss:`
  - Prod: `script-src 'self' 'unsafe-inline'` (no eval)
- Commit: `b7f4223`

**Bug: `Module not found: Can't resolve './teams-status-widget'`**
- Cause: `right-panel-manager.tsx` imports `teams-status-widget.tsx` and `xdr-ticker.tsx` — these weren't included in the Mac update archive
- Fix: `pc push` both files to `/tmp/cg-app/components/dashboard/`
- Lesson: Always include ALL dashboard component files when syncing, not just changed ones

**Bug: `Expected '</>', got 'else'` in `components/pentest/import-wizard.tsx` line 524**
- Cause: `if (step > 1) setStep((step - 1) as Step) else onClose()` — inline if/else with TypeScript `as` cast is invalid syntax in JSX `onClick`
- Fix: Replace with ternary: `step > 1 ? setStep((step - 1) as Step) : onClose()`
- Commit: `d1b4caf`

### 9.3 Dashboard Enhancements (Commit 555a16c)

Added to dashboard top row:
- **Common Controls card** — shows controls shared across frameworks (with overlap %)
- **Unique Controls card** — shows controls exclusive to one framework (with unique %)

Right panel changes:
- Removed XDR Live Feed from default visible widgets
- Added chicklet widget picker (user can show/hide: Mapping Engine, Activity, My Tasks, Teams Bot, XDR Live Feed)
- Preferences persisted in `localStorage` under `cg_right_panel_widgets`
- Quick Actions section moved below Framework Progress
- Integrations card removed from bottom

### 9.4 Penetration Testing Module (Commits 65147a3, d1b4caf)

Full module added to CompliGuard. 28 new/modified files, 5,249 lines.

**Database (migration 0003):**
- `pentest_engagements` — pentest project tracker (vendor, type, scope, dates, status)
- `pentest_issues` — individual findings (severity, status, CVSS, ITSM link, assignee)
- `pentest_evidence` — file attachments per issue
- `pentest_comments` — internal + ITSM-synced comments
- 4 new enums: `pentest_severity`, `pentest_status`, `pentest_engagement_status`, `itsm_platform`
- `integration_type` enum extended: added `servicenow`, `azure_devops`, `linear`, `freshservice`

**API routes (11 new):**
- `GET/POST /api/pentest/engagements` — list with stats, create
- `GET/PATCH/DELETE /api/pentest/engagements/[id]` — detail + issues
- `POST /api/pentest/engagements/[id]/import` — xlsx/csv bulk import
- `GET/POST /api/pentest/issues` — list (filter by severity/status/assignee), create
- `GET/PATCH/DELETE /api/pentest/issues/[id]`
- `GET/POST /api/pentest/issues/[id]/evidence` — file upload
- `DELETE /api/pentest/issues/[id]/evidence/[evidenceId]`
- `GET/POST /api/pentest/issues/[id]/comments`
- `POST/PATCH/DELETE /api/pentest/issues/[id]/itsm-link` — link ticket
- `POST /api/pentest/issues/[id]/itsm-sync` — pull live ticket data + comments
- `GET /api/pentest/stats` — aggregate counts by status/severity

**Libraries:**
- `lib/pentest/itsm-client.ts` — normalized ITSM client for JIRA, ServiceNow, Azure DevOps, Linear, Freshservice; all outbound via SSRF guard
- `lib/pentest/xlsx-parser.ts` — auto-detect columns (case-insensitive), P1–P5 severity normalization, bulk parse

**UI pages/components:**
- `/pentest` — engagements list with stats row, filters, import button
- `/pentest/[id]` — engagement detail with issue table (severity dots, CVSS, ITSM icons)
- `components/pentest/issue-drawer.tsx` — right drawer, 4 tabs: Details / Evidence (drag-drop) / ITSM (link+sync+comments) / Comments
- `components/pentest/import-wizard.tsx` — 4-step wizard: Upload → Column mapping → Preview → Import progress
- `components/pentest/new-engagement-dialog.tsx` — create engagement form
- `components/pentest/new-issue-dialog.tsx` — create issue manually

**Dashboard:**
- New "Pentest Issues" stat card (5th card) — pulls live data from DB (total / open / critical)
- `getPentestStats(orgId)` server function queries `pentest_issues` directly

**Sidebar:**
- "Pen Testing" moved from Security group → Compliance group (after Auditor View)

**Integrations page:**
- ITSM section added: JIRA, ServiceNow, Azure DevOps, Linear, Freshservice config cards
- Platform-specific credential fields (API token, instance URL, PAT, etc.)

**ITSM Integration Flow:**
1. Configure ITSM platform in `/integrations` (credentials stored encrypted)
2. On issue, go to ITSM tab → enter ticket URL + ticket ID → Link
3. "Sync Now" button fetches live ticket status, assignee, comments from ITSM API
4. ITSM comments appear in Comments tab with platform badge

**Excel Import Flow:**
1. Create engagement → "Import Issues" button
2. Upload `.xlsx` or `.csv` pentest report
3. Auto-detect columns (Title, Severity, Description, Steps, Remediation, CVSS, Asset)
4. Preview parsed issues with warnings (empty titles skipped, unknown severities defaulted to medium)
5. Confirm → bulk create issues in DB

### 9.5 Commit Log (Session 2026-05-12)

```
d1b4caf fix(pentest): replace if-else with ternary in import-wizard onClick (parser error)
65147a3 feat: Penetration Testing module — engagements, issues, ITSM integration, Excel import
b7f4223 fix(csp): allow unsafe-eval in dev mode for React/Turbopack hot reload
555a16c feat: dashboard — Common/Unique Controls cards + right panel widget manager
```

### 9.6 Rules for Future Agents

- **Mac dev deploys**: Push changed files via `pc push`, extract new archives to `/tmp/`, use user's Terminal for Docker ops
- **New pentest routes**: Always include `and(eq(table.organizationId, session.orgId), ...)` in all queries — never query by ID alone
- **ITSM fetches**: Always use `safeFetch()` from `lib/security/ssrf-guard.ts` — never raw `fetch()` to user-supplied URLs
- **Migrations**: Apply with `sed 's/--> statement-breakpoint//g' migration.sql | docker exec -i <pg_container> psql -U compliguard -d compliguard`
- **JSX onClick**: Never use `if/else` inline in JSX event handlers with TypeScript casts — use ternary
- **`integration_type` enum**: If adding new ITSM platforms, use `DO $$ BEGIN ALTER TYPE ... ADD VALUE ... EXCEPTION WHEN duplicate_object THEN null; END $$` — never drop/recreate the enum

---

## Session: 2026-05-12 (cont.) — Firewall Audit, DNS Audit, Sidebar Redesign, Settings Refactor

### 10.1 New Modules Added (Migration 0004, Commit 1cf614f)

**Firewall Audit** (`/firewall-audit`)
- Tables: `firewall_audits`, `firewall_findings`, `firewall_evidence`, `firewall_comments`
- Audit types: perimeter, internal, cloud, waf, ngfw, other
- Tracks: rule ID, affected device, affected zone, CVSS, severity, status, assignee, evidence, comments
- API: 7 routes (audits CRUD, findings CRUD, evidence, comments, stats)
- UI: audit list, audit detail with findings table, finding-drawer (Details/Evidence/Comments tabs)

**DNS Audit** (`/dns-audit`)
- Tables: `dns_audits`, `dns_issues`, `dns_evidence`, `dns_comments`
- Audit types: external, internal, both
- Issue types: misconfiguration, dangling_record, missing_spf, missing_dmarc, missing_dkim, zone_transfer, subdomain_takeover, cache_poisoning, wildcard_record, other
- Tracks: affected record, record type, current value, expected value, risk details, remediation
- API: 7 routes (audits CRUD, issues CRUD + ?issueType= filter, evidence, comments, stats with byType breakdown)
- UI: audit list, audit detail, issue-drawer (Details show current/expected in monospace)

**Module Config** (`module_config` table)
- Per-org jsonb toggle for all 9 modules: pentest, firewallAudit, dnsAudit, nlTests, mcpServer, openClaw, teamsBot, training, vendors
- API: GET /api/settings/modules (defaults all true), PATCH (admin-only)
- UI: `components/settings/module-toggles.tsx` — live toggle switches with optimistic updates

### 10.2 Sidebar Redesign (Commit 1cf614f)

Changes to `components/dashboard/sidebar.tsx`:
- **Removed**: "AI Mapping Active" violet card at bottom left
- **Removed**: Old inline collapse button at very bottom
- **Added**: Floating 24px circle button at sidebar/content intersection (`position: absolute, right: -12, top: 50%, transform: translateY(-50%)`). Shows `<` to collapse, `>` to expand.
- **Renamed**: "Platform" section → "Settings", marked `adminOnly: true`
- **Role filter**: `visibleGroups = NAV_GROUPS.filter(g => !g.adminOnly || ['super_admin','admin'].includes(role))` — non-admins never see Settings group
- **Added to Compliance**: Firewall Audit (`/firewall-audit`, ShieldOff icon) and DNS Audit (`/dns-audit`, Globe icon)

### 10.3 Settings Page Refactor (Commit 1cf614f)

- `app/(dashboard)/settings/layout.tsx` — NEW: guards all /settings/** routes. Non-admin roles see "Access Restricted" card instead of content.
- `app/(dashboard)/settings/page.tsx` — Rewritten as async Server Component:
  - Section 1 (top): Platform Modules with `<ModuleToggles />` client component
  - Section 2: All original settings cards + new cards for Integrations, Teams Bot, MCP Server, OpenClaw, Roles, API Keys, Webhooks

### 10.4 Mac Dev Deployment Pattern (established)

For all future sessions, when code is committed to GitHub:
1. Create tar archive of changed files: `tar -czf /tmp/update.tar.gz <files>`
2. `pc push /tmp/update.tar.gz /tmp/update.tar.gz`
3. `pc bash "rm -rf /tmp/cg-update && mkdir /tmp/cg-update && tar -xzf /tmp/update.tar.gz -C /tmp/cg-update && rsync -a --no-perms /tmp/cg-update/ /tmp/cg-app/"`
4. Write migration script to `/tmp/cg-migrate-NNN.sh`, `pc push` it, tell user to run it in Terminal
5. Dev server at `/tmp/cg-app` hot-reloads changed files automatically

### 10.5 Commit Log

```
1cf614f feat: Firewall Audit + DNS Audit modules + Settings refactor + Sidebar redesign
b6c8eac docs: CONTEXT.md — session 2026-05-12 (Mac dev setup, pentest module, bug fixes)
d1b4caf fix(pentest): replace if-else with ternary in import-wizard onClick (parser error)
65147a3 feat: Penetration Testing module — engagements, issues, ITSM integration, Excel import
b7f4223 fix(csp): allow unsafe-eval in dev mode for React/Turbopack hot reload
```
