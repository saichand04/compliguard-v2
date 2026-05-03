import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'
import { controlAssignments } from './frameworks'

export const evidenceTypeEnum = pgEnum('evidence_type', [
  'screenshot',
  'document',
  'log',
  'automated',
  'text',
  'video',
  'configuration',
])

export const evidenceStatusEnum = pgEnum('evidence_status', [
  'pending',
  'approved',
  'rejected',
  'expired',
])

export const evidence = pgTable('evidence', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  controlAssignmentId: uuid('control_assignment_id').references(() => controlAssignments.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  evidenceType: evidenceTypeEnum('evidence_type').notNull(),
  // Storage abstraction columns — not a direct URL
  storageProvider: varchar('storage_provider', { length: 20 }), // local | s3 | azure-blob | onedrive | minio
  storageKey: text('storage_key'),                              // relative key within the provider
  storageBucket: varchar('storage_bucket', { length: 255 }),   // bucket/container at time of upload
  fileName: varchar('file_name', { length: 500 }),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 100 }),
  textContent: text('text_content'),                           // for text evidence type
  status: evidenceStatusEnum('status').notNull().default('pending'),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  collectedViaEmail: boolean('collected_via_email').default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const evidenceForms = pgTable('evidence_forms', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  controlId: uuid('control_id'), // references controls, nullable
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  fields: jsonb('fields').notNull(), // array of form field definitions
  isTemplate: boolean('is_template').default(false),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const evidenceUploadTokens = pgTable('evidence_upload_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  token: text('token').notNull().unique(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  controlAssignmentId: uuid('control_assignment_id').notNull().references(() => controlAssignments.id, { onDelete: 'cascade' }),
  requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  isUsed: boolean('is_used').default(false),
  usedAt: timestamp('used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Evidence = typeof evidence.$inferSelect
export type NewEvidence = typeof evidence.$inferInsert
export type EvidenceForm = typeof evidenceForms.$inferSelect
export type EvidenceUploadToken = typeof evidenceUploadTokens.$inferSelect
