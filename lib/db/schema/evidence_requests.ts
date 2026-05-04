import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const evidenceRequests = pgTable('evidence_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  controlId: uuid('control_id'),
  requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  recipientName: varchar('recipient_name', { length: 255 }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  token: varchar('token', { length: 255 }).notNull().unique(),
  isUsed: boolean('is_used').default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  evidenceId: uuid('evidence_id'),  // filled when evidence is uploaded
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type EvidenceRequest = typeof evidenceRequests.$inferSelect
export type NewEvidenceRequest = typeof evidenceRequests.$inferInsert
