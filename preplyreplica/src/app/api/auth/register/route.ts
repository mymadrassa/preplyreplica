import { NextResponse } from 'next/server'
import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { completeSignup } from '@/lib/auth/completeSignup'
import { normalizePhone, PHONE_HINT } from '@/lib/phone'

const bodySchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`),
  role: z.enum(['student', 'teacher']),
  gender: z.enum(['male', 'female'], { errorMap: () => ({ message: 'Tell us whether you are male or female.' }) }),
  phone: z
    .string()
    .transform((value) => normalizePhone(value))
    .refine((value): value is string => value !== null, { message: PHONE_HINT }),
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
    return NextResponse.json({ error: parseResult.error.issues[0]?.message ?? 'Invalid details.' }, { status: 400 })
  }
  const { email, password, role, phone, gender } = parseResult.data

  const supabase = createServerClient()
  const serviceClient = createSupabaseServiceRoleClient()

  const result = await completeSignup(
    supabase,
    { email, password, role, phone, gender, emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?type=email` },
    serviceClient
  )

  if (!result.ok) {
    await serviceClient.from('error_logs').insert({ context: 'register', message: result.message, detail: result.rawMessage })
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ hasSession: result.hasSession })
}
