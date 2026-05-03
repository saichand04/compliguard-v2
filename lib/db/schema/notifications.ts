import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const notificationTypeEnum = pgEnum('notification_type', [
  'control_overdue',
  'evidence_rejected',
  'evidence_approved',
  'evidence_request',
  'new_finding',
  'policy_expiry',
  'task_assigned',
  'task_overdue',
  'risk_identified',
  'vendor_review_due',
  'system',
  'mention',
  'invite',
])

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  body: text('body'),
  link: varchar('link', { length: 1000 }),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(), // control | evidence | risk | policy | task | vendor
  entityId: uuid('entity_id').notNull(),
  parentCommentId: uuid('parent_comment_id'), // for threads
  isEdited: boolean('is_edited').default(false),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const commentMentions = pgTable('comment_mentions', {
  id: uuid('id').defaultRandom().primaryKey(),
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  mentionedUserId: uuid('mentioned_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  notified: boolean('notified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
