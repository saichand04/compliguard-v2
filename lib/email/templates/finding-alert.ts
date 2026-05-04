import { baseEmailLayout } from './base'

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; emoji: string }> = {
  critical: { color: '#F87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', label: 'CRITICAL', emoji: '🚨' },
  high:     { color: '#FB923C', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.3)',  label: 'HIGH',     emoji: '⚠️' },
  medium:   { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)',  label: 'MEDIUM',   emoji: '⚠️' },
  low:      { color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)',  label: 'LOW',      emoji: 'ℹ️' },
  info:     { color: '#94A3B8', bg: 'rgba(148,163,184,0.1)',border: 'rgba(148,163,184,0.3)', label: 'INFO',     emoji: 'ℹ️' },
}

export function findingAlertEmail(data: {
  recipientName: string
  findingTitle: string
  severity: string
  description: string
  dueDate?: Date
  viewUrl: string
}): string {
  const { recipientName, findingTitle, severity, description, dueDate, viewUrl } = data

  const sev = SEVERITY_CONFIG[severity.toLowerCase()] || SEVERITY_CONFIG.info

  const dueDateStr = dueDate
    ? dueDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const content = `
    <!-- Severity badge -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:${sev.bg};border:1px solid ${sev.border};border-radius:6px;padding:4px 12px;">
          <span style="color:${sev.color};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${sev.emoji} ${sev.label} SEVERITY FINDING</span>
        </td>
      </tr>
    </table>

    <h1 style="margin:0 0 8px;color:white;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
      New Finding Detected
    </h1>
    <p style="margin:0 0 28px;color:rgba(255,255,255,0.45);font-size:14px;">
      A compliance finding requires your attention
    </p>

    <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6;">
      Hi ${escapeHtml(recipientName)},
    </p>

    <p style="margin:0 0 24px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;">
      A new <strong style="color:${sev.color};">${sev.label}</strong> finding has been identified in your compliance program and requires your review.
    </p>

    <!-- Finding card -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-left:3px solid ${sev.color};border-radius:8px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Finding</p>
                <p style="margin:0 0 12px;color:white;font-size:17px;font-weight:600;">${escapeHtml(findingTitle)}</p>
                ${description ? `<p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">${escapeHtml(description)}</p>` : ''}
              </td>
              <td style="text-align:right;vertical-align:top;padding-left:16px;">
                <span style="display:inline-block;background:${sev.bg};border:1px solid ${sev.border};border-radius:6px;padding:4px 10px;color:${sev.color};font-size:11px;font-weight:700;white-space:nowrap;">${sev.label}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${dueDateStr ? `
    <!-- Due date notice -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;">
      <tr>
        <td style="padding:14px 20px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:16px;vertical-align:middle;padding-right:10px;">📅</td>
              <td style="color:rgba(255,255,255,0.7);font-size:14px;">
                Remediation due by <strong style="color:#F59E0B;">${dueDateStr}</strong>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ` : '<table style="margin:0 0 28px;"></table>'}

    <!-- CTA button -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background:${sev.bg};border:1px solid ${sev.border};border-radius:8px;padding:1px;">
          <a href="${viewUrl}" style="display:inline-block;background:linear-gradient(135deg,#1a1f35,#252d4a);color:white;font-size:15px;font-weight:600;padding:14px 36px;border-radius:7px;text-decoration:none;letter-spacing:0.2px;border:1px solid ${sev.border};">
            Review Finding →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.5;">
      Log in to CompliGuard to review, assign, and remediate this finding.<br>
      You are receiving this because you are a compliance manager for this organization.
    </p>
  `

  return baseEmailLayout(content, {
    previewText: `[${sev.label}] New finding: "${findingTitle}" requires your attention.`,
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
