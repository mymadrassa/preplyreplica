-- Payments no longer assume Stripe: provider-specific column names become
-- neutral ones, and each payout account / payment records which provider it
-- lives on (so refunds and captures of older payments keep working after a
-- future switch). Renames only: no data changes.
--
-- Ship together with the matching app code: the old code reads the old names.

alter table public.teacher_profiles rename column stripe_account_id to payout_account_id;
alter table public.teacher_profiles rename column stripe_charges_enabled to payments_enabled;
alter table public.teacher_profiles rename column stripe_payouts_enabled to payouts_enabled;
alter table public.teacher_profiles add column if not exists payment_provider text not null default 'stripe';

alter table public.payments rename column stripe_checkout_session_id to provider_checkout_id;
alter table public.payments rename column stripe_payment_intent_id to provider_payment_id;
alter table public.payments rename column stripe_fee_estimate to processing_fee_estimate;
alter table public.payments add column if not exists provider text not null default 'stripe';

alter table public.profiles rename column pending_stripe_fees to pending_processing_fees;

-- Some databases carry a legacy (unused) checkout column on bookings too.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'stripe_checkout_session_id') then
    alter table public.bookings rename column stripe_checkout_session_id to provider_checkout_id;
  end if;
end $$;

-- Same guard as 0027, with the new column names (a function body isn't
-- updated by a column rename).
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

  if new.payments_enabled is distinct from old.payments_enabled
     or new.payouts_enabled is distinct from old.payouts_enabled
     or new.payment_provider is distinct from old.payment_provider
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count then
    raise exception 'These fields are managed by the platform.';
  end if;

  return new;
end;
$$;
