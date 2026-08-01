-- Supports the escrow-style payout policy: teachers are paid out only after
-- a session completes (not immediately at checkout), and always receive
-- their full base rate — the Stripe processing fee that direct-charge mode
-- automatically deducts from their connected-account balance is temporarily
-- absorbed by the platform, then recouped from the student on their next
-- booking rather than split per-transaction.

alter table public.profiles
  add column if not exists pending_stripe_fees numeric not null default 0;

alter table public.payments
  add column if not exists payout_at timestamptz,
  add column if not exists stripe_fee_estimate numeric not null default 0,
  add column if not exists pending_fees_billed numeric not null default 0;
