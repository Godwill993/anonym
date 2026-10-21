-- ============================================================
-- Class session management improvements (2026-10-21)
-- Lecturers may delete their own sessions that have no attendance.
-- ============================================================

drop policy if exists class_sessions_admin_delete on public.class_sessions;

create policy class_sessions_delete on public.class_sessions
for delete to authenticated
using (
  public.is_admin()
  or (
    lecturer_id = public.current_lecturer_id()
    and not exists (
      select 1 from public.attendance a
      where a.session_id = class_sessions.id
        and a.marked_at is not null
    )
  )
);

create or replace function public.session_attendance_counts(p_session_id uuid)
returns table (
  total_students integer,
  present_count integer,
  absent_count integer,
  late_count integer,
  excused_count integer,
  unmarked_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with sess as (
    select cs.id, bc.batch_id
    from public.class_sessions cs
    join public.batch_courses bc on bc.id = cs.batch_course_id
    where cs.id = p_session_id
  ),
  roster as (
    select s.id as student_id
    from public.students s
    join sess on s.batch_id = sess.batch_id
    where s.is_active = true
  ),
  marks as (
    select a.student_id, a.status, a.marked_at
    from public.attendance a
    where a.session_id = p_session_id
  )
  select
    (select count(*)::integer from roster) as total_students,
    (select count(*)::integer from marks where marked_at is not null and status = 'present') as present_count,
    (select count(*)::integer from marks where marked_at is not null and status = 'absent') as absent_count,
    (select count(*)::integer from marks where marked_at is not null and status = 'late') as late_count,
    (select count(*)::integer from marks where marked_at is not null and status = 'excused') as excused_count,
    (
      (select count(*)::integer from roster)
      - (select count(*)::integer from marks where marked_at is not null)
    ) as unmarked_count;
$$;

revoke all on function public.session_attendance_counts(uuid) from public, anon;
grant execute on function public.session_attendance_counts(uuid) to authenticated;
