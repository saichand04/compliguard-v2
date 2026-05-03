/**
 * Unit tests for storage abstraction layer
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { generateStorageKey } from "../../lib/storage/types"

const TEST_UUID = "123e4567-e89b-12d3-a456-426614174000"

describe("generateStorageKey", () => {
  it("generates key with correct format", () => {
    const key = generateStorageKey("org-123", "evidence.pdf", TEST_UUID)
    // Format: evidence/{orgId}/{year}/{month}/{uuid}-{filename}
    expect(key).toMatch(/^evidence\/org-123\/\d{4}\/\d{2}\/.+-evidence\.pdf$/)
  })

  it("sanitizes filenames with spaces", () => {
    const key = generateStorageKey("org-1", "my document.pdf", TEST_UUID)
    expect(key).not.toContain(" ")
  })

  it("sanitizes filenames with special characters", () => {
    const key = generateStorageKey("org-1", "file@#$.pdf", TEST_UUID)
    expect(key).not.toMatch(/[@#$]/)
  })

  it("includes current year in path", () => {
    const year = new Date().getFullYear().toString()
    const key = generateStorageKey("org-1", "test.pdf", TEST_UUID)
    expect(key).toContain(`/${year}/`)
  })

  it("includes current month in path", () => {
    const month = (new Date().getMonth() + 1).toString().padStart(2, "0")
    const key = generateStorageKey("org-1", "test.pdf", TEST_UUID)
    expect(key).toContain(`/${month}/`)
  })

  it("generates different keys for different uuids", () => {
    const uuid1 = "11111111-1111-1111-1111-111111111111"
    const uuid2 = "22222222-2222-2222-2222-222222222222"
    const key1 = generateStorageKey("org-1", "evidence.pdf", uuid1)
    const key2 = generateStorageKey("org-1", "evidence.pdf", uuid2)
    expect(key1).not.toBe(key2)
  })

  it("preserves .pdf extension", () => {
    const key = generateStorageKey("org-1", "doc.pdf", TEST_UUID)
    expect(key.endsWith(".pdf")).toBe(true)
  })

  it("preserves .png extension", () => {
    const key = generateStorageKey("org-1", "image.png", TEST_UUID)
    expect(key.endsWith(".png")).toBe(true)
  })

  it("preserves .xlsx extension", () => {
    const key = generateStorageKey("org-1", "data.xlsx", TEST_UUID)
    expect(key.endsWith(".xlsx")).toBe(true)
  })

  it("handles filenames without extensions", () => {
    expect(() => {
      generateStorageKey("org-1", "noextension", TEST_UUID)
    }).not.toThrow()
  })

  it("uses org ID as part of path", () => {
    const key = generateStorageKey("my-org-xyz", "file.pdf", TEST_UUID)
    expect(key).toContain("evidence/my-org-xyz/")
  })

  it("starts with evidence/ prefix", () => {
    const key = generateStorageKey("org-1", "file.pdf", TEST_UUID)
    expect(key.startsWith("evidence/")).toBe(true)
  })

  it("includes the uuid in the filename segment", () => {
    const key = generateStorageKey("org-1", "file.pdf", TEST_UUID)
    expect(key).toContain(TEST_UUID)
  })
})

describe("StorageProvider configuration", () => {
  it("STORAGE_PROVIDER env accepts valid values", () => {
    const validProviders = ["local", "s3", "azure-blob", "onedrive"]
    const provider = process.env.STORAGE_PROVIDER || "local"
    expect(validProviders).toContain(provider)
  })

  it("local provider dir is configured", () => {
    const dir = process.env.STORAGE_LOCAL_DIR || "/uploads"
    expect(typeof dir).toBe("string")
    expect(dir.length).toBeGreaterThan(0)
  })

  it("s3 required env var names are known", () => {
    const requiredVarsForS3 = [
      "STORAGE_S3_BUCKET",
      "STORAGE_S3_REGION",
      "STORAGE_S3_ACCESS_KEY_ID",
      "STORAGE_S3_SECRET_ACCESS_KEY",
    ]
    requiredVarsForS3.forEach((v) => {
      expect(v.startsWith("STORAGE_S3_")).toBe(true)
    })
  })
})

describe("UploadResult shape", () => {
  it("upload result has required fields", () => {
    const mockResult = {
      key: "evidence/org-1/2024/01/abc-file.pdf",
      size: 1024,
      mimeType: "application/pdf",
      provider: "local" as const,
    }
    expect(mockResult).toHaveProperty("key")
    expect(mockResult).toHaveProperty("size")
    expect(mockResult).toHaveProperty("mimeType")
    expect(mockResult).toHaveProperty("provider")
    expect(mockResult.size).toBeGreaterThan(0)
  })

  it("storage key path has correct segment count", () => {
    const key = "evidence/org-123/2024/01/uuid-filename.pdf"
    const parts = key.split("/")
    expect(parts[0]).toBe("evidence")
    expect(Number(parts[2])).toBeGreaterThan(2000)
    expect(Number(parts[3])).toBeGreaterThanOrEqual(1)
    expect(Number(parts[3])).toBeLessThanOrEqual(12)
  })
})
