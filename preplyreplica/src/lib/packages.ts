import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { paymentRefFor } from '@/lib/payments'
import { sendPackageRefundedEmail } from '@/lib/email'
import { toPounds } from '@/lib/pricing'
import type { Database } from '@/types/database'

type PackageRow = Database['public']['Tables']['lesson_packages']['Row']

/** Lessons not yet booked; a booked lesson counts as used (it's given back if declined or cancelled). */
export function lessonsLeft(pkg: Pick<PackageRow, 'lessons_total' | 'lessons_used'>): number {
  return Math.max(0, pkg.lessons_total - pkg.lessons_used)
}

/**
 * Ends a package and refunds its unused lessons at the discounted per-lesson
 * price, on the account that took the payment. Used when the student
 * cancels it and when it expires.
 */
export async function closePackageWithRefund(pkg: PackageRow, reason: 'cancelled' | 'expired'): Promise<{ refunded: number } | { error: string }> {
  const supabase = createSupabaseServiceRoleClient()
  const unused = lessonsLeft(pkg)
  const amount = unused * pkg.refund_per_lesson

  if (amount > 0) {
    const { data: teacher } = await supabase.from('teacher_profiles').select('payout_account_id').eq('id', pkg.teacher_id).single()
    const charge = paymentRefFor(pkg, teacher)
    if (!charge) return { error: 'The package payment can’t be found.' }
    try {
      await charge.provider.refundPayment(charge.ref, { amount })
    } catch (error) {
      return { error: (error as Error)?.message || 'Refund failed' }
    }
  }

  // Unused lessons are marked used so nothing more can be booked with it.
  await supabase
    .from('lesson_packages')
    .update({ status: reason, refunded_amount: pkg.refunded_amount + amount, lessons_used: pkg.lessons_total })
    .eq('id', pkg.id)

  if (amount > 0) {
    const [{ data: student }, { data: teacher }] = await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', pkg.student_id).single(),
      supabase.from('profiles').select('full_name').eq('id', pkg.teacher_id).single(),
    ])
    if (student?.email) {
      await sendPackageRefundedEmail({
        to: student.email,
        studentName: student.full_name || 'there',
        teacherName: teacher?.full_name || 'your teacher',
        lessons: unused,
        amount: toPounds(amount),
        reason,
      })
    }
  }
  return { refunded: amount }
}

/** Gives a booked lesson back to its package (declined, cancelled or never answered). */
export async function returnPackageLesson(packageId: string) {
  await createSupabaseServiceRoleClient().rpc('use_package_lesson', { package: packageId, delta: -1 })
}
