# CompliGuard v2 — Project Context

**Last Updated**: 2026-05-03 — Phase 2 launched  
**Status**: Phase 2 — Operational Backbone (in progress)  
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
- `docker-compose.override.yml` — dev overrides
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
