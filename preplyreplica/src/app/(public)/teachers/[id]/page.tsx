// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(public)/teachers/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { canBeMatched } from '@/lib/gender'
import { PackageOffer } from '@/components/PackageOffer'
import { TRIAL, isTier, packagePrice, trialPrice } from '@/lib/pricing'
import { lessonsLeft } from '@/lib/packages'
import { hasHadFirstLesson } from '@/lib/trialRule'
import { BookingForm } from '@/components/BookingForm'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { RatingStars } from '@/components/RatingStars'
import { ChatButton } from '@/components/chat/ChatButton'
import { Avatar } from '@/components/Avatar'
import { IntroVideo } from '@/components/IntroVideo'

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

  // The teacher and the viewer's role don't depend on each other, so they're
  // fetched together in one round trip.
  const [{ data: teacher, error }, viewerProfileResult, changesResult] = await Promise.all([
    supabase
      .from('teacher_profiles')
      .select('*, profiles(*), reviews(*, profiles!student_id(full_name))')
      .eq('id', params.id)
      .order('created_at', { referencedTable: 'reviews', ascending: false })
      .single(),
    isOtherViewer ? supabase.from('profiles').select('role, gender').eq('id', viewerId).single() : null,
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

  const viewer = viewerProfileResult?.data as { role?: string; gender?: string | null } | null | undefined
  const viewerRole = viewer?.role

  // Students only see teachers of their own gender (the teacher's is private, so read with the server key).
  if (viewerRole === 'student') {
    const { data: teacherGender } = await createSupabaseServiceRoleClient().from('profiles').select('gender').eq('id', params.id).maybeSingle()
    if (!canBeMatched(viewer?.gender, teacherGender?.gender)) return notFound()
  }

  // Admin approval and payout setup are independent — a teacher can
  // be approved before finishing payout setup, so both are required
  // before a student can actually get through checkout.
  const canBook = !isOwnProfile && viewerRole !== 'teacher' && viewerRole !== 'admin' && teacher.payments_enabled


  // Trial first; after it, lessons with this teacher come from a package only.
  const packageRequired = canBook && !!viewerId && (await hasHadFirstLesson(supabase, viewerId, teacher.id))
  const tier = isTier(teacher.tier) ? teacher.tier : 'starter'
  const trial = trialPrice()
  const pkgPricing = packagePrice(teacher.hourly_rate, tier)
  // The signed-in student's live package with this teacher, if any.
  const { data: activePackage } =
    canBook && viewerId
      ? await supabase
          .from('lesson_packages')
          .select('id, lessons_total, lessons_used, expires_at')
          .eq('student_id', viewerId)
          .eq('teacher_id', teacher.id)
          .eq('status', 'active')
          .maybeSingle()
      : { data: null }

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
          {shown.video_url ? <IntroVideo url={shown.video_url} /> : null}
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
              <p className="text-sm uppercase tracking-[0.2em] text-brand-700">How it works</p>
              <p className="text-slate-700">
                <strong>1. Trial:</strong> {TRIAL.minutes} minutes for £{trial.studentPays.toFixed(2)}.
                <br />
                <strong>2. Then:</strong> {pkgPricing.lessons} one-hour lessons for £{pkgPricing.price.toFixed(2)} (£{pkgPricing.perLesson.toFixed(2)} a lesson).
              </p>
              <p className="text-slate-600">Pay securely online and join the Jitsi meeting when the lesson starts.</p>
            </div>
          </Card>
          {viewerId && !isOwnProfile && viewerRole === 'student' ? (
            <ChatButton studentId={viewerId} teacherId={teacher.id} teacherName={teacher.profiles?.full_name ?? 'this teacher'} />
          ) : null}
          {packageRequired && !activePackage ? (
            <PackageOffer teacherId={teacher.id} teacherName={teacher.profiles?.full_name ?? 'this teacher'} pricing={pkgPricing} highlight={packageRequired || searchParams.intent === 'package'} />
          ) : null}
          {canBook ? (
            <BookingForm
              teacher={{ id: teacher.id, hourly_rate: teacher.hourly_rate, tier, subjects: teacher.subjects, languages: teacher.languages }}
              packageRequired={packageRequired}
              activePackage={activePackage ? { id: activePackage.id, lessonsLeft: lessonsLeft(activePackage), expiresAt: activePackage.expires_at } : null}
            />
          ) : isOwnProfile ? (
            <Card>
              <p className="text-slate-600">Students book you from this panel. Manage your details from your Profile page.</p>
            </Card>
          ) : viewerRole !== 'teacher' && viewerRole !== 'admin' && !teacher.payments_enabled ? (
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
