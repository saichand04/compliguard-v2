import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function SetupRootPage() {
  try {
    // Check current setup step and redirect appropriately
    const [settings] = await db.select().from(systemSettings).limit(1)

    if (!settings || settings.setupStep === 0) {
      redirect('/setup/welcome')
    }

    const stepRoutes: Record<number, string> = {
      1: '/setup/organization',
      2: '/setup/admin',
      3: '/setup/users',
      4: '/setup/email',
      5: '/setup/storage',
      6: '/setup/ai',
      7: '/setup/integrations',
      8: '/setup/review',
    }

    const targetRoute = stepRoutes[settings.setupStep] || '/setup/welcome'
    redirect(targetRoute)
  } catch {
    // DB unavailable or first run — start from the beginning
    redirect('/setup/welcome')
  }
}
