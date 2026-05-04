/**
 * CompliGuard v2 — Framework Normalizer
 *
 * Parses user-uploaded framework files (CSV/JSON/XLSX) into NormalizedControl[].
 * Detects the framework type and validates the controls structure.
 */

import { isHitrustId, normalizeHitrustId, decodeHitrustId } from './hitrust-decoder'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NormalizedControl {
  /** The raw control ID as it appears in the source file */
  rawId: string
  /** Normalized/canonical ID (lowercase, dots, consistent format) */
  normalizedId: string
  /** Control title */
  title: string
  /** Control description */
  description?: string
  /** Control category or domain */
  category?: string
  /** NIST 800-53 canonical family hint (e.g. "AC", "SI") */
  canonicalHint?: string
  /** The detected framework slug (e.g. 'hitrust', 'iso27001') */
  frameworkSlug?: string
  /** Row index in the source file */
  sourceRow?: number
}

export type FrameworkFormat = 'csv' | 'json' | 'xlsx'

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  /** Total controls parsed */
  total: number
  /** Controls that passed validation */
  validCount: number
}

export interface ValidationError {
  row?: number
  controlId?: string
  field: string
  message: string
}

export interface ValidationWarning {
  row?: number
  controlId?: string
  field: string
  message: string
}

// ── Framework detection patterns ──────────────────────────────────────────────

const FRAMEWORK_PATTERNS: Array<{
  slug: string
  name: string
  idPattern: RegExp
  sample?: string[]
}> = [
  {
    slug: 'nist_800_53',
    name: 'NIST 800-53 Rev 5',
    idPattern: /^[A-Z]{2}-\d+(\(\d+\))?$/i,
    sample: ['AC-1', 'AC-2', 'SI-3', 'PM-9'],
  },
  {
    slug: 'hitrust',
    name: 'HITRUST CSF',
    idPattern: /^\d{2}\.[a-z]+\.\d{2,3}$/i,
    sample: ['09.ab.01', '01.a.01', '10.b.01'],
  },
  {
    slug: 'iso27001',
    name: 'ISO 27001:2022',
    idPattern: /^A\.\d+(\.\d+)+$/i,
    sample: ['A.5.1', 'A.9.1.1', 'A.12.6.1'],
  },
  {
    slug: 'soc2',
    name: 'SOC 2',
    idPattern: /^CC\d+\.\d+$|^A\d+\.\d+$|^PI\d+\.\d+$/i,
    sample: ['CC1.1', 'CC6.1', 'A1.1'],
  },
  {
    slug: 'pci_dss',
    name: 'PCI DSS',
    idPattern: /^\d+(\.\d+)+$/,
    sample: ['1.1.1', '3.4.1', '12.3.2'],
  },
  {
    slug: 'nist_csf',
    name: 'NIST CSF 2.0',
    idPattern: /^(GV|ID|PR|DE|RS|RC)\.[A-Z]+-\d+$/i,
    sample: ['ID.AM-1', 'PR.AC-1', 'DE.CM-1'],
  },
  {
    slug: 'cmmc',
    name: 'CMMC',
    idPattern: /^[A-Z]{2}\.\d+\.\d+(\.\d+)?$/i,
    sample: ['AC.1.001', 'AC.2.006', 'SI.1.210'],
  },
  {
    slug: 'hipaa',
    name: 'HIPAA',
    idPattern: /^§\s*164\.\d+/i,
    sample: ['§ 164.308(a)(1)', '§ 164.312(a)(2)'],
  },
]

// ── Internal helpers ──────────────────────────────────────────────────────────

function normalizeControlId(frameworkSlug: string | undefined, rawId: string): string {
  if (!rawId) return ''

  if (frameworkSlug === 'hitrust' || isHitrustId(rawId)) {
    return normalizeHitrustId(rawId)
  }

  // Default: trim and lowercase
  return rawId.trim().toUpperCase().replace(/\s+/g, '-')
}

function getCanonicalHint(rawId: string, frameworkSlug?: string): string | undefined {
  // HITRUST decode
  if (frameworkSlug === 'hitrust' || isHitrustId(rawId)) {
    const decoded = decodeHitrustId(rawId)
    if (decoded) return decoded.nistFamily
  }

  // NIST 800-53 pattern — family is the prefix before the dash
  const nistMatch = rawId.trim().match(/^([A-Z]{2})-\d+/i)
  if (nistMatch) return nistMatch[1].toUpperCase()

  return undefined
}

// ── CSV parser ────────────────────────────────────────────────────────────────

/**
 * Parse a raw CSV string into NormalizedControl[].
 * Expected columns (order flexible, header required):
 *   id/control_id/ref, title/name, description/desc, category/domain
 */
export function parseCsvControls(
  csvText: string,
  frameworkSlug?: string
): NormalizedControl[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/["\s]/g, ''))

  const idCol = headers.findIndex((h) =>
    ['id', 'control_id', 'controlid', 'ref', 'control', 'number'].includes(h)
  )
  const titleCol = headers.findIndex((h) =>
    ['title', 'name', 'control_name', 'requirement'].includes(h)
  )
  const descCol = headers.findIndex((h) =>
    ['description', 'desc', 'detail', 'guidance'].includes(h)
  )
  const catCol = headers.findIndex((h) =>
    ['category', 'domain', 'family', 'area', 'group'].includes(h)
  )

  const controls: NormalizedControl[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // Simple CSV split — handles quoted fields
    const cols = splitCsvLine(line)

    const rawId = idCol >= 0 ? (cols[idCol] ?? '').replace(/['"]/g, '').trim() : ''
    const title = titleCol >= 0 ? (cols[titleCol] ?? '').replace(/['"]/g, '').trim() : ''
    if (!rawId && !title) continue

    controls.push({
      rawId,
      normalizedId: normalizeControlId(frameworkSlug, rawId),
      title,
      description: descCol >= 0 ? (cols[descCol] ?? '').replace(/['"]/g, '').trim() : undefined,
      category: catCol >= 0 ? (cols[catCol] ?? '').replace(/['"]/g, '').trim() : undefined,
      canonicalHint: getCanonicalHint(rawId, frameworkSlug),
      frameworkSlug,
      sourceRow: i + 1,
    })
  }

  return controls
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let inQuotes = false
  let current = ''

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ── JSON parser ───────────────────────────────────────────────────────────────

interface JsonControlRecord {
  id?: string
  control_id?: string
  ref?: string
  controlId?: string
  title?: string
  name?: string
  control_name?: string
  description?: string
  desc?: string
  guidance?: string
  category?: string
  domain?: string
  family?: string
  [key: string]: unknown
}

/**
 * Parse a JSON array of control objects.
 * Accepts arrays or objects with a `controls` / `data` key.
 */
export function parseJsonControls(
  jsonText: string,
  frameworkSlug?: string
): NormalizedControl[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return []
  }

  let records: JsonControlRecord[]
  if (Array.isArray(parsed)) {
    records = parsed as JsonControlRecord[]
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    const arr = obj['controls'] ?? obj['data'] ?? obj['items'] ?? obj['requirements']
    if (Array.isArray(arr)) {
      records = arr as JsonControlRecord[]
    } else {
      return []
    }
  } else {
    return []
  }

  return records.map((rec, i) => {
    const rawId = String(rec.id ?? rec.control_id ?? rec.ref ?? rec.controlId ?? '').trim()
    const title = String(rec.title ?? rec.name ?? rec.control_name ?? '').trim()
    const description = rec.description
      ? String(rec.description).trim()
      : rec.desc
        ? String(rec.desc).trim()
        : rec.guidance
          ? String(rec.guidance).trim()
          : undefined
    const category = rec.category
      ? String(rec.category).trim()
      : rec.domain
        ? String(rec.domain).trim()
        : rec.family
          ? String(rec.family).trim()
          : undefined

    return {
      rawId,
      normalizedId: normalizeControlId(frameworkSlug, rawId),
      title,
      description,
      category,
      canonicalHint: getCanonicalHint(rawId, frameworkSlug),
      frameworkSlug,
      sourceRow: i + 2,
    }
  }).filter((c) => c.rawId || c.title)
}

// ── Framework detection ───────────────────────────────────────────────────────

/**
 * Auto-detect the framework slug from a sample of control IDs.
 * Returns null if uncertain.
 */
export function detectFramework(controls: NormalizedControl[]): string | null {
  if (controls.length === 0) return null

  const sample = controls.slice(0, Math.min(20, controls.length))
  const ids = sample.map((c) => c.rawId).filter(Boolean)

  // Score each framework pattern
  const scores: Record<string, number> = {}
  for (const { slug, idPattern } of FRAMEWORK_PATTERNS) {
    const matches = ids.filter((id) => idPattern.test(id.trim()))
    scores[slug] = matches.length / Math.max(ids.length, 1)
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  if (!best || best[1] < 0.5) return null

  return best[0]
}

// ── Main normalizer ───────────────────────────────────────────────────────────

/**
 * Normalize a raw file into NormalizedControl[].
 * Auto-detects format from the content if format is not specified.
 */
export function normalizeFrameworkUpload(
  content: string,
  format: FrameworkFormat,
  frameworkSlug?: string
): NormalizedControl[] {
  let controls: NormalizedControl[] = []

  if (format === 'csv') {
    controls = parseCsvControls(content, frameworkSlug)
  } else if (format === 'json') {
    controls = parseJsonControls(content, frameworkSlug)
  } else {
    // xlsx: caller must pre-convert to CSV or JSON before calling this function
    // since xlsx parsing requires a binary reader (done in API route via FormData)
    controls = parseCsvControls(content, frameworkSlug)
  }

  // Auto-detect framework if not provided
  if (!frameworkSlug) {
    const detected = detectFramework(controls)
    if (detected) {
      controls = controls.map((c) => ({
        ...c,
        frameworkSlug: detected,
        normalizedId: normalizeControlId(detected, c.rawId),
        canonicalHint: getCanonicalHint(c.rawId, detected),
      }))
    }
  }

  return controls
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a set of normalized controls.
 * Returns errors and warnings.
 */
export function validateControls(controls: NormalizedControl[]): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (controls.length === 0) {
    errors.push({ field: 'file', message: 'No controls found in uploaded file' })
    return { valid: false, errors, warnings, total: 0, validCount: 0 }
  }

  const seenIds = new Set<string>()
  let validCount = 0

  for (const control of controls) {
    let controlValid = true

    if (!control.rawId && !control.title) {
      errors.push({
        row: control.sourceRow,
        field: 'id',
        message: 'Control is missing both ID and title',
      })
      controlValid = false
    }

    if (!control.title) {
      warnings.push({
        row: control.sourceRow,
        controlId: control.rawId,
        field: 'title',
        message: 'Control has no title',
      })
    }

    if (control.rawId && seenIds.has(control.normalizedId)) {
      warnings.push({
        row: control.sourceRow,
        controlId: control.rawId,
        field: 'id',
        message: `Duplicate control ID: ${control.rawId}`,
      })
    } else if (control.rawId) {
      seenIds.add(control.normalizedId)
    }

    if (controlValid) validCount++
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    total: controls.length,
    validCount,
  }
}
