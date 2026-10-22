// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(public)/teachers/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { BookingForm } from '@/components/BookingForm'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { RatingStars } from '@/components/RatingStars'
import { ChatButton } from '@/components/chat/ChatButton'
import { Avatar } from '@/components/Avatar'

// A directly uploaded file (public Supabase Storage URL, e.g. .../video.mp4)
// plays via the native <video> element; anything else is assumed to be an
// external embed link (YouTube, Vimeo, ...) and needs an <iframe>.
const VIDEO_FILE_EXTENSION = /\.(mp4|webm|mov|ogg)(\?.*)?$/i
function isDirectVideoFile(url: string) {
  return VIDEO_FILE_EXTENSION.test(url)
}

interface TeacherPageProps {
  params: {
    id: string
  }
  searchParams: {
    intent?: string
    /** `1` lets a teacher preview their own page as students see it, before approval or with pending changes. */
    preview?: string
  }
}

export default async function TeacherDetailsPage({ params, searchParams }: TeacherPageProps) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const viewerId = session.data?.session?.user?.id
  const isOwnProfile = viewerId === params.id
  const isOtherViewer = !!viewerId && !isOwnProfile
  const isPreview = isOwnProfile && searchParams.preview === '1'

  // The teacher, the viewer's role and any existing booking between them don't
  // depend on each other, so they're fetched together in one round trip. The
  // booking lookup is only used below if the viewer turns out to be able to book.
  const [{ data: teacher, error }, viewerProfileResult, existingBookingResult, changesResult] = await Promise.all([
    supabase
      .from('teacher_profiles')
      .select('*, profiles(*), reviews(*, profiles!student_id(full_name))')
      .eq('id', params.id)
      .order('created_at', { referencedTable: 'reviews', ascending: false })
      .single(),
    isOtherViewer ? supabase.from('profiles').select('role').eq('id', viewerId).single() : null,
    isOtherViewer
      ? supabase
          .from('bookings')
          .select('id')
          .eq('student_id', viewerId)
          .eq('teacher_id', params.id)
          .not('status', 'in', '(cancelled,rejected)')
          .limit(1)
          .maybeSingle()
      : null,
    // In preview, show the teacher's edits awaiting review as they'll appear once approved.
    isPreview ? supabase.from('teacher_profile_changes').select('*').eq('teacher_id', params.id).maybeSingle() : null,
  ])

  // Students only ever see approved profiles; a teacher previewing their own page sees it whatever its status.
  if (error || !teacher || (teacher.status !== 'approved' && !isPreview)) {
    return notFound()
  }

  const changes = changesResult?.data ?? null
  const shown = {
    headline: changes?.headline ?? teacher.headline,
    bio: changes?.bio ?? teacher.bio,
    subjects: changes?.subjects ?? teacher.subjects,
    languages: changes?.languages ?? teacher.languages,
    video_url: changes ? changes.video_url : teacher.video_url,
    avatar_url: changes ? changes.avatar_url : teacher.profiles?.avatar_url ?? null,
  }

  const viewerRole = (viewerProfileResult?.data as { role?: string } | null | undefined)?.role

  // Admin approval and Stripe payout setup are independent — a teacher can
  // be approved before finishing Stripe onboarding, so both are required
  // before a student can actually get through checkout.
  const canBook = !isOwnProfile && viewerRole !== 'teacher' && viewerRole !== 'admin' && teacher.stripe_charges_enabled

  // A free trial is only offered for first contact with this teacher — any
  // non-cancelled/rejected booking (trial or normal) already disqualifies
  // them. Re-validated server-side again in /api/bookings before charging.
  const isTrialEligible = canBook && !!viewerId && !existingBookingResult?.data

  return (
    <main className="container mx-auto px-4 py-12">
      {isPreview ? (
        <div className="mb-6 rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <strong>Preview:</strong> this is how students see your profile
          {teacher.status !== 'approved' ? '. It isn’t visible to students yet.' : changes ? ', including your changes awaiting review.' : '.'}
        </div>
      ) : null}
      <div className="grid gap-10 lg:grid-cols-[1.7fr_1fr]">
        <section className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={teacher.profiles?.full_name} avatarUrl={shown.avatar_url} size="md" className="h-16 w-16 text-xl" />
            <h1 className="text-3xl font-semibold text-slate-900">{teacher.profiles?.full_name ?? 'Teacher profile'}</h1>
            {!isPreview ? <StatusBadge status={teacher.status} /> : null}
          </div>
          <p className="text-slate-600">{shown.headline}</p>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <RatingStars value={Number(teacher.rating_avg ?? 0)} />
            <span className="font-semibold text-slate-900">{Number(teacher.rating_avg ?? 0).toFixed(1)}</span>
            <span>
              ({teacher.rating_count ?? 0} {teacher.rating_count === 1 ? 'review' : 'reviews'})
            </span>
          </div>
          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">About</p>
              <p className="mt-2 whitespace-pre-line text-slate-700">{shown.bio}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Subjects</p>
                <p className="mt-2 text-slate-700">{shown.subjects?.join(', ') || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Languages</p>
                <p className="mt-2 text-slate-700">{shown.languages?.join(', ') || 'Not specified'}</p>
              </div>
            </div>
          </div>
          {shown.video_url ? (
            <div className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-950">
              {isDirectVideoFile(shown.video_url) ? (
                <video controls className="h-72 w-full" src={shown.video_url} />
              ) : (
                <iframe
                  className="h-72 w-full"
                  src={shown.video_url}
                  title="Teacher introduction"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          ) : null}
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Reviews</h2>
              {teacher.rating_count ? (
                <span className="flex items-center gap-1.5 text-sm text-slate-600">
                  <RatingStars value={Number(teacher.rating_avg ?? 0)} />
                  {Number(teacher.rating_avg ?? 0).toFixed(1)} · {teacher.rating_count} {teacher.rating_count === 1 ? 'review' : 'reviews'}
                </span>
              ) : null}
            </div>
            {teacher.reviews?.length ? (
              <div className="mt-4 divide-y divide-slate-200">
                {teacher.reviews.map((review: any) => (
                  <div key={review.id} className="py-4 first:pt-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{review.profiles?.full_name ?? 'Student'}</p>
                      <RatingStars value={review.rating} />
                    </div>
                    {review.comment ? <p className="mt-1 text-slate-600">{review.comment}</p> : null}
                    <p className="mt-1 text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-slate-500">No reviews yet — be the first to book and leave feedback.</p>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <Card>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.2em] text-brand-700">Hourly rate</p>
              <p className="text-3xl font-semibold text-slate-900">£{teacher.hourly_rate}</p>
              <p className="text-slate-600">Pay securely with Stripe and join the Jitsi meeting when the lesson starts.</p>
            </div>
          </Card>
          {viewerId && !isOwnProfile && viewerRole === 'student' ? (
            <ChatButton studentId={viewerId} teacherId={teacher.id} teacherName={teacher.profiles?.full_name ?? 'this teacher'} />
          ) : null}
          {canBook ? (
            <BookingForm
              teacher={{ id: teacher.id, hourly_rate: teacher.hourly_rate, subjects: teacher.subjects, languages: teacher.languages }}
              isTrialEligible={isTrialEligible}
              defaultAsTrial={searchParams.intent === 'trial'}
            />
          ) : isOwnProfile ? (
            <Card>
              <p className="text-slate-600">Students book you from this panel. Manage your details from your Profile page.</p>
            </Card>
          ) : viewerRole !== 'teacher' && viewerRole !== 'admin' && !teacher.stripe_charges_enabled ? (
            <Card>
              <p className="text-slate-600">This teacher hasn't finished setting up payments yet and isn't accepting bookings right now. Check back soon.</p>
            </Card>
          ) : (
            <Card>
              <p className="text-slate-600">Only student accounts can book lessons.</p>
            </Card>
          )}
        </aside>
      </div>
    </main>
  )
}
