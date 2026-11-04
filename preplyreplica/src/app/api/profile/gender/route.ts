import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const schema = z.object({ gender: z.enum(['male', 'female']) })

/** Sets the signed-in user's gender, once. Changing it afterwards is for our team only (database guard). */
export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose male or female.' }, { status: 400 })
  }

  const { data, error } = await supabase.from('profiles').update({ gender: parsed.data.gender }).eq('id', userId).is('gender', null).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Your gender is already set. Contact us to change it.' }, { status: 409 })
  return NextResponse.json({ gender: parsed.data.gender })
}
