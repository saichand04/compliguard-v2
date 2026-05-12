import { pgTable, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'

// ─── Module Config ─────────────────────────────────────────────────────────────

/**
 * Module Config — per-org feature toggle configuration
 * Stores which modules are enabled/disabled for each organization.
 */
export const moduleConfig = pgTable('module_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  modules: jsonb('modules').$type<{
    pentest?: boolean
    firewallAudit?: boolean
    dnsAudit?: boolean
    nlTests?: boolean
    mcpServer?: boolean
    openClaw?: boolean
    teamsBot?: boolean
    training?: boolean
    vendors?: boolean
  }>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModuleConfig = typeof moduleConfig.$inferSelect
export type NewModuleConfig = typeof moduleConfig.$inferInsert

export type ModuleToggles = {
  pentest: boolean
  firewallAudit: boolean
  dnsAudit: boolean
  nlTests: boolean
  mcpServer: boolean
  openClaw: boolean
  teamsBot: boolean
  training: boolean
  vendors: boolean
}

export const DEFAULT_MODULE_TOGGLES: ModuleToggles = {
  pentest: true,
  firewallAudit: true,
  dnsAudit: true,
  nlTests: true,
  mcpServer: true,
  openClaw: true,
  teamsBot: true,
  training: true,
  vendors: true,
}
