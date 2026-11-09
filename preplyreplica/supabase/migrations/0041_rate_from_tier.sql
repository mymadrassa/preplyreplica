-- A teacher's hourly rate is set by their tier (Starter £15, Mid £17.50,
-- Top £20), as in the pricing model: a promotion is a raise. hourly_rate stays
-- as a copy of the tier's rate for anything that reads it, kept in step by the
-- database, and teachers can no longer set it themselves.

create or replace function public.tier_rate(tier text)
returns numeric
language sql
immutable
as $$
  select case tier when 'mid' then 17.5 when 'top' then 20 else 15 end::numeric;
$$;

update public.teacher_profiles set hourly_rate = public.tier_rate(tier) where hourly_rate is distinct from public.tier_rate(tier);

create or replace function public.sync_rate_with_tier()
returns trigger
language plpgsql
as $$
begin
  new.hourly_rate := public.tier_rate(new.tier);
  return new;
end;
$$;

drop trigger if exists sync_rate_with_tier on public.teacher_profiles;
create trigger sync_rate_with_tier
  before insert or update of tier, hourly_rate on public.teacher_profiles
  for each row execute function public.sync_rate_with_tier();

-- Same guard as 0038, with hourly_rate platform-managed too. (The trigger above
-- already resets any change, this makes the refusal explicit.)
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
     or new.approved_at is distinct from old.approved_at
     or new.review_note is distinct from old.review_note
     or new.reviewed_at is distinct from old.reviewed_at
     or new.hourly_rate is distinct from old.hourly_rate then
    raise exception 'These fields are managed by the platform.';
  end if;

  return new;
end;
$$;
