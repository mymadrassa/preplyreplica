-- stripe_payment_intent_id was NOT NULL, but Stripe doesn't always return a
-- payment_intent synchronously when a Checkout Session is created (observed
-- in practice for a manual-capture, connected-account direct-charge
-- session) — the payments row still needs to be inserted immediately at
-- booking time so the webhook has something to match the checkout session
-- back to. The id gets backfilled from the checkout.session.completed
-- webhook payload instead, by which point the PaymentIntent is guaranteed
-- to exist (the customer just paid through it).
alter table public.payments alter column stripe_payment_intent_id drop not null;
