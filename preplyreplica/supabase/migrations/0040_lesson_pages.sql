-- Lesson history: the Mushaf pages worked on during each lesson. Recorded by
-- the database itself, so the Mushaf package doesn't need to know about
-- lessons: whenever the pair's shared page changes while one of their lessons
-- is on (from 10 minutes before the start to 30 minutes after the end), and
-- whenever something is drawn during a lesson. The app also records the page
-- open when someone joins the room.

create table if not exists public.lesson_pages (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  page int not null check (page between 1 and 604),
  first_seen_at timestamptz not null default now(),
  primary key (booking_id, page)
);

alter table public.lesson_pages enable row level security;
drop policy if exists lesson_pages_read on public.lesson_pages;
create policy lesson_pages_read on public.lesson_pages
  for select
  using (
    public.is_admin()
    or exists (select 1 from public.bookings b where b.id = booking_id and (b.student_id = auth.uid() or b.teacher_id = auth.uid()))
  );

-- The shared page moved during one of the pair's lessons.
create or replace function public.record_lesson_page()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.teacher_id is null or new.current_page is not distinct from old.current_page then
    return new;
  end if;
  insert into public.lesson_pages (booking_id, page)
  select b.id, new.current_page
    from public.bookings b
   where b.student_id = new.student_id
     and b.teacher_id = new.teacher_id
     and b.status in ('confirmed', 'completed')
     and now() between b.start_at - interval '10 minutes' and b.end_at + interval '30 minutes'
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists record_lesson_page on public.mushaf_sessions;
create trigger record_lesson_page
  after update of current_page on public.mushaf_sessions
  for each row execute function public.record_lesson_page();

-- Something drawn during a lesson counts as that page being worked on.
create or replace function public.record_lesson_stroke_page()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.booking_id is not null then
    insert into public.lesson_pages (booking_id, page) values (new.booking_id, new.page) on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists record_lesson_stroke_page on public.mushaf_strokes;
create trigger record_lesson_stroke_page
  after insert on public.mushaf_strokes
  for each row execute function public.record_lesson_stroke_page();
