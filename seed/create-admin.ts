/**
 * Creates a local super_admin user for CompliGuard v2 development.
 * Run from project root: npx tsx seed/create-admin.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { users } from '../lib/db/schema/users'
import { organizations } from '../lib/db/schema/organizations'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('ERROR: DATABASE_URL not set')
  process.exit(1)
}

const client = postgres(connectionString, { max: 1 })
const db = drizzle(client)

async function main() {
  const email = 'admin@compliguard.local'
  const password = 'Welcome@123'
  const hash = await bcrypt.hash(password, 12)

  // Ensure a default org exists
  let orgId: string
  const existingOrg = await db.select({ id: organizations.id }).from(organizations).limit(1)
  if (existingOrg.length > 0) {
    orgId = existingOrg[0].id
    console.log(`[admin] Using existing org: ${orgId}`)
  } else {
    const [newOrg] = await db.insert(organizations).values({
      name: 'CompliGuard Demo Org',
      slug: 'compliguard-demo',
    }).returning({ id: organizations.id })
    orgId = newOrg.id
    console.log(`[admin] Created demo org: ${orgId}`)
  }

  // Upsert admin user
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    await db.update(users)
      .set({ passwordHash: hash, role: 'super_admin', isActive: true })
      .where(eq(users.email, email))
    console.log(`[admin] Updated existing user: ${email}`)
  } else {
    await db.insert(users).values({
      email,
      firstName: 'Admin',
      lastName: 'User',
      passwordHash: hash,
      role: 'super_admin',
      isActive: true,
      organizationId: orgId,
    })
    console.log(`[admin] Created user: ${email}`)
  }

  console.log('\n========================================')
  console.log('  CompliGuard Admin Account Ready')
  console.log('========================================')
  console.log(`  Email   : ${email}`)
  console.log(`  Password: Welcome@123`)
  console.log(`  Role    : super_admin`)
  console.log('========================================\n')

  await client.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
