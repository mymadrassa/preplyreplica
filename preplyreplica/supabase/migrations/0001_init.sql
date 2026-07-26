-- /Users/ybdn95/Desktop/preplyreplica/preplyreplica/supabase/migrations/0001_init.sql
create extension if not exists "pgcrypto";

create type profile_role as enum ('student', 'teacher', 'admin');
create type teacher_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'rejected');
create type exception_type as enum ('blocked', 'added');

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text,
  full_name text,
  username text unique,
  role profile_role not null default 'student',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  headline text,
  bio text,
  languages text[] not null default '{}',
  subjects text[] not null default '{}',
  hourly_rate int not null default 0,
  video_url text,
  stripe_account_id text,
  status teacher_status not null default 'pending',
  rating_avg numeric(4,2) not null default 0,
  rating_count int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_documents (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  bucket_path text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

create table if not exists public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  exception_date date not null,
  start_time time,
  end_time time,
  exception_type exception_type not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  subject text not null,
  language text not null,
  duration int not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status booking_status not null default 'pending',
  recurrence_group_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount int not null,
  currency text not null default 'usd',
  platform_fee int not null,
  teacher_fee int not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user() returns trigger language plpgsql as $$
begin
  insert into public.profiles (id, email, role, created_at)
  values (new.id, new.email, 'student', now()) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.update_teacher_rating() returns trigger language plpgsql as $$
begin
  update public.teacher_profiles
  set rating_avg = coalesce((select avg(rating) from public.reviews where teacher_id = new.teacher_id), 0),
      rating_count = coalesce((select count(*) from public.reviews where teacher_id = new.teacher_id), 0),
      updated_at = now()
  where id = new.teacher_id;
  return new;
end;
$$;

create trigger refresh_teacher_rating after insert on public.reviews
  for each row execute procedure public.update_teacher_rating();
