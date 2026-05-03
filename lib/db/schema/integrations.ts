import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const integrationTypeEnum = pgEnum('integration_type', [
  'aws',
  'azure',
  'gcp',
  'github',
  'google_workspace',
  'jumpcloud',
  'rippling',
  'slack',
  'jira',
  'vercel',
])

export const integrationStatusEnum = pgEnum('integration_status', ['active', 'inactive', 'error', 'pending'])

export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  type: integrationTypeEnum('type').notNull(),
  name: varchar('name', { length: 255 }),
  status: integrationStatusEnum('status').notNull().default('inactive'),
  config: jsonb('config'), // non-sensitive config (regions, resource IDs, etc.)
  encryptedCredentials: text('encrypted_credentials'), // AES-encrypted JSON of API keys/secrets
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  nextSyncAt: timestamp('next_sync_at', { withTimezone: true }),
  syncSchedule: varchar('sync_schedule', { length: 100 }), // cron expression
  errorMessage: text('error_message'),
  configuredBy: uuid('configured_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const integrationScanResults = pgTable('integration_scan_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  integrationId: uuid('integration_id').notNull().references(() => integrations.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  scanType: varchar('scan_type', { length: 100 }),
  totalChecks: uuid('total_checks'), // count of checks run
  passed: text('passed'),           // count passed
  failed: text('failed'),           // count failed
  rawResults: jsonb('raw_results'),
  summary: jsonb('summary'),
  scannedAt: timestamp('scanned_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const nlTests = pgTable('nl_tests', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 500 }).notNull(),
  query: text('query').notNull(), // "check if SSL is enabled on api.acme.com"
  schedule: varchar('schedule', { length: 100 }), // cron
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const nlTestResults = pgTable('nl_test_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  testId: uuid('test_id').notNull().references(() => nlTests.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  passed: boolean('passed'),
  output: text('output'),
  rawData: jsonb('raw_data'),
  duration: text('duration'), // ms as string
  ranAt: timestamp('ran_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Integration = typeof integrations.$inferSelect
export type NewIntegration = typeof integrations.$inferInsert
