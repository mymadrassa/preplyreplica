-- Fix handle_new_auth_user(): it must be SECURITY DEFINER, otherwise it runs as
-- the auth role that performs the insert into auth.users, which has no
-- privileges on public.profiles, so the insert silently fails and the user
-- ends up with no profile row (surfaces later as "Unable to determine your
-- role" at login). Also honor the role chosen at signup instead of hardcoding
-- 'student'.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, created_at)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::profile_role, 'student'),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- is_admin() is invoked from within RLS policies on public.profiles itself;
-- make it SECURITY DEFINER too so it doesn't depend on the calling role's
-- own grants/RLS visibility.
create or replace function public.is_admin()
returns boolean
stable
security definer
set search_path = public
language sql as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Backfill profiles for any existing auth.users rows left without one by the
-- previously-broken trigger.
insert into public.profiles (id, email, role, created_at)
select u.id, u.email, coalesce((u.raw_user_meta_data->>'role')::profile_role, 'student'), now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
