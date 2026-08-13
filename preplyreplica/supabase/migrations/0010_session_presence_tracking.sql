-- Supports join/leave tracking for the Jitsi session room: the app now
-- listens to the Jitsi IFrame API's own presence events and records real
-- timestamps, instead of relying solely on the teacher's self-reported
-- "mark complete." *_joined_at is set once (first join only, via a
-- conditional update — see /api/bookings/[id]/presence); *_left_at is
-- overwritten on every leave, so it always reflects the most recent one.
-- These are purely informational (surfaced to the admin reviewing a
-- payout, and as a live "waiting for..." indicator during the call) and
-- do not drive any automatic refund/payout decision.
alter table public.bookings
  add column if not exists student_joined_at timestamptz,
  add column if not exists student_left_at timestamptz,
  add column if not exists teacher_joined_at timestamptz,
  add column if not exists teacher_left_at timestamptz;
