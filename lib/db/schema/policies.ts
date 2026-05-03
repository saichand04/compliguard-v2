import { pgTable, uuid, varchar, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const policyStatusEnum = pgEnum('policy_status', ['draft', 'review', 'approved', 'archived'])

export const policies = pgTable('policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  content: text('content'),
  version: varchar('version', { length: 50 }).default('1.0'),
  status: policyStatusEnum('status').notNull().default('draft'),
  category: varchar('category', { length: 100 }),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  effectiveDate: timestamp('effective_date', { withTimezone: true }),
  reviewDate: timestamp('review_date', { withTimezone: true }),
  expiryDate: timestamp('expiry_date', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  // Storage reference for policy document file
  storageProvider: varchar('storage_provider', { length: 20 }),
  storageKey: text('storage_key'),
  storageBucket: varchar('storage_bucket', { length: 255 }),
  fileName: varchar('file_name', { length: 500 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Policy = typeof policies.$inferSelect
export type NewPolicy = typeof policies.$inferInsert
