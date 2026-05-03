import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const riskSeverityEnum = pgEnum('risk_severity', ['low', 'medium', 'high', 'critical'])
export const riskStatusEnum = pgEnum('risk_status', ['identified', 'mitigating', 'mitigated', 'accepted', 'transferred'])

export const riskAssessments = pgTable('risk_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  asset: varchar('asset', { length: 500 }),
  threat: text('threat'),
  vulnerability: text('vulnerability'),
  // Inherent risk
  inherentLikelihood: integer('inherent_likelihood'), // 1-5
  inherentImpact: integer('inherent_impact'),         // 1-5
  inherentScore: integer('inherent_score'),           // likelihood * impact
  // Residual risk (after controls)
  residualLikelihood: integer('residual_likelihood'),
  residualImpact: integer('residual_impact'),
  residualScore: integer('residual_score'),
  severity: riskSeverityEnum('severity'),
  status: riskStatusEnum('status').notNull().default('identified'),
  mitigationPlan: text('mitigation_plan'),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  reviewDate: timestamp('review_date', { withTimezone: true }),
  acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptanceRationale: text('acceptance_rationale'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type RiskAssessment = typeof riskAssessments.$inferSelect
export type NewRiskAssessment = typeof riskAssessments.$inferInsert
