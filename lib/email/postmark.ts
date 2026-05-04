import type { EmailProvider, SendEmailOptions, EmailAddress } from './index'

export interface PostmarkConfig {
  serverToken: string
  fromEmail: string
  fromName: string
}

interface PostmarkAttachment {
  Name: string
  Content: string  // base64
  ContentType: string
}

function toRecipientString(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email
}

function toAddressArray(to: EmailAddress | EmailAddress[]): string[] {
  return Array.isArray(to) ? to.map(toRecipientString) : [toRecipientString(to)]
}

export class PostmarkEmailProvider implements EmailProvider {
  private readonly config: PostmarkConfig

  constructor(config: PostmarkConfig) {
    this.config = config
  }

  async send(options: SendEmailOptions): Promise<{ messageId: string; accepted: boolean }> {
    const { serverToken, fromEmail, fromName } = this.config

    const from = options.from
      ? toRecipientString(options.from)
      : `${fromName} <${fromEmail}>`

    const toAddresses = toAddressArray(options.to)

    const attachments: PostmarkAttachment[] = (options.attachments || []).map((att) => ({
      Name: att.filename,
      Content: Buffer.isBuffer(att.content)
        ? att.content.toString('base64')
        : att.content,
      ContentType: att.contentType,
    }))

    const body: Record<string, unknown> = {
      From: from,
      To: toAddresses.join(', '),
      Subject: options.subject,
      HtmlBody: options.htmlBody,
      ...(options.textBody ? { TextBody: options.textBody } : {}),
      ...(options.replyTo ? { ReplyTo: toRecipientString(options.replyTo) } : {}),
      ...(options.tag ? { Tag: options.tag } : {}),
      ...(attachments.length > 0 ? { Attachments: attachments } : {}),
      ...(options.metadata ? { Metadata: options.metadata } : {}),
    }

    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': serverToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { Message?: string }
      throw new Error(`Postmark API error ${res.status}: ${errBody.Message || res.statusText}`)
    }

    const data = await res.json() as { MessageID?: string; ErrorCode?: number; Message?: string }

    if (data.ErrorCode && data.ErrorCode !== 0) {
      throw new Error(`Postmark error ${data.ErrorCode}: ${data.Message}`)
    }

    return {
      messageId: data.MessageID || `postmark-${Date.now()}`,
      accepted: true,
    }
  }
}
