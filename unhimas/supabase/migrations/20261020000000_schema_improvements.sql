-- ============================================================
-- UNHIMAS schema improvements (2026-10-20)
-- Safe to re-run. Aligns app with existing tables/views and
-- fills functional gaps discovered against the live schema.
-- ============================================================

-- 1. Ensure columns introduced by earlier account-provisioning migrations
alter table public.students
  add column if not exists must_reset_password boolean not null default false;

alter table public.lecturers
  add column if not exists must_reset_password boolean not null default false;

-- 2. Enrich published results view with profile_id so student clients
--    can filter by auth.uid() without an extra join.
create or replace view public.results
with (security_invoker = true)
as
select
  s.id as student_id,
  s.profile_id,
  s.matricule,
  s.first_name,
  s.last_name,
  b.id as batch_id,
  b.name as batch_name,
  d.id as department_id,
  d.name as department_name,
  ay.id as academic_year_id,
  ay.name as academic_year,
  sem.id as semester_id,
  sem.name as semester,
  c.id as course_id,
  c.code as course_code,
  c.name as course_name,
  c.credit_units,
  m.attendance_score,
  m.coursework_score,
  m.exam_score,
  m.total_score,
  m.grade,
  m.grade_point,
  ms.status as result_status,
  ms.published_at
from public.marks m
join public.mark_submissions ms on ms.id = m.mark_submission_id
join public.batch_courses bc on bc.id = ms.batch_course_id
join public.students s on s.id = m.student_id
join public.batches b on b.id = bc.batch_id
join public.departments d on d.id = b.department_id
join public.semesters sem on sem.id = bc.semester_id
join public.academic_years ay on ay.id = sem.academic_year_id
join public.courses c on c.id = bc.course_id
where ms.status = 'published';

-- Keep GPA views consistent with the enriched results definition
create or replace view public.student_semester_gpa
with (security_invoker = true)
as
select
  r.student_id,
  r.academic_year_id,
  r.semester_id,
  round(sum(r.grade_point * r.credit_units) / nullif(sum(r.credit_units), 0), 2) as semester_gpa,
  round(sum(r.credit_units), 2) as attempted_credits
from public.results r
group by r.student_id, r.academic_year_id, r.semester_id;

create or replace view public.student_overall_gpa
with (security_invoker = true)
as
select
  r.student_id,
  round(sum(r.grade_point * r.credit_units) / nullif(sum(r.credit_units), 0), 2) as overall_gpa,
  round(sum(r.credit_units), 2) as total_credits
from public.results r
group by r.student_id;

create or replace view public.course_performance
with (security_invoker = true)
as
select
  r.course_id,
  r.course_code,
  r.course_name,
  count(*) as students,
  round(avg(r.total_score), 2) as average_score,
  count(*) filter (where r.grade <> 'F') as passes,
  count(*) filter (where r.grade = 'F') as failures
from public.results r
group by r.course_id, r.course_code, r.course_name;

-- 3. Seed zero mark rows for every active student in the batch
--    so lecturers see a full roster without manual inserts.
create or replace function public.ensure_marks_for_submission(p_submission_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_status public.submission_status;
  v_inserted integer := 0;
begin
  select ms.status, bc.batch_id
    into v_status, v_batch_id
  from public.mark_submissions ms
  join public.batch_courses bc on bc.id = ms.batch_course_id
  where ms.id = p_submission_id;

  if not found then
    raise exception 'Mark submission not found.';
  end if;

  if v_status not in ('draft', 'returned') then
    raise exception 'Marks can only be seeded while the submission is draft or returned.';
  end if;

  -- Lecturers may seed their own; admins may seed any.
  if not public.is_admin()
     and not exists (
       select 1
       from public.mark_submissions ms
       join public.lecturers l on l.id = ms.lecturer_id
       where ms.id = p_submission_id
         and l.profile_id = auth.uid()
     ) then
    raise exception 'Only the assigned lecturer or an administrator may seed marks.';
  end if;

  insert into public.marks (mark_submission_id, student_id)
  select p_submission_id, s.id
  from public.students s
  where s.batch_id = v_batch_id
    and s.is_active = true
  on conflict (mark_submission_id, student_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.ensure_marks_for_submission(uuid)
  from public, anon;
grant execute on function public.ensure_marks_for_submission(uuid)
  to authenticated;

-- 4. Student transfer using the existing student_transfers table
create or replace function public.transfer_student(
  p_student_id uuid,
  p_to_batch_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_batch uuid;
  v_transfer_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may transfer students.';
  end if;

  select batch_id into v_from_batch
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'Student not found.';
  end if;

  if v_from_batch = p_to_batch_id then
    raise exception 'Student is already in the target batch.';
  end if;

  if not exists (select 1 from public.batches where id = p_to_batch_id and is_active = true) then
    raise exception 'Target batch does not exist or is inactive.';
  end if;

  update public.students
     set batch_id = p_to_batch_id,
         updated_at = now()
   where id = p_student_id;

  insert into public.student_transfers (
    student_id, from_batch_id, to_batch_id, reason, transferred_by
  ) values (
    p_student_id, v_from_batch, p_to_batch_id, p_reason, auth.uid()
  )
  returning id into v_transfer_id;

  return v_transfer_id;
end;
$$;

revoke all on function public.transfer_student(uuid, uuid, text)
  from public, anon;
grant execute on function public.transfer_student(uuid, uuid, text)
  to authenticated;

-- 5. Notify students when marks are published (in addition to lecturer feedback)
create or replace function public.notify_mark_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  course_name text;
  batch_uuid uuid;
begin
  select c.name, bc.batch_id
    into course_name, batch_uuid
  from public.batch_courses bc
  join public.courses c on c.id = bc.course_id
  where bc.id = new.batch_course_id;

  select p.id into recipient
  from public.lecturers l
  join public.profiles p on p.id = l.profile_id
  where l.id = new.lecturer_id;

  if recipient is not null and new.status = 'returned' and old.status is distinct from 'returned' then
    insert into public.notifications(recipient_id, title, message, notification_type, related_table, related_id)
    values (
      recipient,
      'Marks returned',
      'Your marks for ' || coalesce(course_name, 'the course') || ' were returned for correction.',
      'marks_returned',
      'mark_submissions',
      new.id
    );
  elsif recipient is not null and new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.notifications(recipient_id, title, message, notification_type, related_table, related_id)
    values (
      recipient,
      'Marks approved',
      'Your marks for ' || coalesce(course_name, 'the course') || ' were approved.',
      'marks_approved',
      'mark_submissions',
      new.id
    );
  end if;

  -- When published, notify every active student in the batch who has a profile
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.notifications (
      recipient_id, title, message, notification_type, related_table, related_id
    )
    select
      p.id,
      'Results published',
      'Results for ' || coalesce(course_name, 'a course') || ' have been published.',
      'results_published',
      'mark_submissions',
      new.id
    from public.students s
    join public.profiles p on p.id = s.profile_id
    where s.batch_id = batch_uuid
      and s.is_active = true
      and p.is_active = true
      and p.role = 'student';
  end if;

  return new;
end;
$$;

-- 6. Public result lookup remains available; keep definition in sync with view columns
create or replace function public.public_result_lookup(p_matricule text)
returns table (
  matricule text,
  student_name text,
  batch_name text,
  academic_year text,
  semester text,
  course_code text,
  course_name text,
  credit_units numeric,
  total_score numeric,
  grade text,
  grade_point numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.matricule,
    trim(r.first_name || ' ' || r.last_name),
    r.batch_name,
    r.academic_year,
    r.semester,
    r.course_code,
    r.course_name,
    r.credit_units,
    r.total_score,
    r.grade,
    r.grade_point
  from public.results r
  where upper(r.matricule) = upper(trim(p_matricule))
    and r.result_status = 'published';
$$;

grant execute on function public.public_result_lookup(text) to anon, authenticated;
