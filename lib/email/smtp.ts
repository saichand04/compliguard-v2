import type { EmailProvider, SendEmailOptions, EmailAddress } from './index'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string
}

function toRecipientString(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email
}

function toAddressList(to: EmailAddress | EmailAddress[]): string {
  const arr = Array.isArray(to) ? to : [to]
  return arr.map(toRecipientString).join(', ')
}

/**
 * SMTP email provider using nodemailer.
 *
 * NOTE: nodemailer must be installed:
 *   npm install nodemailer
 *   npm install --save-dev @types/nodemailer
 *
 * If nodemailer is not available, this provider throws a clear error.
 */
export class SmtpEmailProvider implements EmailProvider {
  private readonly config: SmtpConfig

  constructor(config: SmtpConfig) {
    this.config = config
  }

  async send(options: SendEmailOptions): Promise<{ messageId: string; accepted: boolean }> {
    // Dynamic import so the app doesn't crash if nodemailer isn't installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let createTransport: (opts: unknown) => any
    try {
      // nodemailer must be installed: npm install nodemailer @types/nodemailer
      const nm = await import('nodemailer' as string) as { createTransport: (opts: unknown) => unknown }
      createTransport = nm.createTransport as (opts: unknown) => unknown
    } catch {
      throw new Error(
        'nodemailer is not installed. Run: npm install nodemailer @types/nodemailer'
      )
    }

    const { host, port, secure, user, pass, fromEmail, fromName } = this.config

    const transporter = createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    })

    const from = options.from
      ? toRecipientString(options.from)
      : `${fromName} <${fromEmail}>`

    const attachments = (options.attachments || []).map((att) => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content)
        ? att.content
        : Buffer.from(att.content, 'base64'),
      contentType: att.contentType,
    }))

    const info = await transporter.sendMail({
      from,
      to: toAddressList(options.to),
      subject: options.subject,
      html: options.htmlBody,
      text: options.textBody,
      replyTo: options.replyTo ? toRecipientString(options.replyTo) : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    return {
      messageId: (info.messageId as string) || `smtp-${Date.now()}`,
      accepted: true,
    }
  }
}
