import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Handles Supabase's PKCE redirect (email confirmation, password recovery,
// etc.) by exchanging the `code` for a session, then forwarding the user on
// to whichever page actually needs that session (e.g. reset-password).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/'

  if (code) {
    const supabase = createServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
