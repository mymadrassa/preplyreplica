-- `teacher_profiles`, `bookings`, and `payments` already existed in this
-- database (from an earlier, differently-shaped scaffold: teacher_profiles
-- keyed off a separate `user_id` -> `users.id`, no `subjects` column,
-- `rating`/`total_reviews` instead of `rating_avg`/`rating_count`; bookings
-- keyed off `subject_id`/`duration_hours`/`scheduled_at` instead of free-text
-- subject/language/duration/start_at/end_at) before 0001_init.sql ran. Since
-- that migration used `create table if not exists`, it silently skipped
-- these three tables rather than giving them the intended columns. All three
-- are empty, so this is purely additive/renaming — no data at risk. The
-- legacy `users`/`subjects`/`teacher_subjects`/`availabilities` tables are
-- left untouched (users and subjects hold real rows) since nothing in the
-- app reads them.

alter table public.teacher_profiles
  add column if not exists subjects text[] not null default '{}';

alter table public.teacher_profiles
  rename column rating to rating_avg;

alter table public.teacher_profiles
  rename column total_reviews to rating_count;

alter table public.bookings
  add column if not exists subject text not null,
  add column if not exists language text not null,
  add column if not exists duration int not null,
  add column if not exists start_at timestamptz not null,
  add column if not exists end_at timestamptz not null;

alter table public.bookings
  alter column subject_id drop not null,
  alter column duration_hours drop not null,
  alter column scheduled_at drop not null;

alter table public.payments
  add column if not exists stripe_checkout_session_id text;
