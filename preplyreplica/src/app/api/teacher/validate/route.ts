// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/api/teacher/validate/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const validationSchema = z.object({
  teacherId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'suspend']),
})

export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parseResult = validationSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }

  const status = parseResult.data.action === 'approve' ? 'approved' : parseResult.data.action === 'reject' ? 'rejected' : 'suspended'
  const { error } = await supabase.from('teacher_profiles').update({ status }).eq('id', parseResult.data.teacherId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
