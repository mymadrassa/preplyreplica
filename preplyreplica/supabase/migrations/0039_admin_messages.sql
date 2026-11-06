-- A conversation between the platform's team ("Admin") and one user, in the
-- same Messages area as lesson chats. Admin decisions (e.g. why a teacher's
-- profile wasn't approved) are posted here; the user can reply, and any admin
-- can answer. Messages live in the existing `messages` table, attached to
-- either a lesson conversation or a support thread.

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  -- What each side has read, for unread notifications.
  user_last_read_at timestamptz,
  admin_last_read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.support_threads enable row level security;
-- Read only; the server creates threads and records reads.
drop policy if exists support_threads_read on public.support_threads;
create policy support_threads_read on public.support_threads
  for select
  using (user_id = auth.uid() or public.is_admin());

alter table public.messages alter column conversation_id drop not null;
alter table public.messages add column if not exists support_thread_id uuid references public.support_threads(id) on delete cascade;
alter table public.messages drop constraint if exists messages_one_channel;
alter table public.messages add constraint messages_one_channel check ((conversation_id is null) <> (support_thread_id is null));
create index if not exists messages_support_thread_created_idx on public.messages (support_thread_id, created_at) where support_thread_id is not null;

-- The thread's user and admins read and write in it (alongside the existing
-- lesson-conversation policies; Postgres allows a row if any policy does).
drop policy if exists messages_support_select on public.messages;
create policy messages_support_select on public.messages
  for select
  using (
    support_thread_id is not null
    and (public.is_admin() or exists (select 1 from public.support_threads t where t.id = support_thread_id and t.user_id = auth.uid()))
  );

drop policy if exists messages_support_insert on public.messages;
create policy messages_support_insert on public.messages
  for insert
  with check (
    support_thread_id is not null
    and sender_id = auth.uid()
    and (public.is_admin() or exists (select 1 from public.support_threads t where t.id = support_thread_id and t.user_id = auth.uid()))
  );
