'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface RequestDetails {
  id: string
  title: string
  description: string | null
  recipientName: string | null
  orgName: string
  expiresAt: string
  controlId: string | null
}

type PageState = 'loading' | 'valid' | 'expired' | 'used' | 'error' | 'success'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getDaysLeft(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function UploadPage() {
  const params = useParams()
  const token = params?.token as string

  const [state, setState] = useState<PageState>('loading')
  const [request, setRequest] = useState<RequestDetails | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    if (!token) {
      setState('error')
      setErrorMessage('Invalid link.')
      return
    }

    fetch(`/api/evidence-requests/${token}`)
      .then(async (res) => {
        const data = await res.json() as RequestDetails & { error?: string; expired?: boolean; used?: boolean }
        if (res.ok) {
          setRequest(data)
          setState('valid')
        } else if (data.used) {
          setState('used')
        } else if (data.expired || res.status === 410) {
          setState('expired')
        } else {
          setState('error')
          setErrorMessage(data.error || 'Invalid link.')
        }
      })
      .catch(() => {
        setState('error')
        setErrorMessage('Could not load upload link.')
      })
  }, [token])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  const handleUpload = async () => {
    if (!file || !token) return
    setUploading(true)
    setUploadProgress(10)

    const formData = new FormData()
    formData.append('file', file)

    try {
      setUploadProgress(40)
      const res = await fetch(`/api/evidence-requests/${token}`, {
        method: 'POST',
        body: formData,
      })
      setUploadProgress(90)
      const data = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && data.ok) {
        setUploadProgress(100)
        setState('success')
      } else {
        setErrorMessage(data.error || 'Upload failed. Please try again.')
        setUploading(false)
        setUploadProgress(0)
      }
    } catch {
      setErrorMessage('Network error. Please try again.')
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Base page shell
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      minHeight: '100vh',
      background: '#080B18',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#6D28D9,#7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>C</span>
          </div>
          <span style={{ color: 'white', fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px' }}>CompliGuard</span>
        </div>
        {children}
      </div>
    </div>
  )

  if (state === 'loading') {
    return (
      <Shell>
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 40,
          textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(139,92,246,0.3)',
            borderTopColor: '#8B5CF6', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
          }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, margin: 0 }}>Loading upload link…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </Shell>
    )
  }

  if (state === 'expired' || state === 'used') {
    return (
      <Shell>
        <div style={{
          background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 16, padding: 40,
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28,
          }}>
            {state === 'used' ? '✓' : '⏰'}
          </div>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>
            {state === 'used' ? 'Already Submitted' : 'Link Expired'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, margin: 0, lineHeight: 1.6 }}>
            {state === 'used'
              ? 'This upload link has already been used. Evidence has been submitted successfully.'
              : 'This upload link has expired or already been used. Please contact your compliance manager to request a new link.'
            }
          </p>
        </div>
      </Shell>
    )
  }

  if (state === 'error') {
    return (
      <Shell>
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 40,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>Invalid Link</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, margin: 0 }}>
            {errorMessage || 'This upload link is invalid or could not be found.'}
          </p>
        </div>
      </Shell>
    )
  }

  if (state === 'success') {
    return (
      <Shell>
        <div style={{
          background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: 48,
          textAlign: 'center',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32,
          }}>
            ✓
          </div>
          <h2 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>Evidence Submitted!</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, margin: '0 0 20px', lineHeight: 1.6 }}>
            Thank you. Your evidence has been securely submitted and will be reviewed by the compliance team.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>
            You may close this window.
          </p>
        </div>
      </Shell>
    )
  }

  // Main upload UI
  const daysLeft = request ? getDaysLeft(request.expiresAt) : 0

  return (
    <Shell>
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)', borderRadius: 16, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,rgba(59,130,246,0.15),rgba(139,92,246,0.1))',
          borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '28px 32px',
        }}>
          <div style={{
            display: 'inline-block', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 6, padding: '3px 10px', marginBottom: 14,
          }}>
            <span style={{ color: '#60A5FA', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Evidence Request
            </span>
          </div>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
            {request?.title}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13.5, margin: 0 }}>
            Requested by <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{request?.orgName}</strong>
          </p>
        </div>

        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Description */}
          {request?.description && (
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '14px 18px',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 6px' }}>
                What's needed
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                {request.description}
              </p>
            </div>
          )}

          {/* Expiry */}
          <div style={{
            background: daysLeft <= 2 ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${daysLeft <= 2 ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>📅</span>
            <div>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Expires on</p>
              <p style={{ margin: 0, color: daysLeft <= 2 ? '#F59E0B' : 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 600 }}>
                {request ? formatDate(request.expiresAt) : ''} ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)
              </p>
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => {
              if (!uploading) {
                const input = document.getElementById('file-input') as HTMLInputElement
                input?.click()
              }
            }}
            style={{
              border: `2px dashed ${dragging ? 'rgba(139,92,246,0.6)' : file ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 12,
              padding: '32px 24px',
              textAlign: 'center',
              cursor: uploading ? 'default' : 'pointer',
              background: dragging ? 'rgba(139,92,246,0.08)' : file ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
            }}
          >
            <input
              id="file-input"
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={uploading}
            />
            {file ? (
              <div>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
                <p style={{ color: 'white', fontWeight: 600, fontSize: 15, margin: '0 0 4px' }}>{file.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>{formatSize(file.size)}</p>
                {!uploading && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', marginTop: 8 }}
                  >
                    Change file
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 15, margin: '0 0 6px' }}>
                  Drop your file here
                </p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 12px' }}>or click to browse</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: 0 }}>
                  PDF, Word, Excel, PNG, JPEG, CSV, ZIP — up to 50 MB
                </p>
              </div>
            )}
          </div>

          {/* Upload progress */}
          {uploading && uploadProgress > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Uploading…</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{uploadProgress}%</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
                <div style={{
                  background: 'linear-gradient(90deg,#6D28D9,#3B82F6)',
                  width: `${uploadProgress}%`, height: '100%', borderRadius: 99,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div style={{
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 8, padding: '12px 16px', color: '#F87171', fontSize: 13,
            }}>
              {errorMessage}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{
              width: '100%', padding: '14px 24px', borderRadius: 10, border: 'none', cursor: file && !uploading ? 'pointer' : 'not-allowed',
              background: file && !uploading ? 'linear-gradient(135deg,#1D4ED8,#2563EB)' : 'rgba(255,255,255,0.06)',
              color: file && !uploading ? 'white' : 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: 600,
              transition: 'all 0.2s', letterSpacing: '0.2px',
            }}
          >
            {uploading ? 'Submitting…' : 'Submit Evidence'}
          </button>

          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', margin: 0 }}>
            Your file is uploaded securely and reviewed only by authorized compliance team members.
          </p>
        </div>
      </div>
    </Shell>
  )
}
