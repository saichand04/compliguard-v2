/**
 * Base email layout for all CompliGuard transactional emails.
 * Uses inline CSS only (email client compatibility).
 * Dark-branded: #1a1f35 background, white text.
 */
export function baseEmailLayout(content: string, options?: { previewText?: string }): string {
  const previewText = options?.previewText || ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>CompliGuard</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#080B18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;color:#080B18;font-size:1px;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>` : ''}

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#080B18;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Email container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1f35 0%,#0f1420 100%);border-radius:12px 12px 0 0;padding:28px 40px;border:1px solid rgba(255,255,255,0.08);border-bottom:none;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:linear-gradient(135deg,#6D28D9,#7C3AED);border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;">
                          <span style="color:white;font-size:18px;font-weight:700;line-height:32px;">C</span>
                        </td>
                        <td style="padding-left:10px;">
                          <span style="color:white;font-size:16px;font-weight:700;letter-spacing:-0.3px;">CompliGuard</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <span style="color:rgba(255,255,255,0.3);font-size:11px;letter-spacing:1px;text-transform:uppercase;">GRC Platform</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="background:#1a1f35;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);padding:40px 40px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#111626;border-radius:0 0 12px 12px;padding:24px 40px;border:1px solid rgba(255,255,255,0.08);border-top:1px solid rgba(255,255,255,0.05);">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:rgba(255,255,255,0.35);font-size:12px;line-height:1.6;">
                    <p style="margin:0 0 6px;">Sent by <strong style="color:rgba(255,255,255,0.5);">CompliGuard GRC Platform</strong></p>
                    <p style="margin:0;">
                      <a href="#" style="color:rgba(255,255,255,0.35);text-decoration:underline;font-size:11px;">Unsubscribe</a>
                      &nbsp;&bull;&nbsp;
                      <span style="font-size:11px;">© ${new Date().getFullYear()} CompliGuard. All rights reserved.</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>
</body>
</html>`
}
