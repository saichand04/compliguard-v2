import { baseEmailLayout } from './base'

export function evidenceRequestEmail(data: {
  recipientName: string
  requestedBy: string
  controlName: string
  description: string
  uploadUrl: string
  expiresAt: Date
}): string {
  const { recipientName, requestedBy, controlName, description, uploadUrl, expiresAt } = data

  const expiryStr = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const content = `
    <!-- Label -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:6px;padding:4px 12px;">
          <span style="color:#60A5FA;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Evidence Request</span>
        </td>
      </tr>
    </table>

    <h1 style="margin:0 0 8px;color:white;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
      Evidence Needed
    </h1>
    <p style="margin:0 0 28px;color:rgba(255,255,255,0.45);font-size:14px;">
      A compliance team member is requesting documentation from you
    </p>

    <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6;">
      Hi ${escapeHtml(recipientName)},
    </p>

    <p style="margin:0 0 24px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;">
      <strong style="color:white;">${escapeHtml(requestedBy)}</strong> has requested evidence from you for a compliance control. Please upload the relevant documentation using the secure link below.
    </p>

    <!-- Control card -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-left:3px solid #3B82F6;border-radius:8px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Control</p>
          <p style="margin:0 0 12px;color:white;font-size:16px;font-weight:600;">${escapeHtml(controlName)}</p>
          ${description ? `<p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">${escapeHtml(description)}</p>` : ''}
        </td>
      </tr>
    </table>

    <!-- Expiry notice -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;">
      <tr>
        <td style="padding:14px 20px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:16px;vertical-align:middle;padding-right:10px;">⏰</td>
              <td style="color:rgba(255,255,255,0.7);font-size:14px;">
                This upload link expires on <strong style="color:#F59E0B;">${expiryStr}</strong>. Please submit before that date.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA button -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background:linear-gradient(135deg,#1D4ED8,#2563EB);border-radius:8px;padding:1px;">
          <a href="${uploadUrl}" style="display:inline-block;background:linear-gradient(135deg,#1D4ED8,#2563EB);color:white;font-size:15px;font-weight:600;padding:14px 36px;border-radius:7px;text-decoration:none;letter-spacing:0.2px;">
            Upload Evidence →
          </a>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:6px;">
      <tr>
        <td style="padding:12px 16px;">
          <p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Accepted file types</p>
          <p style="margin:0;color:rgba(255,255,255,0.55);font-size:13px;">PDF, Word, Excel, PNG, JPEG, CSV, ZIP — up to 50 MB</p>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.5;">
      You can also reply to this email with your evidence as an attachment.<br>
      If you have questions, contact your compliance manager.
    </p>
  `

  return baseEmailLayout(content, {
    previewText: `Evidence requested for "${controlName}" — please upload by ${expiryStr}.`,
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
