import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const apiKeyStatusEnum = pgEnum('api_key_status', ['active', 'revoked', 'expired'])
export const webhookStatusEnum = pgEnum('webhook_status', ['active', 'inactive', 'failing'])
export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', ['pending', 'delivered', 'failed', 'retrying'])

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: text('key_hash').notNull().unique(), // SHA-256 hash of the actual key
  keyPrefix: varchar('key_prefix', { length: 20 }), // first 8 chars for display
  scopes: jsonb('scopes'), // array of allowed scopes
  status: apiKeyStatusEnum('status').notNull().default('active'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const mcpApiKeys = pgTable('mcp_api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 20 }),
  permissions: jsonb('permissions'), // array of MCP tool permissions
  status: apiKeyStatusEnum('status').notNull().default('active'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const webhooks = pgTable('webhooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull(),
  secret: text('secret'), // HMAC signing secret
  events: jsonb('events').notNull(), // array of event types to listen to
  status: webhookStatusEnum('status').notNull().default('active'),
  consecutiveFailures: text('consecutive_failures').default('0'),
  lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  webhookId: uuid('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 200 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: webhookDeliveryStatusEnum('status').notNull().default('pending'),
  responseStatus: text('response_status'),
  responseBody: text('response_body'),
  attempts: text('attempts').default('0'),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ApiKey = typeof apiKeys.$inferSelect
export type Webhook = typeof webhooks.$inferSelect
