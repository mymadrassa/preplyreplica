-- Same-gender teaching: students and teachers record their gender, and a
-- student is only ever matched with a teacher of the same gender. The app
-- filters listings and recommendations; these triggers are the hard guarantee
-- for anything that creates a pairing (bookings, conversations).

alter table public.profiles add column if not exists gender text;
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check check (gender is null or gender in ('male', 'female'));

-- Once set, only an admin or the server can change it, so nobody can switch
-- to see the other side. Setting it for the first time is allowed.
create or replace function public.guard_profile_gender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.gender is not null
     and new.gender is distinct from old.gender
     and not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Your gender can only be changed by our team.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_gender on public.profiles;
create trigger guard_profile_gender
  before update on public.profiles
  for each row execute function public.guard_profile_gender();

-- True only when both are set and equal.
create or replace function public.genders_match(student uuid, teacher uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.gender is not null and s.gender = t.gender
       from public.profiles s, public.profiles t
      where s.id = student and t.id = teacher),
    false
  );
$$;

create or replace function public.require_same_gender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.genders_match(new.student_id, new.teacher_id) then
    raise exception 'Teachers and students must be of the same gender.';
  end if;
  return new;
end;
$$;

-- Inserts only: lessons and conversations from before this rule stay as they are.
drop trigger if exists require_same_gender on public.bookings;
create trigger require_same_gender
  before insert on public.bookings
  for each row execute function public.require_same_gender();

drop trigger if exists require_same_gender on public.conversations;
create trigger require_same_gender
  before insert on public.conversations
  for each row execute function public.require_same_gender();
