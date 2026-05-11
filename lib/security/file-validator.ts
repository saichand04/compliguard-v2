/**
 * File validation and storage-key safety helpers (A4 security findings).
 *
 * Responsibilities:
 *  - Reject path-traversal / control-char keys for storage providers.
 *  - Sanitize user-supplied filenames before persisting them.
 *  - Sniff actual MIME types from file bytes (via the `file-type` package) so
 *    we do not trust the declared MIME from the client.
 *  - Block known executable / script MIME types even if the consumer's
 *    allowlist accidentally contains them.
 */

import path from 'path'

/** Maximum allowed length of any storage key. */
export const MAX_STORAGE_KEY_LENGTH = 1024

/** Maximum allowed filename length (bytes, not characters). */
export const MAX_FILENAME_BYTES = 255

/**
 * MIME types that must never be served back to the browser, even if the
 * consumer's allowlist contains them.  These are the high-risk script /
 * executable types.
 */
export const BLOCKED_EXECUTABLE_MIMES: ReadonlySet<string> = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/javascript',
  'text/javascript',
  'application/x-sh',
  'application/x-msi',
  'application/x-elf',
])

/**
 * MIME types that must never be served inline because the browser will render
 * them and execute embedded script.  Local-storage GET refuses to serve these
 * outright (we don't have a sanitizer pipeline).
 */
export const ACTIVE_CONTENT_MIMES: ReadonlySet<string> = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'application/xml',
  'text/xml',
])

/** Text MIME subtypes that are considered safe (cannot host executable script). */
export const SAFE_TEXT_MIMES: ReadonlySet<string> = new Set([
  'text/plain',
  'text/csv',
])

/** Thrown when an uploaded file fails MIME / filename validation. */
export class FileValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileValidationError'
  }
}

/**
 * Reject any storage key that could escape the storage root, contain control
 * characters, URL-encoded traversal sequences, or that path.normalize would
 * collapse to a shorter form.
 *
 * Acceptable keys look like `evidence/{orgId}/{year}/{month}/{uuid}-{name}`.
 * Forward slashes are allowed as path separators.
 */
export function assertSafeStorageKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw new FileValidationError('Storage key is required')
  }

  if (key.length > MAX_STORAGE_KEY_LENGTH) {
    throw new FileValidationError(
      `Storage key exceeds maximum length (${MAX_STORAGE_KEY_LENGTH})`,
    )
  }

  if (key.includes('..')) {
    throw new FileValidationError('Storage key contains parent traversal ("..")')
  }

  if (key.includes('\\')) {
    throw new FileValidationError('Storage key contains backslash')
  }

  if (key.startsWith('/')) {
    throw new FileValidationError('Storage key must not start with "/"')
  }

  // NUL byte or any C0 control char.
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) {
      throw new FileValidationError(
        'Storage key contains a control character',
      )
    }
  }

  // URL-encoded traversal forms (case-insensitive).
  const lower = key.toLowerCase()
  if (
    lower.includes('%2e') ||
    lower.includes('%2f') ||
    lower.includes('%5c') ||
    lower.includes('%00')
  ) {
    throw new FileValidationError(
      'Storage key contains URL-encoded traversal',
    )
  }

  // Reject keys that path.normalize would shorten — that means they contained
  // redundant traversal segments, current-dir markers, etc.
  const normalized = path.posix.normalize(key)
  if (normalized !== key) {
    throw new FileValidationError('Storage key is not normalized')
  }
}

const WINDOWS_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
])

/**
 * Strip path separators, control chars, leading dots, and reserved Windows
 * names from a user-supplied filename.  Caps the output at MAX_FILENAME_BYTES
 * while preserving the extension if it is short.
 */
export function sanitizeFilename(name: string): string {
  if (typeof name !== 'string') return 'unnamed'

  // Strip any directory component the client may have included.
  let base = name.replace(/\\/g, '/')
  const lastSlash = base.lastIndexOf('/')
  if (lastSlash >= 0) base = base.slice(lastSlash + 1)

  // Drop control chars + characters that are problematic on Windows or in
  // Content-Disposition headers.
  // eslint-disable-next-line no-control-regex
  base = base.replace(/[\x00-\x1f\x7f<>:"|?*]/g, '_')

  // Collapse repeated spaces / dots.
  base = base.replace(/\s+/g, ' ').trim()
  base = base.replace(/^\.+/, '') // strip leading dots

  if (base.length === 0) base = 'unnamed'

  // Block Windows reserved device names (with or without extension).
  const stem = base.replace(/\.[^.]*$/, '')
  if (WINDOWS_RESERVED.has(stem.toUpperCase())) {
    base = `_${base}`
  }

  // Cap by byte length, preserving extension if reasonable.
  const enc = new TextEncoder()
  if (enc.encode(base).length > MAX_FILENAME_BYTES) {
    const dot = base.lastIndexOf('.')
    const ext = dot > 0 && base.length - dot <= 16 ? base.slice(dot) : ''
    let stemPart = ext ? base.slice(0, dot) : base
    while (enc.encode(stemPart + ext).length > MAX_FILENAME_BYTES) {
      stemPart = stemPart.slice(0, -1)
      if (stemPart.length === 0) break
    }
    base = stemPart + ext
  }

  return base
}

/**
 * Sniff the actual MIME type from the first bytes of the file using the
 * `file-type` package.  Returns null mime/ext if the type cannot be detected
 * (e.g. for plain-text content that has no magic bytes).
 */
export async function sniffMime(
  buffer: Buffer,
): Promise<{ mime: string | null; ext: string | null }> {
  // `file-type` only needs the first ~4KB; slicing keeps it cheap.
  const head = buffer.length > 4100 ? buffer.subarray(0, 4100) : buffer
  const { fileTypeFromBuffer } = await import('file-type')
  const result = await fileTypeFromBuffer(head)
  if (!result) return { mime: null, ext: null }
  return { mime: result.mime, ext: result.ext }
}

/**
 * Validate an uploaded file against an allowlist.  Sniffs the actual MIME and
 * requires both:
 *   1. The sniffed MIME is in `allowlist` (or, for non-detectable text files,
 *      the declared MIME is in `allowlist` AND is in SAFE_TEXT_MIMES).
 *   2. The declared MIME (if provided) is also in `allowlist`.
 *
 * Always blocks the BLOCKED_EXECUTABLE_MIMES regardless of allowlist contents.
 *
 * Returns the canonical MIME that should be persisted in storage.
 */
export async function assertAllowedFile(
  buffer: Buffer,
  declaredMime: string | undefined | null,
  allowlist: readonly string[],
): Promise<{ mime: string; ext: string | null }> {
  if (!buffer || buffer.length === 0) {
    throw new FileValidationError('Empty file')
  }

  const allowSet = new Set(allowlist.map((m) => m.toLowerCase()))
  const declared = (declaredMime || '').toLowerCase().trim()

  if (declared && BLOCKED_EXECUTABLE_MIMES.has(declared)) {
    throw new FileValidationError(`Executable MIME type blocked: ${declared}`)
  }

  const sniffed = await sniffMime(buffer)
  const sniffedMime = sniffed.mime?.toLowerCase() || null

  if (sniffedMime && BLOCKED_EXECUTABLE_MIMES.has(sniffedMime)) {
    throw new FileValidationError(
      `Executable MIME type blocked (sniffed): ${sniffedMime}`,
    )
  }

  // Case A: file-type could sniff a magic-number MIME.
  if (sniffedMime) {
    if (!allowSet.has(sniffedMime)) {
      throw new FileValidationError(
        `File content type not allowed: ${sniffedMime}`,
      )
    }
    // If the client declared a MIME too, it must also be in the allowlist
    // (we don't require strict equality — declared can be a related family
    // like "image/jpg" vs sniffed "image/jpeg" — but it must be allowed).
    if (declared && !allowSet.has(declared)) {
      throw new FileValidationError(
        `Declared MIME type not allowed: ${declared}`,
      )
    }
    return { mime: sniffedMime, ext: sniffed.ext }
  }

  // Case B: nothing sniffable.  Only allow if the declared MIME is in the
  // allowlist AND is one of the safe text types (CSV / plain).  Anything
  // else without magic bytes is rejected.
  if (declared && allowSet.has(declared) && SAFE_TEXT_MIMES.has(declared)) {
    return { mime: declared, ext: null }
  }

  throw new FileValidationError(
    'Unable to detect file type; declared type is not a permitted text format',
  )
}

/**
 * Build a "safe to serve" MIME for files we are streaming back to the browser.
 * Refuses anything that browsers would render as active content (HTML/SVG/XML)
 * and downgrades unknown types to application/octet-stream.
 */
export function pickServeMime(
  sniffedMime: string | null,
  fallbackExtMime: string | null,
): string {
  const mime = (sniffedMime || fallbackExtMime || '').toLowerCase()
  if (!mime) return 'application/octet-stream'

  if (BLOCKED_EXECUTABLE_MIMES.has(mime) || ACTIVE_CONTENT_MIMES.has(mime)) {
    return 'application/octet-stream'
  }

  if (mime.startsWith('text/') && !SAFE_TEXT_MIMES.has(mime)) {
    return 'application/octet-stream'
  }

  return mime
}

/**
 * True if the given MIME is something we MUST refuse to serve (even as
 * attachment, since some browsers still sniff and render).
 */
export function isActiveContentMime(mime: string | null | undefined): boolean {
  if (!mime) return false
  const m = mime.toLowerCase()
  if (ACTIVE_CONTENT_MIMES.has(m)) return true
  if (BLOCKED_EXECUTABLE_MIMES.has(m)) return true
  if (m.startsWith('text/') && !SAFE_TEXT_MIMES.has(m)) return true
  return false
}
