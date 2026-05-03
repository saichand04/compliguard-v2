import { redirect } from 'next/navigation'

export default function Home() {
  // Root redirect — middleware handles auth + setup routing
  redirect('/dashboard')
}
