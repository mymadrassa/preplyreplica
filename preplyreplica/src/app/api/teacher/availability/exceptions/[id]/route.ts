import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const updateSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  kind: z.enum(['available', 'busy', 'vacation']).optional(),
})

async function loadOwnedException(supabase: ReturnType<typeof createServerClient>, id: string, userId: string) {
  const { data: exception } = await supabase.from('availability_exceptions').select('*').eq('id', id).single()
  if (!exception) return { error: NextResponse.json({ error: 'Exception not found' }, { status: 404 }) }
  if (exception.teacher_id !== userId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { exception }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error: ownershipError } = await loadOwnedException(supabase, params.id, userId)
  if (ownershipError) return ownershipError

  const body = await request.json()
  const parseResult = updateSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }
  if (parseResult.data.start_time && parseResult.data.end_time && parseResult.data.start_time >= parseResult.data.end_time) {
    return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 })
  }

  const { data: exception, error } = await supabase
    .from('availability_exceptions')
    .update(parseResult.data)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ exception })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error: ownershipError } = await loadOwnedException(supabase, params.id, userId)
  if (ownershipError) return ownershipError

  const { error } = await supabase.from('availability_exceptions').delete().eq('id', params.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
