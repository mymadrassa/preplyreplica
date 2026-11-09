import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { firstNameSchema, fullNameFrom, lastNameSchema } from '@/lib/names'

const schema = z.object({
  firstName: firstNameSchema.optional(),
  lastName: lastNameSchema.optional(),
  gender: z.enum(['male', 'female']).optional(),
})

/**
 * Fills in what an account created before signup asked for is missing: the
 * name and/or the gender. Gender is set once only (the database guard keeps
 * it from changing afterwards).
 */
export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check your details.' }, { status: 400 })
  }
  const { firstName, lastName, gender } = parsed.data
  if ((firstName && !lastName) || (!firstName && lastName)) {
    return NextResponse.json({ error: 'Enter both your first and last name.' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('gender').eq('id', userId).single()
  const update = {
    ...(firstName && lastName ? { full_name: fullNameFrom(firstName, lastName) } : {}),
    ...(gender && !profile?.gender ? { gender } : {}),
  }
  if (!Object.keys(update).length) return NextResponse.json({ ok: true })

  const { error } = await supabase.from('profiles').update(update).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
