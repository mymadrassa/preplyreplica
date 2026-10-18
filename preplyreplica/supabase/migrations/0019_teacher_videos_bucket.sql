-- Public storage bucket for teacher intro videos. Unlike `teacher-documents`
-- (private, admin-only via signed URLs), an intro video needs to render
-- directly on the public teacher profile page, so the bucket itself is
-- public -- object reads bypass RLS entirely for a public bucket. The
-- policy below only governs who can upload/overwrite, scoped to each
-- teacher's own `{auth.uid()}/...` folder, mirroring the existing
-- per-user-folder convention already used for `teacher-documents` uploads.
insert into storage.buckets (id, name, public)
values ('teacher-videos', 'teacher-videos', true)
on conflict (id) do nothing;

create policy teacher_videos_owner_write on storage.objects
  for all
  using (bucket_id = 'teacher-videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'teacher-videos' and (storage.foldername(name))[1] = auth.uid()::text);
