import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getEmailProvider } from '@/lib/email'
import { welcomeEmail } from '@/lib/email/templates/welcome'
import { systemSettings } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

// POST /api/email/test — send a test email to current user (super_admin only — C12)
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()

  let body: {
    provider?: string
    postmark?: { serverToken?: string; fromEmail?: string; fromName?: string }
    smtp?: { host?: string; port?: string; secure?: boolean; user?: string; pass?: string; fromEmail?: string; fromName?: string }
  }
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON')
  }

  // If new credentials are provided in the request, temporarily override the DB config
  // by writing them to DB, sending the test, then optionally restoring — but it's simpler
  // to construct a provider ad-hoc here.
  const { provider } = body

  try {
    let emailProvider
    if (provider === 'postmark' && body.postmark?.serverToken && !body.postmark.serverToken.startsWith('•')) {
      const { PostmarkEmailProvider } = await import('@/lib/email/postmark')
      emailProvider = new PostmarkEmailProvider({
        serverToken: body.postmark.serverToken,
        fromEmail: body.postmark.fromEmail || 'compliance@compliguard.app',
        fromName: body.postmark.fromName || 'CompliGuard',
      })
    } else if (provider === 'smtp' && body.smtp?.host) {
      const { SmtpEmailProvider } = await import('@/lib/email/smtp')
      emailProvider = new SmtpEmailProvider({
        host: body.smtp.host,
        port: Number(body.smtp.port) || 587,
        secure: body.smtp.secure || false,
        user: body.smtp.user || '',
        pass: body.smtp.pass && !body.smtp.pass.startsWith('•') ? body.smtp.pass : '',
        fromEmail: body.smtp.fromEmail || 'compliance@compliguard.app',
        fromName: body.smtp.fromName || 'CompliGuard',
      })
    } else {
      // Use configured provider from DB
      emailProvider = await getEmailProvider()
    }

    // Get current user's email
    const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
    const user = userRows[0]
    const recipientEmail = user?.email || session.email
    const recipientName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Admin'

    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://compliguard.app'

    const html = welcomeEmail({
      name: recipientName,
      orgName: 'CompliGuard Test',
      loginUrl: `${baseUrl}/dashboard`,
    })

    const result = await emailProvider.send({
      to: { email: recipientEmail, name: recipientName },
      subject: 'CompliGuard Email Test',
      htmlBody: html,
      textBody: 'This is a test email from CompliGuard. If you received this, your email configuration is working correctly.',
      tag: 'test',
    })

    // Update last send timestamp in settings — constrain UPDATE to single row (C12).
    try {
      const rows = await db.select().from(systemSettings).limit(1)
      const cfg = rows[0]
      if (cfg) {
        const extra = (cfg.extraConfig as Record<string, unknown>) || {}
        await db.update(systemSettings).set({
          extraConfig: { ...extra, lastSendAt: new Date().toISOString(), lastEmailError: null },
          updatedAt: new Date(),
        }).where(eq(systemSettings.id, cfg.id))
      }
    } catch (err) {
      // Non-critical
      logger.warn({ err }, 'email.test lastSendAt persist failed')
    }

    return NextResponse.json({
      ok: true,
      message: `Test email sent successfully to ${recipientEmail}. Message ID: ${result.messageId}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err }, 'email.test send failed')

    // Record error in settings — constrain UPDATE to single row (C12).
    try {
      const rows = await db.select().from(systemSettings).limit(1)
      const cfg = rows[0]
      if (cfg) {
        const extra = (cfg.extraConfig as Record<string, unknown>) || {}
        await db.update(systemSettings).set({
          extraConfig: { ...extra, lastEmailError: message },
          updatedAt: new Date(),
        }).where(eq(systemSettings.id, cfg.id))
      }
    } catch (innerErr) {
      logger.warn({ err: innerErr }, 'email.test lastError persist failed')
    }

    // Do not leak raw error to client — return generic message.
    return NextResponse.json({ ok: false, message: 'Failed to send test email' })
  }
}
