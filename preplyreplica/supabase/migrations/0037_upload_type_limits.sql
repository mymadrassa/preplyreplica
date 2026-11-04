-- Teachers upload straight to storage from the browser, so the buckets
-- themselves now refuse anything but the expected types and sizes (an .exe,
-- an HTML page or an SVG with a script never gets in, even when the app's
-- pages are bypassed). The app also checks each file's real content from its
-- first bytes before recording it (src/lib/verifyUpload.ts), since the type a
-- browser declares is chosen by the uploader.

-- Private: ID documents and certificates, opened by the admin to review them.
update storage.buckets
   set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
       file_size_limit = 10 * 1024 * 1024
 where id = 'teacher-documents';

-- Public: profile photos.
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
       file_size_limit = 5 * 1024 * 1024
 where id = 'avatars';

-- Public: intro videos (90 seconds or less).
update storage.buckets
   set allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm'],
       file_size_limit = 50 * 1024 * 1024
 where id = 'teacher-videos';
