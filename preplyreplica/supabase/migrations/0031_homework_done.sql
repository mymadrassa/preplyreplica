-- Homework as a to-do: the student marks a lesson's homework done (through a
-- server route, as students can't write these rows), and the teacher is
-- alerted until they open that student's follow-up page.

alter table public.lesson_homework add column if not exists done_at timestamptz;
alter table public.lesson_homework add column if not exists teacher_seen_done_at timestamptz;

create index if not exists lesson_homework_done_unseen_idx
  on public.lesson_homework (teacher_id)
  where done_at is not null and teacher_seen_done_at is null;
