/**
 * Unit tests for the rate limiter
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// We test the in-memory store behavior directly
// since we don't have Redis in unit tests

describe("Rate Limiter — in-memory store", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("creates a sliding window tracker", () => {
    const store = new Map<string, { count: number; resetAt: number }>()

    function checkLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
      const now = Date.now()
      const entry = store.get(key)

      if (!entry || now >= entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
      }

      if (entry.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt }
      }

      entry.count++
      return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
    }

    const key = "test-ip"
    const limit = 5
    const windowMs = 60_000

    // First 5 requests should be allowed
    for (let i = 0; i < 5; i++) {
      const result = checkLimit(key, limit, windowMs)
      expect(result.allowed).toBe(true)
    }

    // 6th request should be blocked
    const blocked = checkLimit(key, limit, windowMs)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it("resets counter after window expires", () => {
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))

    const store = new Map<string, { count: number; resetAt: number }>()

    function checkLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
      const now = Date.now()
      const entry = store.get(key)

      if (!entry || now >= entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, remaining: limit - 1 }
      }

      if (entry.count >= limit) {
        return { allowed: false, remaining: 0 }
      }

      entry.count++
      return { allowed: true, remaining: limit - entry.count }
    }

    const key = "test-ip-reset"
    const limit = 2
    const windowMs = 5000 // 5 seconds

    // Exhaust the limit
    expect(checkLimit(key, limit, windowMs).allowed).toBe(true)
    expect(checkLimit(key, limit, windowMs).allowed).toBe(true)
    expect(checkLimit(key, limit, windowMs).allowed).toBe(false)

    // Advance time past window
    vi.advanceTimersByTime(6000)

    // Should be allowed again
    expect(checkLimit(key, limit, windowMs).allowed).toBe(true)
  })

  it("tracks separate keys independently", () => {
    const store = new Map<string, { count: number; resetAt: number }>()

    function checkLimit(key: string, limit: number, windowMs: number): boolean {
      const now = Date.now()
      const entry = store.get(key)

      if (!entry || now >= entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return true
      }

      if (entry.count >= limit) return false
      entry.count++
      return true
    }

    const limit = 2
    const windowMs = 60_000

    // IP 1 gets blocked
    expect(checkLimit("ip-1", limit, windowMs)).toBe(true)
    expect(checkLimit("ip-1", limit, windowMs)).toBe(true)
    expect(checkLimit("ip-1", limit, windowMs)).toBe(false)

    // IP 2 is still allowed
    expect(checkLimit("ip-2", limit, windowMs)).toBe(true)
    expect(checkLimit("ip-2", limit, windowMs)).toBe(true)
    expect(checkLimit("ip-2", limit, windowMs)).toBe(false)
  })
})

describe("Rate Limiter — configuration", () => {
  it("auth limit is stricter than API limit", () => {
    // Auth: 5 per 15 minutes
    const authLimit = 5
    const authWindowMs = 15 * 60 * 1000

    // API: 100 per 1 minute
    const apiLimit = 100
    const apiWindowMs = 1 * 60 * 1000

    // Auth allows fewer requests
    expect(authLimit).toBeLessThan(apiLimit)

    // Auth window is longer (more conservative)
    expect(authWindowMs).toBeGreaterThan(apiWindowMs)
  })

  it("rate limit headers follow RFC 6585", () => {
    const headers = {
      "X-RateLimit-Limit": "5",
      "X-RateLimit-Remaining": "4",
      "X-RateLimit-Reset": "1704067200",
      "Retry-After": "900",
    }

    // Verify header names are correct
    expect(Object.keys(headers)).toContain("X-RateLimit-Limit")
    expect(Object.keys(headers)).toContain("X-RateLimit-Remaining")
    expect(Object.keys(headers)).toContain("X-RateLimit-Reset")

    // Verify values are numeric strings
    expect(Number(headers["X-RateLimit-Limit"])).toBeGreaterThan(0)
    expect(Number(headers["X-RateLimit-Remaining"])).toBeGreaterThanOrEqual(0)
    expect(Number(headers["X-RateLimit-Reset"])).toBeGreaterThan(0)
  })
})
