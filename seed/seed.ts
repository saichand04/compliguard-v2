/**
 * CompliGuard v2 — Database Seeder
 * Seeds frameworks and their controls from JSON files.
 * Safe to run multiple times (upserts by slug).
 */

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { eq } from "drizzle-orm"
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

import { frameworks } from "../lib/db/schema/frameworks"
import { systemSettings } from "../lib/db/schema/system_settings"

// ── Bootstrap ────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("ERROR: DATABASE_URL environment variable is not set")
  process.exit(1)
}

const client = postgres(connectionString, { max: 1 })
const db = drizzle(client)

// ── Types ─────────────────────────────────────────────────
interface FrameworkControl {
  ref: string
  title: string
  description: string
  category: string
  weight?: number
}

interface FrameworkJson {
  id: string
  name: string
  slug: string
  version: string
  description: string
  authority: string
  category: string
  website: string
  logo_url: string | null
  is_active: boolean
  controls: FrameworkControl[]
}

// ── Helpers ───────────────────────────────────────────────
function loadFrameworkFiles(): FrameworkJson[] {
  const frameworksDir = join(__dirname, "frameworks")
  const files = readdirSync(frameworksDir).filter((f) => f.endsWith(".json"))

  return files.map((file) => {
    const raw = readFileSync(join(frameworksDir, file), "utf-8")
    return JSON.parse(raw) as FrameworkJson
  })
}

function log(msg: string) {
  console.log(`[seed] ${new Date().toISOString()} — ${msg}`)
}

// ── Seed Functions ────────────────────────────────────────
async function seedFrameworks(frameworkData: FrameworkJson[]): Promise<void> {
  log(`Seeding ${frameworkData.length} frameworks...`)

  for (const fw of frameworkData) {
    try {
      // Check if framework already exists
      const existing = await db
        .select({ id: frameworks.id })
        .from(frameworks)
        .where(eq(frameworks.slug, fw.slug))
        .limit(1)

      if (existing.length > 0) {
        // Update existing framework
        await db
          .update(frameworks)
          .set({
            name: fw.name,
            version: fw.version,
            description: fw.description,
            authority: fw.authority,
            category: fw.category as "security" | "privacy" | "financial" | "healthcare" | "government" | "industry" | "custom",
            website: fw.website,
            logoUrl: fw.logo_url,
            isActive: fw.is_active,
            controls: fw.controls,
            updatedAt: new Date(),
          })
          .where(eq(frameworks.slug, fw.slug))
        log(`  ↻ Updated: ${fw.name} (${fw.controls.length} controls)`)
      } else {
        // Insert new framework
        await db.insert(frameworks).values({
          name: fw.name,
          slug: fw.slug,
          version: fw.version,
          description: fw.description,
          authority: fw.authority,
          category: fw.category as "security" | "privacy" | "financial" | "healthcare" | "government" | "industry" | "custom",
          website: fw.website,
          logoUrl: fw.logo_url,
          isActive: fw.is_active,
          controls: fw.controls,
          isBuiltIn: true,
        })
        log(`  ✓ Inserted: ${fw.name} (${fw.controls.length} controls)`)
      }
    } catch (err) {
      console.error(`  ✗ Failed to seed framework '${fw.name}':`, err)
      throw err
    }
  }
}

async function seedSystemSettings(): Promise<void> {
  log("Seeding system settings defaults...")

  try {
    // system_settings is a single-row config table (not key-value)
    const existing = await db
      .select({ id: systemSettings.id })
      .from(systemSettings)
      .limit(1)

    if (existing.length === 0) {
      await db.insert(systemSettings).values({
        setupCompleted: false,
        setupStep: 0,
        platformName: "CompliGuard",
        deploymentType: "docker",
        storageProvider: "local",
        aiProvider: "openai",
        allowRegistrations: false,
        maintenanceMode: false,
        version: "2.0.0",
      })
      log("  ✓ System settings row inserted")
    } else {
      log("  - System settings row already exists, skipped")
    }
  } catch (err) {
    console.error("  ✗ Failed to seed system settings:", err)
    // Non-fatal — continue
  }
}

// ── Main ──────────────────────────────────────────────────
async function main(): Promise<void> {
  log("Starting CompliGuard v2 database seed...")
  console.time("seed-duration")

  try {
    // Load framework data from JSON files
    const frameworkData = loadFrameworkFiles()
    log(`Found ${frameworkData.length} framework files`)

    // Seed in order
    await seedSystemSettings()
    await seedFrameworks(frameworkData)

    console.timeEnd("seed-duration")
    log("Seed complete!")

    const stats = {
      frameworks: frameworkData.length,
      controls: frameworkData.reduce((sum, fw) => sum + fw.controls.length, 0),
    }
    log(`Summary: ${stats.frameworks} frameworks, ${stats.controls} total controls`)
  } catch (err) {
    console.error("[seed] Fatal error:", err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
