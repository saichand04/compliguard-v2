import { baseEmailLayout } from './base'

export function reportReadyEmail(data: {
  recipientName: string
  reportName: string
  downloadUrl: string
  generatedAt: Date
}): string {
  const { recipientName, reportName, downloadUrl, generatedAt } = data

  const generatedStr = generatedAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const content = `
    <!-- Label -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:4px 12px;">
          <span style="color:#34D399;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">✓ Report Ready</span>
        </td>
      </tr>
    </table>

    <h1 style="margin:0 0 8px;color:white;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
      Your Report Is Ready
    </h1>
    <p style="margin:0 0 28px;color:rgba(255,255,255,0.45);font-size:14px;">
      Your compliance report has been generated and is available to download
    </p>

    <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6;">
      Hi ${escapeHtml(recipientName)},
    </p>

    <p style="margin:0 0 24px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;">
      Your compliance report has been successfully generated and is ready for download. Click the button below to access it.
    </p>

    <!-- Report card -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-left:3px solid #10B981;border-radius:8px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:36px;vertical-align:top;width:52px;">📊</td>
              <td style="padding-left:16px;vertical-align:top;">
                <p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Report</p>
                <p style="margin:0 0 8px;color:white;font-size:16px;font-weight:600;">${escapeHtml(reportName)}</p>
                <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;">Generated: ${generatedStr}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA button -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background:linear-gradient(135deg,#059669,#10B981);border-radius:8px;padding:1px;">
          <a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#10B981);color:white;font-size:15px;font-weight:600;padding:14px 36px;border-radius:7px;text-decoration:none;letter-spacing:0.2px;">
            Download Report →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.5;">
      This report link is available for 7 days.<br>
      You can also access all reports in CompliGuard under <strong style="color:rgba(255,255,255,0.5);">Reports</strong>.
    </p>
  `

  return baseEmailLayout(content, {
    previewText: `Your report "${reportName}" is ready to download.`,
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
