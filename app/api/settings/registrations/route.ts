import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'

export async function GET() {
  try {
    const [settings] = await db.select({ allowRegistrations: systemSettings.allowRegistrations }).from(systemSettings).limit(1)
    return NextResponse.json({ allowRegistrations: settings?.allowRegistrations ?? false })
  } catch {
    return NextResponse.json({ allowRegistrations: false })
  }
}
