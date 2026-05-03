import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const controlStatusEnum = pgEnum('control_status', [
  'not_started',
  'in_progress',
  'implemented',
  'needs_review',
  'not_applicable',
])

export const soaStatusEnum = pgEnum('soa_status', ['included', 'excluded', 'partial'])

export const frameworks = pgTable('frameworks', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  shortName: varchar('short_name', { length: 50 }),
  version: varchar('version', { length: 50 }),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  regulatoryBody: varchar('regulatory_body', { length: 255 }),
  isBuiltIn: boolean('is_built_in').default(false),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const controls = pgTable('controls', {
  id: uuid('id').defaultRandom().primaryKey(),
  frameworkId: uuid('framework_id').notNull().references(() => frameworks.id, { onDelete: 'cascade' }),
  controlId: varchar('control_id', { length: 100 }), // e.g., CC6.1, A.9.1
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  guidance: text('guidance'),
  category: varchar('category', { length: 255 }),
  subcategory: varchar('subcategory', { length: 255 }),
  testProcedure: text('test_procedure'),
  remediation: text('remediation'),
  isRequired: boolean('is_required').default(true),
  weight: integer('weight').default(1),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const organizationFrameworks = pgTable('organization_frameworks', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  frameworkId: uuid('framework_id').notNull().references(() => frameworks.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  targetDate: timestamp('target_date', { withTimezone: true }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const controlAssignments = pgTable('control_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  controlId: uuid('control_id').notNull().references(() => controls.id, { onDelete: 'cascade' }),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  status: controlStatusEnum('status').notNull().default('not_started'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const controlMappings = pgTable('control_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceControlId: uuid('source_control_id').notNull().references(() => controls.id, { onDelete: 'cascade' }),
  targetControlId: uuid('target_control_id').notNull().references(() => controls.id, { onDelete: 'cascade' }),
  mappingRationale: text('mapping_rationale'),
  confidence: integer('confidence').default(0), // 0-100
  mappedByAi: boolean('mapped_by_ai').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const soaEntries = pgTable('soa_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  controlId: uuid('control_id').notNull().references(() => controls.id, { onDelete: 'cascade' }),
  status: soaStatusEnum('status').notNull().default('included'),
  justification: text('justification'),
  implementationStatus: text('implementation_status'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Framework = typeof frameworks.$inferSelect
export type NewFramework = typeof frameworks.$inferInsert
export type Control = typeof controls.$inferSelect
export type NewControl = typeof controls.$inferInsert
export type ControlAssignment = typeof controlAssignments.$inferSelect
export type NewControlAssignment = typeof controlAssignments.$inferInsert
