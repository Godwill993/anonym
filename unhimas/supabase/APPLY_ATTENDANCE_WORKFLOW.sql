-- =============================================================================
-- UNHIMAS — ONE-SHOT: Class attendance submit / approve workflow
-- Paste this entire file into Supabase → SQL Editor → Run
-- Safe to re-run (IF NOT EXISTS / exception handlers).
-- =============================================================================

-- 1) Status enum + columns on class_sessions
do $$ begin
  create type public.attendance_submission_status as enum ('draft','submitted','returned','approved');
exception when duplicate_object then null;
end $$;

alter table public.class_sessions
  add column if not exists attendance_status public.attendance_submission_status not null default 'draft';

alter table public.class_sessions
  add column if not exists attendance_submitted_at timestamptz;

alter table public.class_sessions
  add column if not exists attendance_reviewed_at timestamptz;

alter table public.class_sessions
  add column if not exists attendance_reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.class_sessions
  add column if not exists attendance_admin_comment text;

create index if not exists class_sessions_attendance_status_idx
  on public.class_sessions(attendance_status);

comment on column public.class_sessions.attendance_status is
  'Lecturer marks attendance while draft/returned; submit for admin approve or return.';

-- 2) Block attendance row changes when session is submitted or approved
create or replace function public.enforce_attendance_edit_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.attendance_submission_status;
begin
  select attendance_status into st
  from public.class_sessions
  where id = coalesce(new.session_id, old.session_id);

  if st is null then
    return coalesce(new, old);
  end if;

  if st is distinct from 'draft' and st is distinct from 'returned' then
    raise exception 'Attendance is locked for this session (status: %). Wait for admin return or use a draft session.', st
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_attendance_edit_lock on public.attendance;
create trigger trg_attendance_edit_lock
  before insert or update or delete on public.attendance
  for each row
  execute function public.enforce_attendance_edit_lock();

-- Done. Lecturer Submit to admin + Admin Class Attendance should now work.
