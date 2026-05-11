/**
 * Unit tests for JWT auth utilities.
 *
 * Updated for the post-A1 payload shape:
 *   userId, email, role, orgId, firstName, lastName, tokenVersion
 *
 * verifyToken also performs an optional DB lookup against users.token_version
 * to enforce revocation. Tests rely on the DB module short-circuiting when
 * DATABASE_URL is unreachable — verifyToken falls back to the cryptographic
 * check only, which is what we exercise here.
 */

import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from '../../lib/auth/jwt'

const fixtureBase = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'test@compliguard.local',
  orgId: '22222222-2222-2222-2222-222222222222',
  role: 'user' as const,
  firstName: 'Test',
  lastName: 'User',
  tokenVersion: 1,
}

describe('JWT signToken', () => {
  it('returns a string token', async () => {
    const token = await signToken(fixtureBase)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(10)
  })

  it('returns a JWT with 3 dot-separated parts', async () => {
    const token = await signToken(fixtureBase)
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })

  it('encodes the userId in the token', async () => {
    const token = await signToken({ ...fixtureBase, userId: 'abcde000-0000-0000-0000-000000000001' })
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(payload.userId).toBe('abcde000-0000-0000-0000-000000000001')
  })

  it('encodes the role in the token', async () => {
    const token = await signToken({ ...fixtureBase, role: 'compliance_manager' })
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(payload.role).toBe('compliance_manager')
  })

  it('encodes the tokenVersion in the token', async () => {
    const token = await signToken({ ...fixtureBase, tokenVersion: 42 })
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(payload.tokenVersion).toBe(42)
  })

  it('includes expiry (exp) claim', async () => {
    const token = await signToken(fixtureBase)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(payload.exp).toBeDefined()
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('includes issuer claim', async () => {
    const token = await signToken(fixtureBase)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(payload.iss).toBe('compliguard')
  })
})

describe('JWT verifyToken', () => {
  it('verifies a valid token and returns payload', async () => {
    const token = await signToken(fixtureBase)
    const payload = await verifyToken(token)
    // verifyToken returns null if the DB lookup says the user is gone /
    // inactive / on a stale tokenVersion. In this test env the DB is
    // unreachable, so the DB check is skipped and the cryptographic
    // payload is returned.
    expect(payload).not.toBeNull()
    expect(payload?.userId).toBe(fixtureBase.userId)
  })

  it('returns null for an invalid token', async () => {
    const result = await verifyToken('not.a.valid.jwt')
    expect(result).toBeNull()
  })

  it('returns null for empty string', async () => {
    const result = await verifyToken('')
    expect(result).toBeNull()
  })

  it('returns null for token with tampered signature', async () => {
    const token = await signToken(fixtureBase)
    const parts = token.split('.')
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`
    const result = await verifyToken(tampered)
    expect(result).toBeNull()
  })

  it('returns correct role from verified payload', async () => {
    const token = await signToken({ ...fixtureBase, role: 'auditor' })
    const payload = await verifyToken(token)
    expect(payload?.role).toBe('auditor')
  })

  it('returns correct orgId from verified payload', async () => {
    const token = await signToken({ ...fixtureBase, orgId: '33333333-3333-3333-3333-333333333333' })
    const payload = await verifyToken(token)
    expect(payload?.orgId).toBe('33333333-3333-3333-3333-333333333333')
  })
})

describe('JWT token consistency', () => {
  it('sign and verify round-trip preserves all fields', async () => {
    const input = {
      ...fixtureBase,
      userId: '44444444-4444-4444-4444-444444444444',
      role: 'admin' as const,
      tokenVersion: 7,
    }
    const token = await signToken(input)
    const payload = await verifyToken(token)
    expect(payload?.userId).toBe(input.userId)
    expect(payload?.role).toBe(input.role)
    expect(payload?.orgId).toBe(input.orgId)
    expect(payload?.tokenVersion).toBe(input.tokenVersion)
  })

  it('two tokens for same user are different (nonce/iat)', async () => {
    const token1 = await signToken(fixtureBase)
    await new Promise((r) => setTimeout(r, 1100)) // iat is seconds-resolution
    const token2 = await signToken(fixtureBase)
    expect(token1).not.toBe(token2)
    const p1 = await verifyToken(token1)
    const p2 = await verifyToken(token2)
    expect(p1?.userId).toBe(fixtureBase.userId)
    expect(p2?.userId).toBe(fixtureBase.userId)
  })
})
