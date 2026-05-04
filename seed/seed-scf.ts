/**
 * CompliGuard v2 — SCF Crosswalk Seeder
 *
 * Seeds the Secure Controls Framework (SCF) crosswalk into the mapping_rules table.
 * Safe to run multiple times — upserts by scfId + nistId combination.
 * SCF data is static and never user-editable.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, and } from 'drizzle-orm'
import { mappingRules } from '../lib/db/schema/mapping_engine'
import { SCF_CROSSWALK } from '../lib/mapping-engine/scf-crosswalk'

// ── Bootstrap (standalone run only) ──────────────────────────────────────────
let _standaloneClient: ReturnType<typeof postgres> | null = null
let _standaloneDb: PostgresJsDatabase | null = null

function getStandaloneDb() {
  if (!_standaloneDb) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      console.error('ERROR: DATABASE_URL environment variable is not set')
      process.exit(1)
    }
    _standaloneClient = postgres(connectionString, { max: 1 })
    _standaloneDb = drizzle(_standaloneClient)
  }
  return _standaloneDb
}

function log(msg: string) {
  console.log(`[seed-scf] ${new Date().toISOString()} — ${msg}`)
}

// ── Main seeder ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedScfCrosswalk(externalDb?: any): Promise<void> {
  // Accept an external db instance (from seed.ts) or create a standalone one
  const db = externalDb ?? getStandaloneDb()
  log(`Seeding ${SCF_CROSSWALK.length} SCF crosswalk entries...`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbInstance: any = db
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const entry of SCF_CROSSWALK) {
    try {
      // Check if this SCF → NIST pair already exists
      const existing = await dbInstance
        .select({ id: mappingRules.id })
        .from(mappingRules)
        .where(
          and(
            eq(mappingRules.scfId, entry.scfId),
            eq(mappingRules.nistId, entry.nistId)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        // Update if anything changed
        await dbInstance
          .update(mappingRules)
          .set({
            mappingType: entry.mappingType,
            confidence: entry.confidence,
            notes: entry.notes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(mappingRules.id, existing[0].id))
        updated++
      } else {
        await dbInstance.insert(mappingRules).values({
          scfId: entry.scfId,
          nistId: entry.nistId,
          mappingType: entry.mappingType,
          confidence: entry.confidence,
          source: 'scf',
          isOverride: false,
          notes: entry.notes ?? null,
        })
        inserted++
      }
    } catch (err) {
      console.error(`  ✗ Failed to seed SCF entry ${entry.scfId} → ${entry.nistId}:`, err)
      skipped++
    }
  }

  log(`SCF crosswalk seed complete: ${inserted} inserted, ${updated} updated, ${skipped} failed`)
}

// ── Standalone run ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('Starting SCF crosswalk seed...')
  console.time('scf-seed-duration')

  try {
    await seedScfCrosswalk()
    console.timeEnd('scf-seed-duration')
  } catch (err) {
    console.error('[seed-scf] Fatal error:', err)
    process.exit(1)
  } finally {
    await closeStandaloneConnection()
  }
}

// ── Standalone cleanup ────────────────────────────────────────────────────────
export async function closeStandaloneConnection(): Promise<void> {
  if (_standaloneClient) {
    await _standaloneClient.end()
    _standaloneClient = null
    _standaloneDb = null
  }
}

// Only run main() when this file is executed directly
if (process.argv[1]?.includes('seed-scf')) {
  main()
}
