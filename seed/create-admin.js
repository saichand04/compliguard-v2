#!/usr/bin/env node
/**
 * CompliGuard v2 — Admin user bootstrap
 * Pure CommonJS — works in production Docker image (no tsx required)
 *
 * Usage:
 *   node seed/create-admin.js
 *   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD=MyPass123 node seed/create-admin.js
 */
'use strict'

const { Client } = require('pg')
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[create-admin] ERROR: DATABASE_URL not set')
  process.exit(1)
}

const ADMIN_EMAIL    = (process.env.ADMIN_EMAIL    || 'admin@compliguard.local').toLowerCase().trim()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD  || 'Welcome@123'
const ADMIN_FIRST    = process.env.ADMIN_FIRST     || 'Admin'
const ADMIN_LAST     = process.env.ADMIN_LAST      || 'User'
const ORG_NAME       = process.env.ORG_NAME        || 'CompliGuard Demo Org'
const ORG_SLUG       = process.env.ORG_SLUG        || 'compliguard-demo'

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  console.log('[create-admin] Connected to database')

  try {
    // 1. Ensure org exists
    let orgId
    const orgRes = await client.query('SELECT id FROM organizations LIMIT 1')
    if (orgRes.rows.length > 0) {
      orgId = orgRes.rows[0].id
      console.log(`[create-admin] Using existing org: ${orgId}`)
    } else {
      orgId = randomUUID()
      await client.query(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [orgId, ORG_NAME, ORG_SLUG]
      )
      console.log(`[create-admin] Created org: ${ORG_NAME} (${orgId})`)
    }

    // 2. Hash password
    console.log('[create-admin] Hashing password...')
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

    // 3. Upsert admin user
    const existRes = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    )

    if (existRes.rows.length > 0) {
      await client.query(
        `UPDATE users
         SET password_hash = $1, role = 'super_admin', is_active = true,
             first_name = $2, last_name = $3, updated_at = NOW()
         WHERE email = $4`,
        [passwordHash, ADMIN_FIRST, ADMIN_LAST, ADMIN_EMAIL]
      )
      console.log(`[create-admin] Updated existing user: ${ADMIN_EMAIL}`)
    } else {
      const userId = randomUUID()
      await client.query(
        `INSERT INTO users
           (id, email, first_name, last_name, password_hash, role, is_active, organization_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'super_admin', true, $6, NOW(), NOW())`,
        [userId, ADMIN_EMAIL, ADMIN_FIRST, ADMIN_LAST, passwordHash, orgId]
      )
      console.log(`[create-admin] Created user: ${ADMIN_EMAIL}`)
    }

    console.log('')
    console.log('========================================')
    console.log('  CompliGuard Admin Account Ready')
    console.log('========================================')
    console.log(`  Email   : ${ADMIN_EMAIL}`)
    console.log(`  Password: ${ADMIN_PASSWORD}`)
    console.log(`  Role    : super_admin`)
    console.log('========================================')
    console.log('')

  } finally {
    await client.end()
  }
}

main().catch(e => {
  console.error('[create-admin] FATAL:', e.message)
  process.exit(1)
})
