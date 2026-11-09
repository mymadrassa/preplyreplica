-- In a student and teacher's shared Mushaf, only the teacher's marks and
-- drawings are saved: the student follows along, and keeps their own marks in
-- their personal Mushaf (where the teacher's marks are shown too). A
-- personal Mushaf is written by its owner only.

drop policy if exists mushaf_annotations_insert on public.mushaf_annotations;
create policy mushaf_annotations_insert on public.mushaf_annotations
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.mushaf_sessions s
      where s.id = session_id
        and (s.teacher_id = auth.uid() or (s.teacher_id is null and s.student_id = auth.uid()))
        and (
          booking_id is null
          or exists (select 1 from public.bookings b where b.id = booking_id and b.student_id = s.student_id and b.teacher_id = s.teacher_id)
        )
    )
  );

drop policy if exists mushaf_strokes_insert on public.mushaf_strokes;
create policy mushaf_strokes_insert on public.mushaf_strokes
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.mushaf_sessions s
      where s.id = session_id
        and (s.teacher_id = auth.uid() or (s.teacher_id is null and s.student_id = auth.uid()))
        and (
          booking_id is null
          or exists (select 1 from public.bookings b where b.id = booking_id and b.student_id = s.student_id and b.teacher_id = s.teacher_id)
        )
    )
  );
