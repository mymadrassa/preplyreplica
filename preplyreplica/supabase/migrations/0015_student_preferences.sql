-- Persists the answers collected by the guest-mode student onboarding
-- wizard once an account actually exists. One row per student profile;
-- overwritten (not appended) if they ever redo onboarding, since this is a
-- "current preferences" snapshot, not a history table.

create table if not exists public.student_preferences (
  id uuid primary key references public.profiles(id) on delete cascade,
  courses text[] not null default '{}',
  immediate_availability text not null check (immediate_availability in ('now', 'this_week', 'flexible')),
  weekly_slots jsonb not null default '[]',
  -- weekly_slots shape: [{ "weekday": 0-6, "start_time": "HH:MM", "end_time": "HH:MM" }, ...]
  -- Stored as jsonb (not a child table) because this is a stated student-side
  -- preference feeding the recommendation scorer, not a real schedule needing
  -- per-row FK/RLS/indexing like availability_slots does.
  lessons_per_week int not null check (lessons_per_week in (1, 2, 3)),
  monthly_package_size int not null check (monthly_package_size in (4, 8, 12)),
  selected_teacher_id uuid references public.teacher_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_preferences enable row level security;

create policy student_preferences_owner on public.student_preferences
  for all
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
