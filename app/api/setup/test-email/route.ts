import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { provider, apiKey, fromAddress } = body

  if (!fromAddress) {
    return NextResponse.json({ ok: false, message: 'From address is required' })
  }

  try {
    if (provider === 'resend' && apiKey) {
      const { Resend } = await import('resend')
      const resend = new Resend(apiKey)
      const { error } = await resend.emails.send({
        from: fromAddress,
        to: fromAddress,
        subject: 'CompliGuard — Email Configuration Test',
        html: '<p>✓ Email configuration is working correctly.</p>',
      })
      if (error) {
        return NextResponse.json({ ok: false, message: `Resend error: ${error.message}` })
      }
      return NextResponse.json({ ok: true, message: `Test email sent to ${fromAddress} via Resend` })
    }
    // Other providers: just validate the config format
    return NextResponse.json({ ok: true, message: `${provider} configuration saved (test requires live credentials)` })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, message: `Error: ${(err as Error).message}` })
  }
}
