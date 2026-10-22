-- After approval, changes to a teacher's ID documents go through the same
-- review as bio/photo edits. `review_change` marks a document that is part of
-- a pending change:
--   null     -> live, counts for verification
--   'add'    -> uploaded after approval, waiting for review (doesn't count yet)
--   'remove' -> still live, but will be removed once the change is approved
-- Approving applies them; discarding the change undoes them.

alter table public.teacher_documents
  add column if not exists review_change text check (review_change in ('add', 'remove'));
