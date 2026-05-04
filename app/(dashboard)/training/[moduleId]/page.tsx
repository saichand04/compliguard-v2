import { getSession } from '@/lib/auth/jwt'
import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { TrainingModuleClient } from './TrainingModuleClient'

interface ModuleDetail {
  id: string
  title: string
  description: string | null
  content: string | null
  estimatedMinutes: number | null
  passingScore: number | null
  isRequired: boolean | null
  category: string
  difficulty: string
}

interface CompletionData {
  completedAt: string | null
  score: number | null
  passed: boolean | null
  certificateKey: string | null
  attemptCount: number | null
}

async function fetchModule(
  moduleId: string,
  token: string
): Promise<{ module: ModuleDetail; completion: CompletionData | null } | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/training/modules/${moduleId}`,
      {
        headers: { Cookie: `cg-session=${token}` },
        cache: 'no-store',
      }
    )
    if (res.status === 404) return null
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default async function TrainingModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/signin')

  const { moduleId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('cg-session')?.value ?? ''

  const data = await fetchModule(moduleId, token)
  if (!data) notFound()

  return (
    <TrainingModuleClient
      module={data.module}
      initialCompletion={data.completion}
      userName={
        session.firstName && session.lastName
          ? `${session.firstName} ${session.lastName}`
          : session.email
      }
    />
  )
}
