import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const firewallAuditSeverityEnum = pgEnum('firewall_audit_severity', [
  'info',
  'low',
  'medium',
  'high',
  'critical',
])

export const firewallAuditStatusEnum = pgEnum('firewall_audit_status', [
  'open',
  'in_progress',
  'remediated',
  'accepted',
  'false_positive',
])

export const firewallAuditTypeEnum = pgEnum('firewall_audit_type', [
  'perimeter',
  'internal',
  'cloud',
  'waf',
  'ngfw',
  'other',
])

// ─── Tables ───────────────────────────────────────────────────────────────────

/**
 * Firewall Audits — top-level audit records (one per firewall audit)
 */
export const firewallAudits = pgTable('firewall_audits', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 500 }).notNull(),
  auditType: firewallAuditTypeEnum('audit_type').notNull().default('perimeter'),
  vendor: varchar('vendor', { length: 255 }), // e.g. Palo Alto, Fortinet, Cisco
  deviceName: varchar('device_name', { length: 255 }),
  scope: text('scope'),
  auditDate: timestamp('audit_date', { withTimezone: true }),
  auditorName: varchar('auditor_name', { length: 255 }),
  status: firewallAuditStatusEnum('status').notNull().default('open'),
  reportFileUrl: text('report_file_url'),
  reportFileName: text('report_file_name'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Firewall Findings — individual findings within an audit
 */
export const firewallFindings = pgTable('firewall_findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  auditId: uuid('audit_id')
    .notNull()
    .references(() => firewallAudits.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  severity: firewallAuditSeverityEnum('severity').notNull().default('medium'),
  status: firewallAuditStatusEnum('status').notNull().default('open'),
  ruleId: varchar('rule_id', { length: 255 }), // firewall rule reference
  affectedDevice: varchar('affected_device', { length: 255 }),
  affectedZone: varchar('affected_zone', { length: 255 }),
  riskDetails: text('risk_details'),
  remediation: text('remediation'),
  cvssScore: varchar('cvss_score', { length: 10 }),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Firewall Evidence — file attachments for individual findings
 */
export const firewallEvidence = pgTable('firewall_evidence', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  findingId: uuid('finding_id')
    .notNull()
    .references(() => firewallFindings.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull().default('other'),
  fileSizeBytes: integer('file_size_bytes'),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Firewall Comments — comments on individual findings
 */
export const firewallComments = pgTable('firewall_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  findingId: uuid('finding_id')
    .notNull()
    .references(() => firewallFindings.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  authorName: varchar('author_name', { length: 255 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type FirewallAudit = typeof firewallAudits.$inferSelect
export type NewFirewallAudit = typeof firewallAudits.$inferInsert

export type FirewallFinding = typeof firewallFindings.$inferSelect
export type NewFirewallFinding = typeof firewallFindings.$inferInsert

export type FirewallEvidence = typeof firewallEvidence.$inferSelect
export type NewFirewallEvidence = typeof firewallEvidence.$inferInsert

export type FirewallComment = typeof firewallComments.$inferSelect
export type NewFirewallComment = typeof firewallComments.$inferInsert
