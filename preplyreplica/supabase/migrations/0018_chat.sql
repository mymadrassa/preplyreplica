-- Real-time 1:1 chat between a student and a teacher, scoped to that pair
-- (one conversation per student/teacher pair, created on first contact --
-- not tied to a specific booking, since chat can happen before any booking
-- exists).

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, teacher_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
create policy conversations_participants on public.conversations
  for all
  using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin());

alter table public.messages enable row level security;
create policy messages_participants_select on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations
      where public.conversations.id = conversation_id
        and (public.conversations.student_id = auth.uid() or public.conversations.teacher_id = auth.uid())
    ) or public.is_admin()
  );
create policy messages_participants_insert on public.messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations
      where public.conversations.id = conversation_id
        and (public.conversations.student_id = auth.uid() or public.conversations.teacher_id = auth.uid())
    )
  );

-- Required for Supabase Realtime to broadcast row changes on this table --
-- without this, postgres_changes subscriptions on `messages` receive nothing.
alter publication supabase_realtime add table public.messages;
