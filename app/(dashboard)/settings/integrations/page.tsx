'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Puzzle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

const INTEGRATIONS = [
  {
    category: 'Cloud Providers',
    color: '#8B5CF6',
    items: [
      { name: 'Amazon Web Services', slug: 'aws', description: 'S3, IAM, CloudTrail, Config, GuardDuty', status: 'available' },
      { name: 'Microsoft Azure', slug: 'azure', description: 'Entra ID, Defender, Sentinel, Policy', status: 'available' },
      { name: 'Google Cloud Platform', slug: 'gcp', description: 'IAM, Security Command Center, Audit Logs', status: 'available' },
    ],
  },
  {
    category: 'Microsoft 365',
    color: '#06B6D4',
    items: [
      { name: 'Microsoft Intune', slug: 'intune', description: 'Device compliance and MDM policies', status: 'available' },
      { name: 'Microsoft Defender', slug: 'defender', description: 'Endpoint detection and threat intelligence', status: 'available' },
      { name: 'Exchange Online', slug: 'exchange', description: 'Email security, mailbox forensics, DMARC', status: 'available' },
    ],
  },
  {
    category: 'DevOps & Engineering',
    color: '#8B5CF6',
    items: [
      { name: 'GitHub', slug: 'github', description: 'Repository scanning, secrets detection, SAST', status: 'available' },
      { name: 'Jira', slug: 'jira', description: 'Risk items, remediation tracking, audit tasks', status: 'available' },
      { name: 'Kubernetes', slug: 'k8s', description: 'Container security posture management', status: 'coming_soon' },
    ],
  },
]

export default function IntegrationsSettingsPage() {
  const router = useRouter()

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }} className="animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.push('/settings')} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={14} /> Settings
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Puzzle size={18} color="#06B6D4" />
        </div>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Integrations</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Connect cloud providers and tools for automated evidence collection</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {INTEGRATIONS.map((group) => (
          <div key={group.category}>
            <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
              {group.category}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.items.map((item) => (
                <div key={item.slug} style={{
                  padding: '14px 18px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(20px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                      {item.status === 'coming_soon' && (
                        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#FBBF24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', padding: '2px 7px', borderRadius: 100 }}>
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.description}</p>
                  </div>
                  {item.status === 'available' ? (
                    <button style={{
                      fontSize: 12, fontWeight: 600, color: group.color, padding: '6px 14px', borderRadius: 7,
                      background: `${group.color}15`, border: `1px solid ${group.color}30`,
                      cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${group.color}25`; e.currentTarget.style.borderColor = `${group.color}50` }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${group.color}15`; e.currentTarget.style.borderColor = `${group.color}30` }}>
                      <ExternalLink size={11} /> Connect
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 14px' }}>—</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: '14px 18px', borderRadius: 12, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', fontSize: 13, color: 'var(--text-secondary)' }}>
        Integration setup was skipped during initial configuration.{' '}
        <Link href="/setup/integrations" style={{ color: '#A78BFA', textDecoration: 'none', fontWeight: 500 }}>
          Run the integration wizard
        </Link>{' '}
        for step-by-step guided setup.
      </div>
    </div>
  )
}
