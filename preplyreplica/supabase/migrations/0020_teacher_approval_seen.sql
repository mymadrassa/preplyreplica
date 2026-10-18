-- /Users/ybdn95/Desktop/preplyreplica/preplyreplica/supabase/migrations/0020_teacher_approval_seen.sql
-- Tracks whether the teacher has been shown the "you're approved" state on
-- their dashboard at least once, so the onboarding/approval timeline can
-- keep showing all-green for that one visit (the moment they're actually
-- notified in-app, alongside the congratulations email) before disappearing
-- on later visits.
alter table public.teacher_profiles add column if not exists approval_seen_at timestamptz;
