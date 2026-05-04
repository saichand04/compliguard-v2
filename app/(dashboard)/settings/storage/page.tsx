'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  HardDrive,
  Cloud,
  Database,
  FolderOpen,
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
  Eye,
  EyeOff,
} from 'lucide-react'

type StorageProviderType = 'local' | 's3' | 'azure_blob' | 'minio' | 'onedrive'

interface ProviderCard {
  value: StorageProviderType
  label: string
  description: string
  icon: React.ReactNode
  color: string
}

const PROVIDERS: ProviderCard[] = [
  {
    value: 'local',
    label: 'Local Storage',
    description: 'Store files on the server filesystem. Best for self-hosted single-node deployments.',
    icon: <HardDrive size={20} />,
    color: '#06B6D4',
  },
  {
    value: 's3',
    label: 'Amazon S3',
    description: 'Scalable AWS S3 object storage with presigned URLs and lifecycle management.',
    icon: <Cloud size={20} />,
    color: '#F59E0B',
  },
  {
    value: 'azure_blob',
    label: 'Azure Blob',
    description: 'Microsoft Azure Blob Storage with SAS token authentication.',
    icon: <Cloud size={20} />,
    color: '#0EA5E9',
  },
  {
    value: 'minio',
    label: 'MinIO',
    description: 'Self-hosted S3-compatible object storage. Ideal for on-premises deployments.',
    icon: <Database size={20} />,
    color: '#EF4444',
  },
  {
    value: 'onedrive',
    label: 'OneDrive / SharePoint',
    description: 'Microsoft OneDrive or SharePoint document library via Graph API.',
    icon: <FolderOpen size={20} />,
    color: '#8B5CF6',
  },
]

interface StorageConfig {
  provider: StorageProviderType
  local?: { enabled: boolean; basePath?: string }
  s3?: { bucket: string; region: string; accessKeyId: string; secretAccessKey: string; endpoint?: string }
  azure_blob?: { accountName: string; accountKey: string; containerName: string; connectionString?: string }
  minio?: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region?: string }
  onedrive?: { clientId: string; clientSecret: string; tenantId: string; driveId?: string; folderId?: string }
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className || 'glass-input'}
        style={{ width: '100%', fontFamily: 'monospace', paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  )
}

export default function StorageSettingsPage() {
  const router = useRouter()
  const [config, setConfig] = useState<StorageConfig>({ provider: 'local', local: { enabled: true } })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saved, setSaved] = useState(false)

  // Load current config
  useEffect(() => {
    fetch('/api/storage/settings')
      .then((r) => r.json())
      .then((data) => {
        setConfig(data || { provider: 'local', local: { enabled: true } })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const setProvider = (provider: StorageProviderType) => {
    setConfig((c) => ({ ...c, provider }))
    setTestResult(null)
  }

  const patch = useCallback(
    (providerKey: keyof StorageConfig, updates: Record<string, unknown>) => {
      setConfig((c) => ({
        ...c,
        [providerKey]: {
          ...(c[providerKey] as Record<string, unknown> || {}),
          ...updates,
        },
      }))
    },
    []
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/storage/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
        setTestResult(null)
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/storage/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      setTestResult({ ok: data.ok, message: data.message })
    } catch (err: unknown) {
      setTestResult({ ok: false, message: (err as Error).message || 'Connection test failed' })
    } finally {
      setTesting(false)
    }
  }

  const activeProvider = PROVIDERS.find((p) => p.value === config.provider)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#8B5CF6' }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }} className="animate-fade-in">
      {/* Back nav */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.push('/settings')} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={14} /> Settings
        </button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(139,92,246,0.15)',
            border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HardDrive size={20} color="#8B5CF6" />
        </div>
        <div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 2,
            }}
          >
            Storage
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Configure where evidence files and policy documents are stored
          </p>
        </div>

        {/* Status badge */}
        {activeProvider && (
          <div
            style={{
              marginLeft: 'auto',
              padding: '4px 12px',
              borderRadius: 20,
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.25)',
              fontSize: 12,
              fontWeight: 600,
              color: '#A78BFA',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#8B5CF6',
                boxShadow: '0 0 6px #8B5CF6',
              }}
            />
            {activeProvider.label}
          </div>
        )}
      </div>

      {/* Provider selector */}
      <div
        className="glass-card"
        style={{
          padding: 24,
          marginBottom: 20,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>
          STORAGE PROVIDER
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {PROVIDERS.map((p) => {
            const isActive = config.provider === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setProvider(p.value)}
                style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: isActive ? `1px solid ${p.color}60` : '1px solid rgba(255,255,255,0.08)',
                  background: isActive ? `${p.color}18` : 'rgba(255,255,255,0.03)',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    color: isActive ? p.color : 'var(--text-muted)',
                    marginBottom: 8,
                    transition: 'color 0.15s',
                  }}
                >
                  {p.icon}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isActive ? p.color : 'var(--text-primary)',
                    marginBottom: 3,
                  }}
                >
                  {p.label}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{p.description}</div>
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: p.color,
                      boxShadow: `0 0 8px ${p.color}`,
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Provider config form */}
      <div
        className="glass-card"
        style={{
          padding: 24,
          marginBottom: 20,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 18 }}>
          CONFIGURATION
        </div>

        {config.provider === 'local' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                background: 'rgba(6,182,212,0.06)',
                border: '1px solid rgba(6,182,212,0.2)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#67E8F9', marginBottom: 6 }}>
                Local Storage Active
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Files are stored on the server at{' '}
                <code
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    background: 'rgba(255,255,255,0.08)',
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}
                >
                  {config.local?.basePath || '/tmp/compliguard-uploads'}
                </code>
                . No additional configuration required.
              </div>
            </div>
            <Field label="Custom Base Path" hint="Leave empty to use the default /tmp/compliguard-uploads">
              <input
                value={config.local?.basePath || ''}
                onChange={(e) => patch('local', { enabled: true, basePath: e.target.value || undefined })}
                placeholder="/tmp/compliguard-uploads"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </Field>
          </div>
        )}

        {config.provider === 's3' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Bucket Name">
              <input
                value={config.s3?.bucket || ''}
                onChange={(e) => patch('s3', { bucket: e.target.value })}
                placeholder="compliguard-evidence"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Region">
              <input
                value={config.s3?.region || ''}
                onChange={(e) => patch('s3', { region: e.target.value })}
                placeholder="us-east-1"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Access Key ID">
              <input
                value={config.s3?.accessKeyId || ''}
                onChange={(e) => patch('s3', { accessKeyId: e.target.value })}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                className="glass-input"
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
            </Field>
            <Field label="Secret Access Key">
              <PasswordInput
                value={config.s3?.secretAccessKey || ''}
                onChange={(v) => patch('s3', { secretAccessKey: v })}
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              />
            </Field>
            <Field
              label="Endpoint (optional)"
              hint="Custom endpoint for S3-compatible APIs. Leave empty for standard AWS S3."
            >
              <input
                value={config.s3?.endpoint || ''}
                onChange={(e) => patch('s3', { endpoint: e.target.value || undefined })}
                placeholder="https://s3.custom-provider.com"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </Field>
          </div>
        )}

        {config.provider === 'azure_blob' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Account Name">
              <input
                value={config.azure_blob?.accountName || ''}
                onChange={(e) => patch('azure_blob', { accountName: e.target.value })}
                placeholder="mystorageaccount"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Account Key">
              <PasswordInput
                value={config.azure_blob?.accountKey || ''}
                onChange={(v) => patch('azure_blob', { accountKey: v })}
                placeholder="base64-encoded-account-key..."
              />
            </Field>
            <Field label="Container Name">
              <input
                value={config.azure_blob?.containerName || ''}
                onChange={(e) => patch('azure_blob', { containerName: e.target.value })}
                placeholder="evidence"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </Field>
            <Field
              label="Connection String (alternative)"
              hint="If provided, overrides account name and key above."
            >
              <PasswordInput
                value={config.azure_blob?.connectionString || ''}
                onChange={(v) => patch('azure_blob', { connectionString: v || undefined })}
                placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
              />
            </Field>
          </div>
        )}

        {config.provider === 'minio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Endpoint URL">
              <input
                value={config.minio?.endpoint || ''}
                onChange={(e) => patch('minio', { endpoint: e.target.value })}
                placeholder="http://minio.internal:9000"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Bucket Name">
              <input
                value={config.minio?.bucket || ''}
                onChange={(e) => patch('minio', { bucket: e.target.value })}
                placeholder="compliguard"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Access Key">
              <input
                value={config.minio?.accessKeyId || ''}
                onChange={(e) => patch('minio', { accessKeyId: e.target.value })}
                placeholder="minioadmin"
                className="glass-input"
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
            </Field>
            <Field label="Secret Key">
              <PasswordInput
                value={config.minio?.secretAccessKey || ''}
                onChange={(v) => patch('minio', { secretAccessKey: v })}
                placeholder="minioadmin"
              />
            </Field>
            <Field label="Region" hint="MinIO ignores region but the SDK requires it. Leave as us-east-1.">
              <input
                value={config.minio?.region || 'us-east-1'}
                onChange={(e) => patch('minio', { region: e.target.value })}
                placeholder="us-east-1"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </Field>
          </div>
        )}

        {config.provider === 'onedrive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(139,92,246,0.06)',
                border: '1px solid rgba(139,92,246,0.2)',
                fontSize: 12.5,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              Requires an Azure AD app registration with <strong>Files.ReadWrite.All</strong> and{' '}
              <strong>Sites.ReadWrite.All</strong> application permissions.
            </div>
            <Field label="Client ID">
              <input
                value={config.onedrive?.clientId || ''}
                onChange={(e) => patch('onedrive', { clientId: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="glass-input"
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
            </Field>
            <Field label="Client Secret">
              <PasswordInput
                value={config.onedrive?.clientSecret || ''}
                onChange={(v) => patch('onedrive', { clientSecret: v })}
                placeholder="your-client-secret"
              />
            </Field>
            <Field label="Tenant ID">
              <input
                value={config.onedrive?.tenantId || ''}
                onChange={(e) => patch('onedrive', { tenantId: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="glass-input"
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
            </Field>
            <Field
              label="Drive ID (optional)"
              hint="Leave empty to use the default OneDrive. For SharePoint, use the drive ID of the document library."
            >
              <input
                value={config.onedrive?.driveId || ''}
                onChange={(e) => patch('onedrive', { driveId: e.target.value || undefined })}
                placeholder="b!xxxxxxxx..."
                className="glass-input"
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
            </Field>
            <Field label="Folder Path (optional)" hint="Subfolder within the drive to store files. Leave empty for root.">
              <input
                value={config.onedrive?.folderId || ''}
                onChange={(e) => patch('onedrive', { folderId: e.target.value || undefined })}
                placeholder="CompliGuard/Evidence"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            marginBottom: 16,
            background: testResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          {testResult.ok ? (
            <CheckCircle size={16} color="#22C55E" style={{ marginTop: 1, flexShrink: 0 }} />
          ) : (
            <XCircle size={16} color="#EF4444" style={{ marginTop: 1, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 13, color: testResult.ok ? '#86EFAC' : '#FCA5A5', lineHeight: 1.5 }}>
            {testResult.message}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          paddingTop: 8,
        }}
      >
        <button
          onClick={handleTest}
          disabled={testing || saving}
          className="btn-ghost"
          style={{ fontSize: 13, gap: 6 }}
        >
          {testing ? (
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Zap size={13} />
          )}
          Test Connection
        </button>
        <button
          onClick={handleSave}
          disabled={saving || testing}
          className="btn-primary"
          style={{ fontSize: 13 }}
        >
          {saving ? (
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Save size={13} />
          )}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
