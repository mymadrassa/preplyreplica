-- Minimal impression/selection log for the onboarding wizard's teacher
-- recommendation step, kept deliberately narrow (no analytics platform, no
-- event schema registry) -- just enough rows to eventually train a ranking
-- model. Insert-only; nothing in the app reads this back today.

create table if not exists public.recommendation_events (
  id bigint generated always as identity primary key,
  -- Nullable: the student may not have an account yet when impressions are
  -- logged (the wizard's teacher-browse step runs in guest mode, before
  -- account creation) -- see src/lib/recommendation.ts.
  student_id uuid references public.profiles(id) on delete set null,
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'selection')),
  score numeric(6,3),
  rank int,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_events_student_idx on public.recommendation_events (student_id);

alter table public.recommendation_events enable row level security;

-- Insert-only, from guest or authenticated callers; no select/update/delete
-- policy is defined, so only the service-role key (used by the server-side
-- logging route, or a future training job) can read rows back.
create policy recommendation_events_insert on public.recommendation_events
  for insert
  with check (student_id = auth.uid() or student_id is null);
