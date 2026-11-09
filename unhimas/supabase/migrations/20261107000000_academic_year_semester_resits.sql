-- Academic-year lifecycle and eligible course resits.

alter table public.semesters
  add column if not exists semester_type text not null default 'regular';

alter table public.semesters
  drop constraint if exists semester_number_ck;

alter table public.semesters
  add constraint semester_number_ck check (number in (1, 2, 3));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'semesters_semester_type_check'
      and conrelid = 'public.semesters'::regclass
  ) then
    alter table public.semesters
      add constraint semesters_semester_type_check
      check (semester_type in ('regular', 'resit'));
  end if;
end;
$$;

update public.semesters
   set semester_type = 'resit'
 where number = 3 and semester_type = 'regular';

insert into public.semesters (
  academic_year_id, name, number, is_current, semester_type, registration_open
)
select ay.id, 'Resit Period', 3, false, 'resit', false
from public.academic_years ay
where not exists (
  select 1
  from public.semesters sem
  where sem.academic_year_id = ay.id and sem.semester_type = 'resit'
);

create or replace function public.create_academic_year_with_semesters(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_is_current boolean default false
)
returns public.academic_years
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year public.academic_years;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may create an academic year.';
  end if;
  if nullif(trim(p_name), '') is null or p_start_date is null or p_end_date is null then
    raise exception 'Academic year name and dates are required.';
  end if;
  if p_end_date <= p_start_date then
    raise exception 'Academic year end date must be after its start date.';
  end if;

  if coalesce(p_is_current, false) then
    update public.academic_years set is_current = false where is_current;
    update public.semesters
       set is_current = false, registration_open = false
     where is_current;
  end if;

  insert into public.academic_years (name, start_date, end_date, is_current)
  values (trim(p_name), p_start_date, p_end_date, coalesce(p_is_current, false))
  returning * into v_year;

  insert into public.semesters (
    academic_year_id, name, number, is_current, semester_type, registration_open
  )
  values
    (v_year.id, 'First Semester', 1, coalesce(p_is_current, false), 'regular', coalesce(p_is_current, false)),
    (v_year.id, 'Second Semester', 2, false, 'regular', false),
    (v_year.id, 'Resit Period', 3, false, 'resit', false);

  return v_year;
end;
$$;

revoke all on function public.create_academic_year_with_semesters(text, date, date, boolean)
  from public, anon;
grant execute on function public.create_academic_year_with_semesters(text, date, date, boolean)
  to authenticated;

create or replace function public.activate_academic_year(p_academic_year_id uuid)
returns public.academic_years
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year public.academic_years;
  v_first_semester_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may activate an academic year.';
  end if;

  select * into v_year
  from public.academic_years
  where id = p_academic_year_id
  for update;
  if not found then
    raise exception 'Academic year not found.';
  end if;

  select id into v_first_semester_id
  from public.semesters
  where academic_year_id = p_academic_year_id and number = 1
  order by id
  limit 1
  for update;
  if not found then
    raise exception 'The academic year has no first semester configured.';
  end if;

  update public.academic_years set is_current = false where is_current;
  update public.academic_years set is_current = true where id = p_academic_year_id;
  update public.semesters
     set is_current = false, registration_open = false
   where is_current;
  update public.semesters
     set is_current = true, registration_open = true
   where id = v_first_semester_id;

  select * into v_year
  from public.academic_years
  where id = p_academic_year_id;
  return v_year;
end;
$$;

revoke all on function public.activate_academic_year(uuid)
  from public, anon;
grant execute on function public.activate_academic_year(uuid)
  to authenticated;

create or replace function public.is_student_resit_eligible(
  p_student_id uuid,
  p_batch_course_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_course_id uuid;
  v_semester_type text;
  v_latest_grade text;
begin
  if p_student_id is null or p_batch_course_id is null then
    return false;
  end if;
  if not public.is_admin()
     and not exists (
       select 1 from public.students s
       where s.id = p_student_id and s.profile_id = auth.uid()
     )
     and not exists (
       select 1
       from public.batch_courses bc
       join public.mark_submissions ms on ms.batch_course_id = bc.id
       join public.lecturers l on l.id = ms.lecturer_id
       where bc.id = p_batch_course_id and l.profile_id = auth.uid()
     ) then
    return false;
  end if;

  select bc.batch_id, bc.course_id, sem.semester_type
    into v_batch_id, v_course_id, v_semester_type
  from public.batch_courses bc
  join public.semesters sem on sem.id = bc.semester_id
  where bc.id = p_batch_course_id;

  if not found or v_semester_type <> 'resit' then
    return false;
  end if;
  if not exists (
    select 1 from public.students s
    where s.id = p_student_id and s.batch_id = v_batch_id and s.is_active = true
  ) then
    return false;
  end if;

  select m.grade
    into v_latest_grade
  from public.marks m
  join public.mark_submissions ms on ms.id = m.mark_submission_id
  join public.batch_courses previous_bc on previous_bc.id = ms.batch_course_id
  where m.student_id = p_student_id
    and previous_bc.batch_id = v_batch_id
    and previous_bc.course_id = v_course_id
    and ms.status = 'published'
  order by ms.published_at desc nulls last, ms.updated_at desc, m.updated_at desc, m.id desc
  limit 1;

  return coalesce(v_latest_grade = 'F', false);
end;
$$;

revoke all on function public.is_student_resit_eligible(uuid, uuid)
  from public, anon;
grant execute on function public.is_student_resit_eligible(uuid, uuid)
  to authenticated;

create or replace function public.get_eligible_resit_batch_courses(
  p_student_id uuid,
  p_semester_id uuid
)
returns table (batch_course_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.students s
    where s.id = p_student_id and s.profile_id = auth.uid()
  ) then
    raise exception 'You may only view your own resit-eligible courses.';
  end if;

  return query
  select bc.id
  from public.batch_courses bc
  join public.semesters sem on sem.id = bc.semester_id
  join public.students s on s.id = p_student_id and s.batch_id = bc.batch_id
  where bc.semester_id = p_semester_id
    and sem.semester_type = 'resit'
    and s.is_active = true
    and public.is_student_resit_eligible(p_student_id, bc.id)
  order by bc.id;
end;
$$;

revoke all on function public.get_eligible_resit_batch_courses(uuid, uuid)
  from public, anon;
grant execute on function public.get_eligible_resit_batch_courses(uuid, uuid)
  to authenticated;

create or replace function public.populate_resit_offerings(p_semester_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not exists (
    select 1 from public.semesters
    where id = p_semester_id and semester_type = 'resit'
  ) then
    return 0;
  end if;

  insert into public.batch_courses (
    batch_id, course_id, semester_id, lecturer_id, is_compulsory
  )
  select distinct on (bc.batch_id, bc.course_id)
    bc.batch_id, bc.course_id, p_semester_id, bc.lecturer_id, false
  from public.batch_courses bc
  join public.semesters source_sem on source_sem.id = bc.semester_id
  join public.academic_years source_year on source_year.id = source_sem.academic_year_id
  join public.semesters resit_sem on resit_sem.id = p_semester_id
  join public.academic_years resit_year on resit_year.id = resit_sem.academic_year_id
  where source_sem.semester_type = 'regular'
    and source_year.start_date <= resit_year.start_date
    and exists (
      select 1
      from public.students s
      where s.batch_id = bc.batch_id
        and s.is_active = true
        and (
          select m.grade
          from public.marks m
          join public.mark_submissions ms on ms.id = m.mark_submission_id
          join public.batch_courses attempted_bc on attempted_bc.id = ms.batch_course_id
          where m.student_id = s.id
            and attempted_bc.batch_id = bc.batch_id
            and attempted_bc.course_id = bc.course_id
            and ms.status = 'published'
          order by ms.published_at desc nulls last, ms.updated_at desc,
                   m.updated_at desc, m.id desc
          limit 1
        ) = 'F'
    )
    and not exists (
      select 1
      from public.batch_courses existing
      where existing.batch_id = bc.batch_id
        and existing.course_id = bc.course_id
        and existing.semester_id = p_semester_id
    )
  order by bc.batch_id, bc.course_id, source_year.start_date desc,
           source_sem.number desc, bc.id desc;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.populate_resit_offerings(uuid)
  from public, anon, authenticated;

create or replace function public.activate_semester(p_semester_id uuid)
returns public.semesters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semester public.semesters;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may activate a semester.';
  end if;

  select * into v_semester
  from public.semesters
  where id = p_semester_id
  for update;
  if not found then
    raise exception 'Semester not found.';
  end if;

  update public.semesters
     set is_current = false, registration_open = false
   where is_current;
  update public.academic_years
     set is_current = false
   where is_current and id <> v_semester.academic_year_id;
  update public.academic_years
     set is_current = true
   where id = v_semester.academic_year_id;

  if v_semester.semester_type = 'resit' then
    perform public.populate_resit_offerings(v_semester.id);
  end if;

  update public.semesters
     set is_current = true, registration_open = true
   where id = v_semester.id
  returning * into v_semester;

  return v_semester;
end;
$$;

revoke all on function public.activate_semester(uuid)
  from public, anon;
grant execute on function public.activate_semester(uuid)
  to authenticated;

create or replace function public.advance_current_semester()
returns public.semesters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.semesters;
  v_next public.semesters;
  v_fallback boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may advance the academic semester.';
  end if;

  select sem.* into v_current
  from public.semesters sem
  where sem.is_current
  order by sem.number
  limit 1
  for update;

  if not found then
    v_fallback := true;
    select sem.* into v_current
    from public.semesters sem
    join public.academic_years ay on ay.id = sem.academic_year_id
    where ay.is_current and sem.number = 1
    order by sem.id
    limit 1
    for update;
  end if;

  if not found then
    raise exception 'There is no current semester to advance.';
  end if;

  if v_fallback then
    update public.semesters
       set is_current = false, registration_open = false
     where is_current;
    update public.semesters
       set is_current = true, registration_open = true
     where id = v_current.id
    returning * into v_current;
    return v_current;
  end if;

  select sem.* into v_next
  from public.semesters sem
  where sem.academic_year_id = v_current.academic_year_id
    and sem.number = v_current.number + 1
  order by sem.id
  limit 1
  for update;

  if not found then
    raise exception 'There is no next semester configured for this academic year.';
  end if;

  update public.semesters
     set is_current = false, registration_open = false
   where is_current;

  if v_next.semester_type = 'resit' then
    perform public.populate_resit_offerings(v_next.id);
  end if;

  update public.semesters
     set is_current = true, registration_open = true
   where id = v_next.id
  returning * into v_next;

  return v_next;
end;
$$;

revoke all on function public.advance_current_semester()
  from public, anon;
grant execute on function public.advance_current_semester()
  to authenticated;

drop policy if exists scr_insert_own on public.student_course_registrations;
create policy scr_insert_own on public.student_course_registrations
  for insert to authenticated
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_id
        and s.profile_id = auth.uid()
        and (
          status <> 'registered'
          or exists (
            select 1
            from public.batch_courses bc
            join public.semesters sem on sem.id = bc.semester_id
            where bc.id = batch_course_id
              and (
                sem.semester_type <> 'resit'
                or public.is_student_resit_eligible(student_id, bc.id)
              )
          )
        )
    )
    or public.is_admin()
  );

drop policy if exists scr_update_own on public.student_course_registrations;
create policy scr_update_own on public.student_course_registrations
  for update to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_id
        and s.profile_id = auth.uid()
        and (
          status <> 'registered'
          or exists (
            select 1
            from public.batch_courses bc
            join public.semesters sem on sem.id = bc.semester_id
            where bc.id = batch_course_id
              and (
                sem.semester_type <> 'resit'
                or public.is_student_resit_eligible(student_id, bc.id)
              )
          )
        )
    )
    or public.is_admin()
  );

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
      or (
        exists (
          select 1
          from public.student_course_registrations scr
          where scr.student_id = s.id
            and scr.batch_course_id = (
              v_batch_course_id
            )
            and scr.status = 'registered'
        )
        and public.is_student_resit_eligible(
          s.id,
          v_batch_course_id
        )
      )
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

create or replace view public.student_semester_gpa
with (security_invoker = true)
as
with latest_attempts as (
  select distinct on (r.student_id, r.course_id) r.*
  from public.results r
  order by r.student_id, r.course_id, r.published_at desc nulls last,
           r.academic_year desc, r.semester_id desc
)
select
  r.student_id,
  r.academic_year_id,
  r.semester_id,
  round(sum(r.grade_point * r.credit_units) / nullif(sum(r.credit_units), 0), 2) as semester_gpa,
  round(sum(r.credit_units), 2) as attempted_credits
from latest_attempts r
group by r.student_id, r.academic_year_id, r.semester_id;

create or replace view public.student_overall_gpa
with (security_invoker = true)
as
with latest_attempts as (
  select distinct on (r.student_id, r.course_id) r.*
  from public.results r
  order by r.student_id, r.course_id, r.published_at desc nulls last,
           r.academic_year desc, r.semester_id desc
)
select
  r.student_id,
  round(sum(r.grade_point * r.credit_units) / nullif(sum(r.credit_units), 0), 2) as overall_gpa,
  round(sum(r.credit_units), 2) as total_credits
from latest_attempts r
group by r.student_id;

create or replace view public.course_performance
with (security_invoker = true)
as
with latest_attempts as (
  select distinct on (r.student_id, r.course_id) r.*
  from public.results r
  order by r.student_id, r.course_id, r.published_at desc nulls last,
           r.academic_year desc, r.semester_id desc
)
select
  r.course_id,
  r.course_code,
  r.course_name,
  count(*) as students,
  round(avg(r.total_score), 2) as average_score,
  count(*) filter (where r.grade <> 'F') as passes,
  count(*) filter (where r.grade = 'F') as failures
from latest_attempts r
group by r.course_id, r.course_code, r.course_name;

grant select on public.student_semester_gpa to authenticated;
grant select on public.student_overall_gpa to authenticated;
grant select on public.course_performance to authenticated;
