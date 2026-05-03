import { pgTable, uuid, varchar, text, timestamp, jsonb, pgEnum, boolean } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const findingSeverityEnum = pgEnum('finding_severity', ['info', 'low', 'medium', 'high', 'critical'])
export const findingStatusEnum = pgEnum('finding_status', ['open', 'in_remediation', 'resolved', 'accepted', 'false_positive'])
export const findingSourceEnum = pgEnum('finding_source', ['aws', 'azure', 'gcp', 'github', 'pentest', 'manual', 'nl_test', 'integration'])

export const findings = pgTable('findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  severity: findingSeverityEnum('severity').notNull().default('medium'),
  status: findingStatusEnum('status').notNull().default('open'),
  source: findingSourceEnum('source').notNull().default('manual'),
  resourceType: varchar('resource_type', { length: 100 }),
  resourceId: varchar('resource_id', { length: 500 }),
  affectedAsset: varchar('affected_asset', { length: 500 }),
  cveId: varchar('cve_id', { length: 50 }),
  remediationGuidance: text('remediation_guidance'),
  remediationSteps: text('remediation_steps'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
  acceptanceRationale: text('acceptance_rationale'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  rawData: jsonb('raw_data'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const findingTemplates = pgTable('finding_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  severity: findingSeverityEnum('severity').notNull().default('medium'),
  source: findingSourceEnum('source').default('manual'),
  remediationGuidance: text('remediation_guidance'),
  isBuiltIn: boolean('is_built_in').default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Finding = typeof findings.$inferSelect
export type NewFinding = typeof findings.$inferInsert
