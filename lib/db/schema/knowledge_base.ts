import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const knowledgeBaseEntries = pgTable('knowledge_base_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  category: varchar('category', { length: 100 }),
  tags: jsonb('tags'), // array of strings
  embedding: jsonb('embedding'), // vector stored as jsonb until pgvector is set up
  isPublic: boolean('is_public').default(false),
  isBuiltIn: boolean('is_built_in').default(false),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const secrets = pgTable('secrets', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  encryptedValue: text('encrypted_value').notNull(), // AES-256-GCM encrypted
  category: varchar('category', { length: 100 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const setupWizardState = pgTable('setup_wizard_state', {
  id: uuid('id').defaultRandom().primaryKey(),
  step: varchar('step', { length: 100 }).notNull().unique(),
  completed: boolean('completed').default(false),
  skipped: boolean('skipped').default(false),
  data: jsonb('data'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const frameworkVersions = pgTable('framework_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  frameworkId: uuid('framework_id').notNull(), // references frameworks
  version: varchar('version', { length: 50 }).notNull(),
  changelog: text('changelog'),
  publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  snapshotData: jsonb('snapshot_data'), // full framework + controls snapshot
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const frameworkTemplates = pgTable('framework_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  shortName: varchar('short_name', { length: 50 }),
  version: varchar('version', { length: 50 }),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  regulatoryBody: varchar('regulatory_body', { length: 255 }),
  isActive: boolean('is_active').default(true),
  controlCount: text('control_count'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const controlTemplates = pgTable('control_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  frameworkTemplateId: uuid('framework_template_id').references(() => frameworkTemplates.id, { onDelete: 'cascade' }),
  controlId: varchar('control_id', { length: 100 }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  guidance: text('guidance'),
  category: varchar('category', { length: 255 }),
  testProcedure: text('test_procedure'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const customRoles = pgTable('custom_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const customRolePermissions = pgTable('custom_role_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  roleId: uuid('role_id').notNull().references(() => customRoles.id, { onDelete: 'cascade' }),
  permission: varchar('permission', { length: 200 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type KnowledgeBaseEntry = typeof knowledgeBaseEntries.$inferSelect
export type Secret = typeof secrets.$inferSelect
export type CustomRole = typeof customRoles.$inferSelect
