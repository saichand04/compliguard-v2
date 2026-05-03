import { pgTable, uuid, varchar, text, timestamp, jsonb, inet } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 200 }).notNull(), // e.g., 'evidence.upload', 'control.status_change'
  resourceType: varchar('resource_type', { length: 100 }), // evidence | control | policy | user | etc.
  resourceId: uuid('resource_id'),
  resourceTitle: varchar('resource_title', { length: 500 }),
  description: text('description'),
  before: jsonb('before'),   // state before change
  after: jsonb('after'),     // state after change
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
