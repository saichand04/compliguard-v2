import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { encrypt } from '@/lib/encryption'
import { resetEmailProvider } from '@/lib/email'
import { logger } from '@/lib/logger'

// GET /api/email/settings — load current email config (super_admin only — C12)
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()

  const rows = await db.select().from(systemSettings).limit(1)
  const cfg = rows[0]
  if (!cfg) return NextResponse.json({
    provider: 'disabled',
    postmark: { serverToken: '', fromEmail: '', fromName: 'CompliGuard' },
    smtp: { host: '', port: '587', secure: false, user: '', pass: '', fromEmail: '', fromName: 'CompliGuard' },
  })

  const extraCfg = (cfg.extraConfig as Record<string, unknown>) || {}

  // Postmark settings
  const postmarkFromStore = (extraCfg.postmarkServerToken as string) || ''
  const postmark = {
    serverToken: postmarkFromStore ? '••••••••' : '', // mask stored token
    fromEmail: (extraCfg.postmarkFromEmail as string) || cfg.emailFrom || '',
    fromName: (extraCfg.postmarkFromName as string) || 'CompliGuard',
  }

  // SMTP settings
  const smtpFromStore = (extraCfg.smtp as Record<string, unknown>) || {}
  const smtp = {
    host: (smtpFromStore.host as string) || '',
    port: String((smtpFromStore.port as number) || 587),
    secure: (smtpFromStore.secure as boolean) || false,
    user: (smtpFromStore.user as string) || '',
    pass: smtpFromStore.pass ? '••••••••' : '',
    fromEmail: (smtpFromStore.fromEmail as string) || '',
    fromName: (smtpFromStore.fromName as string) || 'CompliGuard',
  }

  return NextResponse.json({
    provider: cfg.emailProvider || 'disabled',
    postmark,
    smtp,
    lastSendAt: (extraCfg.lastSendAt as string) || null,
    lastError: (extraCfg.lastEmailError as string) || null,
  })
}

// POST /api/email/settings — save email config (super_admin only — C12)
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()

  let body: {
    provider: string
    postmark?: { serverToken?: string; fromEmail?: string; fromName?: string }
    smtp?: { host?: string; port?: string; secure?: boolean; user?: string; pass?: string; fromEmail?: string; fromName?: string }
  }
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON')
  }

  const { provider, postmark, smtp } = body

  const rows = await db.select().from(systemSettings).limit(1)
  const existing = rows[0]
  const existingExtra = (existing?.extraConfig as Record<string, unknown>) || {}

  const newExtra: Record<string, unknown> = { ...existingExtra }

  if (provider === 'postmark' && postmark) {
    // Only update token if a new (non-masked) value was provided
    if (postmark.serverToken && !postmark.serverToken.startsWith('•')) {
      newExtra.postmarkServerToken = encrypt(postmark.serverToken)
    }
    newExtra.postmarkFromEmail = postmark.fromEmail || ''
    newExtra.postmarkFromName = postmark.fromName || 'CompliGuard'
  }

  if (provider === 'smtp' && smtp) {
    const existingSmtp = (existingExtra.smtp as Record<string, unknown>) || {}
    newExtra.smtp = {
      host: smtp.host || '',
      port: Number(smtp.port) || 587,
      secure: smtp.secure || false,
      user: smtp.user || '',
      // Only encrypt new password if provided
      pass: smtp.pass && !smtp.pass.startsWith('•')
        ? encrypt(smtp.pass)
        : existingSmtp.pass || '',
      fromEmail: smtp.fromEmail || '',
      fromName: smtp.fromName || 'CompliGuard',
    }
  }

  const fromEmail = provider === 'postmark'
    ? (postmark?.fromEmail || '')
    : provider === 'smtp'
      ? (smtp?.fromEmail || '')
      : (existing?.emailFrom || '')

  try {
    // (C12) constrain UPDATE to the existing settings row; if none, insert.
    if (existing) {
      await db.update(systemSettings).set({
        emailProvider: provider,
        emailFrom: fromEmail,
        extraConfig: newExtra,
        updatedAt: new Date(),
      }).where(eq(systemSettings.id, existing.id))
    } else {
      await db.insert(systemSettings).values({
        emailProvider: provider,
        emailFrom: fromEmail,
        extraConfig: newExtra,
      })
    }
  } catch (err) {
    logger.error({ err }, 'email-settings.update failed')
    return ApiErrors.internal()
  }

  // Reset the singleton so new settings take effect
  resetEmailProvider()

  return NextResponse.json({ ok: true })
}
