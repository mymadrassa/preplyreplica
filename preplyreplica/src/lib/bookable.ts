import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { canBeMatched } from '@/lib/gender'
import { sendNewBookingRequestEmail } from '@/lib/email'

type TeacherRow = Database['public']['Tables']['teacher_profiles']['Row']
export type BookableTeacher = TeacherRow & { payout_account_id: string }

/**
 * Whether a student may pay this teacher (a lesson or a package): approved,
 * same gender, and able to accept payments. Returns the teacher, or the error
 * to send back.
 */
export async function loadBookableTeacher(
  supabase: SupabaseClient<Database>,
  studentId: string,
  teacherId: string
): Promise<{ teacher: BookableTeacher } | { error: string; status: number }> {
  const { data: teacher } = await supabase.from('teacher_profiles').select('*').eq('id', teacherId).single()
  if (!teacher || teacher.status !== 'approved') {
    return { error: 'Teacher is not available for booking', status: 400 }
  }
  // Same-gender teaching only (also enforced by the database on insert).
  const { data: genders } = await createSupabaseServiceRoleClient().from('profiles').select('id, gender').in('id', [studentId, teacherId])
  const genderOf = (id: string) => genders?.find((g) => g.id === id)?.gender
  if (!canBeMatched(genderOf(studentId), genderOf(teacherId))) {
    return { error: 'You can only book teachers of your own gender.', status: 403 }
  }
  // payout_account_id is set as soon as payout setup *starts*; only
  // payments_enabled (synced from the provider's webhook) confirms the
  // account can really accept a charge.
  if (!teacher.payments_enabled || !teacher.payout_account_id) {
    return { error: "This teacher hasn't finished setting up payments yet and can't accept bookings right now.", status: 400 }
  }
  return { teacher: teacher as BookableTeacher }
}

/** Tells the teacher a lesson request is waiting for their answer. */
export async function emailTeacherNewRequest(bookingId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('subject, start_at, teacher_profiles(profiles(email, full_name)), profiles!student_id(full_name, email)')
    .eq('id', bookingId)
    .single()
  const teacherContact = (booking?.teacher_profiles as { profiles: { email: string | null; full_name: string | null } | null } | null)?.profiles
  const student = booking?.profiles as { full_name: string | null; email: string | null } | null
  if (!booking || !teacherContact?.email) return
  await sendNewBookingRequestEmail({
    to: teacherContact.email,
    teacherName: teacherContact.full_name || 'there',
    studentName: student?.full_name || student?.email || 'A student',
    subject: booking.subject,
    startAt: booking.start_at,
    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/teacher/dashboard`,
  })
}
