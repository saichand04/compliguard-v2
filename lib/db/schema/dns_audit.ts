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

export const dnsAuditSeverityEnum = pgEnum('dns_audit_severity', [
  'info',
  'low',
  'medium',
  'high',
  'critical',
])

export const dnsAuditStatusEnum = pgEnum('dns_audit_status', [
  'open',
  'in_progress',
  'remediated',
  'accepted',
  'false_positive',
])

export const dnsAuditTypeEnum = pgEnum('dns_audit_type', [
  'external',
  'internal',
  'both',
])

export const dnsIssueTypeEnum = pgEnum('dns_issue_type', [
  'misconfiguration',
  'dangling_record',
  'missing_spf',
  'missing_dmarc',
  'missing_dkim',
  'zone_transfer',
  'subdomain_takeover',
  'cache_poisoning',
  'wildcard_record',
  'other',
])

// ─── Tables ───────────────────────────────────────────────────────────────────

/**
 * DNS Audits — top-level audit records
 */
export const dnsAudits = pgTable('dns_audits', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 500 }).notNull(),
  auditType: dnsAuditTypeEnum('audit_type').notNull().default('both'),
  domain: varchar('domain', { length: 255 }), // primary domain audited
  scope: text('scope'),
  auditDate: timestamp('audit_date', { withTimezone: true }),
  auditorName: varchar('auditor_name', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull().default('active'), // active / completed / archived
  reportFileUrl: text('report_file_url'),
  reportFileName: text('report_file_name'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * DNS Issues — individual issues within an audit
 */
export const dnsIssues = pgTable('dns_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  auditId: uuid('audit_id')
    .notNull()
    .references(() => dnsAudits.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  severity: dnsAuditSeverityEnum('severity').notNull().default('medium'),
  status: dnsAuditStatusEnum('status').notNull().default('open'),
  issueType: dnsIssueTypeEnum('issue_type').notNull().default('misconfiguration'),
  affectedRecord: varchar('affected_record', { length: 500 }), // e.g. "subdomain.example.com A 1.2.3.4"
  recordType: varchar('record_type', { length: 50 }), // A, AAAA, CNAME, MX, TXT, NS, PTR, etc.
  affectedDomain: varchar('affected_domain', { length: 255 }),
  currentValue: text('current_value'),
  expectedValue: text('expected_value'),
  riskDetails: text('risk_details'),
  remediation: text('remediation'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * DNS Evidence — file attachments for individual issues
 */
export const dnsEvidence = pgTable('dns_evidence', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  issueId: uuid('issue_id')
    .notNull()
    .references(() => dnsIssues.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull().default('other'),
  fileSizeBytes: integer('file_size_bytes'),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * DNS Comments — comments on individual issues
 */
export const dnsComments = pgTable('dns_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  issueId: uuid('issue_id')
    .notNull()
    .references(() => dnsIssues.id, { onDelete: 'cascade' }),
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

export type DnsAudit = typeof dnsAudits.$inferSelect
export type NewDnsAudit = typeof dnsAudits.$inferInsert

export type DnsIssue = typeof dnsIssues.$inferSelect
export type NewDnsIssue = typeof dnsIssues.$inferInsert

export type DnsEvidence = typeof dnsEvidence.$inferSelect
export type NewDnsEvidence = typeof dnsEvidence.$inferInsert

export type DnsComment = typeof dnsComments.$inferSelect
export type NewDnsComment = typeof dnsComments.$inferInsert
