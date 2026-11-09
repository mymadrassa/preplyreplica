-- After each lesson both sides say how it went: "everything went well" (with
-- ratings per criterion), or a problem report (absence, platform technical
-- problem, lesson cut short, other). A report holds that lesson's payout
-- until an admin resolves it. Lessons nobody reports within 48 hours of the
-- end become payable, and teachers are paid once a month, on the 1st, for
-- everything that became payable before then (one payout per teacher).

-- 1. Feedback: the outcome, ratings per criterion, and the report itself.
alter table public.session_feedback
  add column if not exists outcome text not null default 'ok' check (outcome in ('ok', 'reported')),
  add column if not exists criteria jsonb not null default '{}'::jsonb,
  add column if not exists report_reason text check (report_reason in ('no_show', 'technical', 'cut_short', 'other')),
  add column if not exists report_detail text check (char_length(report_detail) <= 2000);

-- Given feedback: a report; or a student's rating and visibility; or a teacher's ratings or tags.
alter table public.session_feedback drop constraint if exists session_feedback_check;
alter table public.session_feedback add constraint session_feedback_check check (
  status = 'skipped'
  or (outcome = 'reported' and report_reason is not null)
  or (author_role = 'student' and rating is not null and visibility is not null)
  or (author_role = 'teacher' and (cardinality(tags) > 0 or criteria <> '{}'::jsonb))
);

-- 2. Reports: one case per reporter per lesson, until an admin resolves it.
create table if not exists public.lesson_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  reporter_role text not null check (reporter_role in ('student', 'teacher')),
  reason text not null check (reason in ('no_show', 'technical', 'cut_short', 'other')),
  detail text not null check (char_length(detail) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text check (resolution in ('pay_teacher', 'refund_student', 'refund_partial')),
  refund_amount int check (refund_amount >= 0),
  admin_note text check (char_length(admin_note) <= 4000),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, reported_by)
);

create index if not exists lesson_reports_open_idx on public.lesson_reports (created_at) where status = 'open';

alter table public.lesson_reports enable row level security;

-- Readable by the lesson's student and teacher, and admins; written by the server only.
drop policy if exists lesson_reports_read on public.lesson_reports;
create policy lesson_reports_read on public.lesson_reports
  for select
  using (
    public.is_admin()
    or exists (select 1 from public.bookings b where b.id = booking_id and (b.student_id = auth.uid() or b.teacher_id = auth.uid()))
  );

-- 3. Monthly payouts: one per teacher per month.
create table if not exists public.teacher_payouts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(id) on delete restrict,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  amount int not null check (amount >= 0),
  lessons_count int not null check (lessons_count >= 0),
  provider text not null default 'stripe',
  provider_payout_id text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  failure_reason text,
  attempts int not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (teacher_id, period)
);

alter table public.teacher_payouts enable row level security;

drop policy if exists teacher_payouts_read on public.teacher_payouts;
create policy teacher_payouts_read on public.teacher_payouts
  for select
  using (teacher_id = auth.uid() or public.is_admin());

-- 4. Each lesson's payout: what the teacher is owed, from when, and in which payout.
alter table public.bookings
  add column if not exists payout_state text not null default 'none' check (payout_state in ('none', 'held', 'scheduled', 'paid', 'refunded')),
  add column if not exists payout_amount int check (payout_amount >= 0),
  add column if not exists payout_eligible_at timestamptz,
  add column if not exists payout_batch_id uuid references public.teacher_payouts(id) on delete set null;

create index if not exists bookings_payout_scheduled_idx on public.bookings (teacher_id, payout_eligible_at) where payout_state = 'scheduled';

-- Lessons already paid out one by one under the old flow (admin confirmation).
update public.bookings set payout_state = 'paid'
where payout_state = 'none' and status = 'completed' and admin_confirmed_at is not null;
