import fs from 'fs'
import type { EmailProvider, SendEmailOptions, EmailAddress } from './index'

const LOG_FILE = '/tmp/compliguard-emails.json'

interface MockEmailRecord {
  messageId: string
  timestamp: string
  to: string | string[]
  from?: string
  subject: string
  preview: string
  tag?: string
}

function toStr(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email
}

function toList(to: EmailAddress | EmailAddress[]): string[] {
  return Array.isArray(to) ? to.map(toStr) : [toStr(to)]
}

export class MockEmailProvider implements EmailProvider {
  async send(options: SendEmailOptions): Promise<{ messageId: string; accepted: boolean }> {
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const toList_ = toList(options.to)

    const record: MockEmailRecord = {
      messageId,
      timestamp: new Date().toISOString(),
      to: toList_,
      from: options.from ? toStr(options.from) : 'CompliGuard <compliance@compliguard.app>',
      subject: options.subject,
      preview: options.textBody
        ? options.textBody.slice(0, 200)
        : options.htmlBody.replace(/<[^>]+>/g, '').slice(0, 200),
      ...(options.tag ? { tag: options.tag } : {}),
    }

    // Console log for dev visibility
    console.log('[MockEmail] Sending email:', JSON.stringify(record, null, 2))

    // Append to log file
    try {
      let existing: MockEmailRecord[] = []
      if (fs.existsSync(LOG_FILE)) {
        const raw = fs.readFileSync(LOG_FILE, 'utf-8')
        existing = JSON.parse(raw)
        if (!Array.isArray(existing)) existing = []
      }
      existing.push(record)
      // Keep only last 1000 emails
      if (existing.length > 1000) existing = existing.slice(-1000)
      fs.writeFileSync(LOG_FILE, JSON.stringify(existing, null, 2), 'utf-8')
    } catch {
      // If we can't write to /tmp (e.g. edge runtime), just log to console
    }

    return { messageId, accepted: true }
  }
}
