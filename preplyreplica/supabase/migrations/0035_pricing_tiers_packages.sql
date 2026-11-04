-- Pricing model: teacher tiers (commission 40/35/30%), and 10-lesson
-- packages paid upfront. See src/lib/pricing.ts and src/lib/tiers.ts.

-- Tiers ---------------------------------------------------------------------

alter table public.teacher_profiles add column if not exists tier text not null default 'starter';
alter table public.teacher_profiles drop constraint if exists teacher_profiles_tier_check;
alter table public.teacher_profiles add constraint teacher_profiles_tier_check check (tier in ('starter', 'mid', 'top'));
-- Set by an admin: the daily promotion job leaves it alone.
alter table public.teacher_profiles add column if not exists tier_locked boolean not null default false;
alter table public.teacher_profiles add column if not exists tier_updated_at timestamptz;
-- "Months on the platform" counts from approval.
alter table public.teacher_profiles add column if not exists approved_at timestamptz;
update public.teacher_profiles
   set approved_at = coalesce(approval_seen_at, updated_at)
 where status = 'approved' and approved_at is null;

-- Tier and approval date are platform-managed, like status and payouts (0027/0034).
create or replace function public.guard_teacher_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or coalesce(auth.role(), '') = 'service_role' or pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.status is distinct from old.status
     and not (old.status in ('draft', 'rejected') and new.status = 'pending')
     and not (old.status = 'pending' and new.status = 'draft') then
    raise exception 'Only an admin can change a teacher''s approval status.';
  end if;

  if new.payments_enabled is distinct from old.payments_enabled
     or new.payouts_enabled is distinct from old.payouts_enabled
     or new.payment_provider is distinct from old.payment_provider
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count
     or new.tier is distinct from old.tier
     or new.tier_locked is distinct from old.tier_locked
     or new.tier_updated_at is distinct from old.tier_updated_at
     or new.approved_at is distinct from old.approved_at then
    raise exception 'These fields are managed by the platform.';
  end if;

  return new;
end;
$$;

-- Packages ------------------------------------------------------------------

create table if not exists public.lesson_packages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  lessons_total int not null check (lessons_total > 0),
  lessons_used int not null default 0,
  -- Pence. refund_per_lesson is the discounted price of one lesson.
  price int not null,
  teacher_fee_per_lesson int not null,
  refund_per_lesson int not null,
  refunded_amount int not null default 0,
  tier text not null,
  provider text not null default 'stripe',
  provider_checkout_id text,
  provider_payment_id text,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'used_up', 'expired', 'cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (lessons_used between 0 and lessons_total)
);

create index if not exists lesson_packages_student_idx on public.lesson_packages (student_id, teacher_id);
create index if not exists lesson_packages_expiry_idx on public.lesson_packages (expires_at) where status = 'active';
-- One live package per student and teacher.
create unique index if not exists lesson_packages_one_active
  on public.lesson_packages (student_id, teacher_id) where status in ('pending_payment', 'active');

alter table public.lesson_packages enable row level security;
drop policy if exists lesson_packages_read on public.lesson_packages;
create policy lesson_packages_read on public.lesson_packages
  for select
  using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin());

-- A lesson booked with a package credit has no payment of its own.
alter table public.bookings add column if not exists package_id uuid references public.lesson_packages(id) on delete set null;
create index if not exists bookings_package_idx on public.bookings (package_id) where package_id is not null;

-- Students may insert their own bookings (RLS), but only as an unpaid hold
-- that the payment flow moves forward. Lessons paid with a package credit,
-- or in any other status, are created by the server, so nobody can book a
-- "confirmed" lesson or spend a package lesson without it being counted.
create or replace function public.guard_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if new.status <> 'pending_payment' or new.package_id is not null then
    raise exception 'Bookings are created through checkout.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_booking_insert on public.bookings;
create trigger guard_booking_insert
  before insert on public.bookings
  for each row execute function public.guard_booking_insert();

create or replace function public.guard_booking_package()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.package_id is distinct from old.package_id
     and not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'A lesson''s package can''t be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_booking_package on public.bookings;
create trigger guard_booking_package
  before update on public.bookings
  for each row execute function public.guard_booking_package();

-- Moves one lesson in or out of a package atomically; false when none is left
-- (or nothing to give back). Server-only (called with the service key).
create or replace function public.use_package_lesson(package uuid, delta int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed int;
begin
  update public.lesson_packages
     set lessons_used = lessons_used + delta,
         status = case
           when lessons_used + delta >= lessons_total then 'used_up'
           when status = 'used_up' and lessons_used + delta < lessons_total then 'active'
           else status end
   where id = package
     and status in ('active', 'used_up')
     and (delta < 0 or (status = 'active' and expires_at > now()))
     and lessons_used + delta between 0 and lessons_total;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke execute on function public.use_package_lesson(uuid, int) from public, anon, authenticated;
