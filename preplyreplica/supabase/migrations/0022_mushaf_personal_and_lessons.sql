-- Personal Mushaf spaces (teacher_id null = a private revision space owned by
-- student_id, which is just "the owner" there -- teachers use it too), a
-- relationship gate on shared sessions, and per-lesson tagging of annotations
-- so each booking has its own viewable history.

alter table public.mushaf_sessions alter column teacher_id drop not null;

create unique index if not exists mushaf_sessions_personal_owner_idx
  on public.mushaf_sessions (student_id) where teacher_id is null;

alter table public.mushaf_annotations
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create index if not exists mushaf_annotations_booking_id_idx
  on public.mushaf_annotations (booking_id);

-- A shared session may only exist between a pair that already has a booking
-- or a conversation; a personal session only for its owner.
drop policy if exists mushaf_sessions_participants on public.mushaf_sessions;

create policy mushaf_sessions_select on public.mushaf_sessions
  for select
  using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin());

create policy mushaf_sessions_insert on public.mushaf_sessions
  for insert
  with check (
    (teacher_id is null and student_id = auth.uid())
    or (
      (student_id = auth.uid() or teacher_id = auth.uid())
      and (
        exists (select 1 from public.bookings b where b.student_id = mushaf_sessions.student_id and b.teacher_id = mushaf_sessions.teacher_id)
        or exists (select 1 from public.conversations c where c.student_id = mushaf_sessions.student_id and c.teacher_id = mushaf_sessions.teacher_id)
      )
    )
  );

create policy mushaf_sessions_update on public.mushaf_sessions
  for update
  using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin());

-- A tagged lesson must be a booking between the session's own pair.
drop policy if exists mushaf_annotations_insert on public.mushaf_annotations;
create policy mushaf_annotations_insert on public.mushaf_annotations
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
