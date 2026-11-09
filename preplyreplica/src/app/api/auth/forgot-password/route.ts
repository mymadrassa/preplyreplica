import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { sendPasswordResetEmail } from '@/lib/email'

const schema = z.object({ email: z.string().email('Enter a valid email address.') })

/**
 * Sends the password reset email from the app (through the IONOS mailbox) instead of
 * Supabase's built-in template, which can't be edited without custom SMTP.
 * The link carries a one-time token hash checked by /auth/confirm, so it
 * works in any browser or device.
 *
 * Always answers the same way whether or not the email has an account, so
 * this can't be used to find out who's registered.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Enter a valid email address.' }, { status: 400 })
  }
  const email = parsed.data.email.trim().toLowerCase()

  const { data, error } = await createSupabaseServiceRoleClient().auth.admin.generateLink({ type: 'recovery', email })
  const tokenHash = data?.properties?.hashed_token
  if (!error && tokenHash) {
    const params = new URLSearchParams({ token_hash: tokenHash, type: 'recovery', next: '/auth/reset-password' })
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    try {
      await sendPasswordResetEmail({ to: email, resetUrl: `${origin}/auth/confirm?${params}` })
    } catch (sendError) {
      // 502: the email server refused or failed (e.g. 535 = wrong SMTP_USER / SMTP_PASSWORD).
      console.error('[forgot-password] email not sent:', (sendError as Error)?.message ?? sendError)
      return NextResponse.json({ error: 'We couldn’t send the email right now. Please try again in a few minutes.' }, { status: 502 })
    }
  }
  // No account (or any other lookup error): same answer to the visitor, nothing sent.
  // The server log says which case it was, for whoever runs the site.
  if (error || !tokenHash) {
    console.warn(`[forgot-password] no email sent to ${email}: ${error?.message ?? 'no reset link returned'} (an address without an account ends up here)`)
  } else {
    console.info(`[forgot-password] reset email sent to ${email}`)
  }
  return NextResponse.json({ ok: true })
}
