import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { getSessionFromRequest, setSetupCookie } from '@/lib/auth/jwt'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const [settings] = await db.select().from(systemSettings).limit(1)
    if (!settings) {
      return NextResponse.json({ error: 'System settings not found. Please complete all setup steps.' }, { status: 400 })
    }

    // Re-running the wizard on a live installation is only permitted for an
    // authenticated super_admin — otherwise anyone hitting this endpoint
    // could reset the setup flag and access the wizard.
    if (settings.setupCompleted) {
      const session = await getSessionFromRequest(req)
      if (!session || session.role !== 'super_admin') {
        return NextResponse.json({ error: 'Setup already complete' }, { status: 403 })
      }
    }

    // Mark setup as completed
    await db.update(systemSettings).set({
      setupCompleted: true,
      setupStep: 9,
      updatedAt: new Date(),
    })

    // Set the lightweight setup completion cookie (used by middleware)
    await setSetupCookie()

    logger.info('Setup wizard completed')

    return NextResponse.json({ ok: true, redirect: '/dashboard' })
  } catch (err: unknown) {
    logger.error({ err }, 'Setup completion failed')
    return NextResponse.json({ error: 'Failed to complete setup. Please try again.' }, { status: 500 })
  }
}
