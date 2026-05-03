import { pgTable, uuid, text, boolean, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  setupCompleted: boolean('setup_completed').notNull().default(false),
  setupStep: integer('setup_step').notNull().default(0),
  platformName: text('platform_name').default('CompliGuard'),
  deploymentType: text('deployment_type').default('docker'), // docker | linux | cloud
  storageProvider: text('storage_provider').default('local'),
  emailProvider: text('email_provider'),
  emailFrom: text('email_from'),
  aiProvider: text('ai_provider').default('openai'),
  aiModel: text('ai_model'),
  maintenanceMode: boolean('maintenance_mode').default(false),
  allowRegistrations: boolean('allow_registrations').default(false),
  version: text('version').default('2.0.0'),
  extraConfig: jsonb('extra_config'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type SystemSettings = typeof systemSettings.$inferSelect
export type NewSystemSettings = typeof systemSettings.$inferInsert
