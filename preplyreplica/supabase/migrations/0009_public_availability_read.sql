-- availability_slots/exceptions only had an "owner or admin" policy, which
-- was harmless while that data was purely a decorative list on the public
-- teacher profile page (RLS silently returned zero rows for everyone else,
-- and nobody noticed). Now the actual booking flow depends on students
-- being able to see a teacher's real availability, so add a public-read
-- policy scoped the same way teacher_profiles already is — visible once
-- the teacher is approved, in addition to the existing owner/admin access.
drop policy if exists availability_slots_select on public.availability_slots;
create policy availability_slots_select on public.availability_slots
  for select
  using (
    teacher_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.teacher_profiles tp
      where tp.id = availability_slots.teacher_id and tp.status = 'approved'
    )
  );

drop policy if exists availability_exceptions_select on public.availability_exceptions;
create policy availability_exceptions_select on public.availability_exceptions
  for select
  using (
    teacher_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.teacher_profiles tp
      where tp.id = availability_exceptions.teacher_id and tp.status = 'approved'
    )
  );
