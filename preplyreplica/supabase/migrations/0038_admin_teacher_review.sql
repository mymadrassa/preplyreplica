-- Admin review of a teacher's profile on its own page:
--   * the admin's decision message (what's missing, or their own words) is
--     kept on the profile and shown to the teacher;
--   * each uploaded document records the result of its safety check (real
--     file type from its first bytes), so the admin is warned about a
--     suspicious file before opening it.

alter table public.teacher_profiles add column if not exists review_note text check (char_length(review_note) <= 2000);
alter table public.teacher_profiles add column if not exists reviewed_at timestamptz;

alter table public.teacher_documents add column if not exists scan_status text check (scan_status in ('clean', 'suspicious'));
alter table public.teacher_documents add column if not exists scan_detail text;
alter table public.teacher_documents add column if not exists scanned_at timestamptz;

-- Review fields are the platform's, like status and tier (0027/0034/0035).
create or replace function public.guard_teacher_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or coalesce(auth.role(), '') = 'service_role' or pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.status is distinct from old.status
     and not (old.status in ('draft', 'rejected') and new.status = 'pending')
     and not (old.status = 'pending' and new.status = 'draft') then
    raise exception 'Only an admin can change a teacher''s approval status.';
  end if;

  if new.payments_enabled is distinct from old.payments_enabled
     or new.payouts_enabled is distinct from old.payouts_enabled
     or new.payment_provider is distinct from old.payment_provider
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count
     or new.tier is distinct from old.tier
     or new.tier_locked is distinct from old.tier_locked
     or new.tier_updated_at is distinct from old.tier_updated_at
     or new.approved_at is distinct from old.approved_at
     or new.review_note is distinct from old.review_note
     or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'These fields are managed by the platform.';
  end if;

  return new;
end;
$$;

-- Teachers manage their own document rows (RLS), but never the safety check:
-- only the server sets it, so nobody can mark their own file as clean.
create or replace function public.guard_document_scan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.scan_status := null;
    new.scan_detail := null;
    new.scanned_at := null;
  elsif new.scan_status is distinct from old.scan_status
     or new.scan_detail is distinct from old.scan_detail
     or new.scanned_at is distinct from old.scanned_at then
    raise exception 'The safety check is set by the platform.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_document_scan on public.teacher_documents;
create trigger guard_document_scan
  before insert or update on public.teacher_documents
  for each row execute function public.guard_document_scan();
