-- Block attendance row changes when the parent session is submitted or approved.
-- Lecturers may only edit while attendance_status is draft or returned.
-- Admins can still change rows if needed (bypass via service role / separate policies).

create or replace function public.enforce_attendance_session_editable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sess_status public.attendance_submission_status;
begin
  -- If attendance_status column is missing (migration not applied), allow write.
  begin
    select cs.attendance_status into sess_status
    from public.class_sessions cs
    where cs.id = coalesce(new.session_id, old.session_id);
  exception
    when undefined_column then
      return coalesce(new, old);
  end;

  if sess_status is null then
    return coalesce(new, old);
  end if;

  if sess_status not in ('draft', 'returned') then
    raise exception 'Attendance for this session is locked (status: %). Submit is already sent or approved.', sess_status
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists attendance_session_editable_trg on public.attendance;

create trigger attendance_session_editable_trg
  before insert or update or delete on public.attendance
  for each row
  execute function public.enforce_attendance_session_editable();

comment on function public.enforce_attendance_session_editable() is
  'Prevents attendance inserts/updates/deletes when class_sessions.attendance_status is submitted or approved.';
