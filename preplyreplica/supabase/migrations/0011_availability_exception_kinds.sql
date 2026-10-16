-- Generalizes the old binary exception_type ('blocked'|'added') into an
-- extensible `kind` for the interactive availability calendar, where a
-- teacher can mark a date-specific window as Available / Busy / Vacation
-- (and more later) with its own color, instead of just blocked-vs-added.
-- A checked text column rather than another enum value means adding a new
-- kind later doesn't need the ALTER TYPE ADD VALUE dance.
alter table public.availability_exceptions add column kind text;

update public.availability_exceptions
  set kind = case exception_type when 'added' then 'available' else 'busy' end;

alter table public.availability_exceptions
  alter column kind set not null,
  add constraint availability_exceptions_kind_check check (kind in ('available', 'busy', 'vacation'));

alter table public.availability_exceptions drop column exception_type;
drop type exception_type;
