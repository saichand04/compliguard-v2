import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }),
  industry: varchar('industry', { length: 100 }),
  size: varchar('size', { length: 50 }),
  logoUrl: text('logo_url'),
  slug: varchar('slug', { length: 255 }).unique(),
  trustPortalEnabled: boolean('trust_portal_enabled').default(false),
  trustPortalCustomDomain: varchar('trust_portal_custom_domain', { length: 255 }),
  // Opt-in flag for the public Trust Portal. Defaults to false so newly created
  // orgs are NOT publicly visible at /api/trust/[slug] until an admin enables it.
  trustPublic: boolean('trust_public').notNull().default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
