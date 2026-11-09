-- Trial lessons are paid on their own, 48 hours after they end, rather than
-- in the monthly payout (now on the 3rd, for all lessons of the month
-- before). A trial's payout is a teacher_payouts row tied to its lesson; a
-- teacher still gets at most one monthly payout per month.

alter table public.teacher_payouts
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

alter table public.teacher_payouts drop constraint if exists teacher_payouts_teacher_id_period_key;
create unique index if not exists teacher_payouts_monthly_key on public.teacher_payouts (teacher_id, period) where booking_id is null;
create unique index if not exists teacher_payouts_trial_key on public.teacher_payouts (booking_id) where booking_id is not null;
