// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/api/teacher/onboard/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { createTeacherConnectAccount, createTeacherConnectAccountLink } from '@/lib/stripe'
import { normalizeVideoUrl } from '@/lib/videoUrl'

// A video_url is either one of our own uploads (the client already turned
// it into a public teacher-videos storage URL) or a link normalizeVideoUrl
// recognizes (YouTube/Vimeo/Drive, already rewritten to its embeddable
// form) -- re-checked here too since the client-side check alone could be
// bypassed by calling this route directly, and this value ends up embedded
// in an <iframe> on a public profile page.
function isAllowedVideoUrl(url: string): boolean {
  return url.includes('/storage/v1/object/public/teacher-videos/') || normalizeVideoUrl(url) !== null
}

const onboardSchema = z.object({
  headline: z.string().min(10).max(100),
  bio: z.string().min(20).max(1000),
  languages: z.string().array().min(1),
  subjects: z.string().array().min(1),
  hourly_rate: z.coerce.number().min(8),
  video_url: z
    .union([z.string().url(), z.literal('')])
    .optional()
    .refine((url) => !url || isAllowedVideoUrl(url), { message: 'Video URL must be a YouTube, Vimeo, or Google Drive link, or an uploaded video.' }),
  document_paths: z.string().array().optional(),
  // Profile saving and starting/continuing Stripe Connect are separate
  // actions in the edit-profile form ("Save changes" vs "Continue Stripe
  // onboarding") -- the wizard's first-ever save is the one case that still
  // wants both at once, and passes this explicitly.
  start_stripe_onboarding: z.boolean().optional().default(false),
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

  const { headline, bio, languages, subjects, hourly_rate, video_url, document_paths, start_stripe_onboarding } = parseResult.data

  const { data: existing } = await supabase.from('teacher_profiles').select('*').eq('id', userId).single()

  // Only create/continue the Stripe flow when explicitly requested and not
  // already complete — otherwise editing your profile after approval would
  // bounce you into "reconnect your bank account" every single time, and a
  // plain "Save changes" would start Stripe onboarding nobody asked for.
  let stripeAccountId = existing?.stripe_account_id || null
  let onboardingUrl: string | null = null
  if (start_stripe_onboarding && !existing?.stripe_charges_enabled) {
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
    user_id: userId,
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
