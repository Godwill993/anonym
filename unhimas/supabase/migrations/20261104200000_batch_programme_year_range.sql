-- A batch is one stable cohort covering the full duration of its programme.
-- academic_year_id is the programme start session; the new FK is its end session.
alter table public.batches
  add column if not exists programme_end_academic_year_id uuid
    references public.academic_years(id);

alter table public.batches
  alter column year_of_study drop not null;

create index if not exists idx_batches_programme_end_academic_year
  on public.batches(programme_end_academic_year_id);

create or replace function public.validate_batch_programme_year_range()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_date date;
  v_end_date date;
  v_expected_end_year integer;
  v_duration numeric;
begin
  if new.programme_id is null then
    raise exception 'A programme is required for a cohort batch.';
  end if;
  if new.academic_year_id is null or new.programme_end_academic_year_id is null then
    raise exception 'Programme start and end academic years are required.';
  end if;

  select start_date into v_start_date
  from public.academic_years
  where id = new.academic_year_id;

  select start_date into v_end_date
  from public.academic_years
  where id = new.programme_end_academic_year_id;

  if v_start_date is null or v_end_date is null then
    raise exception 'The selected academic year does not have a start date.';
  end if;

  v_duration := public.effective_programme_duration_years(new.programme_id, new.department_id);
  if v_duration is null or v_duration <= 0 then
    raise exception 'The selected programme has no valid duration.';
  end if;

  v_expected_end_year := extract(year from v_start_date)::integer + ceil(v_duration)::integer - 1;
  if extract(year from v_end_date)::integer <> v_expected_end_year then
    raise exception
      'The selected end academic year does not match the programme duration of % year(s).',
      ceil(v_duration)::integer;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_batch_programme_year_range on public.batches;
create trigger trg_validate_batch_programme_year_range
  before insert or update of
    programme_id,
    department_id,
    academic_year_id,
    programme_end_academic_year_id
  on public.batches
  for each row execute function public.validate_batch_programme_year_range();

create or replace function public.validate_batch_course_academic_year_range()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.batches;
  v_semester_start date;
  v_start_date date;
  v_end_date date;
begin
  select * into v_batch from public.batches where id = new.batch_id;
  if not found then
    return new;
  end if;
  if v_batch.programme_end_academic_year_id is null then
    return new;
  end if;

  select start_date into v_start_date
  from public.academic_years
  where id = v_batch.academic_year_id;
  select start_date into v_end_date
  from public.academic_years
  where id = v_batch.programme_end_academic_year_id;
  select ay.start_date into v_semester_start
  from public.semesters s
  join public.academic_years ay on ay.id = s.academic_year_id
  where s.id = new.semester_id;

  if v_semester_start is null
     or v_start_date is null
     or v_end_date is null
     or v_semester_start < v_start_date
     or v_semester_start > v_end_date then
    raise exception 'The course semester must fall within the batch programme academic-year range.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_batch_course_academic_year_range on public.batch_courses;
create trigger trg_validate_batch_course_academic_year_range
  before insert or update of batch_id, semester_id
  on public.batch_courses
  for each row execute function public.validate_batch_course_academic_year_range();

create or replace function public.is_final_year_batch(p_batch_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when b.programme_end_academic_year_id is not null
      then coalesce(end_year.end_date <= current_date, false)
    when b.programme_id is null or b.year_of_study is null
      then false
    else coalesce(
      b.year_of_study >= ceil(
        public.effective_programme_duration_years(b.programme_id, b.department_id)
      )::integer,
      false
    )
  end
  from public.batches b
  left join public.academic_years end_year
    on end_year.id = b.programme_end_academic_year_id
  where b.id = p_batch_id;
$$;

create or replace function public.mark_student_programme_completed(
  p_student_id uuid,
  p_result public.programme_completion_result default 'pass',
  p_notes text default null
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students;
  v_batch public.batches;
  v_prog_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may mark programme completion.';
  end if;

  select * into v_student
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'Student not found.';
  end if;

  if v_student.programme_status = 'completed' then
    raise exception 'This student has already completed their current programme.';
  end if;

  if v_student.batch_id is null then
    raise exception 'Student has no batch. Assign a batch before marking completion.';
  end if;

  select * into v_batch from public.batches where id = v_student.batch_id;
  if v_batch.programme_id is null then
    raise exception 'The student''s batch has no programme. Set programme on the batch first.';
  end if;

  if not coalesce(public.is_final_year_batch(v_student.batch_id), false) then
    raise exception 'The programme end academic year has not finished yet.';
  end if;

  v_prog_id := coalesce(v_student.programme_id, v_batch.programme_id);

  insert into public.student_programme_completions (
    student_id, programme_id, batch_id, academic_year_id,
    year_of_study, result, completed_by, notes
  ) values (
    p_student_id,
    v_prog_id,
    v_student.batch_id,
    v_batch.academic_year_id,
    v_batch.year_of_study,
    p_result,
    auth.uid(),
    p_notes
  );

  update public.students
  set programme_status = 'completed',
      programme_completed_at = now(),
      programme_completion_result = p_result,
      programme_id = v_prog_id,
      updated_at = now()
  where id = p_student_id
  returning * into v_student;

  return v_student;
end;
$$;

create or replace function public.mark_batch_programme_completed(
  p_batch_id uuid,
  p_result public.programme_completion_result default 'pass',
  p_notes text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.batches;
  v_count integer := 0;
  r record;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may mark batch programme completion.';
  end if;

  select * into v_batch from public.batches where id = p_batch_id;
  if not found then
    raise exception 'Batch not found.';
  end if;

  if v_batch.programme_id is null then
    raise exception 'This batch has no programme. Assign a programme first.';
  end if;

  if v_batch.programme_end_academic_year_id is null and v_batch.year_of_study is null then
    raise exception 'This batch has no programme end year.';
  end if;

  if not coalesce(public.is_final_year_batch(p_batch_id), false) then
    raise exception 'The programme end academic year has not finished yet.';
  end if;

  for r in
    select id
    from public.students
    where batch_id = p_batch_id
      and programme_status = 'active'
      and is_active = true
  loop
    perform public.mark_student_programme_completed(r.id, p_result, p_notes);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.get_batch_programme_info(p_batch_id uuid)
returns table (
  batch_id uuid,
  programme_id uuid,
  programme_code text,
  programme_name text,
  duration_years numeric,
  year_of_study integer,
  is_final_year boolean,
  academic_year_name text,
  active_students integer,
  completed_students integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    b.id as batch_id,
    p.id as programme_id,
    p.code as programme_code,
    p.name as programme_name,
    public.effective_programme_duration_years(b.programme_id, b.department_id) as duration_years,
    b.year_of_study,
    public.is_final_year_batch(b.id) as is_final_year,
    case
      when end_year.name is not null then start_year.name || ' – ' || end_year.name
      else start_year.name
    end as academic_year_name,
    (select count(*)::integer from public.students s
      where s.batch_id = b.id and s.programme_status = 'active' and s.is_active) as active_students,
    (select count(*)::integer from public.students s
      where s.batch_id = b.id and s.programme_status = 'completed') as completed_students
  from public.batches b
  left join public.programmes p on p.id = b.programme_id
  left join public.academic_years start_year on start_year.id = b.academic_year_id
  left join public.academic_years end_year on end_year.id = b.programme_end_academic_year_id
  where b.id = p_batch_id;
$$;
