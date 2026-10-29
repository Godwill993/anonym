-- Expose can_force_publish on batch readiness overview (for admin UI).

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
  can_force_publish boolean,
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
      count(*) filter (where status = 'approved')::integer as approved_only,
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
    (a.approved_only > 0 and a.pending_courses > 0) as can_force_publish,
    (a.total_courses > 0 and a.published_courses = a.total_courses) as all_published
  from agg a
  join public.batches b on b.id = a.batch_id
  join public.departments d on d.id = b.department_id
  join public.semesters sem on sem.id = a.semester_id
  join public.academic_years ay on ay.id = sem.academic_year_id
  where a.total_courses > 0
  order by ay.name desc, sem.number, b.name;
$$;

revoke all on function public.list_batch_semester_readiness() from public, anon;
grant execute on function public.list_batch_semester_readiness() to authenticated;
