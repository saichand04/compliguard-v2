import { Resend } from 'resend'
import { logger } from '@/lib/logger'

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  return new Resend(apiKey)
}

const FROM = process.env.EMAIL_FROM || 'compliance@compliguard.app'
const REPLY_TO = process.env.EMAIL_REPLY_TO || FROM

/**
 * Send an evidence request email with a secure single-use upload link.
 */
export async function sendEvidenceRequest(
  to: string,
  controlTitle: string,
  uploadLink: string,
  dueDate: string
): Promise<void> {
  const resend = getResendClient()
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    replyTo: REPLY_TO,
    subject: `Evidence Request: ${controlTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e293b">Evidence Request</h2>
        <p>You have been asked to provide evidence for the following compliance control:</p>
        <blockquote style="border-left:4px solid #3b82f6;padding:8px 16px;background:#f0f9ff">
          <strong>${controlTitle}</strong>
        </blockquote>
        <p><strong>Due date:</strong> ${dueDate}</p>
        <p>Please click the button below to upload your evidence:</p>
        <a href="${uploadLink}" style="display:inline-block;background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Upload Evidence
        </a>
        <p style="color:#64748b;font-size:14px;margin-top:24px">
          This link is single-use and expires after upload. If you have questions, please contact your compliance manager.
        </p>
        <p style="color:#64748b;font-size:14px">
          Alternatively, you can reply to this email with your evidence file as an attachment.
        </p>
      </div>
    `,
  })
  if (error) {
    logger.error({ error, to, controlTitle }, 'Failed to send evidence request email')
    throw new Error(`Email send failed: ${error.message}`)
  }
  logger.info({ to, controlTitle }, 'Evidence request email sent')
}

/**
 * Send an invitation email to a new team member.
 */
export async function sendInviteEmail(
  to: string,
  inviterName: string,
  orgName: string,
  inviteLink: string
): Promise<void> {
  const resend = getResendClient()
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `You've been invited to ${orgName} on CompliGuard`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e293b">You've been invited</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong>'s compliance workspace on CompliGuard.</p>
        <a href="${inviteLink}" style="display:inline-block;background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
          Accept Invitation
        </a>
        <p style="color:#64748b;font-size:14px">This invitation expires in 48 hours.</p>
      </div>
    `,
  })
  if (error) throw new Error(`Invite email failed: ${error.message}`)
}

/**
 * Notify uploader that their evidence was approved.
 */
export async function sendEvidenceApproved(
  to: string,
  controlTitle: string,
  notes: string
): Promise<void> {
  const resend = getResendClient()
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Evidence Approved: ${controlTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#16a34a">✓ Evidence Approved</h2>
        <p>Your evidence submission for <strong>${controlTitle}</strong> has been approved.</p>
        ${notes ? `<p><strong>Reviewer notes:</strong> ${notes}</p>` : ''}
      </div>
    `,
  })
}

/**
 * Notify uploader that their evidence was rejected.
 */
export async function sendEvidenceRejected(
  to: string,
  controlTitle: string,
  notes: string
): Promise<void> {
  const resend = getResendClient()
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Evidence Rejected: ${controlTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#dc2626">✗ Evidence Rejected</h2>
        <p>Your evidence submission for <strong>${controlTitle}</strong> was not accepted.</p>
        ${notes ? `<p><strong>Reason:</strong> ${notes}</p>` : ''}
        <p>Please review the feedback and re-submit corrected evidence.</p>
      </div>
    `,
  })
}

/**
 * Notify assignee that a control is overdue.
 */
export async function sendControlOverdue(
  to: string,
  controlTitle: string,
  dueDate: string
): Promise<void> {
  const resend = getResendClient()
  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Overdue] Control: ${controlTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#f59e0b">⚠ Control Overdue</h2>
        <p>The following compliance control was due on <strong>${dueDate}</strong> and is now overdue:</p>
        <blockquote style="border-left:4px solid #f59e0b;padding:8px 16px;background:#fffbeb">
          <strong>${controlTitle}</strong>
        </blockquote>
        <p>Please update the control status or upload evidence as soon as possible.</p>
      </div>
    `,
  })
}

/**
 * Warn policy owner about upcoming review date.
 */
export async function sendPolicyExpiryWarning(
  to: string,
  policyTitle: string,
  reviewDate: string
): Promise<void> {
  const resend = getResendClient()
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Policy Review Due: ${policyTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#7c3aed">Policy Review Required</h2>
        <p>The policy <strong>${policyTitle}</strong> is due for review on <strong>${reviewDate}</strong>.</p>
        <p>Please log in to CompliGuard to review and update this policy.</p>
      </div>
    `,
  })
}

/**
 * Notify compliance managers about a new finding.
 */
export async function sendNewFinding(
  to: string,
  findingTitle: string,
  severity: string
): Promise<void> {
  const severityColors: Record<string, string> = {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#3b82f6',
    info: '#64748b',
  }
  const color = severityColors[severity] || '#64748b'
  const resend = getResendClient()
  await resend.emails.send({
    from: FROM,
    to,
    subject: `[${severity.toUpperCase()}] New Finding: ${findingTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:${color}">New ${severity.toUpperCase()} Finding</h2>
        <p>A new finding has been detected:</p>
        <blockquote style="border-left:4px solid ${color};padding:8px 16px">
          <strong>${findingTitle}</strong>
        </blockquote>
        <p>Log in to CompliGuard to review and triage this finding.</p>
      </div>
    `,
  })
}

/**
 * Send a daily digest email with tasks, findings, and framework health.
 */
export async function sendDailyDigest(
  to: string,
  tasks: { title: string; dueDate: string }[],
  findings: { title: string; severity: string }[],
  frameworkHealth: { name: string; percent: number }[]
): Promise<void> {
  const resend = getResendClient()
  const taskRows = tasks
    .map((t) => `<tr><td style="padding:4px 8px">${t.title}</td><td style="padding:4px 8px">${t.dueDate}</td></tr>`)
    .join('')
  const findingRows = findings
    .map((f) => `<tr><td style="padding:4px 8px">${f.title}</td><td style="padding:4px 8px;color:#dc2626">${f.severity}</td></tr>`)
    .join('')
  const frameworkRows = frameworkHealth
    .map((fw) => `<tr><td style="padding:4px 8px">${fw.name}</td><td style="padding:4px 8px">${fw.percent}%</td></tr>`)
    .join('')

  await resend.emails.send({
    from: FROM,
    to,
    subject: `CompliGuard Daily Digest — ${new Date().toLocaleDateString()}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e293b">Daily Compliance Digest</h2>
        ${tasks.length > 0 ? `
          <h3>My Tasks Due This Week (${tasks.length})</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left;padding:4px 8px">Task</th><th style="text-align:left;padding:4px 8px">Due</th></tr></thead>
            <tbody>${taskRows}</tbody>
          </table>` : ''}
        ${findings.length > 0 ? `
          <h3>Open Findings (${findings.length})</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left;padding:4px 8px">Finding</th><th style="text-align:left;padding:4px 8px">Severity</th></tr></thead>
            <tbody>${findingRows}</tbody>
          </table>` : ''}
        ${frameworkHealth.length > 0 ? `
          <h3>Framework Progress</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left;padding:4px 8px">Framework</th><th style="text-align:left;padding:4px 8px">Progress</th></tr></thead>
            <tbody>${frameworkRows}</tbody>
          </table>` : ''}
        <p style="color:#64748b;font-size:12px;margin-top:24px">Sent by CompliGuard — manage email preferences in Settings.</p>
      </div>
    `,
  })
}
