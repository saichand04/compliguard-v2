import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, integer } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'

export const userRoleEnum = pgEnum('user_role', ['super_admin', 'admin', 'compliance_manager', 'auditor', 'user'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  inviteToken: text('invite_token'),
  inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
  oauthProvider: varchar('oauth_provider', { length: 50 }),
  oauthId: text('oauth_id'),
  // Monotonically-increasing version used to invalidate previously-issued JWTs
  // (bumped on logout, deactivation, password change, etc.).
  tokenVersion: integer('token_version').notNull().default(1),
  // Single-use password reset token + expiry (set by /api/auth/forgot-password,
  // consumed by /api/auth/reset-password).
  passwordResetToken: text('password_reset_token'),
  passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
