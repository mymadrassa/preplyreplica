import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { fallBackToEmail } from '@/lib/notifyHomework'

// Meta's WhatsApp Cloud API webhook.
// GET  -- the one-time subscription check when the webhook is configured in Meta.
// POST -- message status updates (sent / delivered / read / failed). A failure
//         such as "not a WhatsApp user" only arrives here, after sending, so
//         this is where the email fallback for those numbers happens.

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(params.get('hub.challenge') ?? '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

function signatureValid(body: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret || !header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  const given = header.slice('sha256='.length)
  return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given))
}

interface StatusUpdate {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  errors?: { code?: number; title?: string; message?: string }[]
}

export async function POST(request: Request) {
  const body = await request.text()
  if (!signatureValid(body, request.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(body)
  const statuses: StatusUpdate[] = (payload.entry ?? []).flatMap((entry: any) =>
    (entry.changes ?? []).flatMap((change: any) => change.value?.statuses ?? [])
  )

  const admin = createSupabaseServiceRoleClient()
  for (const update of statuses) {
    const { data: homework } = await admin
      .from('lesson_homework')
      .select('id, sent_channel, delivery_status')
      .eq('whatsapp_message_id', update.id)
      .maybeSingle()
    // Not ours, or already moved to email.
    if (!homework || homework.sent_channel !== 'whatsapp') continue

    if (update.status === 'failed') {
      const error = update.errors?.[0]
      await fallBackToEmail(homework.id, error?.title || error?.message || `error ${error?.code ?? 'unknown'}`)
      continue
    }

    // Statuses can arrive out of order; never step back (e.g. read -> delivered).
    const rank = { sent: 1, delivered: 2, read: 3, failed: 0 } as const
    if (rank[update.status] > rank[(homework.delivery_status ?? 'sent') as keyof typeof rank]) {
      await admin.from('lesson_homework').update({ delivery_status: update.status }).eq('id', homework.id)
    }
  }

  // Meta retries on anything but 200, so always acknowledge.
  return NextResponse.json({ received: true })
}
