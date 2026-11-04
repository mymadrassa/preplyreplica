-- Bookings and payments carry money and lesson state, so only the server
-- writes them: every route checks who's calling and what the change is
-- allowed to be, then writes with the service key. Until now RLS also let a
-- student or teacher write these rows directly from the browser, e.g.
--   - a student setting their own booking to 'confirmed' without paying, or
--     marking a teacher's lesson 'completed';
--   - a student inserting a payment row, or raising its teacher_fee before
--     an admin approves the payout.
-- Reading stays as it was (participants and admins). Admins keep direct
-- write access for support fixes.

drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_modify on public.bookings;
create policy bookings_admin_write on public.bookings
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists payments_insert on public.payments;
drop policy if exists payments_modify on public.payments;
create policy payments_admin_write on public.payments
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 0035's insert guard (unpaid holds only) can't be reached by a non-admin
-- any more; it stays as a second line of defence.
