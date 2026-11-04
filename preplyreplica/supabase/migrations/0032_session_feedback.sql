-- Post-lesson feedback, both ways: the student about the teacher (stars,
-- comment, public or private) and the teacher about the student (quick tags).
-- One row per lesson per author; a skip is recorded too so the popup stops.
-- Writes go through the server (service role); public student feedback also
-- becomes a row in public.reviews.

create table if not exists public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  author_role text not null check (author_role in ('student', 'teacher')),
  status text not null check (status in ('given', 'skipped')),
  rating int check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  visibility text check (visibility in ('public', 'private')),
  tags text[] not null default '{}',
  recipient_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, author_id),
  -- A student's given feedback has a rating and a visibility; a teacher's has tags.
  check (
    status = 'skipped'
    or (author_role = 'student' and rating is not null and visibility is not null)
    or (author_role = 'teacher' and cardinality(tags) > 0)
  )
);

create index if not exists session_feedback_unseen_idx
  on public.session_feedback (recipient_id)
  where status = 'given' and recipient_seen_at is null;
create index if not exists session_feedback_author_idx on public.session_feedback (author_id);

alter table public.session_feedback enable row level security;

drop policy if exists session_feedback_read on public.session_feedback;
create policy session_feedback_read on public.session_feedback
  for select
  using (author_id = auth.uid() or (recipient_id = auth.uid() and status = 'given') or public.is_admin());
