import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Handles Supabase's PKCE redirect (email confirmation, password recovery,
// etc.) by exchanging the `code` for a session, then forwarding the user on
// to whichever page actually needs that session.
//
// `next`, when explicitly provided (e.g. the password-recovery flow passing
// `?next=/auth/reset-password`), is always honored as-is. Without one (the
// plain email-confirmation case), a successful exchange lands on a branded
// confirmation page instead of the bare homepage, and a failed one (link
// already used/expired -- a real possibility, since some email clients
// pre-fetch links and burn the one-time code before the user ever clicks)
// lands on login with a clear explanation instead of silently pretending it
// worked.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (!code) {
    return NextResponse.redirect(`${origin}${next || '/'}`)
  }

  const supabase = createServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const destination = next || '/auth/login'
    const separator = destination.includes('?') ? '&' : '?'
    return NextResponse.redirect(`${origin}${destination}${separator}error=link_expired`)
  }

  return NextResponse.redirect(`${origin}${next || '/auth/confirmed'}`)
}
