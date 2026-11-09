import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { lessonPayoutAmount, payoutEligibleAt } from '@/lib/payouts'

// The server side of monthly payouts (see ./payouts.ts for the rules): what
// a lesson earns, and moving ended lessons along to "payable".

type Db = ReturnType<typeof createSupabaseServiceRoleClient>

/** What the teacher earns for this lesson, from its payment or its package. */
export async function loadPayoutAmount(db: Db, booking: { id: string; package_id: string | null }): Promise<number | null> {
  if (booking.package_id) {
    const { data: pkg } = await db.from('lesson_packages').select('teacher_fee_per_lesson').eq('id', booking.package_id).maybeSingle()
    return lessonPayoutAmount({ payment: null, pkg })
  }
  const { data: payment } = await db.from('payments').select('teacher_fee').eq('booking_id', booking.id).eq('status', 'succeeded').maybeSingle()
  return lessonPayoutAmount({ payment, pkg: null })
}

/**
 * Ended lessons count as given: they're marked completed with the amount
 * the teacher earns and the time it becomes payable (48 hours after the
 * end). Then lessons past that time with no report become payable: a trial
 * at the next daily run, the others with the monthly payout on the 3rd. A
 * reported lesson stays held until an admin resolves it.
 */
export async function settleEndedLessons(now: Date = new Date()): Promise<{ completed: number; scheduled: number }> {
  const db = createSupabaseServiceRoleClient()

  const { data: ended } = await db.from('bookings').select('id, package_id, end_at').eq('status', 'confirmed').lte('end_at', now.toISOString())
  for (const booking of ended ?? []) {
    await db
      .from('bookings')
      .update({ status: 'completed', payout_amount: await loadPayoutAmount(db, booking), payout_eligible_at: payoutEligibleAt(booking.end_at) })
      .eq('id', booking.id)
      .eq('status', 'confirmed')
  }

  const { data: due } = await db
    .from('bookings')
    .update({ payout_state: 'scheduled' })
    .eq('status', 'completed')
    .eq('payout_state', 'none')
    .lte('payout_eligible_at', now.toISOString())
    .not('payout_amount', 'is', null)
    .select('id')

  return { completed: ended?.length ?? 0, scheduled: due?.length ?? 0 }
}

/** Admins' emails, and one admin's id to sign automatic messages in users' Admin threads. */
export async function loadAdmins(): Promise<{ emails: string[]; senderId: string | null }> {
  const { data: admins } = await createSupabaseServiceRoleClient().from('profiles').select('id, email').eq('role', 'admin').order('created_at', { ascending: true })
  return {
    emails: (admins ?? []).map((admin) => admin.email).filter((email): email is string => Boolean(email)),
    senderId: admins?.[0]?.id ?? null,
  }
}
