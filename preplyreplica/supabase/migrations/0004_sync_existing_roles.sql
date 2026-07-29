-- The old handle_new_auth_user() trigger hardcoded role = 'student' for
-- every signup, so accounts that picked "teacher" at registration ended up
-- with a profiles row stuck at role = 'student' (0003 only backfilled rows
-- that were missing entirely, not ones already created with the wrong role).
-- Reconcile existing rows against the role actually chosen at signup, which
-- was stored correctly in auth.users' metadata all along even though the
-- trigger ignored it.
update public.profiles p
set role = (u.raw_user_meta_data->>'role')::profile_role
from auth.users u
where u.id = p.id
  and u.raw_user_meta_data->>'role' is not null
  and p.role <> (u.raw_user_meta_data->>'role')::profile_role;
