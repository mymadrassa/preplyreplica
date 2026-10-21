// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/api/teacher/validate/route.ts
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { TEACHER_CATALOGUE_TAG } from '@/lib/teacherCatalogue'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { sendTeacherApprovedEmail } from '@/lib/email'

const validationSchema = z.object({
  teacherId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'suspend', 'reset']),
})

const statusByAction: Record<string, 'approved' | 'rejected' | 'suspended' | 'pending'> = {
  approve: 'approved',
  reject: 'rejected',
  suspend: 'suspended',
  reset: 'pending',
}

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

  const status = statusByAction[parseResult.data.action]

  // Stripe payouts are the one thing that can't be fixed after the fact --
  // an approved teacher with no connected account can't actually get paid
  // once a student books. Approval is blocked until they've finished that
  // setup; every other action (reject/suspend/reset) is unaffected.
  if (status === 'approved') {
    const { data: teacher } = await supabase.from('teacher_profiles').select('stripe_charges_enabled').eq('id', parseResult.data.teacherId).single()
    if (!teacher?.stripe_charges_enabled) {
      return NextResponse.json({ error: "This teacher hasn't finished setting up Stripe payouts yet, so they can't be approved." }, { status: 409 })
    }
  }

  // Reset approval_seen_at whenever status changes away from approved (reject/suspend/reset),
  // and leave it null on a fresh approval too -- it only gets set once the teacher has actually
  // seen the all-green timeline on their dashboard, which is what triggers the congratulations email below.
  const { error } = await supabase
    .from('teacher_profiles')
    .update({ status, approval_seen_at: null })
    .eq('id', parseResult.data.teacherId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateTag(TEACHER_CATALOGUE_TAG)

  if (status === 'approved') {
    const { data: teacher } = await supabase
      .from('teacher_profiles')
      .select('profiles(email, full_name)')
      .eq('id', parseResult.data.teacherId)
      .single()
    const teacherProfile = teacher?.profiles as { email: string | null; full_name: string | null } | null
    if (teacherProfile?.email) {
      await sendTeacherApprovedEmail({
        to: teacherProfile.email,
        teacherName: teacherProfile.full_name || 'there',
        dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/teacher/dashboard`,
      })
    }
  }

  return NextResponse.json({ success: true })
}
