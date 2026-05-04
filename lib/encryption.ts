import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const ENCODING = 'hex'

/**
 * Get a 32-byte encryption key derived from NEXTAUTH_SECRET or fallback.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET || 'fallback-32-char-key-padded-here!'
  // Use SHA-256 to always produce exactly 32 bytes regardless of secret length
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns: "ENCRYPTED:<iv>:<authTag>:<ciphertext>" (all hex-encoded)
 */
export function encrypt(text: string): string {
  if (!text) return text
  // Don't double-encrypt
  if (text.startsWith('ENCRYPTED:')) return text

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `ENCRYPTED:${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted.toString(ENCODING)}`
}

/**
 * Decrypt a string encrypted by encrypt().
 * Returns the original plaintext.
 */
export function decrypt(text: string): string {
  if (!text) return text
  if (!text.startsWith('ENCRYPTED:')) return text // not encrypted, return as-is

  const parts = text.split(':')
  if (parts.length !== 4) throw new Error('Invalid encrypted value format')

  const [, ivHex, authTagHex, ciphertextHex] = parts
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, ENCODING)
  const authTag = Buffer.from(authTagHex, ENCODING)
  const ciphertext = Buffer.from(ciphertextHex, ENCODING)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Encrypt all sensitive fields in a config object in-place.
 * Sensitive field names: secretAccessKey, accountKey, clientSecret, password, secret
 */
export function encryptConfig<T extends Record<string, unknown>>(config: T): T {
  const sensitiveKeys = ['secretAccessKey', 'accountKey', 'clientSecret', 'password', 'secret', 'connectionString']
  const result = { ...config } as Record<string, unknown>

  for (const [key, value] of Object.entries(result)) {
    if (sensitiveKeys.includes(key) && typeof value === 'string' && value) {
      result[key] = encrypt(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = encryptConfig(value as Record<string, unknown>)
    }
  }

  return result as T
}

/**
 * Decrypt all sensitive fields in a config object in-place.
 */
export function decryptConfig<T extends Record<string, unknown>>(config: T): T {
  const sensitiveKeys = ['secretAccessKey', 'accountKey', 'clientSecret', 'password', 'secret', 'connectionString']
  const result = { ...config } as Record<string, unknown>

  for (const [key, value] of Object.entries(result)) {
    if (sensitiveKeys.includes(key) && typeof value === 'string' && value) {
      result[key] = decrypt(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = decryptConfig(value as Record<string, unknown>)
    }
  }

  return result as T
}
