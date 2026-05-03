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
          isBuiltin: true,
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

  const defaultSettings = [
    {
      key: "app.setup_complete",
      value: "false",
      type: "boolean" as const,
      group: "setup",
      label: "Setup Complete",
      description: "Whether the initial setup wizard has been completed",
      isPublic: false,
      isEditable: false,
    },
    {
      key: "app.setup_step",
      value: "0",
      type: "number" as const,
      group: "setup",
      label: "Setup Step",
      description: "Current step of the setup wizard (0 = not started, 9 = complete)",
      isPublic: false,
      isEditable: false,
    },
    {
      key: "app.name",
      value: "CompliGuard",
      type: "string" as const,
      group: "general",
      label: "Application Name",
      description: "Display name for this CompliGuard installation",
      isPublic: true,
      isEditable: true,
    },
    {
      key: "app.tagline",
      value: "AI-powered GRC Compliance Platform",
      type: "string" as const,
      group: "general",
      label: "Application Tagline",
      description: "Short tagline displayed on login and public pages",
      isPublic: true,
      isEditable: true,
    },
    {
      key: "security.session_timeout_minutes",
      value: "480",
      type: "number" as const,
      group: "security",
      label: "Session Timeout (minutes)",
      description: "How long before an inactive session expires (default: 8 hours)",
      isPublic: false,
      isEditable: true,
    },
    {
      key: "security.max_login_attempts",
      value: "5",
      type: "number" as const,
      group: "security",
      label: "Max Login Attempts",
      description: "Number of failed login attempts before account lockout",
      isPublic: false,
      isEditable: true,
    },
    {
      key: "security.lockout_duration_minutes",
      value: "15",
      type: "number" as const,
      group: "security",
      label: "Lockout Duration (minutes)",
      description: "How long an account is locked after too many failed attempts",
      isPublic: false,
      isEditable: true,
    },
    {
      key: "security.require_mfa",
      value: "false",
      type: "boolean" as const,
      group: "security",
      label: "Require MFA",
      description: "Whether to require multi-factor authentication for all users",
      isPublic: false,
      isEditable: true,
    },
    {
      key: "registration.allow_public",
      value: "false",
      type: "boolean" as const,
      group: "registration",
      label: "Allow Public Registration",
      description: "Whether new users can register without an invitation",
      isPublic: true,
      isEditable: true,
    },
    {
      key: "registration.require_email_verification",
      value: "true",
      type: "boolean" as const,
      group: "registration",
      label: "Require Email Verification",
      description: "Whether new accounts must verify their email address",
      isPublic: false,
      isEditable: true,
    },
    {
      key: "ai.provider",
      value: "openai",
      type: "string" as const,
      group: "ai",
      label: "AI Provider",
      description: "Primary AI provider for risk scoring and evidence analysis (openai | azure-openai | none)",
      isPublic: false,
      isEditable: true,
    },
    {
      key: "ai.enabled",
      value: "false",
      type: "boolean" as const,
      group: "ai",
      label: "AI Features Enabled",
      description: "Master toggle for all AI-powered features",
      isPublic: false,
      isEditable: true,
    },
    {
      key: "notifications.default_channels",
      value: JSON.stringify(["email"]),
      type: "json" as const,
      group: "notifications",
      label: "Default Notification Channels",
      description: "Default channels for system notifications (email, teams, slack, webhook)",
      isPublic: false,
      isEditable: true,
    },
  ]

  for (const setting of defaultSettings) {
    try {
      const existing = await db
        .select({ id: systemSettings.id })
        .from(systemSettings)
        .where(eq(systemSettings.key, setting.key))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(systemSettings).values(setting)
        log(`  ✓ Setting: ${setting.key}`)
      } else {
        log(`  - Skipped (exists): ${setting.key}`)
      }
    } catch (err) {
      console.error(`  ✗ Failed to seed setting '${setting.key}':`, err)
      // Non-fatal — continue
    }
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
