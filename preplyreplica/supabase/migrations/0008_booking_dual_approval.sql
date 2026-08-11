-- Supports the dual-approval booking lifecycle: a booking now needs the
-- teacher to mark a completed session as done AND the admin to sign off
-- before the payout cron will release funds. Two nullable timestamps (set
-- once, independently, by each party) give a clear audit trail without
-- adding another `status` value.
alter table public.bookings
  add column if not exists teacher_confirmed_at timestamptz,
  add column if not exists admin_confirmed_at timestamptz;
