-- /Users/ybdn95/Desktop/preplyreplica/preplyreplica/supabase/migrations/0002_rls.sql
create or replace function public.is_admin() returns boolean stable language sql as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
create policy profiles_owner_or_admin on public.profiles
  for all
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

alter table public.teacher_profiles enable row level security;
create policy teacher_profiles_select on public.teacher_profiles
  for select
  using (status = 'approved' or auth.uid() = id or public.is_admin());
create policy teacher_profiles_modify on public.teacher_profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());
create policy teacher_profiles_insert on public.teacher_profiles
  for insert
  with check (auth.uid() = id or public.is_admin());

alter table public.teacher_documents enable row level security;
create policy teacher_documents_owner on public.teacher_documents
  for all
  using (teacher_id = auth.uid() or public.is_admin())
  with check (teacher_id = auth.uid() or public.is_admin());

alter table public.availability_slots enable row level security;
create policy availability_slots_owner on public.availability_slots
  for all
  using (teacher_id = auth.uid() or public.is_admin())
  with check (teacher_id = auth.uid() or public.is_admin());

alter table public.availability_exceptions enable row level security;
create policy availability_exceptions_owner on public.availability_exceptions
  for all
  using (teacher_id = auth.uid() or public.is_admin())
  with check (teacher_id = auth.uid() or public.is_admin());

alter table public.bookings enable row level security;
create policy bookings_owner on public.bookings
  for select
  using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin());
create policy bookings_insert on public.bookings
  for insert
  with check (student_id = auth.uid() or public.is_admin());
create policy bookings_modify on public.bookings
  for update
  using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin());

alter table public.payments enable row level security;
create policy payments_owner on public.payments
  for select
  using (
    exists(
      select 1 from public.bookings
      where public.bookings.id = booking_id
        and (student_id = auth.uid() or teacher_id = auth.uid())
    ) or public.is_admin()
  );
create policy payments_insert on public.payments
  for insert
  with check (exists(select 1 from public.bookings where public.bookings.id = booking_id and student_id = auth.uid()) or public.is_admin());
create policy payments_modify on public.payments
  for update
  using (
    exists(
      select 1 from public.bookings
      where public.bookings.id = booking_id
        and (student_id = auth.uid() or teacher_id = auth.uid())
    ) or public.is_admin()
  )
  with check ((exists(select 1 from public.bookings where public.bookings.id = booking_id and (student_id = auth.uid() or teacher_id = auth.uid()))) or public.is_admin());

alter table public.reviews enable row level security;
create policy reviews_public_select on public.reviews
  for select
  using (true);
create policy reviews_insert on public.reviews
  for insert
  with check (
    student_id = auth.uid()
    and exists(
      select 1 from public.bookings
      where public.bookings.id = booking_id
        and student_id = auth.uid()
        and status = 'completed'
    )
  );
