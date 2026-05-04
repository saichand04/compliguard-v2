/**
 * lib/integrations/store.ts
 * Helper to get/save integration config with encryption.
 */

import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt, decrypt } from '@/lib/encryption'

// Valid integration types per schema enum
type IntegrationType =
  | 'aws'
  | 'azure'
  | 'gcp'
  | 'github'
  | 'google_workspace'
  | 'jumpcloud'
  | 'rippling'
  | 'slack'
  | 'jira'
  | 'vercel'

/**
 * Retrieve decrypted integration config for an org + type.
 * Returns null if no integration exists.
 */
export async function getIntegrationConfig(
  orgId: string,
  type: string,
): Promise<Record<string, string> | null> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, type as IntegrationType),
      ),
    )
    .limit(1)

  if (!row) return null

  const result: Record<string, string> = {}

  // Merge non-sensitive config
  if (row.config && typeof row.config === 'object') {
    for (const [k, v] of Object.entries(row.config as Record<string, unknown>)) {
      if (typeof v === 'string') result[k] = v
    }
  }

  // Merge decrypted credentials
  if (row.encryptedCredentials) {
    try {
      const decrypted = decrypt(row.encryptedCredentials)
      const parsed = JSON.parse(decrypted) as Record<string, unknown>
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') result[k] = v
      }
    } catch {
      // Ignore decryption errors — credentials may be malformed
    }
  }

  return result
}

/**
 * Save integration config, encrypting credential keys.
 * Returns the integration id.
 *
 * @param orgId           Organization UUID
 * @param type            Integration type (e.g. 'github', 'aws')
 * @param name            Display name
 * @param config          Full config map (plain values)
 * @param credentialKeys  Keys within config to encrypt before storing
 */
export async function saveIntegrationConfig(
  orgId: string,
  type: string,
  name: string,
  config: Record<string, string>,
  credentialKeys: string[],
): Promise<string> {
  // Split config into public and credential parts
  const publicConfig: Record<string, string> = {}
  const credentials: Record<string, string> = {}

  for (const [k, v] of Object.entries(config)) {
    if (credentialKeys.includes(k)) {
      credentials[k] = v
    } else {
      publicConfig[k] = v
    }
  }

  // Encrypt the credentials object as a JSON string
  const encryptedCredentials = encrypt(JSON.stringify(credentials))

  // Check if integration already exists
  const [existing] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, type as IntegrationType),
      ),
    )
    .limit(1)

  if (existing) {
    // Update existing
    await db
      .update(integrations)
      .set({
        name,
        status: 'active',
        config: publicConfig as unknown as Record<string, unknown>,
        encryptedCredentials,
        updatedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(integrations.id, existing.id))

    return existing.id
  }

  // Insert new
  const [inserted] = await db
    .insert(integrations)
    .values({
      organizationId: orgId,
      type: type as IntegrationType,
      name,
      status: 'active',
      config: publicConfig as unknown as Record<string, unknown>,
      encryptedCredentials,
    })
    .returning({ id: integrations.id })

  return inserted.id
}

/**
 * Get full integration row (including status, lastSyncAt, etc.)
 */
export async function getIntegrationRow(orgId: string, type: string) {
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, type as IntegrationType),
      ),
    )
    .limit(1)

  return row ?? null
}

/**
 * Delete an integration by org + type.
 */
export async function deleteIntegration(orgId: string, type: string): Promise<void> {
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, type as IntegrationType),
      ),
    )
}
