/**
 * Vitest global test setup
 * Runs once before all test files.
 */

import { vi, beforeAll, afterAll } from "vitest"

// ── Environment ───────────────────────────────────────────
// NODE_ENV is read-only in strict TS — use Object.assign to override in tests
Object.assign(process.env, { NODE_ENV: "test" })
process.env.JWT_SECRET = "test_jwt_secret_32_chars_minimum_here"
process.env.DATABASE_URL = "postgresql://compliguard:test@localhost:5432/compliguard_test"
process.env.STORAGE_PROVIDER = "local"
process.env.STORAGE_LOCAL_DIR = "/tmp/compliguard-test"
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
process.env.LOG_LEVEL = "silent"

// ── Mock next/headers ─────────────────────────────────────
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getAll: vi.fn(() => []),
  })),
  headers: vi.fn(() => new Headers()),
}))

// ── Mock next/navigation ──────────────────────────────────
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

// ── Mock Pino logger ──────────────────────────────────────
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}))

// ── Global lifecycle ──────────────────────────────────────
beforeAll(() => {
  // Global test setup
})

afterAll(() => {
  // Global teardown
  vi.clearAllMocks()
})
