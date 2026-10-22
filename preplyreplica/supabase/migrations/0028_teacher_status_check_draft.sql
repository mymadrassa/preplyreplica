-- The live teacher_profiles table predates 0001_init.sql (see 0005) and carries
-- its own check on `status` that doesn't include 'draft', so 0025's enum change
-- alone wasn't enough. Rebuild the check with every status the app uses.
-- `status::text` works whether the column is text or the teacher_status enum.

alter table public.teacher_profiles drop constraint if exists teacher_profiles_status_check;

alter table public.teacher_profiles
  add constraint teacher_profiles_status_check
  check (status::text in ('draft', 'pending', 'approved', 'rejected', 'suspended'));
