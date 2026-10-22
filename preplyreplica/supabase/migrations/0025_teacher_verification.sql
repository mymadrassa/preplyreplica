-- Teacher verification: an explicit "not yet submitted" status, document
-- kinds (ID vs certificate), and the storage buckets for profile photos and
-- verification documents.

-- 'draft' = profile saved but not yet submitted for admin approval. The column
-- default is left alone on purpose: Postgres won't let a brand-new enum value
-- be used in the same transaction, so the app sets 'draft' explicitly.
alter type public.teacher_status add value if not exists 'draft' before 'pending';

-- Existing documents count as identity documents, so teachers who already
-- uploaded something aren't asked to do it again.
alter table public.teacher_documents
  add column if not exists kind text not null default 'identity'
  check (kind in ('identity', 'certificate'));

-- Profile photos: public (shown on profiles), each user writes only in their own folder.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects
  for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Verification documents: private. Owners read/write their own folder; admins
-- read everything (for the signed links on the admin dashboard). These only add
-- access, so any policies already set up by hand keep working.
insert into storage.buckets (id, name, public) values ('teacher-documents', 'teacher-documents', false)
  on conflict (id) do nothing;

drop policy if exists teacher_documents_owner_files on storage.objects;
create policy teacher_documents_owner_files on storage.objects
  for all
  using (bucket_id = 'teacher-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'teacher-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists teacher_documents_admin_read on storage.objects;
create policy teacher_documents_admin_read on storage.objects
  for select
  using (bucket_id = 'teacher-documents' and public.is_admin());
