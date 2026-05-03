import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, pgEnum } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const vendorRiskLevelEnum = pgEnum('vendor_risk_level', ['low', 'medium', 'high', 'critical'])
export const vendorStatusEnum = pgEnum('vendor_status', ['active', 'inactive', 'under_review', 'terminated'])
export const questionnaireStatusEnum = pgEnum('questionnaire_status', ['draft', 'sent', 'in_progress', 'completed', 'expired'])

export const vendors = pgTable('vendors', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  website: varchar('website', { length: 500 }),
  contactName: varchar('contact_name', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  category: varchar('category', { length: 100 }),
  description: text('description'),
  status: vendorStatusEnum('status').notNull().default('active'),
  inherentRiskLevel: vendorRiskLevelEnum('inherent_risk_level'),
  residualRiskLevel: vendorRiskLevelEnum('residual_risk_level'),
  riskScore: integer('risk_score'), // 0-100
  dpaStatus: varchar('dpa_status', { length: 50 }), // signed | pending | not_required
  dpaSignedAt: timestamp('dpa_signed_at', { withTimezone: true }),
  nextReviewDate: timestamp('next_review_date', { withTimezone: true }),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const vendorRiskAssessments = pgTable('vendor_risk_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  assessmentDate: timestamp('assessment_date', { withTimezone: true }).defaultNow(),
  inherentScore: integer('inherent_score'),
  residualScore: integer('residual_score'),
  findings: text('findings'),
  recommendations: text('recommendations'),
  conductedBy: uuid('conducted_by').references(() => users.id, { onDelete: 'set null' }),
  nextAssessmentDate: timestamp('next_assessment_date', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const questionnaires = pgTable('questionnaires', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: questionnaireStatusEnum('status').notNull().default('draft'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const questionnaireQuestions = pgTable('questionnaire_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionnaireId: uuid('questionnaire_id').notNull().references(() => questionnaires.id, { onDelete: 'cascade' }),
  questionText: text('question_text').notNull(),
  questionType: varchar('question_type', { length: 50 }).notNull(), // text | yes_no | multiple_choice | file_upload | rating
  options: jsonb('options'), // for multiple_choice
  isRequired: integer('is_required').default(1),
  orderIndex: integer('order_index').default(0),
  category: varchar('category', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const questionnaireResponses = pgTable('questionnaire_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionnaireId: uuid('questionnaire_id').notNull().references(() => questionnaires.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questionnaireQuestions.id, { onDelete: 'cascade' }),
  responseText: text('response_text'),
  responseData: jsonb('response_data'),
  respondentEmail: varchar('respondent_email', { length: 255 }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Vendor = typeof vendors.$inferSelect
export type NewVendor = typeof vendors.$inferInsert
