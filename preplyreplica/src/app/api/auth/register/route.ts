import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { completeSignup } from '@/lib/auth/completeSignup'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['student', 'teacher']),
})

// This Supabase project requires email confirmation, so signUp() returns no
// session yet -- auth.uid() is null until the link is clicked. The profiles
// write must still succeed immediately, so it goes through the service-role
// client (same fix already applied to the onboarding-wizard completion
// route) rather than the RLS-bound browser client register/page.tsx used to
// call this with directly.
export async function POST(request: Request) {
  const body = await request.json()
  const parseResult = bodySchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }
  const { email, password, role } = parseResult.data

  const supabase = createServerClient()
  const serviceClient = createSupabaseServiceRoleClient()

  const result = await completeSignup(
    supabase,
    { email, password, role, emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    serviceClient
  )

  if (!result.ok) {
    await serviceClient.from('error_logs').insert({ context: 'register', message: result.message, detail: result.rawMessage })
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ hasSession: result.hasSession })
}
