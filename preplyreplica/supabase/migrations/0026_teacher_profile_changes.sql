-- Edits an approved teacher makes to what students see (headline, bio,
-- subjects, languages, intro video, photo) wait here for admin review while
-- the approved profile stays live. At most one copy per teacher: approving
-- copies it onto the live profile and deletes it, so only the newest version
-- survives.

create table if not exists public.teacher_profile_changes (
  teacher_id uuid primary key references public.teacher_profiles(id) on delete cascade,
  headline text,
  bio text,
  subjects text[] not null default '{}',
  languages text[] not null default '{}',
  video_url text,
  avatar_url text,
  state text not null default 'draft' check (state in ('draft', 'submitted')),
  review_note text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.teacher_profile_changes enable row level security;

-- The teacher can always read their copy; they can only create, change or
-- delete it while it's a draft. Once submitted it's frozen until the admin decides.
drop policy if exists teacher_profile_changes_owner_read on public.teacher_profile_changes;
create policy teacher_profile_changes_owner_read on public.teacher_profile_changes
  for select
  using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists teacher_profile_changes_owner_insert on public.teacher_profile_changes;
create policy teacher_profile_changes_owner_insert on public.teacher_profile_changes
  for insert
  with check ((teacher_id = auth.uid() and state = 'draft') or public.is_admin());

drop policy if exists teacher_profile_changes_owner_update on public.teacher_profile_changes;
create policy teacher_profile_changes_owner_update on public.teacher_profile_changes
  for update
  using ((teacher_id = auth.uid() and state = 'draft') or public.is_admin())
  with check (teacher_id = auth.uid() or public.is_admin());

drop policy if exists teacher_profile_changes_owner_delete on public.teacher_profile_changes;
create policy teacher_profile_changes_owner_delete on public.teacher_profile_changes
  for delete
  using ((teacher_id = auth.uid() and state = 'draft') or public.is_admin());
