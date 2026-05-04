/**
 * CompliGuard v2 — Controls Mapping Engine Schema
 * Phase 1: Canonical Store, Mapping Graph, Evidence Inheritance, AI Engine hooks
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { controls } from './frameworks'
import { organizations } from './organizations'
import { users } from './users'

// ── Enums ─────────────────────────────────────────────────────────────────────

export const mappingTypeEnum = pgEnum('mapping_type', [
  'direct',    // 1:1 semantic equivalence
  'partial',   // substantial overlap, not identical
  'related',   // meaningful relationship, different intent
  'inferred',  // derived via NIST canonical anchor
])

export const mappingSourceEnum = pgEnum('mapping_source', [
  'builtin',  // shipped with CompliGuard
  'scf',      // derived from Secure Controls Framework crosswalk
  'ai',       // suggested by AI engine
  'user',     // manually created/overridden by user
])

export const suggestionStatusEnum = pgEnum('suggestion_status', [
  'pending',
  'accepted',
  'rejected',
])

export const uploadStatusEnum = pgEnum('upload_status', [
  'pending',
  'processing',
  'complete',
  'failed',
])

export const fileTypeEnum = pgEnum('file_type', ['csv', 'json', 'xlsx'])

// ── canonical_controls ────────────────────────────────────────────────────────
// NIST 800-53 Rev 5 as the universal anchor.
// Every control from every framework gets a canonicalId pointing here.

export const canonicalControls = pgTable('canonical_controls', {
  id: uuid('id').defaultRandom().primaryKey(),
  nistId: varchar('nist_id', { length: 50 }).notNull().unique(), // e.g. "AC-1", "AC-1(1)"
  family: varchar('family', { length: 10 }).notNull(),           // e.g. "AC"
  familyName: varchar('family_name', { length: 100 }),           // e.g. "Access Control"
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  supplementalGuidance: text('supplemental_guidance'),
  isEnhancement: boolean('is_enhancement').default(false),       // true for AC-1(1) style
  parentNistId: varchar('parent_nist_id', { length: 50 }),       // AC-1 for AC-1(1)
  priority: varchar('priority', { length: 10 }),                  // P1, P2, P3
  baselineImpact: varchar('baseline_impact', { length: 50 }),    // LOW, MODERATE, HIGH
  relatedControls: text('related_controls'),                      // comma-separated nist IDs
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── mapping_rules ─────────────────────────────────────────────────────────────
// Static SCF crosswalk + user overrides.
// This is the lookup table: frameworkControlId → NIST canonical ID.

export const mappingRules = pgTable('mapping_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  // SCF identifier (e.g. "IAC-01", "CRY-03.1")
  scfId: varchar('scf_id', { length: 100 }),
  // NIST 800-53 Rev 5 target (e.g. "AC-1")
  nistId: varchar('nist_id', { length: 50 }).notNull(),
  // Source framework this rule applies to (null = applies to all)
  frameworkId: uuid('framework_id'),
  // The raw control ID in the source framework (e.g. "09.ab.01" for HITRUST)
  frameworkControlId: varchar('framework_control_id', { length: 200 }),
  mappingType: mappingTypeEnum('mapping_type').notNull().default('direct'),
  confidence: integer('confidence').default(80), // 0-100
  source: mappingSourceEnum('source').notNull().default('scf'),
  // User overrides beat all other sources
  isOverride: boolean('is_override').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── evidence_inheritance ──────────────────────────────────────────────────────
// When evidence is attached to one control, it auto-populates all mapped controls.
// This table tracks the propagation chain.

export const evidenceInheritance = pgTable('evidence_inheritance', {
  id: uuid('id').defaultRandom().primaryKey(),
  evidenceId: uuid('evidence_id').notNull(),               // references evidence.id (avoid circular import)
  sourceControlId: uuid('source_control_id')
    .notNull()
    .references(() => controls.id, { onDelete: 'cascade' }),
  inheritedControlId: uuid('inherited_control_id')
    .notNull()
    .references(() => controls.id, { onDelete: 'cascade' }),
  // The mapping that established this inheritance
  mappingId: uuid('mapping_id'),                            // references control_mappings enhanced
  inheritanceDepth: integer('inheritance_depth').default(1), // 1 = direct, 2 = via one hop
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── framework_uploads ─────────────────────────────────────────────────────────
// Tracks user-uploaded framework files (CSV, JSON, XLSX).

export const frameworkUploads = pgTable('framework_uploads', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 500 }).notNull(),
  originalFilename: varchar('original_filename', { length: 500 }),
  fileType: fileTypeEnum('file_type').notNull(),
  status: uploadStatusEnum('status').notNull().default('pending'),
  totalControls: integer('total_controls').default(0),
  mappedControls: integer('mapped_controls').default(0),
  unmappedControls: integer('unmapped_controls').default(0),
  // ID of the framework created from this upload (set after processing)
  resultFrameworkId: uuid('result_framework_id'),
  errorMessage: text('error_message'),
  uploadedBy: uuid('uploaded_by')
    .references(() => users.id, { onDelete: 'set null' }),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── mapping_suggestions ───────────────────────────────────────────────────────
// AI-suggested or SCF-derived mappings pending human review.

export const mappingSuggestions = pgTable('mapping_suggestions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceControlId: uuid('source_control_id')
    .notNull()
    .references(() => controls.id, { onDelete: 'cascade' }),
  targetControlId: uuid('target_control_id')
    .notNull()
    .references(() => controls.id, { onDelete: 'cascade' }),
  confidence: integer('confidence').notNull().default(0), // 0-100
  rationale: text('rationale'),
  suggestedBy: varchar('suggested_by', { length: 10 }).notNull().default('scf'), // 'ai' | 'scf'
  status: suggestionStatusEnum('status').notNull().default('pending'),
  reviewedBy: uuid('reviewed_by')
    .references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  // Once accepted, this becomes the control_mapping ID
  resolvedMappingId: uuid('resolved_mapping_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── Type exports ──────────────────────────────────────────────────────────────

export type CanonicalControl = typeof canonicalControls.$inferSelect
export type NewCanonicalControl = typeof canonicalControls.$inferInsert
export type MappingRule = typeof mappingRules.$inferSelect
export type NewMappingRule = typeof mappingRules.$inferInsert
export type EvidenceInheritance = typeof evidenceInheritance.$inferSelect
export type NewEvidenceInheritance = typeof evidenceInheritance.$inferInsert
export type FrameworkUpload = typeof frameworkUploads.$inferSelect
export type NewFrameworkUpload = typeof frameworkUploads.$inferInsert
export type MappingSuggestion = typeof mappingSuggestions.$inferSelect
export type NewMappingSuggestion = typeof mappingSuggestions.$inferInsert
