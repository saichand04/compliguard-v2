import { baseEmailLayout } from './base'

export function welcomeEmail(data: {
  name: string
  orgName: string
  loginUrl: string
}): string {
  const { name, orgName, loginUrl } = data

  const content = `
    <h1 style="margin:0 0 8px;color:white;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
      Welcome to CompliGuard
    </h1>
    <p style="margin:0 0 28px;color:rgba(255,255,255,0.55);font-size:14px;">
      Your compliance workspace is ready
    </p>

    <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6;">
      Hi ${escapeHtml(name)},
    </p>

    <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;">
      You've been added to <strong style="color:white;">${escapeHtml(orgName)}</strong>'s compliance workspace on CompliGuard. You can now manage controls, track evidence, and stay on top of your compliance program.
    </p>

    <!-- Feature highlights -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
      ${featureRow('📋', 'Manage Controls', 'Track all your compliance controls in one place')}
      ${featureRow('📎', 'Upload Evidence', 'Attach documents and evidence to controls')}
      ${featureRow('🔍', 'AI-Powered Analysis', 'Get intelligent insights and gap analysis')}
      ${featureRow('📊', 'Reports & SOA', 'Generate compliance reports automatically')}
    </table>

    <!-- CTA button -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background:linear-gradient(135deg,#6D28D9,#7C3AED);border-radius:8px;padding:1px;">
          <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#6D28D9,#7C3AED);color:white;font-size:15px;font-weight:600;padding:14px 32px;border-radius:7px;text-decoration:none;letter-spacing:0.2px;">
            Get Started →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.5;">
      If you have trouble clicking the button, copy and paste this link into your browser:<br>
      <a href="${loginUrl}" style="color:#8B5CF6;word-break:break-all;">${loginUrl}</a>
    </p>
  `

  return baseEmailLayout(content, {
    previewText: `Welcome to CompliGuard! Your compliance workspace at ${orgName} is ready.`,
  })
}

function featureRow(icon: string, title: string, desc: string): string {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:36px;font-size:20px;vertical-align:top;padding-top:2px;">${icon}</td>
            <td style="padding-left:12px;">
              <p style="margin:0 0 2px;color:white;font-size:14px;font-weight:600;">${title}</p>
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;">${desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
