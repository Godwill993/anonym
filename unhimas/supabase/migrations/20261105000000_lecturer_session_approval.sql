-- Lecturer-created class sessions require administrator approval before use.
do $$
begin
  create type public.class_session_approval_status as enum ('pending', 'approved', 'returned');
exception
  when duplicate_object then null;
end
$$;

alter table public.class_sessions
  add column if not exists approval_status public.class_session_approval_status
    not null default 'approved',
  add column if not exists approval_comment text,
  add column if not exists approval_reviewed_at timestamptz,
  add column if not exists approval_reviewed_by uuid references public.profiles(id) on delete set null;

create index if not exists class_sessions_approval_status_idx
  on public.class_sessions(approval_status);

create or replace function public.guard_class_session_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := public.is_admin();
  v_session_details_changed boolean;
begin
  if tg_op = 'INSERT' then
    if not v_is_admin then
      new.approval_status := 'pending';
      new.approval_comment := null;
      new.approval_reviewed_at := null;
      new.approval_reviewed_by := null;
    end if;
    return new;
  end if;

  if v_is_admin then
    if new.approval_status is distinct from old.approval_status then
      if old.approval_status not in ('pending', 'returned')
         or new.approval_status not in ('approved', 'returned') then
        raise exception 'Only pending or returned class sessions can be reviewed.';
      end if;
      if new.approval_status = 'returned'
         and nullif(btrim(new.approval_comment), '') is null then
        raise exception 'A reason is required when returning a class session.';
      end if;
      new.approval_reviewed_at := now();
      new.approval_reviewed_by := auth.uid();
      if new.approval_status = 'approved' then
        new.approval_comment := null;
      end if;
    end if;
    return new;
  end if;

  if old.lecturer_id is distinct from public.current_lecturer_id()
     or new.lecturer_id is distinct from public.current_lecturer_id() then
    raise exception 'Lecturers may only update their own class sessions.';
  end if;

  if new.approval_status is distinct from old.approval_status
     or new.approval_comment is distinct from old.approval_comment
     or new.approval_reviewed_at is distinct from old.approval_reviewed_at
     or new.approval_reviewed_by is distinct from old.approval_reviewed_by then
    raise exception 'Only an administrator may review a class session.';
  end if;

  v_session_details_changed :=
    new.batch_course_id is distinct from old.batch_course_id
    or new.lecturer_id is distinct from old.lecturer_id
    or new.scheduled_start is distinct from old.scheduled_start
    or new.scheduled_end is distinct from old.scheduled_end
    or new.room is distinct from old.room
    or new.topic is distinct from old.topic
    or new.notes is distinct from old.notes;

  if v_session_details_changed then
    if old.attendance_status not in ('draft', 'returned') then
      raise exception 'A session cannot be changed after attendance has been submitted or approved.';
    end if;
    new.approval_status := 'pending';
    new.approval_comment := null;
    new.approval_reviewed_at := null;
    new.approval_reviewed_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists class_sessions_approval_guard on public.class_sessions;
create trigger class_sessions_approval_guard
  before insert or update on public.class_sessions
  for each row execute function public.guard_class_session_approval();

create or replace function public.enforce_attendance_session_editable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.class_sessions;
begin
  select * into v_session
  from public.class_sessions
  where id = coalesce(new.session_id, old.session_id);

  if not found then
    return coalesce(new, old);
  end if;

  if v_session.approval_status <> 'approved' then
    raise exception 'Attendance cannot be recorded until an administrator approves this session.'
      using errcode = 'check_violation';
  end if;

  if v_session.attendance_status not in ('draft', 'returned') then
    raise exception 'Attendance for this session is locked (status: %).', v_session.attendance_status
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.guard_attendance_submission_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.attendance_status is distinct from old.attendance_status then
    if old.approval_status <> 'approved' then
      raise exception 'Attendance cannot be submitted until an administrator approves this session.';
    end if;

    if new.attendance_status in ('submitted', 'approved')
       and old.attendance_status not in ('draft', 'returned', 'submitted') then
      raise exception 'Attendance cannot be submitted from its current status.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists class_sessions_attendance_submission_guard on public.class_sessions;
create trigger class_sessions_attendance_submission_guard
  before update of attendance_status on public.class_sessions
  for each row execute function public.guard_attendance_submission_status();

comment on column public.class_sessions.approval_status is
  'Lecturer-created sessions require administrator approval before attendance can be recorded.';
