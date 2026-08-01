-- Tracks whether a pre-lesson reminder email has already been sent for a
-- booking, so the reminders cron doesn't send duplicates on every run.
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

-- teacher_profiles.id has never had a foreign key to profiles.id (it
-- pre-existed under a legacy schema keyed only by user_id -> users.id — see
-- 0005's notes). Every `.select('*, profiles(*)')` embedded query against
-- teacher_profiles across the app (teacher dashboard, /teachers listing,
-- teacher detail page, admin dashboard, student bookings) has therefore
-- been silently failing with PGRST200 ("no relationship found") and
-- returning no profile data, without erroring loudly since callers only
-- destructure `data`. Table is still empty, so this is safe to add.
alter table public.teacher_profiles
  add constraint teacher_profiles_id_fkey foreign key (id) references public.profiles(id) on delete cascade;

-- Same issue: bookings.student_id and reviews.student_id were left pointing
-- at the legacy `users` table instead of `profiles`. Both tables are still
-- empty, so it's safe to swap the constraint target.
do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public' and tc.table_name = 'bookings'
    and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'student_id';
  if fk_name is not null then
    execute format('alter table public.bookings drop constraint %I', fk_name);
  end if;
end $$;

alter table public.bookings
  add constraint bookings_student_id_fkey foreign key (student_id) references public.profiles(id) on delete cascade;

do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public' and tc.table_name = 'reviews'
    and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'student_id';
  if fk_name is not null then
    execute format('alter table public.reviews drop constraint %I', fk_name);
  end if;
end $$;

alter table public.reviews
  add constraint reviews_student_id_fkey foreign key (student_id) references public.profiles(id) on delete cascade;
