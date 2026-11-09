import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { TEACHER_CATALOGUE_TAG } from '@/lib/teacherCatalogue'
import { TIERS, isTier } from '@/lib/pricing'
import { nextTierFor } from '@/lib/tiers'
import { loadTeacherStats } from '@/lib/loadTeacherStats'
import { sendTierPromotionEmail } from '@/lib/email'

/**
 * Daily: promotes teachers who now meet a higher tier's criteria (never
 * demotes; admin-set tiers are left alone). A promotion lowers the commission,
 * so students' prices for that teacher drop.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data: teachers } = await supabase
    .from('teacher_profiles')
    .select('id, tier, tier_locked, approved_at, rating_avg, profiles(full_name, email)')
    .eq('status', 'approved')
    .eq('tier_locked', false)

  const promoted: { teacherId: string; from: string; to: string }[] = []
  for (const teacher of teachers ?? []) {
    const current = isTier(teacher.tier) ? teacher.tier : 'starter'
    const next = nextTierFor(current, await loadTeacherStats(supabase, teacher), teacher.tier_locked)
    if (next === current) continue

    await supabase.from('teacher_profiles').update({ tier: next, tier_updated_at: new Date().toISOString() }).eq('id', teacher.id)
    promoted.push({ teacherId: teacher.id, from: current, to: next })
    const contact = teacher.profiles as { full_name: string | null; email: string | null } | null
    if (contact?.email) {
      await sendTierPromotionEmail({ to: contact.email, teacherName: contact.full_name || 'there', tierLabel: TIERS[next].label, rate: TIERS[next].rate })
    }
  }

  if (promoted.length) revalidateTag(TEACHER_CATALOGUE_TAG)
  return NextResponse.json({ checked: teachers?.length ?? 0, promoted })
}
