-- A note can now span several selected words: word_ref is the first word,
-- end_word_ref the last (null for a note on a single word or a whole verse).
alter table public.mushaf_annotations add column if not exists end_word_ref text;

-- Make the API pick up the new column immediately instead of after its cache expires.
notify pgrst, 'reload schema';
