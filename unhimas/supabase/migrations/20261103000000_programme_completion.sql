-- ============================================================
-- Programme completion (Cameroon model)
-- HND 2 yrs (3 Biomedical) → B.Tech 1 yr → M.Tech 2 yrs
-- A batch belongs to one programme + one year_of_study + school year.
-- A student completes the programme when they finish the final year.
-- Safe to re-run.
-- ============================================================

-- Status of a student inside their current programme
do $$
begin
  if not exists (select 1 from pg_type where typname = 'programme_status') then
    create type public.programme_status as enum (
      'active',
      'completed',
      'withdrawn'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'programme_completion_result') then
    create type public.programme_completion_result as enum (
      'pass',
      'fail_or_exit'
    );
  end if;
end$$;

-- Students: explicit programme lifecycle
alter table public.students
  add column if not exists programme_status public.programme_status not null default 'active';

alter table public.students
  add column if not exists programme_completed_at timestamptz;

alter table public.students
  add column if not exists programme_completion_result public.programme_completion_result;

create index if not exists idx_students_programme_status
  on public.students(programme_status);

-- Audit history of programme completions (one row per completion event)
create table if not exists public.student_programme_completions (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  programme_id    uuid not null references public.programmes(id) on delete restrict,
  batch_id        uuid references public.batches(id) on delete set null,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  year_of_study   integer,
  result          public.programme_completion_result not null,
  completed_at    timestamptz not null default now(),
  completed_by    uuid references auth.users(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_spc_student on public.student_programme_completions(student_id);
create index if not exists idx_spc_programme on public.student_programme_completions(programme_id);

-- RLS
alter table public.student_programme_completions enable row level security;

drop policy if exists spc_select_authenticated on public.student_programme_completions;
create policy spc_select_authenticated on public.student_programme_completions
  for select to authenticated
  using (true);

drop policy if exists spc_admin_write on public.student_programme_completions;
create policy spc_admin_write on public.student_programme_completions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.student_programme_completions to authenticated;
grant select, insert, update, delete on public.student_programme_completions to authenticated;

-- Helper: is this batch the final year of its programme?
create or replace function public.is_final_year_batch(p_batch_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when b.programme_id is null or b.year_of_study is null then false
    else b.year_of_study >= ceil(
      public.effective_programme_duration_years(b.programme_id, b.department_id)
    )::integer
  end
  from public.batches b
  where b.id = p_batch_id;
$$;

grant execute on function public.is_final_year_batch(uuid) to authenticated, anon;

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

revoke all on function public.mark_student_programme_completed(uuid, public.programme_completion_result, text)
  from public, anon;
grant execute on function public.mark_student_programme_completed(uuid, public.programme_completion_result, text)
  to authenticated;

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

  if v_batch.year_of_study is null then
    raise exception 'This batch has no year of study. Set year of study first.';
  end if;

  if not public.is_final_year_batch(p_batch_id) then
    raise exception
      'This batch is year % of the programme. Only the final year can be marked completed.',
      v_batch.year_of_study;
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

revoke all on function public.mark_batch_programme_completed(uuid, public.programme_completion_result, text)
  from public, anon;
grant execute on function public.mark_batch_programme_completed(uuid, public.programme_completion_result, text)
  to authenticated;

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
    ay.name as academic_year_name,
    (select count(*)::integer from public.students s
      where s.batch_id = b.id and s.programme_status = 'active' and s.is_active) as active_students,
    (select count(*)::integer from public.students s
      where s.batch_id = b.id and s.programme_status = 'completed') as completed_students
  from public.batches b
  left join public.programmes p on p.id = b.programme_id
  left join public.academic_years ay on ay.id = b.academic_year_id
  where b.id = p_batch_id;
$$;

grant execute on function public.get_batch_programme_info(uuid) to authenticated, anon;
