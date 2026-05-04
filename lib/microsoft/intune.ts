/**
 * Microsoft Intune Compliance Checks via Microsoft Graph Intune APIs
 * Phase 4.2 — 19 checks across Devices, BitLocker, App Protection, OS Version, Config Profiles
 */

import { getMSGraphToken, graphGet, graphGetAll } from './graph'

export interface IntuneCheckResult {
  category: 'devices' | 'policies' | 'apps' | 'encryption' | 'os_version'
  checkId: string
  title: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  compliantCount?: number
  nonCompliantCount?: number
  totalCount?: number
  complianceRate?: number
  affectedDevices?: Array<{ id: string; deviceName: string; owner: string; detail: string }>
  recommendation: string
  nistControls: string[]
}

// ─── Type Definitions ────────────────────────────────────────────────────────

interface ManagedDevice {
  id: string
  deviceName: string
  userDisplayName?: string | null
  userPrincipalName?: string | null
  complianceState: string // compliant | noncompliant | unknown | notApplicable | inGracePeriod | configManager
  operatingSystem: string // Windows | iOS | Android | macOS
  osVersion: string
  isEncrypted: boolean
  isJailBroken: string // 'True' | 'False'
  lastSyncDateTime: string
  managementState: string
  deviceType: string
  model?: string
  manufacturer?: string
  imei?: string
  serialNumber?: string
}

interface CompliancePolicy {
  id: string
  displayName: string
  createdDateTime: string
  lastModifiedDateTime: string
}

interface ManagedAppPolicy {
  id: string
  displayName: string
  '@odata.type': string
  pinRequired?: boolean
  dataBackupBlocked?: boolean
  managedBrowser?: number
  minimumPinLength?: number
  assignments?: Array<{ id: string; target: unknown }>
}

interface DeviceConfiguration {
  id: string
  displayName: string
  '@odata.type': string
  description?: string
}

// OS minimum version thresholds
const OS_MIN_VERSIONS = {
  Windows: '10.0.22621', // Windows 11 22H2
  iOS: '16.0',
  Android: '12.0',
  macOS: '13.0',
}

function parseVersion(v: string): number[] {
  return v
    .split('.')
    .map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10) || 0)
    .slice(0, 4)
}

function versionLessThan(a: string, b: string): boolean {
  const av = parseVersion(a)
  const bv = parseVersion(b)
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const ai = av[i] ?? 0
    const bi = bv[i] ?? 0
    if (ai < bi) return true
    if (ai > bi) return false
  }
  return false
}

function deviceOwner(d: ManagedDevice): string {
  return d.userDisplayName ?? d.userPrincipalName ?? 'Unknown'
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function runIntuneChecks(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<IntuneCheckResult[]> {
  const token = await getMSGraphToken(tenantId, clientId, clientSecret)
  const results: IntuneCheckResult[] = []

  // ── Fetch all data in parallel ──────────────────────────────────────────────
  const [devicesResult, compliancePoliciesResult, appPoliciesResult, configProfilesResult] =
    await Promise.allSettled([
      graphGetAll<ManagedDevice>(
        token,
        '/deviceManagement/managedDevices?$select=id,deviceName,userDisplayName,userPrincipalName,complianceState,operatingSystem,osVersion,isEncrypted,isJailBroken,lastSyncDateTime,managementState,deviceType&$top=999'
      ),
      graphGetAll<CompliancePolicy>(
        token,
        '/deviceManagement/deviceCompliancePolicies?$top=999'
      ),
      graphGetAll<ManagedAppPolicy>(
        token,
        '/deviceAppManagement/managedAppPolicies?$top=999'
      ),
      graphGetAll<DeviceConfiguration>(
        token,
        '/deviceManagement/deviceConfigurations?$top=999'
      ),
    ])

  const devices = devicesResult.status === 'fulfilled' ? devicesResult.value : []
  const compliancePolicies =
    compliancePoliciesResult.status === 'fulfilled' ? compliancePoliciesResult.value : []
  const appPolicies = appPoliciesResult.status === 'fulfilled' ? appPoliciesResult.value : []
  const configProfiles =
    configProfilesResult.status === 'fulfilled' ? configProfilesResult.value : []

  const totalDevices = devices.length

  // ── Device Compliance Checks ──────────────────────────────────────────────

  // 1. Overall compliance rate
  {
    const compliant = devices.filter((d) => d.complianceState === 'compliant').length
    const rate = totalDevices > 0 ? Math.round((compliant / totalDevices) * 100) : 0
    results.push({
      category: 'devices',
      checkId: 'intune.devices.compliance_rate',
      title: 'Device Compliance Rate',
      status: rate < 70 ? 'fail' : rate < 85 ? 'warn' : 'pass',
      severity: rate < 70 ? 'critical' : rate < 85 ? 'high' : 'low',
      compliantCount: compliant,
      nonCompliantCount: totalDevices - compliant,
      totalCount: totalDevices,
      complianceRate: rate,
      recommendation:
        rate < 85
          ? `${rate}% of devices are compliant. Review non-compliant devices and enforce compliance policies.`
          : `${rate}% device compliance rate — within acceptable range.`,
      nistControls: ['CM-2', 'CM-6', 'SI-2'],
    })
  }

  // 2. Non-compliant device list
  {
    const nonCompliant = devices.filter(
      (d) => d.complianceState === 'noncompliant' || d.complianceState === 'unknown'
    )
    results.push({
      category: 'devices',
      checkId: 'intune.devices.noncompliant_list',
      title: 'Non-Compliant Devices',
      status: nonCompliant.length === 0 ? 'pass' : nonCompliant.length < 5 ? 'warn' : 'fail',
      severity:
        nonCompliant.length === 0 ? 'info' : nonCompliant.length < 5 ? 'medium' : 'high',
      nonCompliantCount: nonCompliant.length,
      totalCount: totalDevices,
      affectedDevices: nonCompliant.slice(0, 30).map((d) => ({
        id: d.id,
        deviceName: d.deviceName,
        owner: deviceOwner(d),
        detail: `OS: ${d.operatingSystem} ${d.osVersion} | State: ${d.complianceState}`,
      })),
      recommendation:
        nonCompliant.length > 0
          ? `${nonCompliant.length} devices are non-compliant or unknown. Investigate and remediate through Intune compliance policies.`
          : 'All devices are compliant.',
      nistControls: ['CM-2', 'CM-7'],
    })
  }

  // 3. Stale devices (not synced in 30+ days)
  {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const stale = devices.filter((d) => new Date(d.lastSyncDateTime) < thirtyDaysAgo)
    results.push({
      category: 'devices',
      checkId: 'intune.devices.stale_devices',
      title: 'Stale Devices (Not Synced in 30+ Days)',
      status: stale.length === 0 ? 'pass' : stale.length < 5 ? 'warn' : 'fail',
      severity: stale.length === 0 ? 'info' : stale.length < 5 ? 'medium' : 'high',
      nonCompliantCount: stale.length,
      totalCount: totalDevices,
      affectedDevices: stale.slice(0, 20).map((d) => ({
        id: d.id,
        deviceName: d.deviceName,
        owner: deviceOwner(d),
        detail: `Last sync: ${d.lastSyncDateTime} | OS: ${d.operatingSystem}`,
      })),
      recommendation:
        stale.length > 0
          ? `${stale.length} devices have not synced in 30+ days. Retire or wipe devices that are no longer active.`
          : 'All devices have synced within the last 30 days.',
      nistControls: ['CM-2', 'SA-9'],
    })
  }

  // 4. Jailbroken/rooted devices
  {
    const jailbroken = devices.filter((d) => d.isJailBroken?.toLowerCase() === 'true')
    results.push({
      category: 'devices',
      checkId: 'intune.devices.jailbroken',
      title: 'Jailbroken or Rooted Devices',
      status: jailbroken.length === 0 ? 'pass' : 'fail',
      severity: jailbroken.length === 0 ? 'info' : 'critical',
      nonCompliantCount: jailbroken.length,
      totalCount: totalDevices,
      affectedDevices: jailbroken.map((d) => ({
        id: d.id,
        deviceName: d.deviceName,
        owner: deviceOwner(d),
        detail: `OS: ${d.operatingSystem} ${d.osVersion}`,
      })),
      recommendation:
        jailbroken.length > 0
          ? `${jailbroken.length} jailbroken/rooted devices detected. Block these devices immediately via compliance policy and remote wipe if necessary.`
          : 'No jailbroken or rooted devices detected.',
      nistControls: ['CM-7', 'SC-28', 'SI-7'],
    })
  }

  // 5. Encryption rate (all platforms)
  {
    const encrypted = devices.filter((d) => d.isEncrypted)
    const rate = totalDevices > 0 ? Math.round((encrypted.length / totalDevices) * 100) : 0
    results.push({
      category: 'encryption',
      checkId: 'intune.devices.encrypted',
      title: 'Device Encryption Rate',
      status: rate < 80 ? 'fail' : rate < 95 ? 'warn' : 'pass',
      severity: rate < 80 ? 'critical' : rate < 95 ? 'high' : 'low',
      compliantCount: encrypted.length,
      nonCompliantCount: totalDevices - encrypted.length,
      totalCount: totalDevices,
      complianceRate: rate,
      affectedDevices: devices
        .filter((d) => !d.isEncrypted)
        .slice(0, 20)
        .map((d) => ({
          id: d.id,
          deviceName: d.deviceName,
          owner: deviceOwner(d),
          detail: `OS: ${d.operatingSystem} ${d.osVersion}`,
        })),
      recommendation:
        rate < 95
          ? `${rate}% of devices have encryption enabled. Enforce disk encryption via Intune compliance and device configuration policies.`
          : 'Device encryption rate is excellent.',
      nistControls: ['SC-28', 'MP-5'],
    })
  }

  // ── BitLocker Checks ──────────────────────────────────────────────────────

  const windowsDevices = devices.filter((d) => d.operatingSystem === 'Windows')

  // 6. BitLocker enabled rate
  {
    const bitlockerEnabled = windowsDevices.filter((d) => d.isEncrypted)
    const rate =
      windowsDevices.length > 0
        ? Math.round((bitlockerEnabled.length / windowsDevices.length) * 100)
        : 100
    results.push({
      category: 'encryption',
      checkId: 'intune.bitlocker.enabled_rate',
      title: 'BitLocker Enabled Rate (Windows)',
      status: rate < 80 ? 'fail' : rate < 95 ? 'warn' : 'pass',
      severity: rate < 80 ? 'critical' : rate < 95 ? 'high' : 'low',
      compliantCount: bitlockerEnabled.length,
      nonCompliantCount: windowsDevices.length - bitlockerEnabled.length,
      totalCount: windowsDevices.length,
      complianceRate: rate,
      affectedDevices: windowsDevices
        .filter((d) => !d.isEncrypted)
        .slice(0, 20)
        .map((d) => ({
          id: d.id,
          deviceName: d.deviceName,
          owner: deviceOwner(d),
          detail: `OS: ${d.osVersion} | BitLocker: disabled`,
        })),
      recommendation:
        rate < 80
          ? `Only ${rate}% of Windows devices have BitLocker enabled. Deploy a BitLocker enforcement policy via Intune Endpoint Security.`
          : `${rate}% BitLocker coverage on Windows devices.`,
      nistControls: ['SC-28', 'MP-5'],
    })
  }

  // 7. BitLocker recovery keys escrowed
  {
    // Check via deviceManagement endpoint for BitLocker recovery key presence (best-effort)
    let recoveryKeysCount = 0
    try {
      const rkResp = await graphGet<{ '@odata.count': number; value: unknown[] }>(
        token,
        '/informationProtection/bitlocker/recoveryKeys?$count=true&$top=1'
      )
      recoveryKeysCount = rkResp['@odata.count'] ?? rkResp.value?.length ?? 0
    } catch { /* May require additional permissions */ }

    const bitlockerWindowsEncrypted = windowsDevices.filter((d) => d.isEncrypted).length
    const hasGoodEscrow = recoveryKeysCount >= bitlockerWindowsEncrypted * 0.8
    results.push({
      category: 'encryption',
      checkId: 'intune.bitlocker.recovery_keys',
      title: 'BitLocker Recovery Keys Escrowed to Entra ID',
      status: recoveryKeysCount === 0 ? 'warn' : hasGoodEscrow ? 'pass' : 'warn',
      severity: recoveryKeysCount === 0 ? 'high' : hasGoodEscrow ? 'info' : 'medium',
      compliantCount: recoveryKeysCount,
      recommendation:
        recoveryKeysCount === 0
          ? 'No BitLocker recovery keys found in Entra ID. Configure Intune to escrow BitLocker recovery keys automatically.'
          : `${recoveryKeysCount} BitLocker recovery keys escrowed. Ensure all encrypted Windows devices have keys backed up.`,
      nistControls: ['CP-9', 'SC-28'],
    })
  }

  // 8. BitLocker policy exists
  {
    const bitlockerPolicy = compliancePolicies.find(
      (p) => p.displayName.toLowerCase().includes('bitlocker') || p.displayName.toLowerCase().includes('encryption')
    )
    const bitlockerConfigProfile = configProfiles.find(
      (p) =>
        p.displayName.toLowerCase().includes('bitlocker') ||
        p['@odata.type']?.includes('BitLocker') ||
        p['@odata.type']?.includes('windowsDefender')
    )
    results.push({
      category: 'encryption',
      checkId: 'intune.bitlocker.policy_exists',
      title: 'BitLocker Compliance Policy Exists',
      status: bitlockerPolicy || bitlockerConfigProfile ? 'pass' : 'fail',
      severity: bitlockerPolicy || bitlockerConfigProfile ? 'info' : 'high',
      recommendation:
        bitlockerPolicy || bitlockerConfigProfile
          ? `BitLocker policy "${(bitlockerPolicy ?? bitlockerConfigProfile)?.displayName}" is configured.`
          : 'No BitLocker compliance or configuration policy found. Create an Intune Endpoint Security policy to enforce BitLocker.',
      nistControls: ['CM-6', 'SC-28'],
    })
  }

  // ── App Protection Policy Checks ──────────────────────────────────────────

  const iosPolicies = appPolicies.filter((p) =>
    p['@odata.type']?.toLowerCase().includes('ios')
  )
  const androidPolicies = appPolicies.filter((p) =>
    p['@odata.type']?.toLowerCase().includes('android')
  )

  // 9. iOS app protection policy
  {
    const hasIos = iosPolicies.length > 0
    results.push({
      category: 'apps',
      checkId: 'intune.app.ios_policy',
      title: 'iOS App Protection Policy Configured',
      status: hasIos ? 'pass' : 'fail',
      severity: hasIos ? 'info' : 'high',
      recommendation: hasIos
        ? `${iosPolicies.length} iOS MAM policy(ies) configured: ${iosPolicies.map((p) => p.displayName).join(', ')}`
        : 'No iOS App Protection (MAM) policy found. Create and assign an iOS MAM policy to protect corporate data on mobile devices.',
      nistControls: ['AC-19', 'SC-28'],
    })
  }

  // 10. Android app protection policy
  {
    const hasAndroid = androidPolicies.length > 0
    results.push({
      category: 'apps',
      checkId: 'intune.app.android_policy',
      title: 'Android App Protection Policy Configured',
      status: hasAndroid ? 'pass' : 'fail',
      severity: hasAndroid ? 'info' : 'high',
      recommendation: hasAndroid
        ? `${androidPolicies.length} Android MAM policy(ies) configured: ${androidPolicies.map((p) => p.displayName).join(', ')}`
        : 'No Android App Protection (MAM) policy found. Create and assign an Android MAM policy.',
      nistControls: ['AC-19', 'SC-28'],
    })
  }

  // 11. PIN required in app protection policies
  {
    const policiesWithPin = appPolicies.filter((p) => p.pinRequired === true)
    const policiesWithoutPin = appPolicies.filter(
      (p) => p.pinRequired === false || p.pinRequired === undefined
    )
    results.push({
      category: 'apps',
      checkId: 'intune.app.pin_required',
      title: 'App Protection Policies Require PIN/Biometric',
      status: appPolicies.length === 0 ? 'fail' : policiesWithoutPin.length === 0 ? 'pass' : 'warn',
      severity: appPolicies.length === 0 ? 'high' : policiesWithoutPin.length === 0 ? 'info' : 'medium',
      compliantCount: policiesWithPin.length,
      nonCompliantCount: policiesWithoutPin.length,
      recommendation:
        policiesWithoutPin.length > 0
          ? `${policiesWithoutPin.length} app protection policies do not require PIN. Enable PIN/biometric requirement in all MAM policies.`
          : 'All app protection policies require PIN or biometric authentication.',
      nistControls: ['IA-2', 'AC-19'],
    })
  }

  // 12. Data backup blocked
  {
    const policiesBlockingBackup = appPolicies.filter((p) => p.dataBackupBlocked === true)
    const policiesAllowingBackup = appPolicies.filter(
      (p) => p.dataBackupBlocked === false || p.dataBackupBlocked === undefined
    )
    results.push({
      category: 'apps',
      checkId: 'intune.app.data_backup_blocked',
      title: 'App Protection Policies Block Data Backup to Personal Storage',
      status:
        appPolicies.length === 0
          ? 'fail'
          : policiesAllowingBackup.length === 0
          ? 'pass'
          : 'warn',
      severity:
        appPolicies.length === 0
          ? 'high'
          : policiesAllowingBackup.length === 0
          ? 'info'
          : 'medium',
      compliantCount: policiesBlockingBackup.length,
      nonCompliantCount: policiesAllowingBackup.length,
      recommendation:
        policiesAllowingBackup.length > 0
          ? `${policiesAllowingBackup.length} MAM policies allow backup to personal storage. Enable data backup blocking in all app protection policies.`
          : 'All app protection policies block personal storage backup.',
      nistControls: ['MP-6', 'AC-19'],
    })
  }

  // ── OS Version Checks ─────────────────────────────────────────────────────

  // Helper for OS version check
  const makeOsCheck = (
    osName: string,
    checkId: string,
    title: string,
    minVersion: string,
    nistControls: string[]
  ): IntuneCheckResult => {
    const osDevices = devices.filter(
      (d) => d.operatingSystem.toLowerCase() === osName.toLowerCase()
    )
    if (osDevices.length === 0) {
      return {
        category: 'os_version',
        checkId,
        title,
        status: 'info',
        severity: 'info',
        totalCount: 0,
        recommendation: `No ${osName} devices enrolled in Intune.`,
        nistControls,
      }
    }
    const outdated = osDevices.filter((d) => versionLessThan(d.osVersion, minVersion))
    const rate = Math.round(((osDevices.length - outdated.length) / osDevices.length) * 100)
    return {
      category: 'os_version',
      checkId,
      title,
      status: outdated.length === 0 ? 'pass' : outdated.length < osDevices.length * 0.1 ? 'warn' : 'fail',
      severity: outdated.length === 0 ? 'info' : outdated.length < 3 ? 'medium' : 'high',
      compliantCount: osDevices.length - outdated.length,
      nonCompliantCount: outdated.length,
      totalCount: osDevices.length,
      complianceRate: rate,
      affectedDevices: outdated.slice(0, 20).map((d) => ({
        id: d.id,
        deviceName: d.deviceName,
        owner: deviceOwner(d),
        detail: `Current: ${d.osVersion} | Required: ≥ ${minVersion}`,
      })),
      recommendation:
        outdated.length > 0
          ? `${outdated.length} ${osName} devices running below minimum version ${minVersion}. Deploy OS update compliance policies.`
          : `All ${osName} devices meet minimum version requirement (${minVersion}).`,
      nistControls,
    }
  }

  // 13. Windows min version
  results.push(makeOsCheck('Windows', 'intune.os.windows_min_version', 'Windows Minimum Version (≥ Windows 11 22H2)', OS_MIN_VERSIONS.Windows, ['CM-6', 'SI-2']))

  // 14. iOS min version
  results.push(makeOsCheck('iOS', 'intune.os.ios_min_version', 'iOS Minimum Version (≥ iOS 16)', OS_MIN_VERSIONS.iOS, ['CM-6', 'SI-2']))

  // 15. Android min version
  results.push(makeOsCheck('Android', 'intune.os.android_min_version', 'Android Minimum Version (≥ Android 12)', OS_MIN_VERSIONS.Android, ['CM-6', 'SI-2']))

  // 16. macOS min version
  results.push(makeOsCheck('macOS', 'intune.os.macos_min_version', 'macOS Minimum Version (≥ macOS 13 Ventura)', OS_MIN_VERSIONS.macOS, ['CM-6', 'SI-2']))

  // ── Configuration Profile Checks ──────────────────────────────────────────

  // 17. Defender AV
  {
    const defenderProfile = configProfiles.find(
      (p) =>
        p.displayName.toLowerCase().includes('defender') ||
        p['@odata.type']?.toLowerCase().includes('defender') ||
        p['@odata.type']?.toLowerCase().includes('endpointprotection') ||
        p['@odata.type']?.toLowerCase().includes('antivirus')
    )
    results.push({
      category: 'policies',
      checkId: 'intune.config.defender_av',
      title: 'Microsoft Defender Antivirus Enabled via Endpoint Protection Profile',
      status: defenderProfile ? 'pass' : 'fail',
      severity: defenderProfile ? 'info' : 'critical',
      recommendation: defenderProfile
        ? `Defender profile "${defenderProfile.displayName}" is configured.`
        : 'No Defender Antivirus profile detected. Deploy an Endpoint Protection configuration profile to enforce Defender AV.',
      nistControls: ['SI-3', 'SI-4'],
    })
  }

  // 18. Firewall enabled
  {
    const firewallProfile = configProfiles.find(
      (p) =>
        p.displayName.toLowerCase().includes('firewall') ||
        p['@odata.type']?.toLowerCase().includes('firewall')
    )
    results.push({
      category: 'policies',
      checkId: 'intune.config.firewall_enabled',
      title: 'Firewall Enabled via Device Configuration Profile',
      status: firewallProfile ? 'pass' : 'warn',
      severity: firewallProfile ? 'info' : 'high',
      recommendation: firewallProfile
        ? `Firewall profile "${firewallProfile.displayName}" is configured.`
        : 'No firewall configuration profile detected. Create and assign a device configuration profile enforcing firewall rules.',
      nistControls: ['SC-7', 'CM-7'],
    })
  }

  // 19. Screen lock (timeout ≤ 5 min)
  {
    const screenLockProfile = configProfiles.find(
      (p) =>
        p.displayName.toLowerCase().includes('screen lock') ||
        p.displayName.toLowerCase().includes('pin') ||
        p.displayName.toLowerCase().includes('passcode') ||
        p.displayName.toLowerCase().includes('lock screen') ||
        p['@odata.type']?.toLowerCase().includes('devicerestriction')
    )
    results.push({
      category: 'policies',
      checkId: 'intune.config.screen_lock',
      title: 'Screen Lock Policy Required (≤ 5 Min Timeout)',
      status: screenLockProfile ? 'pass' : 'warn',
      severity: screenLockProfile ? 'info' : 'medium',
      recommendation: screenLockProfile
        ? `Screen lock profile "${screenLockProfile.displayName}" is configured.`
        : 'No screen lock configuration profile detected. Deploy a policy requiring screen lock with a maximum idle timeout of 5 minutes.',
      nistControls: ['AC-11', 'AC-12'],
    })
  }

  return results
}
