alter table public.bookings add column if not exists is_trial boolean not null default false;

-- Defense in depth against a race between two concurrent trial requests for
-- the same (student, teacher) pair — enforced continuously by Postgres, so a
-- row that later moves to 'cancelled'/'rejected' drops out of the index and
-- frees the slot, matching the app-level eligibility check in
-- /api/bookings (no non-cancelled/rejected booking of any kind with that
-- teacher yet).
create unique index if not exists bookings_one_active_trial_per_teacher
  on public.bookings (student_id, teacher_id)
  where is_trial = true and status not in ('cancelled', 'rejected');
