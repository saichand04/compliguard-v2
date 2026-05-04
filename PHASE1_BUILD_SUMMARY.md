# Phase 1 Build Summary — Controls Mapping Engine

> **Build date:** 2026-05-03  
> **Status:** ✅ PASS — zero TypeScript errors

---

## Architecture Implemented

4-layer Controls Mapping Engine as specified in CONTEXT.md:

1. **Canonical Store** — `canonical_controls` table, NIST 800-53 Rev 5 as the universal anchor. Every control from every framework resolves to a `nistId`.
2. **Mapping Graph** — `control_mappings` table (extended) with bidirectional edges: sourceControlId ↔ targetControlId, confidence (0–100), mappingType (direct/partial/related/inferred), source (builtin/scf/ai/user), isUserOverride.
3. **Evidence Inheritance** — `evidence_inheritance` table tracks propagation chains. When evidence is attached to one control, all mapped controls receive it (tracked with `inheritanceDepth`).
4. **AI Engine** — `mapping_suggestions` table + `_aiSuggestMappings()` placeholder in `MappingEngine` class. Returns empty in Phase 1; wired to LLM in Phase 2.

### Critical Rules Enforced

- **HITRUST Rule:** HITRUST IDs (`09.ab.01`) encode ISO 27001 sections structurally. The `hitrust-decoder.ts` decodes domain → ISO clause → NIST family, but never equates HITRUST IDs to ISO 27001 clauses directly. Resolution always routes through NIST canonical anchor.
- **ARC-AMPE Rule:** `normalizeControlId()` in `MappingEngine` handles HITRUST and ARC-AMPE separately. Same NIST substance ≠ same string. Matching is done by `canonicalNistId`, not string comparison.
- **SCF Rule:** SCF crosswalk is seeded once to `mapping_rules`, marked `source: 'scf'`, and never editable by users. User overrides set `isOverride: true` and always win.

---

## Files Created

### Database Schema

| File | Description |
|------|-------------|
| `lib/db/schema/mapping_engine.ts` | **NEW** — 5 new tables: `canonical_controls`, `mapping_rules`, `evidence_inheritance`, `framework_uploads`, `mapping_suggestions` |
| `lib/db/schema/frameworks.ts` | **MODIFIED** — Added `mappingType`, `source`, `isUserOverride`, `canonicalNistId`, `updatedAt` columns to `controlMappings`. Added `controlMappingTypeEnum` and `controlMappingSourceEnum`. |
| `lib/db/schema/index.ts` | **MODIFIED** — Added `export * from './mapping_engine'` |

### Schema Tables Added

| Table | Purpose |
|-------|---------|
| `canonical_controls` | NIST 800-53 Rev 5 master list. Universal anchor for all framework controls. |
| `mapping_rules` | Static SCF crosswalk + user overrides. `frameworkControlId → nistId` lookup. |
| `evidence_inheritance` | Tracks evidence propagation across mapped controls. |
| `framework_uploads` | Tracks user-uploaded framework files (CSV/JSON/XLSX) with processing status. |
| `mapping_suggestions` | AI/SCF-suggested mappings pending human review. |

### Mapping Engine Library

| File | Description |
|------|-------------|
| `lib/mapping-engine/index.ts` | **NEW** — `MappingEngine` class with all 6 methods + singleton export |
| `lib/mapping-engine/hitrust-decoder.ts` | **NEW** — Full HITRUST domain table (domains 00–11), `decodeHitrustId()`, `normalizeToCanonical()`, `isHitrustId()` |
| `lib/mapping-engine/scf-crosswalk.ts` | **NEW** — ~70 SCF entries across 10 domains (GOV/RSK/IAC/CRY/NET/END/IRM/BCR/CHG/AST), with `lookupByNistId()`, `lookupByScfId()`, `lookupByNistFamily()` |
| `lib/mapping-engine/framework-normalizer.ts` | **NEW** — `normalizeFrameworkUpload()`, `detectFramework()`, `validateControls()`, CSV/JSON parsers, 8 framework auto-detection patterns |

#### MappingEngine Methods
- `resolveCanonical(frameworkSlug, controlId)` → `ResolvedCanonical`
- `getCrossFrameworkMappings(controlId)` → `MappedControl[]`
- `getEvidenceInheritanceChain(evidenceId)` → `EvidenceInheritanceChain[]`
- `suggestMappings(controlId)` → `MappingSuggestionResult[]`
- `decodeHitrustId(hitrustId)` → `DecodedHitrustId | null`
- `normalizeControlId(frameworkSlug, rawId)` → `string`

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/mappings` | GET | List mappings for a framework or specific control |
| `/api/mappings` | POST | Create user crosswalk override (sets `isUserOverride: true`) |
| `/api/mappings/[controlId]` | GET | Cross-framework mappings for one control + canonical resolution |
| `/api/frameworks/upload` | POST | Accept CSV/JSON, parse, normalize, return preview + store upload record |
| `/api/controls` | GET | List controls (existing, unchanged) |
| `/api/controls/[id]` | GET | Single control + all mappings + canonical + HITRUST decode + suggestions |

### UI Pages

| Page | Route | Description |
|------|-------|-------------|
| Controls Library | `/controls` | 3-column: framework list (left) → controls list (middle) → mapping panel (right). Confidence-coded mapping display. |
| Mapping Explorer | `/mappings` | Visual crosswalk table. Rows = NIST 800-53 controls, columns = target frameworks (HITRUST, ISO 27001, SOC 2, PCI DSS, CMMC). Cells color-coded: green ≥80% / yellow 50–79% / orange 20–49% / empty = no mapping. |
| Framework Upload | `/frameworks/upload` | Drag-and-drop CSV/JSON upload, progress indicator, parsed preview table with NIST family hints, import confirmation. |

### Navigation

`components/dashboard/sidebar.tsx` — Added **Controls** group with 3 items:
- Controls Library → `/controls`
- Mapping Explorer → `/mappings`
- Upload Framework → `/frameworks/upload`

### Seed Files

| File | Description |
|------|-------------|
| `seed/seed-scf.ts` | **NEW** — Seeds SCF crosswalk into `mapping_rules`. Upserts by scfId+nistId. Accepts external `db` instance or creates standalone connection. |
| `seed/seed.ts` | **MODIFIED** — Imports `seedScfCrosswalk` and calls it after `seedFrameworks()`, passing the existing `db` instance. |

---

## TypeScript Check

```
npx tsc --noEmit
```

**Result: PASS — 0 errors, 0 warnings**

One error was found and fixed during the check:
- `app/(dashboard)/frameworks/upload/page.tsx` — missing `GitBranch` import from lucide-react (added)

---

## Design System Compliance

All UI pages follow the specified design system:
- Background: `#080B18`, glass cards: `rgba(255,255,255,0.04)` + `backdrop-blur`
- Accent violet: `#8B5CF6`, accent cyan: `#06B6D4`
- `glass-card`, `btn-primary`, `btn-ghost`, `btn-icon` classes used throughout
- Confidence color coding: `--emerald` ≥80%, `#FBBF24` 50–79%, `#F97316` 20–49%, `--text-muted` none
- `animate-fade-in`, `animate-fade-up` animations applied
- Inter font for body, consistent with existing pages

---

## Notes for Phase 2

- `_aiSuggestMappings()` in `MappingEngine` is a stub — wire to LLM provider
- `framework_uploads` XLSX parsing returns 422 asking for CSV conversion — integrate a server-side xlsx library (e.g. `xlsx`) in Phase 2
- `canonical_controls` table is empty until seeded with NIST 800-53 Rev 5 data — add a `seed-nist.ts` script in Phase 2
- `evidence_inheritance` records are created manually for now — add auto-propagation trigger on evidence insert in Phase 2
