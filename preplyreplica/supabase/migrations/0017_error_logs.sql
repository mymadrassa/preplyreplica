-- Minimal server-side error log so raw provider errors (Supabase auth rate
-- limits, Stripe failures, etc.) aren't only visible in Vercel's function
-- logs -- they're queryable from the DB too. Insert-only; no RLS policy is
-- defined beyond enabling RLS, so only the service-role key (used by the
-- logging route) can write or read these rows.
create table if not exists public.error_logs (
  id bigint generated always as identity primary key,
  context text not null,
  message text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists error_logs_context_idx on public.error_logs (context, created_at desc);

alter table public.error_logs enable row level security;
