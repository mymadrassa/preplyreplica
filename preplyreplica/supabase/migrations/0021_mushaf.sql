-- Shared Mushaf session per student/teacher pair (current page the teacher
-- is on) plus the annotations either side adds to it. Backs the
-- @preply-clone/mushaf package; synced over Supabase Realtime.

create table if not exists public.mushaf_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  current_page int not null default 1,
  updated_at timestamptz not null default now(),
  unique (student_id, teacher_id)
);

create table if not exists public.mushaf_annotations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mushaf_sessions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('highlight', 'error', 'note')),
  color text check (color in ('yellow', 'green', 'blue', 'pink')),
  error_type text check (error_type in ('memorisation', 'tajwid', 'hesitation')),
  word_ref text,
  verse_ref text not null,
  note_text text check (note_text is null or char_length(note_text) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists mushaf_annotations_session_id_idx
  on public.mushaf_annotations (session_id);

alter table public.mushaf_sessions enable row level security;
create policy mushaf_sessions_participants on public.mushaf_sessions
  for all
  using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin());

alter table public.mushaf_annotations enable row level security;
create policy mushaf_annotations_select on public.mushaf_annotations
  for select
  using (
    exists (
      select 1 from public.mushaf_sessions s
      where s.id = session_id and (s.student_id = auth.uid() or s.teacher_id = auth.uid())
    ) or public.is_admin()
  );
create policy mushaf_annotations_insert on public.mushaf_annotations
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.mushaf_sessions s
      where s.id = session_id and (s.student_id = auth.uid() or s.teacher_id = auth.uid())
    )
  );
-- This policy, not UI hiding, is what stops a student erasing the teacher's marks.
create policy mushaf_annotations_delete on public.mushaf_annotations
  for delete
  using (author_id = auth.uid() or public.is_admin());

-- Required for postgres_changes subscriptions to receive anything.
alter publication supabase_realtime add table public.mushaf_sessions;
alter publication supabase_realtime add table public.mushaf_annotations;
