-- Free-hand pen strokes drawn over a Mushaf page. Points are stored
-- normalised to 0..1 of the page's width/height so a stroke lines up on any
-- screen size.

create table if not exists public.mushaf_strokes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mushaf_sessions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  page int not null check (page >= 1),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  width numeric not null default 3 check (width > 0 and width <= 24),
  points jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) between 2 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists mushaf_strokes_session_page_idx
  on public.mushaf_strokes (session_id, page);

alter table public.mushaf_strokes enable row level security;

create policy mushaf_strokes_select on public.mushaf_strokes
  for select
  using (
    exists (
      select 1 from public.mushaf_sessions s
      where s.id = session_id and (s.student_id = auth.uid() or s.teacher_id = auth.uid())
    ) or public.is_admin()
  );

create policy mushaf_strokes_insert on public.mushaf_strokes
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.mushaf_sessions s
      where s.id = session_id
        and (s.student_id = auth.uid() or s.teacher_id = auth.uid())
        and (
          booking_id is null
          or exists (select 1 from public.bookings b where b.id = booking_id and b.student_id = s.student_id and b.teacher_id = s.teacher_id)
        )
    )
  );

-- Same rule as annotations: you can only erase your own strokes.
create policy mushaf_strokes_delete on public.mushaf_strokes
  for delete
  using (author_id = auth.uid() or public.is_admin());

alter publication supabase_realtime add table public.mushaf_strokes;
