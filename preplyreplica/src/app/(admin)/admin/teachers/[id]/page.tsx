import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, FileText, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/Avatar'
import { StatusBadge } from '@/components/StatusBadge'
import { AdminTierSelect } from '@/components/AdminTierSelect'
import { AdminDocumentActions } from '@/components/admin/AdminDocumentActions'
import { AdminTeacherDecision } from '@/components/admin/AdminTeacherDecision'
import { AdminPendingChanges } from '@/components/admin/AdminPendingChanges'
import { loadTeacherProfileState } from '@/lib/teacherProfileState'
import { submittedChangeFields } from '@/lib/adminTeacherReview'
import { scanUncheckedDocuments, type ScanStatus } from '@/lib/documentScan'
import { automaticReviewMessage } from '@/lib/reviewMessage'
import { isTier } from '@/lib/pricing'
import { GENDERS } from '@/lib/gender'
import { IntroVideo } from '@/components/IntroVideo'
import { watchUrlFor } from '@/lib/videoUrl'
import { ChatThread } from '@/components/chat/ChatThread'
import { getOrCreateSupportThread, markSupportThreadRead } from '@/lib/support'

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'
}

/** The admin's full view of one teacher: profile, documents (with safety checks) and the approval decision. */
export default async function AdminTeacherPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user?.id) redirect('/auth/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (me?.role !== 'admin') notFound()

  const [state, { data: profile }, { data: documents }] = await Promise.all([
    loadTeacherProfileState(supabase, params.id),
    supabase.from('profiles').select('full_name, email, phone, gender, avatar_url, created_at').eq('id', params.id).maybeSingle(),
    supabase
      .from('teacher_documents')
      .select('id, bucket_path, kind, review_change, uploaded_at, scan_status, scan_detail')
      .eq('teacher_id', params.id)
      .order('uploaded_at', { ascending: true }),
  ])
  if (!state || !profile) notFound()
  const { teacher, readiness } = state

  // Files uploaded before checks existed are checked now, so a suspicious one is flagged straight away.
  const docs = documents ?? []
  const scanned = await scanUncheckedDocuments(docs)
  const statusOf = (d: (typeof docs)[number]): ScanStatus => scanned.get(d.id)?.status ?? d.scan_status
  const detailOf = (d: (typeof docs)[number]) => scanned.get(d.id)?.detail ?? d.scan_detail
  const suspicious = docs.filter((d) => statusOf(d) === 'suspicious')

  const name = profile.full_name || profile.email || 'Teacher'
  // Opening the page counts as reading the teacher's replies.
  const thread = await getOrCreateSupportThread(params.id)
  if (thread) await markSupportThreadRead(thread.id, 'admin')
  const tier = isTier(teacher.tier) ? teacher.tier : 'starter'
  const changes = submittedChangeFields(teacher, profile.avatar_url, state.changes, docs)
  const blockers = [
    ...(teacher.status === 'draft' ? ['The teacher hasn’t submitted their profile yet.'] : []),
    ...readiness.missing.map((m) => m.title),
    ...(suspicious.length ? [`${suspicious.length} document${suspicious.length === 1 ? '' : 's'} failed the safety check.`] : []),
  ]

  const rows: [string, React.ReactNode][] = [
    ['Headline', teacher.headline || '—'],
    ['Bio', <span key="bio" className="whitespace-pre-line">{teacher.bio || '—'}</span>],
    ['Subjects', teacher.subjects?.join(', ') || '—'],
    ['Languages', teacher.languages?.join(', ') || '—'],
    ['Hourly rate', `£${teacher.hourly_rate}`],
    ['Gender', GENDERS.find((g) => g.value === profile.gender)?.label ?? 'Not set'],
    ['WhatsApp', profile.phone || 'Not set'],
    ['Payouts', teacher.payments_enabled ? 'Set up' : 'Not completed yet'],
    ['Intro video', teacher.video_url ? 'Shown below' : 'None'],
  ]
  const watch = teacher.video_url ? watchUrlFor(teacher.video_url) : null

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10">
      <Link href="/admin/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All teachers
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={name} avatarUrl={profile.avatar_url} size="md" className="h-16 w-16 text-xl" />
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{name}</h1>
            <p className="text-sm text-slate-500">
              {profile.email} · joined {formatDate(profile.created_at)}
              {teacher.reviewed_at ? ` · last decision ${formatDate(teacher.reviewed_at)}` : ''}
            </p>
          </div>
        </div>
        <StatusBadge status={teacher.status} />
      </div>

      {suspicious.length ? (
        <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-900">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold">
              {suspicious.length === 1 ? 'A document' : `${suspicious.length} documents`} failed the safety check
            </p>
            <p>
              {suspicious.length === 1 ? 'It is' : 'They are'} not a real PDF or image and could be harmful. Don&apos;t open {suspicious.length === 1 ? 'it' : 'them'} on your
              computer: ask the teacher to upload it again (Reject with a message below). Approval is blocked until then.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
            <dl className="mt-4 divide-y divide-slate-100">
              {rows.map(([label, value]) => (
                <div key={label} className="grid gap-1 py-3 text-sm sm:grid-cols-[8rem_1fr]">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
            {teacher.video_url ? (
              <div className="mt-4 space-y-2">
                <IntroVideo url={teacher.video_url} className="aspect-video h-auto w-full" />
                {/* The embed link itself only plays inside a page, so open the host's normal page instead. */}
                <a href={watch?.url ?? teacher.video_url} target="_blank" rel="noopener" className="inline-flex text-sm font-medium text-brand-700 hover:text-brand-800">
                  {watch ? `Open on ${watch.host}` : 'Open the video file'}
                </a>
              </div>
            ) : null}
            {teacher.status === 'approved' ? (
              <div className="mt-4 max-w-xs">
                <AdminTierSelect teacherId={teacher.id} tier={tier} locked={teacher.tier_locked} />
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
            {docs.length ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {docs.map((doc) => {
                  const scan = statusOf(doc)
                  return (
                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                            {doc.kind === 'certificate' ? 'Teaching certificate' : 'ID document'}
                            {doc.review_change === 'add' ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">New · to review</span>
                            ) : doc.review_change === 'remove' ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Removed if approved</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-slate-500">Uploaded {formatDate(doc.uploaded_at)}</p>
                          {scan === 'clean' ? (
                            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Safety check passed
                            </p>
                          ) : scan === 'suspicious' ? (
                            <p className="mt-1 flex items-start gap-1 text-xs font-medium text-red-700">
                              <ShieldAlert className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" /> {detailOf(doc) ?? 'Failed the safety check.'}
                            </p>
                          ) : (
                            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <ShieldQuestion className="h-3.5 w-3.5" aria-hidden="true" /> Couldn’t be checked right now; it will be checked again
                            </p>
                          )}
                        </div>
                      </div>
                      <AdminDocumentActions documentId={doc.id} suspicious={scan === 'suspicious'} />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No documents uploaded.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <AdminTeacherDecision
            teacherId={teacher.id}
            status={teacher.status}
            blockers={blockers}
            automaticMessage={automaticReviewMessage(readiness.missing, suspicious.length)}
            lastNote={teacher.review_note}
          />
          {changes?.length ? <AdminPendingChanges teacherId={teacher.id} changes={changes} /> : null}
          {thread ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
              <p className="text-sm text-slate-500">The teacher sees this conversation as “Admin” in their Messages. Decision messages are posted here automatically.</p>
              <ChatThread target={{ kind: 'support', id: thread.id, threadUserId: teacher.id, viewer: 'admin' }} currentUserId={session.user.id} otherPartyName={name} />
            </section>
          ) : null}
        </div>
      </div>
    </main>
  )
}
