import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { sendHomeworkEmail } from '@/lib/email'
import { homeworkParts, rangeFromRow, type SurahMeta } from '@/lib/homework'
import { getSurahs } from '@/lib/surahs'
import { appUrl } from '@/lib/appUrl'

// Sends a lesson's cahier de texte entry to the student: WhatsApp first (Meta
// Cloud API, approved template), email when the student has no phone, when
// WhatsApp isn't configured, when the API refuses the message, or -- reported
// later by the webhook -- when the number isn't on WhatsApp. Runs with the
// server key: it reads the student's private phone/email and writes delivery fields.

const GRAPH = 'https://graph.facebook.com/v21.0'

export function whatsappConfigured() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME)
}

interface Recipient {
  studentName: string
  studentEmail: string | null
  studentPhone: string | null
  teacherName: string
  lessonDate: string
  parts: ReturnType<typeof homeworkParts>
}

async function loadRecipient(homeworkId: string): Promise<{ recipient: Recipient; row: Record<string, unknown> } | null> {
  const admin = createSupabaseServiceRoleClient()
  const { data } = await admin
    .from('lesson_homework')
    .select('*, bookings(start_at), student:profiles!lesson_homework_student_id_fkey(full_name, email, phone), teacher_profiles(profiles(full_name))')
    .eq('id', homeworkId)
    .single()
  if (!data) return null

  const row = data as Record<string, any>
  const surahs: SurahMeta[] = await getSurahs()
  return {
    row,
    recipient: {
      studentName: row.student?.full_name || 'there',
      studentEmail: row.student?.email ?? null,
      studentPhone: row.student?.phone ?? null,
      teacherName: row.teacher_profiles?.profiles?.full_name || 'your teacher',
      lessonDate: row.bookings?.start_at ? new Date(row.bookings.start_at).toLocaleDateString('en-GB', { dateStyle: 'long' }) : 'your last lesson',
      parts: homeworkParts({ revision: rangeFromRow(row, 'revision'), memorization: rangeFromRow(row, 'memorization'), note: row.note ?? null }, surahs),
    },
  }
}

async function sendEmailCopy(homeworkId: string, recipient: Recipient, updated: boolean, reason: string | null) {
  const admin = createSupabaseServiceRoleClient()
  if (!recipient.studentEmail) {
    await admin.from('lesson_homework').update({ delivery_status: 'failed', last_error: reason ?? 'The student has no email address.' }).eq('id', homeworkId)
    return { channel: null, error: 'The student has no email address.' }
  }
  await sendHomeworkEmail({
    to: recipient.studentEmail,
    studentName: recipient.studentName,
    teacherName: recipient.teacherName,
    lessonDate: recipient.lessonDate,
    revision: recipient.parts.revision,
    memorization: recipient.parts.memorization,
    note: recipient.parts.note,
    homeworkUrl: appUrl('/student/homework'),
    updated,
  })
  await admin
    .from('lesson_homework')
    .update({ sent_channel: 'email', delivery_status: 'sent', last_error: reason, sent_at: new Date().toISOString(), whatsapp_message_id: null })
    .eq('id', homeworkId)
  return { channel: 'email' as const, error: null }
}

/** WhatsApp template parameters can't contain new lines, tabs or more than four spaces in a row. */
function templateText(value: string) {
  return value.replace(/[\n\t]+/g, ' ').replace(/ {4,}/g, '   ').slice(0, 900) || '—'
}

async function sendWhatsApp(homeworkId: string, recipient: Recipient) {
  const response = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipient.studentPhone!.replace('+', ''),
      type: 'template',
      template: {
        name: process.env.WHATSAPP_TEMPLATE_NAME,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              recipient.studentName,
              recipient.teacherName,
              recipient.lessonDate,
              recipient.parts.revision,
              recipient.parts.memorization,
              recipient.parts.note,
            ].map((text) => ({ type: 'text', text: templateText(text) })),
          },
        ],
      },
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result?.messages?.[0]?.id) {
    return { ok: false as const, error: result?.error?.message || `WhatsApp refused the message (${response.status}).` }
  }

  await createSupabaseServiceRoleClient()
    .from('lesson_homework')
    .update({ sent_channel: 'whatsapp', whatsapp_message_id: result.messages[0].id, delivery_status: 'sent', last_error: null, sent_at: new Date().toISOString() })
    .eq('id', homeworkId)
  return { ok: true as const }
}

/** Sends (or re-sends) one entry. Returns which channel it went out on. */
export async function notifyHomework(homeworkId: string, { updated = false } = {}) {
  const loaded = await loadRecipient(homeworkId)
  if (!loaded) return { channel: null, error: 'Homework not found.' }
  const { recipient } = loaded

  if (whatsappConfigured() && recipient.studentPhone) {
    const sent = await sendWhatsApp(homeworkId, recipient)
    if (sent.ok) return { channel: 'whatsapp' as const, error: null }
    return sendEmailCopy(homeworkId, recipient, updated, `WhatsApp: ${sent.error}`)
  }

  const reason = !recipient.studentPhone ? 'The student has no phone number yet.' : null
  return sendEmailCopy(homeworkId, recipient, updated, reason)
}

/**
 * Called by the WhatsApp webhook when Meta reports a message failed (e.g. the
 * number isn't on WhatsApp): sends the email copy once.
 */
export async function fallBackToEmail(homeworkId: string, reason: string) {
  const loaded = await loadRecipient(homeworkId)
  if (!loaded) return
  return sendEmailCopy(homeworkId, loaded.recipient, false, `WhatsApp: ${reason}`)
}
