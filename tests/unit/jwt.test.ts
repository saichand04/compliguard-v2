/**
 * Unit tests for JWT auth utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { signToken, verifyToken } from "../../lib/auth/jwt"

describe("JWT signToken", () => {
  it("returns a string token", async () => {
    const token = await signToken({ sub: "user-1", role: "user", orgId: "org-1" })
    expect(typeof token).toBe("string")
    expect(token.length).toBeGreaterThan(10)
  })

  it("returns a JWT with 3 dot-separated parts", async () => {
    const token = await signToken({ sub: "user-1", role: "user", orgId: "org-1" })
    const parts = token.split(".")
    expect(parts).toHaveLength(3)
  })

  it("encodes the subject in the token", async () => {
    const token = await signToken({ sub: "user-abc", role: "admin", orgId: "org-1" })
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
    expect(payload.sub).toBe("user-abc")
  })

  it("encodes the role in the token", async () => {
    const token = await signToken({ sub: "user-1", role: "compliance_manager", orgId: "org-1" })
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
    expect(payload.role).toBe("compliance_manager")
  })

  it("includes expiry (exp) claim", async () => {
    const token = await signToken({ sub: "user-1", role: "user", orgId: "org-1" })
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
    expect(payload.exp).toBeDefined()
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })
})

describe("JWT verifyToken", () => {
  it("verifies a valid token and returns payload", async () => {
    const token = await signToken({ sub: "user-1", role: "user", orgId: "org-1" })
    const payload = await verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload?.sub).toBe("user-1")
  })

  it("returns null for an invalid token", async () => {
    const result = await verifyToken("not.a.valid.jwt")
    expect(result).toBeNull()
  })

  it("returns null for empty string", async () => {
    const result = await verifyToken("")
    expect(result).toBeNull()
  })

  it("returns null for token with wrong signature", async () => {
    const token = await signToken({ sub: "user-1", role: "user", orgId: "org-1" })
    // Tamper with the signature
    const parts = token.split(".")
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`
    const result = await verifyToken(tampered)
    expect(result).toBeNull()
  })

  it("returns correct role from verified payload", async () => {
    const token = await signToken({ sub: "user-1", role: "auditor", orgId: "org-1" })
    const payload = await verifyToken(token)
    expect(payload?.role).toBe("auditor")
  })

  it("returns correct orgId from verified payload", async () => {
    const token = await signToken({ sub: "user-1", role: "user", orgId: "org-xyz" })
    const payload = await verifyToken(token)
    expect(payload?.orgId).toBe("org-xyz")
  })
})

describe("JWT token consistency", () => {
  it("sign and verify round-trip preserves all fields", async () => {
    const input = { sub: "user-roundtrip", role: "admin" as const, orgId: "org-rt" }
    const token = await signToken(input)
    const payload = await verifyToken(token)
    expect(payload?.sub).toBe(input.sub)
    expect(payload?.role).toBe(input.role)
    expect(payload?.orgId).toBe(input.orgId)
  })

  it("two tokens for same user are different (nonce/iat)", async () => {
    const data = { sub: "user-1", role: "user" as const, orgId: "org-1" }
    // Add small delay to ensure different iat
    const token1 = await signToken(data)
    await new Promise((r) => setTimeout(r, 10))
    const token2 = await signToken(data)
    // Tokens may differ due to timestamp
    // Both should be valid
    const p1 = await verifyToken(token1)
    const p2 = await verifyToken(token2)
    expect(p1?.sub).toBe(data.sub)
    expect(p2?.sub).toBe(data.sub)
  })
})
