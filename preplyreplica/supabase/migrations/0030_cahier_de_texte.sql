-- Cahier de texte: after each lesson the teacher sets what to revise and what
-- to memorise next; it's sent to the student (WhatsApp, or email when the
-- number isn't on WhatsApp) and listed in the student's app. Needs a phone
-- number on every profile.

-- International format, e.g. +33612345678. Private to the owner and admins (existing RLS).
alter table public.profiles add column if not exists phone text;
alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles add constraint profiles_phone_format check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');

create table if not exists public.lesson_homework (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,

  revision_from_surah int check (revision_from_surah between 1 and 114),
  revision_from_ayah int check (revision_from_ayah >= 1),
  revision_to_surah int check (revision_to_surah between 1 and 114),
  revision_to_ayah int check (revision_to_ayah >= 1),

  memorization_from_surah int check (memorization_from_surah between 1 and 114),
  memorization_from_ayah int check (memorization_from_ayah >= 1),
  memorization_to_surah int check (memorization_to_surah between 1 and 114),
  memorization_to_ayah int check (memorization_to_ayah >= 1),

  note text check (note is null or char_length(note) <= 500),

  -- Delivery: 'whatsapp' or 'email'; for WhatsApp the status follows Meta's webhook.
  sent_channel text check (sent_channel in ('whatsapp', 'email')),
  whatsapp_message_id text,
  delivery_status text check (delivery_status in ('sent', 'delivered', 'read', 'failed')),
  last_error text,
  sent_at timestamptz,

  -- When the student opened their cahier de texte after this entry was (re)sent; drives their bell.
  student_seen_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Each range is either fully given or fully empty.
  check (num_nulls(revision_from_surah, revision_from_ayah, revision_to_surah, revision_to_ayah) in (0, 4)),
  check (num_nulls(memorization_from_surah, memorization_from_ayah, memorization_to_surah, memorization_to_ayah) in (0, 4))
);

create index if not exists lesson_homework_student_idx on public.lesson_homework (student_id, created_at desc);
create index if not exists lesson_homework_teacher_idx on public.lesson_homework (teacher_id, created_at desc);
create index if not exists lesson_homework_message_idx on public.lesson_homework (whatsapp_message_id);

alter table public.lesson_homework enable row level security;

-- Teacher and student of the lesson can read it.
drop policy if exists lesson_homework_read on public.lesson_homework;
create policy lesson_homework_read on public.lesson_homework
  for select
  using (teacher_id = auth.uid() or student_id = auth.uid() or public.is_admin());

-- Only the lesson's teacher writes it, for their own booking with that student.
drop policy if exists lesson_homework_teacher_insert on public.lesson_homework;
create policy lesson_homework_teacher_insert on public.lesson_homework
  for insert
  with check (
    (teacher_id = auth.uid()
      and exists (select 1 from public.bookings b where b.id = booking_id and b.teacher_id = auth.uid() and b.student_id = lesson_homework.student_id))
    or public.is_admin()
  );

drop policy if exists lesson_homework_teacher_update on public.lesson_homework;
create policy lesson_homework_teacher_update on public.lesson_homework
  for update
  using (teacher_id = auth.uid() or public.is_admin())
  with check (teacher_id = auth.uid() or public.is_admin());
-- Delivery fields and student_seen_at are written by the server (server key), not by these policies.
