import { unstable_cache } from 'next/cache'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const TEACHER_CATALOGUE_TAG = 'teacher-catalogue'

// The public teacher list is identical for every visitor, so it's shared from a
// server cache instead of re-queried on each page view. It's read with the
// service client because the cache has no per-visitor session, so it selects
// only the public fields the catalogue shows (no emails or payout details).
// Anything that changes a listing calls revalidateTag(TEACHER_CATALOGUE_TAG);
// ratings may otherwise lag by up to `revalidate` seconds.
export const getTeacherCatalogue = unstable_cache(
  async () => {
    const supabase = createSupabaseServiceRoleClient()
    const { data } = await supabase
      .from('teacher_profiles')
      .select('id, headline, rating_avg, hourly_rate, subjects, languages, status, profiles(full_name)')
      .eq('status', 'approved')
      // Approval only reflects the admin's review of the profile — a teacher
      // can be approved before finishing Stripe onboarding. Only list ones who
      // can actually be paid, so a student never lands on a "book" flow that
      // fails at the last step.
      .eq('stripe_charges_enabled', true)
      .order('rating_avg', { ascending: false })
    return data ?? []
  },
  [TEACHER_CATALOGUE_TAG],
  { revalidate: 120, tags: [TEACHER_CATALOGUE_TAG] }
)
