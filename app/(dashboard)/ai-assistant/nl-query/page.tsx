// Redirect legacy /ai-assistant/nl-query → /ai-assistant (unified page)
import { redirect } from 'next/navigation'

export default function NLQueryRedirect() {
  redirect('/ai-assistant')
}
