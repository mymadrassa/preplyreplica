// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/api/teacher/onboard/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { createTeacherConnectAccount, createTeacherConnectAccountLink } from '@/lib/stripe'

const onboardSchema = z.object({
  headline: z.string().min(10),
  bio: z.string().min(20),
  languages: z.string().array().min(1),
  subjects: z.string().array().min(1),
  hourly_rate: z.coerce.number().min(10),
  video_url: z.union([z.string().url(), z.literal('')]).optional(),
  document_paths: z.string().array().optional(),
})

export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parseResult = onboardSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }

  const { headline, bio, languages, subjects, hourly_rate, video_url, document_paths } = parseResult.data

  const { data: existing } = await supabase.from('teacher_profiles').select('*').eq('id', userId).single()

  // Only send the teacher through Stripe's setup flow if it isn't already
  // complete — otherwise editing your profile after approval would bounce
  // you into "reconnect your bank account" every single time.
  let stripeAccountId = existing?.stripe_account_id || null
  let onboardingUrl: string | null = null
  if (!existing?.stripe_charges_enabled) {
    try {
      if (!stripeAccountId) {
        const account = await createTeacherConnectAccount(session.data!.session!.user!.email || '')
        stripeAccountId = account.id
      }
      const accountLink = await createTeacherConnectAccountLink(stripeAccountId)
      onboardingUrl = accountLink.url
    } catch (stripeError: any) {
      return NextResponse.json(
        { error: stripeError?.raw?.message || stripeError?.message || 'Unable to set up Stripe payouts for this account.' },
        { status: 502 }
      )
    }
  }

  const { error } = await supabase.from('teacher_profiles').upsert({
    id: userId,
    headline,
    bio,
    languages,
    subjects,
    hourly_rate,
    video_url: video_url || null,
    stripe_account_id: stripeAccountId,
    // Preserve the existing review status when editing — only brand-new
    // profiles start at 'pending'. Editing your bio shouldn't silently
    // un-approve an already-approved teacher.
    status: existing?.status || 'pending',
    updated_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (document_paths?.length) {
    await supabase.from('teacher_documents').insert(
      document_paths.map((bucket_path) => ({ teacher_id: userId, bucket_path }))
    )
  }

  return NextResponse.json({ onboardingUrl })
}
