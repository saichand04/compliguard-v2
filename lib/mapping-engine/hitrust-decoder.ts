/**
 * CompliGuard v2 — HITRUST ID Decoder
 *
 * HITRUST IDs encode ISO 27001 sections. Format: {domain}.{section}.{req_num}
 * Example: 09.ab.01 → domain '09' (Access Control) → ISO A.9, NIST family AC
 *
 * CRITICAL RULE: Never treat the same HITRUST ID as equivalent to the same
 * ISO 27001 clause directly — they must be resolved through the canonical NIST anchor.
 */

// ── Domain → ISO 27001 mapping ────────────────────────────────────────────────

export interface HitrustDomainInfo {
  isoClause: string
  isoTitle: string
  nistFamily: string
  nistFamilyName: string
}

/**
 * HITRUST two-digit domain codes → ISO 27001 section + NIST 800-53 family.
 * These are structural hints only — the actual canonical resolution goes through
 * the NIST anchor in mapping_rules, not direct ISO↔HITRUST string comparison.
 */
export const HITRUST_DOMAIN_MAP: Record<string, HitrustDomainInfo> = {
  '00': {
    isoClause: 'A.5',
    isoTitle: 'Information Security Policies',
    nistFamily: 'PM',
    nistFamilyName: 'Program Management',
  },
  '01': {
    isoClause: 'A.6',
    isoTitle: 'Organisation of Information Security',
    nistFamily: 'PL',
    nistFamilyName: 'Planning',
  },
  '02': {
    isoClause: 'A.8',
    isoTitle: 'Asset Management',
    nistFamily: 'CM',
    nistFamilyName: 'Configuration Management',
  },
  '03': {
    isoClause: 'A.7',
    isoTitle: 'Human Resource Security',
    nistFamily: 'PS',
    nistFamilyName: 'Personnel Security',
  },
  '04': {
    isoClause: 'A.11',
    isoTitle: 'Physical and Environmental Security',
    nistFamily: 'PE',
    nistFamilyName: 'Physical and Environmental Protection',
  },
  '05': {
    isoClause: 'A.13',
    isoTitle: 'Communications Security',
    nistFamily: 'SC',
    nistFamilyName: 'System and Communications Protection',
  },
  '06': {
    isoClause: 'A.14',
    isoTitle: 'System Acquisition, Development and Maintenance',
    nistFamily: 'SA',
    nistFamilyName: 'System and Services Acquisition',
  },
  '07': {
    isoClause: 'A.15',
    isoTitle: 'Supplier Relationships',
    nistFamily: 'SR',
    nistFamilyName: 'Supply Chain Risk Management',
  },
  '08': {
    isoClause: 'A.16',
    isoTitle: 'Information Security Incident Management',
    nistFamily: 'IR',
    nistFamilyName: 'Incident Response',
  },
  '09': {
    isoClause: 'A.9',
    isoTitle: 'Access Control',
    nistFamily: 'AC',
    nistFamilyName: 'Access Control',
  },
  '10': {
    isoClause: 'A.12',
    isoTitle: 'Operations Security',
    nistFamily: 'SI',
    nistFamilyName: 'System and Information Integrity',
  },
  '11': {
    isoClause: 'A.10',
    isoTitle: 'Cryptography',
    nistFamily: 'SC',
    nistFamilyName: 'System and Communications Protection',
  },
}

// ── Decoded result types ───────────────────────────────────────────────────────

export interface DecodedHitrustId {
  /** The raw HITRUST ID that was decoded */
  raw: string
  /** Two-digit domain code, e.g. '09' */
  domain: string
  /** Alphabetic section, e.g. 'ab' */
  section: string
  /** Requirement number, e.g. '01' */
  requirement: string
  /** ISO 27001 clause this domain maps to, e.g. 'A.9' */
  isoClause: string
  /** Human-readable ISO title */
  isoTitle: string
  /** NIST 800-53 family abbreviation, e.g. 'AC' */
  nistFamily: string
  /** NIST family full name */
  nistFamilyName: string
}

export interface HitrustCanonicalHint {
  /** Human-readable hint for NIST family to search when resolving */
  canonicalHint: string
  /** NIST 800-53 family code */
  nistFamily: string
  /** ISO 27001 clause hint (structural, not a direct mapping) */
  isoClause: string
}

// ── Core decode function ───────────────────────────────────────────────────────

/**
 * Decode a HITRUST CSF control ID into its constituent parts.
 *
 * @example
 * decodeHitrustId('09.ab.01')
 * // → { domain: '09', section: 'ab', requirement: '01', isoClause: 'A.9', ... }
 */
export function decodeHitrustId(hitrustId: string): DecodedHitrustId | null {
  if (!hitrustId) return null

  const normalized = hitrustId.trim().toLowerCase()

  // HITRUST format: DD.xx.NN where DD=domain, xx=section letters, NN=req num
  const match = normalized.match(/^(\d{2})\.([a-z]+)\.(\d{2,3})$/)
  if (!match) {
    // Try alternate formats: e.g. 09ab.01, 09.ab1, 0201.09j
    const altMatch = normalized.match(/^(\d{4})\.(\d{2})([a-z])$/)
    if (altMatch) {
      // ARC-AMPE style: 0201.09j — this is NOT a HITRUST ID, reject
      return null
    }
    return null
  }

  const [, domain, section, requirement] = match
  const domainInfo = HITRUST_DOMAIN_MAP[domain]

  if (!domainInfo) {
    // Unknown domain — return partial decode
    return {
      raw: hitrustId,
      domain,
      section,
      requirement,
      isoClause: 'Unknown',
      isoTitle: `Unknown domain ${domain}`,
      nistFamily: 'Unknown',
      nistFamilyName: 'Unknown',
    }
  }

  return {
    raw: hitrustId,
    domain,
    section,
    requirement,
    isoClause: domainInfo.isoClause,
    isoTitle: domainInfo.isoTitle,
    nistFamily: domainInfo.nistFamily,
    nistFamilyName: domainInfo.nistFamilyName,
  }
}

/**
 * Given a HITRUST ID, return the canonical NIST family hint for mapping resolution.
 * This is used by the MappingEngine to narrow the search space in canonical_controls.
 *
 * NOTE: This returns a HINT, not a definitive mapping. The actual canonical ID
 * must be resolved via the mapping_rules table, not string comparison.
 */
export function normalizeToCanonical(hitrustId: string): HitrustCanonicalHint | null {
  const decoded = decodeHitrustId(hitrustId)
  if (!decoded) return null

  return {
    canonicalHint: `${decoded.nistFamily} (${decoded.nistFamilyName}) — domain ${decoded.domain}.${decoded.section}.${decoded.requirement}`,
    nistFamily: decoded.nistFamily,
    isoClause: decoded.isoClause,
  }
}

/**
 * Validate that a string looks like a HITRUST CSF control ID.
 */
export function isHitrustId(id: string): boolean {
  return /^\d{2}\.[a-z]+\.\d{2,3}$/.test(id.trim().toLowerCase())
}

/**
 * Normalize a HITRUST control ID to a canonical string form.
 * Returns lowercase with dots, e.g. '09.ab.01'
 */
export function normalizeHitrustId(id: string): string {
  const decoded = decodeHitrustId(id)
  if (!decoded) return id.trim().toLowerCase()
  return `${decoded.domain}.${decoded.section}.${decoded.requirement}`
}
