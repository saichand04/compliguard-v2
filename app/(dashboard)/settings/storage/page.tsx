'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HardDrive, ArrowLeft, Save, Loader2 } from 'lucide-react'

type StorageProvider = 'local' | 's3' | 'azure_blob' | 'gcs'

const providers: { value: StorageProvider; label: string; description: string }[] = [
  { value: 'local', label: 'Local Storage', description: 'Store files on the server filesystem' },
  { value: 's3', label: 'Amazon S3', description: 'AWS S3 bucket for scalable object storage' },
  { value: 'azure_blob', label: 'Azure Blob', description: 'Microsoft Azure Blob Storage' },
  { value: 'gcs', label: 'Google Cloud Storage', description: 'GCS bucket storage' },
]

export default function StorageSettingsPage() {
  const router = useRouter()
  const [provider, setProvider] = useState<StorageProvider>('local')
  const [bucket, setBucket] = useState('')
  const [region, setRegion] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/setup/step/6', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageProvider: provider, bucket, region, accessKey, secretKey }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }} className="animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.push('/settings')} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={14} /> Settings
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HardDrive size={18} color="#06B6D4" />
        </div>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Storage</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Evidence files and policy document storage</p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Storage provider</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {providers.map((p) => (
                <button key={p.value} type="button" onClick={() => setProvider(p.value)} style={{
                  padding: '12px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                  border: provider === p.value ? '1px solid rgba(6,182,212,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  background: provider === p.value ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)',
                  transition: 'all 0.15s',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: provider === p.value ? '#67E8F9' : 'var(--text-primary)', marginBottom: 2 }}>{p.label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.description}</div>
                  </div>
                  {provider === p.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#06B6D4', boxShadow: '0 0 8px #06B6D4' }} />}
                </button>
              ))}
            </div>
          </div>

          {provider !== 'local' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Bucket / Container name</label>
                <input value={bucket} onChange={e => setBucket(e.target.value)} placeholder="compliguard-evidence" className="glass-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Region</label>
                <input value={region} onChange={e => setRegion(e.target.value)} placeholder="us-east-1" className="glass-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Access Key</label>
                <input type="password" value={accessKey} onChange={e => setAccessKey(e.target.value)} placeholder="AKIA..." className="glass-input" style={{ width: '100%', fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Secret Key</label>
                <input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="..." className="glass-input" style={{ width: '100%', fontFamily: 'monospace' }} />
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
              {saved ? 'Saved!' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
