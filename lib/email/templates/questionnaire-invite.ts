import { baseEmailLayout } from './base'

export function questionnaireInviteEmail(data: {
  recipientName: string
  orgName: string
  questionnaireTitle: string
  description: string
  responseUrl: string
  dueDate?: Date
}): string {
  const { recipientName, orgName, questionnaireTitle, description, responseUrl, dueDate } = data

  const dueDateStr = dueDate
    ? dueDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const content = `
    <!-- Label -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);border-radius:6px;padding:4px 12px;">
          <span style="color:#A78BFA;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Vendor Questionnaire</span>
        </td>
      </tr>
    </table>

    <h1 style="margin:0 0 8px;color:white;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
      You've Been Invited to Respond
    </h1>
    <p style="margin:0 0 28px;color:rgba(255,255,255,0.45);font-size:14px;">
      A security or compliance questionnaire requires your response
    </p>

    <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6;">
      Hi ${escapeHtml(recipientName)},
    </p>

    <p style="margin:0 0 24px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;">
      <strong style="color:white;">${escapeHtml(orgName)}</strong> has invited you to complete a security questionnaire as part of their vendor assessment process. Your responses help them maintain their compliance posture.
    </p>

    <!-- Questionnaire card -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-left:3px solid #8B5CF6;border-radius:8px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Questionnaire</p>
          <p style="margin:0 0 10px;color:white;font-size:17px;font-weight:600;">${escapeHtml(questionnaireTitle)}</p>
          ${description ? `<p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">${escapeHtml(description)}</p>` : ''}
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
                Please complete your response by <strong style="color:#F59E0B;">${dueDateStr}</strong>.
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
        <td style="background:linear-gradient(135deg,#6D28D9,#7C3AED);border-radius:8px;padding:1px;">
          <a href="${responseUrl}" style="display:inline-block;background:linear-gradient(135deg,#6D28D9,#7C3AED);color:white;font-size:15px;font-weight:600;padding:14px 36px;border-radius:7px;text-decoration:none;letter-spacing:0.2px;">
            Start Questionnaire →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.5;">
      This link was sent to you by <strong style="color:rgba(255,255,255,0.5);">${escapeHtml(orgName)}</strong>.<br>
      If you believe this was sent in error, you can safely ignore this email.
    </p>
  `

  return baseEmailLayout(content, {
    previewText: `${orgName} has invited you to complete a questionnaire: "${questionnaireTitle}"`,
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
