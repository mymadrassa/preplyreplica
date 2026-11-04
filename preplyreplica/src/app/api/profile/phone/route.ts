import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/phone'

const schema = z.object({ phone: z.string().max(40), fullName: z.string().max(120).optional() })

/** Saves the signed-in user's phone number (and optionally name), in international format. */
export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const phone = normalizePhone(parsed.data.phone)
  if (!phone) {
    return NextResponse.json({ error: 'Enter a valid phone number with its country code, e.g. +33 6 12 34 56 78.' }, { status: 400 })
  }

  const fullName = parsed.data.fullName?.trim()
  const { error } = await supabase
    .from('profiles')
    .update({ phone, ...(fullName ? { full_name: fullName } : {}) })
    .eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ phone })
}
