-- A teacher may update their own teacher_profiles row (RLS), which until now
-- included columns only the platform should set. This guard stops a teacher
-- from approving themselves or faking a connected Stripe account through the
-- API directly. Admins and the server key (webhooks, admin tools) are unaffected.
--
-- The only status moves a teacher may make themselves:
--   draft/rejected -> pending   (submitting for review)
--   pending        -> draft     (withdrawing a submission to edit it)

create or replace function public.guard_teacher_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins, the server key, and updates made by another database trigger (e.g.
  -- update_teacher_rating, fired when a student leaves a review) may change anything.
  if public.is_admin() or coalesce(auth.role(), '') = 'service_role' or pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.status is distinct from old.status
     and not (old.status in ('draft', 'rejected') and new.status = 'pending')
     and not (old.status = 'pending' and new.status = 'draft') then
    raise exception 'Only an admin can change a teacher''s approval status.';
  end if;

  if new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
     or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count then
    raise exception 'These fields are managed by the platform.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_teacher_profile_fields on public.teacher_profiles;
create trigger guard_teacher_profile_fields
  before update on public.teacher_profiles
  for each row execute function public.guard_teacher_profile_fields();
