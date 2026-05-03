import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const teamsConversationRefs = pgTable('teams_conversation_refs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  conversationRef: jsonb('conversation_ref').notNull(), // full ConversationReference object from Teams SDK
  serviceUrl: text('service_url').notNull(),
  tenantId: text('tenant_id'),
  teamsUserId: text('teams_user_id'),
  channelId: text('channel_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type TeamsConversationRef = typeof teamsConversationRefs.$inferSelect
export type NewTeamsConversationRef = typeof teamsConversationRefs.$inferInsert
