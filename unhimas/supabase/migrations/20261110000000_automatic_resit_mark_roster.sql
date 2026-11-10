-- Automatically include every active student whose latest published attempt failed.
-- Resit roster inclusion no longer depends on a student-course registration row.

create or replace function public.ensure_marks_for_submission(p_submission_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_batch_course_id uuid;
  v_semester_type text;
  v_status public.submission_status;
  v_inserted integer := 0;
begin
  select ms.status, bc.batch_id, ms.batch_course_id, sem.semester_type
    into v_status, v_batch_id, v_batch_course_id, v_semester_type
  from public.mark_submissions ms
  join public.batch_courses bc on bc.id = ms.batch_course_id
  join public.semesters sem on sem.id = bc.semester_id
  where ms.id = p_submission_id;

  if not found then
    raise exception 'Mark submission not found.';
  end if;
  if v_status not in ('draft', 'returned') then
    raise exception 'Marks can only be seeded while the submission is draft or returned.';
  end if;
  if not public.is_admin()
     and not exists (
       select 1
       from public.mark_submissions ms
       join public.lecturers l on l.id = ms.lecturer_id
       where ms.id = p_submission_id and l.profile_id = auth.uid()
     ) then
    raise exception 'Only the assigned lecturer or an administrator may seed marks.';
  end if;

  insert into public.marks (mark_submission_id, student_id)
  select p_submission_id, s.id
  from public.students s
  where s.batch_id = v_batch_id
    and s.is_active = true
    and (
      v_semester_type <> 'resit'
      or public.is_student_resit_eligible(s.id, v_batch_course_id)
    )
  on conflict (mark_submission_id, student_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.ensure_marks_for_submission(uuid)
  from public, anon;
grant execute on function public.ensure_marks_for_submission(uuid)
  to authenticated;
