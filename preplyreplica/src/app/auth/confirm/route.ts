import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

// Email links (password recovery, signup confirmation) that carry a one-time
// token hash rather than a PKCE code. Unlike /auth/callback, this works in
// any browser or device: the PKCE code can only be exchanged in the browser
// that asked for the email, so a reset link opened from a phone, another
// browser or a mail app's built-in browser used to land on the reset page
// with no session ("Auth session missing!").
//
// Signup asks Supabase to redirect here (?type=email) and the "Confirm
// signup" email template appends the token, so the link returns to the same
// site (localhost or production):
//   {{ .RedirectTo }}&token_hash={{ .TokenHash }}
// Password reset links are built by /api/auth/forgot-password the same way.
const ALLOWED_TYPES: EmailOtpType[] = ['recovery', 'signup', 'email', 'invite', 'magiclink', 'email_change']

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  // Only ever an in-app path, never another site.
  const nextParam = searchParams.get('next')
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null
  const fallback = type === 'recovery' ? '/auth/reset-password' : '/auth/confirmed'

  const supabase = createServerClient()

  // An email template not yet switched to the token link still sends a PKCE
  // code here; accept it (it only works in the browser that asked for the email).
  const code = searchParams.get('code')
  if (!tokenHash && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    const destination = next || fallback
    return NextResponse.redirect(`${origin}${destination}${error ? `${destination.includes('?') ? '&' : '?'}error=link_expired` : ''}`)
  }

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}${type === 'recovery' ? '/auth/reset-password' : '/auth/login'}?error=link_expired`)
  }

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) {
    const destination = next || (type === 'recovery' ? '/auth/reset-password' : '/auth/login')
    return NextResponse.redirect(`${origin}${destination}${destination.includes('?') ? '&' : '?'}error=link_expired`)
  }
  return NextResponse.redirect(`${origin}${next || fallback}`)
}
