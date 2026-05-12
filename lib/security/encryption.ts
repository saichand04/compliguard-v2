/**
 * lib/security/encryption.ts
 *
 * AES-256-GCM symmetric encryption for storing sensitive credentials
 * (ITSM tokens, API keys, etc.) in the database.
 *
 * Key is derived from ENCRYPTION_SECRET env var (32-byte hex or arbitrary string).
 * Falls back to a deterministic dev key when env var is absent (dev-only).
 *
 * Usage:
 *   const cipher = await encrypt('{"token":"abc123"}')  // -> "iv:ciphertext:tag" base64 string
 *   const plain  = await decrypt(cipher)                // -> '{"token":"abc123"}'
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12  // 96-bit IV recommended for GCM
const TAG_BYTES = 16 // 128-bit auth tag

/**
 * Derive a stable 32-byte key from an arbitrary secret string.
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[encryption] ENCRYPTION_SECRET env var is required in production. ' +
        'Set it to a random 32+ character string in your .env file.',
      )
    }
    // Dev fallback — NOT secure, only for local development
    return deriveKey('compliguard-dev-encryption-key-do-not-use-in-prod')
  }
  return deriveKey(secret)
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string in the format: <iv>:<ciphertext>:<authTag>
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64'),
  ].join(':')
}

/**
 * Decrypt a string produced by encrypt().
 * Input format: <iv>:<ciphertext>:<authTag>  (base64 parts)
 */
export async function decrypt(ciphertext: string): Promise<string> {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('[encryption] Invalid ciphertext format — expected iv:data:tag')
  }
  const [ivB64, dataB64, tagB64] = parts
  const key = getKey()
  const iv = Buffer.from(ivB64, 'base64')
  const encrypted = Buffer.from(dataB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])
  return decrypted.toString('utf-8')
}

/**
 * Convenience helper — encrypt a plain JS object to a storable string.
 */
export async function encryptObject(obj: Record<string, unknown>): Promise<string> {
  return encrypt(JSON.stringify(obj))
}

/**
 * Convenience helper — decrypt back to a JS object.
 */
export async function decryptObject(ciphertext: string): Promise<Record<string, unknown>> {
  const raw = await decrypt(ciphertext)
  return JSON.parse(raw) as Record<string, unknown>
}
