import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const trainingModules = pgTable('training_modules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  content: text('content'),
  contentType: varchar('content_type', { length: 50 }).default('text'), // text | video | scorm | quiz
  estimatedMinutes: integer('estimated_minutes'),
  passingScore: integer('passing_score').default(80),
  isRequired: boolean('is_required').default(false),
  isActive: boolean('is_active').default(true),
  isBuiltIn: boolean('is_built_in').default(false),
  storageKey: text('storage_key'),
  metadata: jsonb('metadata'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const trainingCompletions = pgTable('training_completions', {
  id: uuid('id').defaultRandom().primaryKey(),
  moduleId: uuid('module_id').notNull().references(() => trainingModules.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  score: integer('score'),
  passed: boolean('passed'),
  attemptCount: integer('attempt_count').default(0),
  certificateKey: text('certificate_key'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const backgroundChecks = pgTable('background_checks', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  candidateName: varchar('candidate_name', { length: 255 }).notNull(),
  candidateEmail: varchar('candidate_email', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  provider: varchar('provider', { length: 100 }),
  externalId: varchar('external_id', { length: 255 }),
  reportUrl: text('report_url'),
  requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type TrainingModule = typeof trainingModules.$inferSelect
export type TrainingCompletion = typeof trainingCompletions.$inferSelect
