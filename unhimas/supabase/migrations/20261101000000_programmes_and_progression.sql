-- ============================================================
-- UNHIMAS Programmes (Cameroon HND / B.Tech / M.Tech / B.Sc / M.Sc)
-- HND: 2 years default; 3 years for Biomedical department
-- Pass HND → B.Tech (1 yr) → M.Tech (2 yr)
-- Fail / exit HND → B.Sc → M.Sc
-- Safe to re-run.
-- ============================================================

-- Award / track enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'programme_award') then
    create type public.programme_award as enum (
      'HND',
      'BTECH',
      'MTECH',
      'BSC',
      'MSC'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'programme_track') then
    create type public.programme_track as enum (
      'technology',
      'science'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'progression_condition') then
    create type public.progression_condition as enum (
      'pass',
      'fail_or_exit'
    );
  end if;
end$$;

-- Programmes catalogue
create table if not exists public.programmes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null,
  award             public.programme_award not null,
  track             public.programme_track not null,
  duration_years    numeric(3,1) not null check (duration_years > 0),
  description       text,
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_programmes_award on public.programmes(award);
create index if not exists idx_programmes_active on public.programmes(is_active);

-- Department-level HND duration override (Biomedical = 3)
alter table public.departments
  add column if not exists is_biomedical boolean not null default false;

alter table public.departments
  add column if not exists hnd_duration_years integer
    check (hnd_duration_years is null or hnd_duration_years between 1 and 6);

-- Batches linked to a programme + year of study within that programme
alter table public.batches
  add column if not exists programme_id uuid references public.programmes(id) on delete set null;

alter table public.batches
  add column if not exists year_of_study integer
    check (year_of_study is null or year_of_study between 1 and 6);

create index if not exists idx_batches_programme on public.batches(programme_id);

-- Students: optional direct programme (usually derived from batch)
alter table public.students
  add column if not exists programme_id uuid references public.programmes(id) on delete set null;

create index if not exists idx_students_programme on public.students(programme_id);

-- Admissions: preferred programme
alter table public.admission_applications
  add column if not exists programme_id uuid references public.programmes(id) on delete set null;

create index if not exists idx_admission_programme on public.admission_applications(programme_id);

-- Formal progression paths
create table if not exists public.programme_progressions (
  id                  uuid primary key default gen_random_uuid(),
  from_programme_id   uuid not null references public.programmes(id) on delete cascade,
  to_programme_id     uuid not null references public.programmes(id) on delete cascade,
  condition           public.progression_condition not null,
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (from_programme_id, to_programme_id, condition)
);

-- updated_at trigger for programmes
drop trigger if exists trg_programmes_updated on public.programmes;
create trigger trg_programmes_updated
  before update on public.programmes
  for each row execute function public.set_updated_at();

-- Seed core programmes (idempotent)
insert into public.programmes (code, name, award, track, duration_years, description, sort_order)
values
  ('HND',   'Higher National Diploma',           'HND',   'technology', 2.0,
   'Two-year HND for most departments; three years for Biomedical.', 10),
  ('BTECH', 'Bachelor of Technology',            'BTECH', 'technology', 1.0,
   'One-year top-up after successful completion of HND.', 20),
  ('MTECH', 'Masters of Technology',             'MTECH', 'technology', 2.0,
   'Two-year masters on the technology track after B.Tech.', 30),
  ('BSC',   'Bachelor of Science',               'BSC',   'science',    3.0,
   'Science-track bachelor; available after unsuccessful / exit from HND or as direct entry.', 40),
  ('MSC',   'Masters of Science',                'MSC',   'science',    2.0,
   'Two-year masters on the science track after B.Sc.', 50)
on conflict (code) do update set
  name = excluded.name,
  award = excluded.award,
  track = excluded.track,
  duration_years = excluded.duration_years,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Seed progression rules
insert into public.programme_progressions (from_programme_id, to_programme_id, condition, notes)
select f.id, t.id, 'pass'::public.progression_condition,
       'Successful HND graduates proceed to one-year Bachelor of Technology.'
from public.programmes f, public.programmes t
where f.code = 'HND' and t.code = 'BTECH'
on conflict (from_programme_id, to_programme_id, condition) do nothing;

insert into public.programme_progressions (from_programme_id, to_programme_id, condition, notes)
select f.id, t.id, 'pass'::public.progression_condition,
       'B.Tech graduates may proceed to Masters of Technology.'
from public.programmes f, public.programmes t
where f.code = 'BTECH' and t.code = 'MTECH'
on conflict (from_programme_id, to_programme_id, condition) do nothing;

insert into public.programme_progressions (from_programme_id, to_programme_id, condition, notes)
select f.id, t.id, 'fail_or_exit'::public.progression_condition,
       'Students who fail or exit HND may continue on the Bachelor of Science path.'
from public.programmes f, public.programmes t
where f.code = 'HND' and t.code = 'BSC'
on conflict (from_programme_id, to_programme_id, condition) do nothing;

insert into public.programme_progressions (from_programme_id, to_programme_id, condition, notes)
select f.id, t.id, 'pass'::public.progression_condition,
       'B.Sc graduates may proceed to Masters of Science.'
from public.programmes f, public.programmes t
where f.code = 'BSC' and t.code = 'MSC'
on conflict (from_programme_id, to_programme_id, condition) do nothing;

-- Mark Biomedical departments (by name / abbreviation) if present
update public.departments
set is_biomedical = true,
    hnd_duration_years = 3
where is_biomedical = false
  and (
    lower(name) like '%biomed%'
    or lower(coalesce(abbreviation, '')) like '%biomed%'
    or lower(name) like '%bio-med%'
  );

-- Effective HND duration for a department (3 if biomedical / override, else programme default)
create or replace function public.effective_hnd_duration_years(p_department_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select d.hnd_duration_years
       from public.departments d
      where d.id = p_department_id
        and d.hnd_duration_years is not null),
    case
      when exists (
        select 1 from public.departments d
        where d.id = p_department_id and d.is_biomedical = true
      ) then 3
      else coalesce(
        (select duration_years from public.programmes where code = 'HND' and is_active limit 1),
        2
      )
    end
  );
$$;

grant execute on function public.effective_hnd_duration_years(uuid) to authenticated, anon;

-- Duration helper for any programme + department (HND uses department override)
create or replace function public.effective_programme_duration_years(
  p_programme_id uuid,
  p_department_id uuid default null
)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when p.code = 'HND' and p_department_id is not null
      then public.effective_hnd_duration_years(p_department_id)
    else p.duration_years
  end
  from public.programmes p
  where p.id = p_programme_id;
$$;

grant execute on function public.effective_programme_duration_years(uuid, uuid) to authenticated, anon;

-- Keep student.programme_id in sync when batch changes
create or replace function public.sync_student_programme_from_batch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prog uuid;
begin
  if new.batch_id is not null then
    select programme_id into v_prog from public.batches where id = new.batch_id;
    new.programme_id := v_prog;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_student_sync_programme on public.students;
create trigger trg_student_sync_programme
  before insert or update of batch_id on public.students
  for each row execute function public.sync_student_programme_from_batch();

-- RLS
alter table public.programmes enable row level security;
alter table public.programme_progressions enable row level security;

drop policy if exists programmes_select_all on public.programmes;
create policy programmes_select_all on public.programmes
  for select to anon, authenticated
  using (true);

drop policy if exists programmes_admin_write on public.programmes;
create policy programmes_admin_write on public.programmes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists progressions_select_all on public.programme_progressions;
create policy progressions_select_all on public.programme_progressions
  for select to anon, authenticated
  using (true);

drop policy if exists progressions_admin_write on public.programme_progressions;
create policy progressions_admin_write on public.programme_progressions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.programmes to anon, authenticated;
grant select, insert, update, delete on public.programmes to authenticated;
grant select on public.programme_progressions to anon, authenticated;
grant select, insert, update, delete on public.programme_progressions to authenticated;
