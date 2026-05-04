/**
 * CompliGuard v2 — SCF (Secure Controls Framework) Crosswalk
 *
 * Static lookup table: ~50 key SCF entries → NIST 800-53 Rev 5 control IDs.
 * This is the seed data for the `mapping_rules` table.
 * SCF is a metaframework — it is NEVER user-editable, seeded once to DB.
 *
 * SCF domains mapped:
 *   SCF-GOV → PM (Program Management)
 *   SCF-RSK → RA (Risk Assessment)
 *   SCF-IAC → AC (Access Control)
 *   SCF-CRY → SC (cryptography controls)
 *   SCF-NET → SC (network controls)
 *   SCF-END → SI (System & Information Integrity)
 *   SCF-IRM → IR (Incident Response)
 *   SCF-BCR → CP (Contingency Planning)
 *   SCF-CHG → CM (Configuration Management)
 *   SCF-AST → CM / SA (Asset Management)
 */

export interface ScfEntry {
  scfId: string
  scfTitle: string
  nistId: string
  mappingType: 'direct' | 'partial' | 'related'
  confidence: number // 0-100
  notes?: string
}

// ── SCF-GOV: Governance → NIST PM (Program Management) ───────────────────────

const SCF_GOV: ScfEntry[] = [
  {
    scfId: 'GOV-01',
    scfTitle: 'Cybersecurity & Data Privacy Governance Program',
    nistId: 'PM-1',
    mappingType: 'direct',
    confidence: 92,
    notes: 'PM-1 Information Security Program Plan',
  },
  {
    scfId: 'GOV-02',
    scfTitle: 'Publishing Cybersecurity & Data Privacy Documentation',
    nistId: 'PM-7',
    mappingType: 'direct',
    confidence: 88,
    notes: 'PM-7 Enterprise Architecture',
  },
  {
    scfId: 'GOV-03',
    scfTitle: 'Periodic Review & Update of Cybersecurity & Privacy Program',
    nistId: 'PM-9',
    mappingType: 'direct',
    confidence: 90,
    notes: 'PM-9 Risk Management Strategy',
  },
  {
    scfId: 'GOV-04',
    scfTitle: 'Assigned Security & Privacy Responsibilities',
    nistId: 'PM-2',
    mappingType: 'direct',
    confidence: 95,
    notes: 'PM-2 Senior Agency Information Security Officer',
  },
  {
    scfId: 'GOV-05',
    scfTitle: 'Measures of Performance',
    nistId: 'PM-6',
    mappingType: 'direct',
    confidence: 85,
    notes: 'PM-6 Information Security Measures of Performance',
  },
  {
    scfId: 'GOV-06',
    scfTitle: 'Governance & Oversight',
    nistId: 'PM-3',
    mappingType: 'direct',
    confidence: 88,
    notes: 'PM-3 Information Security Resources',
  },
  {
    scfId: 'GOV-07',
    scfTitle: 'Security & Privacy in Project Management',
    nistId: 'PM-7',
    mappingType: 'partial',
    confidence: 75,
    notes: 'Also relates to SA-3 System Development Life Cycle',
  },
]

// ── SCF-RSK: Risk Management → NIST RA (Risk Assessment) ─────────────────────

const SCF_RSK: ScfEntry[] = [
  {
    scfId: 'RSK-01',
    scfTitle: 'Risk Management Program',
    nistId: 'RA-1',
    mappingType: 'direct',
    confidence: 93,
    notes: 'RA-1 Risk Assessment Policy and Procedures',
  },
  {
    scfId: 'RSK-02',
    scfTitle: 'Risk Identification',
    nistId: 'RA-3',
    mappingType: 'direct',
    confidence: 95,
    notes: 'RA-3 Risk Assessment',
  },
  {
    scfId: 'RSK-03',
    scfTitle: 'Risk Ranking',
    nistId: 'RA-3',
    mappingType: 'partial',
    confidence: 82,
    notes: 'Risk scoring aspect of RA-3',
  },
  {
    scfId: 'RSK-04',
    scfTitle: 'Risk Register',
    nistId: 'RA-3',
    mappingType: 'related',
    confidence: 70,
    notes: 'Documentation of risk assessments',
  },
  {
    scfId: 'RSK-05',
    scfTitle: 'Risk Treatment',
    nistId: 'RA-7',
    mappingType: 'direct',
    confidence: 88,
    notes: 'RA-7 Risk Response; also PM-9 Risk Management Strategy',
  },
  {
    scfId: 'RSK-06',
    scfTitle: 'Supply Chain Risk Management (SCRM)',
    nistId: 'SR-3',
    mappingType: 'direct',
    confidence: 90,
    notes: 'SR-3 Supply Chain Controls and Processes',
  },
  {
    scfId: 'RSK-07',
    scfTitle: 'Technology Risk Assessments',
    nistId: 'RA-2',
    mappingType: 'direct',
    confidence: 85,
    notes: 'RA-2 Security Categorization',
  },
]

// ── SCF-IAC: Identity & Access Control → NIST AC (Access Control) ────────────

const SCF_IAC: ScfEntry[] = [
  {
    scfId: 'IAC-01',
    scfTitle: 'Identity & Access Management (IAM)',
    nistId: 'AC-1',
    mappingType: 'direct',
    confidence: 92,
    notes: 'AC-1 Access Control Policy and Procedures',
  },
  {
    scfId: 'IAC-02',
    scfTitle: 'Account Management',
    nistId: 'AC-2',
    mappingType: 'direct',
    confidence: 98,
    notes: 'AC-2 Account Management — near 1:1 mapping',
  },
  {
    scfId: 'IAC-03',
    scfTitle: 'Access Enforcement',
    nistId: 'AC-3',
    mappingType: 'direct',
    confidence: 97,
    notes: 'AC-3 Access Enforcement',
  },
  {
    scfId: 'IAC-06',
    scfTitle: 'Least Privilege',
    nistId: 'AC-6',
    mappingType: 'direct',
    confidence: 98,
    notes: 'AC-6 Least Privilege — direct 1:1',
  },
  {
    scfId: 'IAC-07',
    scfTitle: 'Unsuccessful Login Attempts',
    nistId: 'AC-7',
    mappingType: 'direct',
    confidence: 97,
    notes: 'AC-7 Unsuccessful Logon Attempts',
  },
  {
    scfId: 'IAC-08',
    scfTitle: 'System Use Notification',
    nistId: 'AC-8',
    mappingType: 'direct',
    confidence: 96,
    notes: 'AC-8 System Use Notification',
  },
  {
    scfId: 'IAC-15',
    scfTitle: 'Remote Access',
    nistId: 'AC-17',
    mappingType: 'direct',
    confidence: 95,
    notes: 'AC-17 Remote Access',
  },
  {
    scfId: 'IAC-16',
    scfTitle: 'Wireless Access Restrictions',
    nistId: 'AC-18',
    mappingType: 'direct',
    confidence: 95,
    notes: 'AC-18 Wireless Access',
  },
  {
    scfId: 'IAC-21',
    scfTitle: 'Multi-Factor Authentication (MFA)',
    nistId: 'IA-2',
    mappingType: 'direct',
    confidence: 93,
    notes: 'IA-2 Identification and Authentication (Organizational Users)',
  },
  {
    scfId: 'IAC-22',
    scfTitle: 'Authenticator Management',
    nistId: 'IA-5',
    mappingType: 'direct',
    confidence: 95,
    notes: 'IA-5 Authenticator Management',
  },
]

// ── SCF-CRY: Cryptography → NIST SC cryptography controls ────────────────────

const SCF_CRY: ScfEntry[] = [
  {
    scfId: 'CRY-01',
    scfTitle: 'Use of Cryptographic Controls',
    nistId: 'SC-13',
    mappingType: 'direct',
    confidence: 93,
    notes: 'SC-13 Cryptographic Protection',
  },
  {
    scfId: 'CRY-02',
    scfTitle: 'Encryption & Key Management',
    nistId: 'SC-12',
    mappingType: 'direct',
    confidence: 95,
    notes: 'SC-12 Cryptographic Key Establishment and Management',
  },
  {
    scfId: 'CRY-03',
    scfTitle: 'Transmission Confidentiality',
    nistId: 'SC-8',
    mappingType: 'direct',
    confidence: 96,
    notes: 'SC-8 Transmission Confidentiality and Integrity',
  },
  {
    scfId: 'CRY-04',
    scfTitle: 'Encryption at Rest',
    nistId: 'SC-28',
    mappingType: 'direct',
    confidence: 95,
    notes: 'SC-28 Protection of Information at Rest',
  },
  {
    scfId: 'CRY-05',
    scfTitle: 'PKI & Certificate Management',
    nistId: 'SC-17',
    mappingType: 'direct',
    confidence: 90,
    notes: 'SC-17 Public Key Infrastructure Certificates',
  },
  {
    scfId: 'CRY-06',
    scfTitle: 'Cryptographic Hashing',
    nistId: 'SI-7',
    mappingType: 'partial',
    confidence: 72,
    notes: 'SI-7 Software, Firmware, and Information Integrity — hashing as integrity mechanism',
  },
]

// ── SCF-NET: Network Security → NIST SC network controls ─────────────────────

const SCF_NET: ScfEntry[] = [
  {
    scfId: 'NET-01',
    scfTitle: 'Network Security Controls',
    nistId: 'SC-7',
    mappingType: 'direct',
    confidence: 94,
    notes: 'SC-7 Boundary Protection',
  },
  {
    scfId: 'NET-02',
    scfTitle: 'Firewall Rules Management',
    nistId: 'SC-7',
    mappingType: 'partial',
    confidence: 85,
    notes: 'SC-7(5) Deny by Default / Allow by Exception',
  },
  {
    scfId: 'NET-03',
    scfTitle: 'Network Segmentation',
    nistId: 'SC-32',
    mappingType: 'direct',
    confidence: 88,
    notes: 'SC-32 System Partitioning',
  },
  {
    scfId: 'NET-04',
    scfTitle: 'Network Intrusion Detection / Prevention',
    nistId: 'SI-4',
    mappingType: 'direct',
    confidence: 90,
    notes: 'SI-4 System Monitoring',
  },
  {
    scfId: 'NET-05',
    scfTitle: 'Wireless Networking',
    nistId: 'AC-18',
    mappingType: 'direct',
    confidence: 92,
    notes: 'AC-18 Wireless Access',
  },
  {
    scfId: 'NET-06',
    scfTitle: 'Remote Diagnostics & Maintenance Ports',
    nistId: 'MA-4',
    mappingType: 'direct',
    confidence: 88,
    notes: 'MA-4 Nonlocal Maintenance',
  },
]

// ── SCF-END: Endpoint Security → NIST SI (System & Information Integrity) ─────

const SCF_END: ScfEntry[] = [
  {
    scfId: 'END-01',
    scfTitle: 'Endpoint Security',
    nistId: 'SI-3',
    mappingType: 'direct',
    confidence: 88,
    notes: 'SI-3 Malicious Code Protection',
  },
  {
    scfId: 'END-02',
    scfTitle: 'Malware Protection',
    nistId: 'SI-3',
    mappingType: 'direct',
    confidence: 97,
    notes: 'SI-3 Malicious Code Protection — near direct 1:1',
  },
  {
    scfId: 'END-03',
    scfTitle: 'Software Patching & Vulnerability Management',
    nistId: 'SI-2',
    mappingType: 'direct',
    confidence: 95,
    notes: 'SI-2 Flaw Remediation',
  },
  {
    scfId: 'END-04',
    scfTitle: 'Host-Based Intrusion Detection',
    nistId: 'SI-4',
    mappingType: 'partial',
    confidence: 80,
    notes: 'SI-4 System Monitoring — host-based aspect',
  },
  {
    scfId: 'END-05',
    scfTitle: 'Mobile Device Management (MDM)',
    nistId: 'AC-19',
    mappingType: 'direct',
    confidence: 90,
    notes: 'AC-19 Access Control for Mobile Devices',
  },
]

// ── SCF-IRM: Incident Response → NIST IR ─────────────────────────────────────

const SCF_IRM: ScfEntry[] = [
  {
    scfId: 'IRM-01',
    scfTitle: 'Incident Response Program',
    nistId: 'IR-1',
    mappingType: 'direct',
    confidence: 93,
    notes: 'IR-1 Incident Response Policy and Procedures',
  },
  {
    scfId: 'IRM-02',
    scfTitle: 'Incident Response Plan',
    nistId: 'IR-8',
    mappingType: 'direct',
    confidence: 97,
    notes: 'IR-8 Incident Response Plan',
  },
  {
    scfId: 'IRM-03',
    scfTitle: 'Incident Response Testing',
    nistId: 'IR-3',
    mappingType: 'direct',
    confidence: 96,
    notes: 'IR-3 Incident Response Testing',
  },
  {
    scfId: 'IRM-04',
    scfTitle: 'Incident Response Training',
    nistId: 'IR-2',
    mappingType: 'direct',
    confidence: 97,
    notes: 'IR-2 Incident Response Training',
  },
  {
    scfId: 'IRM-05',
    scfTitle: 'Incident Handling',
    nistId: 'IR-4',
    mappingType: 'direct',
    confidence: 95,
    notes: 'IR-4 Incident Handling',
  },
  {
    scfId: 'IRM-06',
    scfTitle: 'Incident Monitoring',
    nistId: 'IR-5',
    mappingType: 'direct',
    confidence: 95,
    notes: 'IR-5 Incident Monitoring',
  },
]

// ── SCF-BCR: Business Continuity & Recovery → NIST CP ────────────────────────

const SCF_BCR: ScfEntry[] = [
  {
    scfId: 'BCR-01',
    scfTitle: 'Business Continuity Management Program',
    nistId: 'CP-1',
    mappingType: 'direct',
    confidence: 93,
    notes: 'CP-1 Contingency Planning Policy and Procedures',
  },
  {
    scfId: 'BCR-02',
    scfTitle: 'Business Impact Analysis (BIA)',
    nistId: 'CP-2',
    mappingType: 'direct',
    confidence: 88,
    notes: 'CP-2 Contingency Plan includes BIA',
  },
  {
    scfId: 'BCR-03',
    scfTitle: 'Business Continuity Plan (BCP)',
    nistId: 'CP-2',
    mappingType: 'direct',
    confidence: 94,
    notes: 'CP-2 Contingency Plan',
  },
  {
    scfId: 'BCR-04',
    scfTitle: 'Backup & Recovery',
    nistId: 'CP-9',
    mappingType: 'direct',
    confidence: 97,
    notes: 'CP-9 System Backup',
  },
  {
    scfId: 'BCR-05',
    scfTitle: 'Disaster Recovery Plan (DRP)',
    nistId: 'CP-10',
    mappingType: 'direct',
    confidence: 90,
    notes: 'CP-10 System Recovery and Reconstitution',
  },
  {
    scfId: 'BCR-06',
    scfTitle: 'Continuity Testing',
    nistId: 'CP-4',
    mappingType: 'direct',
    confidence: 95,
    notes: 'CP-4 Contingency Plan Testing',
  },
]

// ── SCF-CHG: Change Management → NIST CM (Configuration Management) ──────────

const SCF_CHG: ScfEntry[] = [
  {
    scfId: 'CHG-01',
    scfTitle: 'Change Management Program',
    nistId: 'CM-1',
    mappingType: 'direct',
    confidence: 90,
    notes: 'CM-1 Configuration Management Policy and Procedures',
  },
  {
    scfId: 'CHG-02',
    scfTitle: 'Configuration Change Control',
    nistId: 'CM-3',
    mappingType: 'direct',
    confidence: 97,
    notes: 'CM-3 Configuration Change Control — near direct 1:1',
  },
  {
    scfId: 'CHG-03',
    scfTitle: 'Baseline Configuration',
    nistId: 'CM-2',
    mappingType: 'direct',
    confidence: 97,
    notes: 'CM-2 Baseline Configuration',
  },
  {
    scfId: 'CHG-04',
    scfTitle: 'Security Impact Analysis',
    nistId: 'CM-4',
    mappingType: 'direct',
    confidence: 95,
    notes: 'CM-4 Impact Analyses',
  },
  {
    scfId: 'CHG-05',
    scfTitle: 'Software Usage Restrictions',
    nistId: 'CM-10',
    mappingType: 'direct',
    confidence: 92,
    notes: 'CM-10 Software Usage Restrictions',
  },
  {
    scfId: 'CHG-06',
    scfTitle: 'Unauthorized Software Restrictions',
    nistId: 'CM-7',
    mappingType: 'direct',
    confidence: 90,
    notes: 'CM-7 Least Functionality',
  },
]

// ── SCF-AST: Asset Management → NIST CM / SA ─────────────────────────────────

const SCF_AST: ScfEntry[] = [
  {
    scfId: 'AST-01',
    scfTitle: 'Asset Management',
    nistId: 'CM-8',
    mappingType: 'direct',
    confidence: 90,
    notes: 'CM-8 System Component Inventory',
  },
  {
    scfId: 'AST-02',
    scfTitle: 'Asset Inventory',
    nistId: 'CM-8',
    mappingType: 'direct',
    confidence: 97,
    notes: 'CM-8 System Component Inventory — near direct 1:1',
  },
  {
    scfId: 'AST-03',
    scfTitle: 'Asset Classification',
    nistId: 'RA-2',
    mappingType: 'partial',
    confidence: 78,
    notes: 'RA-2 Security Categorization applies to information/systems',
  },
  {
    scfId: 'AST-04',
    scfTitle: 'Media Handling',
    nistId: 'MP-1',
    mappingType: 'direct',
    confidence: 88,
    notes: 'MP-1 Media Protection Policy and Procedures',
  },
  {
    scfId: 'AST-05',
    scfTitle: 'Media Sanitization',
    nistId: 'MP-6',
    mappingType: 'direct',
    confidence: 95,
    notes: 'MP-6 Media Sanitization',
  },
  {
    scfId: 'AST-06',
    scfTitle: 'Information & Asset Disposal',
    nistId: 'MP-6',
    mappingType: 'partial',
    confidence: 82,
    notes: 'MP-6 Media Sanitization (disposal aspect)',
  },
  {
    scfId: 'AST-07',
    scfTitle: 'Component Lifecycle',
    nistId: 'SA-22',
    mappingType: 'related',
    confidence: 68,
    notes: 'SA-22 Unsupported System Components',
  },
]

// ── Consolidated export ───────────────────────────────────────────────────────

export const SCF_CROSSWALK: ScfEntry[] = [
  ...SCF_GOV,
  ...SCF_RSK,
  ...SCF_IAC,
  ...SCF_CRY,
  ...SCF_NET,
  ...SCF_END,
  ...SCF_IRM,
  ...SCF_BCR,
  ...SCF_CHG,
  ...SCF_AST,
]

export const SCF_DOMAINS: Record<string, { title: string; nistFamily: string; entries: ScfEntry[] }> = {
  'SCF-GOV': { title: 'Governance', nistFamily: 'PM', entries: SCF_GOV },
  'SCF-RSK': { title: 'Risk Management', nistFamily: 'RA', entries: SCF_RSK },
  'SCF-IAC': { title: 'Identity & Access Control', nistFamily: 'AC', entries: SCF_IAC },
  'SCF-CRY': { title: 'Cryptography', nistFamily: 'SC', entries: SCF_CRY },
  'SCF-NET': { title: 'Network Security', nistFamily: 'SC', entries: SCF_NET },
  'SCF-END': { title: 'Endpoint Security', nistFamily: 'SI', entries: SCF_END },
  'SCF-IRM': { title: 'Incident Response', nistFamily: 'IR', entries: SCF_IRM },
  'SCF-BCR': { title: 'Business Continuity & Recovery', nistFamily: 'CP', entries: SCF_BCR },
  'SCF-CHG': { title: 'Change Management', nistFamily: 'CM', entries: SCF_CHG },
  'SCF-AST': { title: 'Asset Management', nistFamily: 'CM', entries: SCF_AST },
}

/**
 * Look up SCF entries by NIST control ID.
 * Returns all SCF controls that map to the given NIST ID.
 */
export function lookupByNistId(nistId: string): ScfEntry[] {
  return SCF_CROSSWALK.filter(
    (entry) => entry.nistId.toLowerCase() === nistId.toLowerCase()
  )
}

/**
 * Look up a single SCF entry by SCF ID.
 */
export function lookupByScfId(scfId: string): ScfEntry | undefined {
  return SCF_CROSSWALK.find(
    (entry) => entry.scfId.toLowerCase() === scfId.toLowerCase()
  )
}

/**
 * Get all SCF entries for a given NIST family prefix (e.g. 'AC', 'SI').
 */
export function lookupByNistFamily(family: string): ScfEntry[] {
  const prefix = family.toUpperCase()
  return SCF_CROSSWALK.filter((entry) =>
    entry.nistId.toUpperCase().startsWith(prefix + '-')
  )
}
