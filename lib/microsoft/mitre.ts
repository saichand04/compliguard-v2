/**
 * lib/microsoft/mitre.ts
 * MITRE ATT&CK enrichment for Sentinel incidents and Defender alerts.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MitreAttackInfo {
  techniqueId: string
  techniqueName: string
  tacticId: string
  tacticName: string
  description: string
  url: string
  nistControls: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
}

// ── Tactic → NIST mapping ─────────────────────────────────────────────────────

export const TACTIC_NIST_MAP: Record<string, string[]> = {
  InitialAccess:       ['AC-17', 'CM-7', 'SC-7'],
  Execution:           ['CM-7', 'SI-3', 'SI-7'],
  Persistence:         ['AC-2', 'CM-6', 'SI-7'],
  PrivilegeEscalation: ['AC-3', 'AC-6', 'CM-5'],
  DefenseEvasion:      ['AU-12', 'SI-3', 'SI-4'],
  CredentialAccess:    ['IA-2', 'IA-5', 'SC-28'],
  Discovery:           ['AC-4', 'AU-12', 'CM-8'],
  LateralMovement:     ['AC-4', 'SC-7', 'SI-4'],
  Collection:          ['AC-3', 'AU-12', 'MP-2'],
  CommandAndControl:   ['SC-7', 'SC-44', 'SI-4'],
  Exfiltration:        ['AC-4', 'CA-7', 'DM-2'],
  Impact:              ['CP-9', 'CP-10', 'SI-7'],
}

// ── Tactic ID + display name mapping ─────────────────────────────────────────

const TACTIC_META: Record<string, { id: string; name: string }> = {
  InitialAccess:       { id: 'TA0001', name: 'Initial Access' },
  Execution:           { id: 'TA0002', name: 'Execution' },
  Persistence:         { id: 'TA0003', name: 'Persistence' },
  PrivilegeEscalation: { id: 'TA0004', name: 'Privilege Escalation' },
  DefenseEvasion:      { id: 'TA0005', name: 'Defense Evasion' },
  CredentialAccess:    { id: 'TA0006', name: 'Credential Access' },
  Discovery:           { id: 'TA0007', name: 'Discovery' },
  LateralMovement:     { id: 'TA0008', name: 'Lateral Movement' },
  Collection:          { id: 'TA0009', name: 'Collection' },
  CommandAndControl:   { id: 'TA0011', name: 'Command and Control' },
  Exfiltration:        { id: 'TA0010', name: 'Exfiltration' },
  Impact:              { id: 'TA0040', name: 'Impact' },
  Reconnaissance:      { id: 'TA0043', name: 'Reconnaissance' },
  ResourceDevelopment: { id: 'TA0042', name: 'Resource Development' },
}

// ── Technique map (~50+ common techniques) ────────────────────────────────────

export const TECHNIQUE_MAP: Record<string, { name: string; tactic: string; severity: string; description: string }> = {
  T1078: { name: 'Valid Accounts', tactic: 'InitialAccess', severity: 'high', description: 'Adversaries may obtain and abuse credentials of existing accounts as a means of gaining Initial Access.' },
  T1110: { name: 'Brute Force', tactic: 'CredentialAccess', severity: 'high', description: 'Adversaries may use brute force techniques to gain access to accounts when passwords are unknown or when password hashes are obtained.' },
  T1566: { name: 'Phishing', tactic: 'InitialAccess', severity: 'high', description: 'Adversaries may send phishing messages to gain access to victim systems.' },
  T1059: { name: 'Command and Scripting Interpreter', tactic: 'Execution', severity: 'medium', description: 'Adversaries may abuse command and script interpreters to execute commands, scripts, or binaries.' },
  T1053: { name: 'Scheduled Task/Job', tactic: 'Persistence', severity: 'medium', description: 'Adversaries may abuse task scheduling functionality to facilitate initial or recurring execution of malicious code.' },
  T1547: { name: 'Boot or Logon Autostart Execution', tactic: 'Persistence', severity: 'high', description: 'Adversaries may configure system settings to automatically execute a program during system boot or logon.' },
  T1068: { name: 'Exploitation for Privilege Escalation', tactic: 'PrivilegeEscalation', severity: 'critical', description: 'Adversaries may exploit software vulnerabilities in an attempt to elevate privileges.' },
  T1021: { name: 'Remote Services', tactic: 'LateralMovement', severity: 'medium', description: 'Adversaries may use valid accounts to log into a service specifically designed to accept remote connections.' },
  T1048: { name: 'Exfiltration Over Alternative Protocol', tactic: 'Exfiltration', severity: 'high', description: 'Adversaries may steal data by exfiltrating it over a different protocol than that of the existing command and control channel.' },
  T1486: { name: 'Data Encrypted for Impact', tactic: 'Impact', severity: 'critical', description: 'Adversaries may encrypt data on target systems or on large numbers of systems in a network to interrupt availability to system and network resources (ransomware).' },
  T1055: { name: 'Process Injection', tactic: 'PrivilegeEscalation', severity: 'high', description: 'Adversaries may inject code into processes to evade process-based defenses and possibly elevate privileges.' },
  T1027: { name: 'Obfuscated Files or Information', tactic: 'DefenseEvasion', severity: 'medium', description: 'Adversaries may attempt to make an executable or file difficult to discover or analyze.' },
  T1070: { name: 'Indicator Removal', tactic: 'DefenseEvasion', severity: 'high', description: 'Adversaries may delete or alter generated artifacts on a host system, including logs or captured files.' },
  T1003: { name: 'OS Credential Dumping', tactic: 'CredentialAccess', severity: 'critical', description: 'Adversaries may attempt to dump credentials to obtain account login and credential material.' },
  T1087: { name: 'Account Discovery', tactic: 'Discovery', severity: 'low', description: 'Adversaries may attempt to get a listing of local system or domain accounts.' },
  T1082: { name: 'System Information Discovery', tactic: 'Discovery', severity: 'low', description: 'An adversary may attempt to get detailed information about the operating system and hardware.' },
  T1018: { name: 'Remote System Discovery', tactic: 'Discovery', severity: 'medium', description: 'Adversaries may attempt to get a listing of other systems by IP address, hostname, or other logical identifier.' },
  T1057: { name: 'Process Discovery', tactic: 'Discovery', severity: 'low', description: 'Adversaries may attempt to get information about running processes on a system.' },
  T1083: { name: 'File and Directory Discovery', tactic: 'Discovery', severity: 'low', description: 'Adversaries may enumerate files and directories or search for specific information on a host.' },
  T1005: { name: 'Data from Local System', tactic: 'Collection', severity: 'medium', description: 'Adversaries may search local system sources, such as file systems and configuration files or local databases, to find files of interest.' },
  T1039: { name: 'Data from Network Shared Drive', tactic: 'Collection', severity: 'medium', description: 'Adversaries may search network shares on computers they have compromised to find files of interest.' },
  T1113: { name: 'Screen Capture', tactic: 'Collection', severity: 'medium', description: 'Adversaries may attempt to take screen captures of the desktop to gather information.' },
  T1056: { name: 'Input Capture', tactic: 'Collection', severity: 'high', description: 'Adversaries may use methods of capturing user input to obtain credentials or collect information.' },
  T1071: { name: 'Application Layer Protocol', tactic: 'CommandAndControl', severity: 'medium', description: 'Adversaries may communicate using application layer protocols to avoid detection.' },
  T1105: { name: 'Ingress Tool Transfer', tactic: 'CommandAndControl', severity: 'medium', description: 'Adversaries may transfer tools or other files from an external system into a compromised environment.' },
  T1219: { name: 'Remote Access Software', tactic: 'CommandAndControl', severity: 'high', description: 'Adversaries may use legitimate desktop support and remote access software, such as Team Viewer, etc.' },
  T1041: { name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration', severity: 'high', description: 'Adversaries may steal data by exfiltrating it over an existing command and control channel.' },
  T1567: { name: 'Exfiltration Over Web Service', tactic: 'Exfiltration', severity: 'high', description: 'Adversaries may use an existing legitimate external Web service to exfiltrate data.' },
  T1485: { name: 'Data Destruction', tactic: 'Impact', severity: 'critical', description: 'Adversaries may destroy data and files on specific systems or in large numbers on a network.' },
  T1490: { name: 'Inhibit System Recovery', tactic: 'Impact', severity: 'critical', description: 'Adversaries may delete or remove built-in operating system data and turn off services designed to aid in the recovery of a corrupted system.' },
  T1489: { name: 'Service Stop', tactic: 'Impact', severity: 'high', description: 'Adversaries may stop or disable services on a system to render those services unavailable to legitimate users.' },
  T1098: { name: 'Account Manipulation', tactic: 'Persistence', severity: 'high', description: 'Adversaries may manipulate accounts to maintain access to victim systems.' },
  T1136: { name: 'Create Account', tactic: 'Persistence', severity: 'medium', description: 'Adversaries may create an account to maintain access to victim systems.' },
  T1543: { name: 'Create or Modify System Process', tactic: 'Persistence', severity: 'high', description: 'Adversaries may create or modify system-level processes to repeatedly execute malicious payloads.' },
  T1569: { name: 'System Services', tactic: 'Execution', severity: 'high', description: 'Adversaries may abuse system services or daemons to execute commands or programs.' },
  T1204: { name: 'User Execution', tactic: 'Execution', severity: 'medium', description: 'An adversary may rely upon specific actions by a user in order to gain execution.' },
  T1190: { name: 'Exploit Public-Facing Application', tactic: 'InitialAccess', severity: 'critical', description: 'Adversaries may attempt to take advantage of a weakness in an Internet-facing computer or program using a software, data, or command.' },
  T1133: { name: 'External Remote Services', tactic: 'InitialAccess', severity: 'high', description: 'Adversaries may leverage external-facing remote services to initially access and/or persist within a network.' },
  T1189: { name: 'Drive-by Compromise', tactic: 'InitialAccess', severity: 'high', description: 'Adversaries may gain access to a system through a user visiting a website over the normal course of browsing.' },
  T1195: { name: 'Supply Chain Compromise', tactic: 'InitialAccess', severity: 'critical', description: 'Adversaries may manipulate products or product delivery mechanisms prior to receipt by a final consumer.' },
  T1566001: { name: 'Spearphishing Attachment', tactic: 'InitialAccess', severity: 'high', description: 'Adversaries may send spearphishing emails with a malicious attachment in an attempt to gain access.' },
  T1566002: { name: 'Spearphishing Link', tactic: 'InitialAccess', severity: 'high', description: 'Adversaries may send spearphishing emails with a malicious link.' },
  T1102: { name: 'Web Service', tactic: 'CommandAndControl', severity: 'medium', description: 'Adversaries may use an existing, legitimate external Web service as a means for relaying data.' },
  T1132: { name: 'Data Encoding', tactic: 'CommandAndControl', severity: 'low', description: 'Adversaries may encode data to make the content of command and control traffic more difficult to detect.' },
  T1011: { name: 'Exfiltration Over Other Network Medium', tactic: 'Exfiltration', severity: 'medium', description: 'Adversaries may attempt to exfiltrate data over a different network medium than the command and control channel.' },
  T1001: { name: 'Data Obfuscation', tactic: 'CommandAndControl', severity: 'low', description: 'Adversaries may obfuscate command and control traffic to make it more difficult to detect.' },
  T1074: { name: 'Data Staged', tactic: 'Collection', severity: 'medium', description: 'Adversaries may stage collected data in a central location or directory prior to exfiltration.' },
  T1560: { name: 'Archive Collected Data', tactic: 'Collection', severity: 'medium', description: 'An adversary may compress and/or encrypt data that is collected prior to exfiltration.' },
  T1550: { name: 'Use Alternate Authentication Material', tactic: 'LateralMovement', severity: 'high', description: 'Adversaries may use alternate authentication material, such as password hashes, Kerberos tickets, and application access tokens.' },
  T1534: { name: 'Internal Spearphishing', tactic: 'LateralMovement', severity: 'high', description: 'Adversaries may use internal spearphishing to gain access to additional information or exploit other users within the same organization.' },
  T1210: { name: 'Exploitation of Remote Services', tactic: 'LateralMovement', severity: 'critical', description: 'Adversaries may exploit remote services to gain unauthorized access to internal systems once inside of a network.' },
}

// ── Severity ordering for tactic-level fallback ───────────────────────────────

const TACTIC_SEVERITY_MAP: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  InitialAccess: 'high',
  Execution: 'medium',
  Persistence: 'high',
  PrivilegeEscalation: 'critical',
  DefenseEvasion: 'high',
  CredentialAccess: 'high',
  Discovery: 'low',
  LateralMovement: 'high',
  Collection: 'medium',
  CommandAndControl: 'medium',
  Exfiltration: 'high',
  Impact: 'critical',
  Reconnaissance: 'low',
  ResourceDevelopment: 'low',
}

// ── Sentinel tactic name normalization ────────────────────────────────────────

function normalizeTactic(raw: string): string {
  // Sentinel uses PascalCase internally; also handle spaced names
  const map: Record<string, string> = {
    'Initial Access': 'InitialAccess',
    'Privilege Escalation': 'PrivilegeEscalation',
    'Defense Evasion': 'DefenseEvasion',
    'Credential Access': 'CredentialAccess',
    'Lateral Movement': 'LateralMovement',
    'Command And Control': 'CommandAndControl',
    'Command and Control': 'CommandAndControl',
    'Resource Development': 'ResourceDevelopment',
  }
  return map[raw] ?? raw
}

// ── Main enrichment function ──────────────────────────────────────────────────

export function enrichWithMitre(tactics: string[], techniques?: string[]): MitreAttackInfo[] {
  const results: MitreAttackInfo[] = []
  const seen = new Set<string>()

  // Enrich via specific techniques first
  if (techniques && techniques.length > 0) {
    for (const techId of techniques) {
      const cleanId = techId.replace('.', '') // T1566.001 → T1566001
      const tech = TECHNIQUE_MAP[techId] ?? TECHNIQUE_MAP[cleanId]
      if (!tech) continue
      if (seen.has(techId)) continue
      seen.add(techId)

      const tactic = normalizeTactic(tech.tactic)
      const tacticMeta = TACTIC_META[tactic] ?? { id: 'TA0000', name: tactic }
      const nistControls = TACTIC_NIST_MAP[tactic] ?? []

      results.push({
        techniqueId: techId,
        techniqueName: tech.name,
        tacticId: tacticMeta.id,
        tacticName: tacticMeta.name,
        description: tech.description,
        url: `https://attack.mitre.org/techniques/${techId.replace('.', '/')}/`,
        nistControls,
        severity: tech.severity as 'critical' | 'high' | 'medium' | 'low',
      })
    }
  }

  // Enrich via tactics when no technique matched
  for (const rawTactic of tactics) {
    const tactic = normalizeTactic(rawTactic)
    const tacticMeta = TACTIC_META[tactic]
    if (!tacticMeta) continue

    // Look for a representative technique for this tactic
    const representativeTech = Object.entries(TECHNIQUE_MAP).find(
      ([, v]) => normalizeTactic(v.tactic) === tactic && !seen.has(Object.entries(TECHNIQUE_MAP).find(([k]) => k === Object.entries(TECHNIQUE_MAP).find(([, vv]) => vv === v)?.[0])?.[0] ?? ''),
    )

    const nistControls = TACTIC_NIST_MAP[tactic] ?? []
    const severity = TACTIC_SEVERITY_MAP[tactic] ?? 'medium'

    if (representativeTech) {
      const [techId, techData] = representativeTech
      if (!seen.has(techId)) {
        seen.add(techId)
        results.push({
          techniqueId: techId,
          techniqueName: techData.name,
          tacticId: tacticMeta.id,
          tacticName: tacticMeta.name,
          description: techData.description,
          url: `https://attack.mitre.org/techniques/${techId}/`,
          nistControls,
          severity: techData.severity as 'critical' | 'high' | 'medium' | 'low',
        })
      }
    } else {
      // Tactic-only entry (no specific technique matched)
      const tacticKey = `tactic-${tactic}`
      if (!seen.has(tacticKey)) {
        seen.add(tacticKey)
        results.push({
          techniqueId: tacticMeta.id,
          techniqueName: tacticMeta.name,
          tacticId: tacticMeta.id,
          tacticName: tacticMeta.name,
          description: `ATT&CK tactic: ${tacticMeta.name}. Review related techniques for this tactic.`,
          url: `https://attack.mitre.org/tactics/${tacticMeta.id}/`,
          nistControls,
          severity,
        })
      }
    }
  }

  return results
}

// ── Utility: get all NIST controls from a set of MITRE infos ─────────────────

export function collectNistControls(mitreInfos: MitreAttackInfo[]): string[] {
  const set = new Set<string>()
  for (const m of mitreInfos) {
    for (const ctrl of m.nistControls) {
      set.add(ctrl)
    }
  }
  return Array.from(set).sort()
}

// ── Utility: highest severity from a set of MITRE infos ──────────────────────

export function highestSeverity(mitreInfos: MitreAttackInfo[]): 'critical' | 'high' | 'medium' | 'low' {
  const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  let best = 'low'
  for (const m of mitreInfos) {
    if ((order[m.severity] ?? 0) > (order[best] ?? 0)) best = m.severity
  }
  return best as 'critical' | 'high' | 'medium' | 'low'
}
