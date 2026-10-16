-- The bookings_status_check constraint (added manually outside tracked
-- migrations at some point — see 0005's note about this schema's history)
-- was missing 'pending' and 'rejected' entirely, even though every part of
-- the app relies on both: 'pending' is the "awaiting teacher approval"
-- state the whole accept/decline flow depends on reaching, and 'rejected'
-- is what a decline sets. With those excluded, no booking could ever leave
-- 'pending_payment', and a teacher declining one would silently fail too —
-- both confirmed empirically against the live constraint.
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending_payment', 'pending', 'confirmed', 'completed', 'cancelled', 'rejected'));
