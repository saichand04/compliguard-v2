import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const orgChartNodes = pgTable('org_chart_nodes', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  parentId: uuid('parent_id'), // self-referential, FK handled at app level
  name: varchar('name', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }),
  department: varchar('department', { length: 255 }),
  email: varchar('email', { length: 255 }),
  avatarUrl: text('avatar_url'),
  metadata: jsonb('metadata'),
  orderIndex: integer('order_index').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const timelines = pgTable('timelines', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  frameworkId: uuid('framework_id'),
  isTemplate: boolean('is_template').default(false),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const timelinePhases = pgTable('timeline_phases', {
  id: uuid('id').defaultRandom().primaryKey(),
  timelineId: uuid('timeline_id').notNull().references(() => timelines.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('pending'),
  orderIndex: integer('order_index').default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const contextHub = pgTable('context_hub', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }).unique(),
  techStack: jsonb('tech_stack'),           // array of technology items
  businessProcesses: text('business_processes'),
  riskTolerance: varchar('risk_tolerance', { length: 50 }), // low | medium | high
  complianceGoals: jsonb('compliance_goals'),
  keyAssets: jsonb('key_assets'),
  threatActors: jsonb('threat_actors'),
  regulatoryContext: text('regulatory_context'),
  additionalContext: text('additional_context'),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type OrgChartNode = typeof orgChartNodes.$inferSelect
export type Timeline = typeof timelines.$inferSelect
export type ContextHub = typeof contextHub.$inferSelect
