import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { decrypt } from '@/lib/encryption'

export interface EmailAddress {
  email: string
  name?: string
}

export interface EmailAttachment {
  filename: string
  content: Buffer | string  // base64 string or Buffer
  contentType: string
}

export interface SendEmailOptions {
  to: EmailAddress | EmailAddress[]
  from?: EmailAddress           // defaults to system compliance@ address
  subject: string
  htmlBody: string
  textBody?: string
  replyTo?: EmailAddress
  attachments?: EmailAttachment[]
  tag?: string                  // Postmark message tag
  metadata?: Record<string, string>
}

export interface EmailProvider {
  send(options: SendEmailOptions): Promise<{ messageId: string; accepted: boolean }>
}

export type EmailProviderType = 'postmark' | 'smtp' | 'mock'

let _instance: EmailProvider | null = null

/**
 * Factory: reads config from system_settings, returns appropriate provider.
 * Uses a module-level singleton so it's only instantiated once per server lifecycle.
 */
export async function getEmailProvider(): Promise<EmailProvider> {
  if (_instance) return _instance

  try {
    const settings = await db.select().from(systemSettings).limit(1)
    const cfg = settings[0]

    if (cfg?.emailProvider === 'postmark') {
      const extraCfg = (cfg.extraConfig as Record<string, unknown>) || {}
      const rawToken = (extraCfg.postmarkServerToken as string) || ''
      const serverToken = rawToken ? decrypt(rawToken) : ''
      const fromEmail = (extraCfg.postmarkFromEmail as string) || cfg.emailFrom || 'compliance@compliguard.app'
      const fromName = (extraCfg.postmarkFromName as string) || 'CompliGuard'

      if (serverToken) {
        const { PostmarkEmailProvider } = await import('./postmark')
        _instance = new PostmarkEmailProvider({ serverToken, fromEmail, fromName })
        return _instance
      }
    }

    if (cfg?.emailProvider === 'smtp') {
      const extraCfg = (cfg.extraConfig as Record<string, unknown>) || {}
      const smtpCfg = (extraCfg.smtp as Record<string, unknown>) || {}
      if (smtpCfg.host) {
        const { SmtpEmailProvider } = await import('./smtp')
        _instance = new SmtpEmailProvider({
          host: smtpCfg.host as string,
          port: (smtpCfg.port as number) || 587,
          secure: (smtpCfg.secure as boolean) || false,
          user: smtpCfg.user as string,
          pass: smtpCfg.pass ? decrypt(smtpCfg.pass as string) : '',
          fromEmail: (smtpCfg.fromEmail as string) || cfg.emailFrom || 'compliance@compliguard.app',
          fromName: (smtpCfg.fromName as string) || 'CompliGuard',
        })
        return _instance
      }
    }
  } catch {
    // Fall through to mock provider if DB is not available
  }

  const { MockEmailProvider } = await import('./mock')
  _instance = new MockEmailProvider()
  return _instance
}

/**
 * Reset the singleton (useful after config changes).
 */
export function resetEmailProvider(): void {
  _instance = null
}
