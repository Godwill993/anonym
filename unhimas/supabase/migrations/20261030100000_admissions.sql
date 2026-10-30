-- ============================================================
-- UNHIMAS Online Admissions / Pre-registration
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'admission_status') then
    create type public.admission_status as enum (
      'submitted',
      'under_review',
      'accepted',
      'rejected',
      'waitlisted',
      'withdrawn'
    );
  end if;
end$$;

create table if not exists public.admission_applications (
  id                uuid primary key default gen_random_uuid(),
  application_number text not null unique,
  status            public.admission_status not null default 'submitted',
  -- Applicant identity
  first_name        text not null,
  middle_name       text,
  last_name         text not null,
  email             text not null,
  phone             text,
  date_of_birth     date,
  gender            text,
  nationality       text default 'Cameroonian',
  -- Academic preference
  department_id     uuid references public.departments(id) on delete set null,
  preferred_level   text, -- e.g. Level 1, BSc Year 1
  academic_year_id  uuid references public.academic_years(id) on delete set null,
  -- Background
  previous_school   text,
  previous_qualification text,
  -- Review
  admin_notes       text,
  reviewed_by       uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,
  student_id        uuid references public.students(id) on delete set null, -- linked after accept
  submitted_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_admission_status on public.admission_applications(status);
create index if not exists idx_admission_email on public.admission_applications(email);
create index if not exists idx_admission_dept on public.admission_applications(department_id);

create sequence if not exists public.admission_number_seq start 1000;

create or replace function public.generate_application_number()
returns text
language plpgsql
as $$
begin
  return 'APP-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.admission_number_seq')::text, 5, '0');
end;
$$;

drop trigger if exists trg_admission_updated on public.admission_applications;
create trigger trg_admission_updated
  before update on public.admission_applications
  for each row execute function public.set_updated_at();

alter table public.admission_applications enable row level security;

-- Anyone (incl. anon) can submit an application
drop policy if exists admission_insert_public on public.admission_applications;
create policy admission_insert_public on public.admission_applications
  for insert to anon, authenticated
  with check (status = 'submitted');

-- Public can read own application by application_number + email (via RPC preferred)
-- Admins full access
drop policy if exists admission_admin_all on public.admission_applications;
create policy admission_admin_all on public.admission_applications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Authenticated non-admin: no list (admin only for now)
grant select, insert, update on public.admission_applications to authenticated;
grant insert on public.admission_applications to anon;
grant usage, select on sequence public.admission_number_seq to anon, authenticated;
grant execute on function public.generate_application_number() to anon, authenticated;
