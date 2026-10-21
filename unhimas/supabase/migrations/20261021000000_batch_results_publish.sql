-- ============================================================
-- Batch-level results publishing (2026-10-21)
-- Results for a batch+semester become visible to students only
-- after every assigned course has marks submitted AND approved.
-- ============================================================

-- 1. Readiness report for one batch + semester
create or replace function public.get_batch_results_readiness(
  p_batch_id uuid,
  p_semester_id uuid
)
returns table (
  batch_course_id uuid,
  course_id uuid,
  course_code text,
  course_name text,
  credit_units numeric,
  lecturer_id uuid,
  lecturer_name text,
  submission_id uuid,
  submission_status public.submission_status,
  is_ready boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bc.id as batch_course_id,
    c.id as course_id,
    c.code as course_code,
    c.name as course_name,
    c.credit_units,
    bc.lecturer_id,
    case
      when l.id is null then null
      else trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, ''))
    end as lecturer_name,
    ms.id as submission_id,
    ms.status as submission_status,
    (ms.status is not null and ms.status in ('approved', 'published')) as is_ready
  from public.batch_courses bc
  join public.courses c on c.id = bc.course_id
  left join public.lecturers l on l.id = bc.lecturer_id
  left join public.mark_submissions ms on ms.batch_course_id = bc.id
  where bc.batch_id = p_batch_id
    and bc.semester_id = p_semester_id
  order by c.code;
$$;

revoke all on function public.get_batch_results_readiness(uuid, uuid)
  from public, anon;
grant execute on function public.get_batch_results_readiness(uuid, uuid)
  to authenticated;

-- 2. Overview: every batch+semester that has at least one course
create or replace function public.list_batch_semester_readiness()
returns table (
  batch_id uuid,
  batch_name text,
  batch_code text,
  department_name text,
  semester_id uuid,
  semester_name text,
  academic_year text,
  total_courses integer,
  ready_courses integer,
  published_courses integer,
  pending_courses integer,
  can_publish boolean,
  all_published boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with course_status as (
    select
      bc.batch_id,
      bc.semester_id,
      bc.id as batch_course_id,
      ms.status
    from public.batch_courses bc
    left join public.mark_submissions ms on ms.batch_course_id = bc.id
  ),
  agg as (
    select
      batch_id,
      semester_id,
      count(*)::integer as total_courses,
      count(*) filter (where status in ('approved', 'published'))::integer as ready_courses,
      count(*) filter (where status = 'published')::integer as published_courses,
      count(*) filter (
        where status is null or status not in ('approved', 'published')
      )::integer as pending_courses
    from course_status
    group by batch_id, semester_id
  )
  select
    a.batch_id,
    b.name as batch_name,
    b.code as batch_code,
    d.name as department_name,
    a.semester_id,
    sem.name as semester_name,
    ay.name as academic_year,
    a.total_courses,
    a.ready_courses,
    a.published_courses,
    a.pending_courses,
    (a.total_courses > 0
      and a.pending_courses = 0
      and a.published_courses < a.total_courses) as can_publish,
    (a.total_courses > 0 and a.published_courses = a.total_courses) as all_published
  from agg a
  join public.batches b on b.id = a.batch_id
  join public.departments d on d.id = b.department_id
  join public.semesters sem on sem.id = a.semester_id
  join public.academic_years ay on ay.id = sem.academic_year_id
  where a.total_courses > 0
  order by ay.name desc, sem.number, b.name;
$$;

revoke all on function public.list_batch_semester_readiness()
  from public, anon;
grant execute on function public.list_batch_semester_readiness()
  to authenticated;

-- 3. Publish every approved submission for a batch + semester
create or replace function public.publish_batch_results(
  p_batch_id uuid,
  p_semester_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_ready integer;
  v_published integer := 0;
  v_batch_name text;
  v_sem_name text;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may publish batch results.';
  end if;

  select b.name, sem.name
    into v_batch_name, v_sem_name
  from public.batches b
  cross join public.semesters sem
  where b.id = p_batch_id
    and sem.id = p_semester_id;

  if v_batch_name is null or v_sem_name is null then
    raise exception 'Batch or semester not found.';
  end if;

  select count(*)::integer,
         count(*) filter (
           where ms.status in ('approved', 'published')
         )::integer
    into v_total, v_ready
  from public.batch_courses bc
  left join public.mark_submissions ms on ms.batch_course_id = bc.id
  where bc.batch_id = p_batch_id
    and bc.semester_id = p_semester_id;

  if v_total = 0 then
    raise exception 'No courses are assigned to this batch for the selected semester.';
  end if;

  if v_ready < v_total then
    raise exception
      'Cannot publish results for % (%) — % of % courses still lack approved marks. All lecturers must submit and all marksheets must be approved first.',
      v_batch_name, v_sem_name, (v_total - v_ready), v_total;
  end if;

  update public.mark_submissions ms
     set status = 'published',
         published_at = coalesce(ms.published_at, now()),
         admin_comment = coalesce(ms.admin_comment, 'Published with full batch results'),
         reviewed_at = coalesce(ms.reviewed_at, now()),
         reviewed_by = coalesce(ms.reviewed_by, auth.uid()),
         updated_at = now()
    from public.batch_courses bc
   where ms.batch_course_id = bc.id
     and bc.batch_id = p_batch_id
     and bc.semester_id = p_semester_id
     and ms.status = 'approved';

  get diagnostics v_published = row_count;

  -- Audit-friendly notification context is handled by notify_mark_submission trigger
  return v_published;
end;
$$;

revoke all on function public.publish_batch_results(uuid, uuid)
  from public, anon;
grant execute on function public.publish_batch_results(uuid, uuid)
  to authenticated;

-- 4. Harden single-course publish: same batch+semester must be fully ready
create or replace function public.guard_submission_workflow()
returns trigger
language plpgsql
as $$
declare
  v_batch_id uuid;
  v_semester_id uuid;
  v_total integer;
  v_ready integer;
begin
  if old.status = 'published' and new.status <> 'published' and not public.is_admin() then
    raise exception 'Published submissions can only be changed by an administrator';
  end if;

  if new.status = 'submitted' and old.status not in ('draft','returned') then
    raise exception 'Only draft or returned submissions can be submitted';
  end if;

  if new.status = 'approved' and old.status <> 'submitted' then
    raise exception 'Only submitted marks can be approved';
  end if;

  if new.status = 'published' and old.status <> 'approved' then
    raise exception 'Only approved marks can be published';
  end if;

  if new.status = 'returned' and old.status <> 'submitted' then
    raise exception 'Only submitted marks can be returned';
  end if;

  -- Batch completeness gate for any path into 'published'
  if new.status = 'published' and old.status is distinct from 'published' then
    select bc.batch_id, bc.semester_id
      into v_batch_id, v_semester_id
    from public.batch_courses bc
    where bc.id = new.batch_course_id;

    select count(*)::integer,
           count(*) filter (
             where coalesce(ms.status, 'draft') in ('approved', 'published')
                or ms.id = new.id  -- this row is becoming published
           )::integer
      into v_total, v_ready
    from public.batch_courses bc
    left join public.mark_submissions ms on ms.batch_course_id = bc.id
    where bc.batch_id = v_batch_id
      and bc.semester_id = v_semester_id;

    -- Treat the current transition as ready
    if old.status <> 'approved' then
      -- already blocked above; keep logic clear
      null;
    end if;

    -- Recompute readiness counting this submission as approved/published
    select count(*)::integer,
           count(*) filter (
             where (
               case
                 when bc.id = new.batch_course_id then 'published'
                 else coalesce(ms.status::text, 'draft')
               end
             ) in ('approved', 'published')
           )::integer
      into v_total, v_ready
    from public.batch_courses bc
    left join public.mark_submissions ms on ms.batch_course_id = bc.id
    where bc.batch_id = v_batch_id
      and bc.semester_id = v_semester_id;

    if v_ready < v_total then
      raise exception
        'Cannot publish a single course until every course in this batch and semester has approved marks (% of % ready). Use Publish batch results instead.',
        v_ready, v_total;
    end if;
  end if;

  if new.status = 'submitted' and old.status in ('draft','returned') then
    new.submitted_at := now();
  end if;

  if new.status in ('approved','returned') and old.status = 'submitted' then
    new.reviewed_at := now();
    new.reviewed_by := auth.uid();
  end if;

  if new.status = 'published' and old.status = 'approved' then
    new.published_at := now();
  end if;

  return new;
end;
$$;
