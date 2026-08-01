'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'

export function SignOutButton() {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    await supabase.auth.signOut()
    // Full reload (not router.push+refresh) so the root layout's Navbar —
    // a server component — reliably re-renders with the cleared session.
    window.location.href = '/'
  }

  return (
    <Button variant="secondary" onClick={handleSignOut} loading={loading}>
      Sign out
    </Button>
  )
}
