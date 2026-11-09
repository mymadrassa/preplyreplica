-- My Madrassa sells the lessons: students now pay into My Madrassa's own
-- Stripe account ('platform' charges) instead of the teacher's ('direct'
-- charges, used until now). Once a payment is charged we record Stripe's
-- real card fee and what My Madrassa keeps, so receipts and teacher
-- statements show exact amounts. Teachers are paid by a transfer from My
-- Madrassa to their Stripe account, then a payout to their bank.

alter table public.payments
  add column if not exists charge_model text not null default 'direct' check (charge_model in ('direct', 'platform')),
  add column if not exists processing_fee int check (processing_fee >= 0),
  add column if not exists platform_amount int,
  add column if not exists card_country text,
  add column if not exists refunded_amount int not null default 0 check (refunded_amount >= 0),
  add column if not exists paid_at timestamptz;

alter table public.lesson_packages
  add column if not exists charge_model text not null default 'direct' check (charge_model in ('direct', 'platform')),
  add column if not exists processing_fee int check (processing_fee >= 0),
  add column if not exists platform_amount int,
  add column if not exists card_country text,
  add column if not exists paid_at timestamptz;

-- Rows created from now on default to the new flow.
alter table public.payments alter column charge_model set default 'platform';
alter table public.lesson_packages alter column charge_model set default 'platform';

-- Charged before this migration: the payment date is the best we know.
update public.payments set paid_at = created_at where paid_at is null and status in ('succeeded', 'refunded');
update public.lesson_packages set paid_at = created_at where paid_at is null and status in ('active', 'used_up', 'expired', 'cancelled') and provider_payment_id is not null;

alter table public.teacher_payouts
  add column if not exists provider_transfer_id text,
  add column if not exists transferred_amount int not null default 0 check (transferred_amount >= 0);
