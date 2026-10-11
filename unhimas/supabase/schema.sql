-- UNHIMAS SCHOOL MANAGEMENT SYSTEM
-- Supabase / PostgreSQL
-- Run on a FRESH Supabase project.
-- Do NOT put the Supabase service-role key in the frontend.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. ENUMS
-- ============================================================

do $$ begin
  create type public.user_role as enum ('admin','frontdesk','lecturer','student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('present','absent','late','excused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.submission_status as enum ('draft','submitted','returned','approved','published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.shift_status as enum ('open','closed','corrected');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 2. SETTINGS
-- ============================================================
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  school_name text not null default 'UNHIMAS',
  school_abbreviation text not null default 'UNH',
  attendance_max numeric(5,2) not null default 5,
  coursework_max numeric(5,2) not null default 25,
  exam_max numeric(5,2) not null default 70,
  attendance_threshold numeric(5,2) not null default 75,
  timezone text not null default 'Africa/Douala',
  updated_at timestamptz not null default now(),
  constraint settings_marks_total_ck check (attendance_max >= 0 and coursework_max >= 0 and exam_max >= 0),
  constraint settings_attendance_threshold_ck check (attendance_threshold between 0 and 100)
);

insert into public.settings (id)
select gen_random_uuid()
where not exists (select 1 from public.settings);

-- ============================================================
-- 3. PROFILES / AUTH ROLES
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  login_id text unique,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_login_id_idx on public.profiles(login_id);

-- ============================================================
-- 4. ACADEMIC STRUCTURE
-- ============================================================
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint academic_year_dates_ck check (end_date > start_date)
);

create unique index if not exists academic_year_one_current_idx
on public.academic_years(is_current) where is_current = true;

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  number smallint not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique(academic_year_id, number),
  unique(academic_year_id, name),
  constraint semester_number_ck check (number in (1,2)),
  constraint semester_dates_ck check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  abbreviation text not null unique,
  code text unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  name text not null,
  level_name text,
  batch_number text not null,
  code text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(department_id, academic_year_id, batch_number)
);

create index if not exists batches_department_idx on public.batches(department_id);
create index if not exists batches_year_idx on public.batches(academic_year_id);

-- ============================================================
-- 5. PEOPLE
-- ============================================================
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  matricule text not null unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  email text,
  phone text,
  batch_id uuid not null references public.batches(id) on delete restrict,
  admission_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_batch_idx on public.students(batch_id);
create index if not exists students_profile_idx on public.students(profile_id);

create table if not exists public.lecturers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  staff_id text not null unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  email text,
  phone text,
  department_id uuid references public.departments(id) on delete set null,
  specialization text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lecturers_department_idx on public.lecturers(department_id);
create index if not exists lecturers_profile_idx on public.lecturers(profile_id);

create table if not exists public.student_transfers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  from_batch_id uuid references public.batches(id) on delete set null,
  to_batch_id uuid not null references public.batches(id) on delete restrict,
  reason text,
  transferred_at timestamptz not null default now(),
  transferred_by uuid references public.profiles(id) on delete set null
);

-- ============================================================
-- 6. COURSES AND BATCH COURSE ASSIGNMENT
-- ============================================================
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  code text not null unique,
  name text not null,
  credit_units numeric(4,2) not null default 3,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_credit_ck check (credit_units > 0)
);

create index if not exists courses_department_idx on public.courses(department_id);

create table if not exists public.batch_courses (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  lecturer_id uuid references public.lecturers(id) on delete set null,
  is_compulsory boolean not null default true,
  created_at timestamptz not null default now(),
  unique(batch_id, course_id, semester_id)
);

create index if not exists batch_courses_batch_idx on public.batch_courses(batch_id);
create index if not exists batch_courses_course_idx on public.batch_courses(course_id);
create index if not exists batch_courses_lecturer_idx on public.batch_courses(lecturer_id);

-- ============================================================
-- 7. LECTURER CLOCK-IN / CLOCK-OUT
-- ============================================================
create table if not exists public.lecturer_shifts (
  id uuid primary key default gen_random_uuid(),
  lecturer_id uuid not null references public.lecturers(id) on delete restrict,
  clock_in timestamptz not null,
  clock_out timestamptz,
  status public.shift_status not null default 'open',
  clock_in_by uuid references public.profiles(id) on delete set null,
  clock_out_by uuid references public.profiles(id) on delete set null,
  correction_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_times_ck check (clock_out is null or clock_out >= clock_in)
);

create unique index if not exists lecturer_one_open_shift_idx
on public.lecturer_shifts(lecturer_id) where clock_out is null;

create index if not exists lecturer_shifts_lecturer_idx on public.lecturer_shifts(lecturer_id);
create index if not exists lecturer_shifts_clock_in_idx on public.lecturer_shifts(clock_in);

-- ============================================================
-- 8. CLASS SESSIONS AND ATTENDANCE
-- ============================================================
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  batch_course_id uuid not null references public.batch_courses(id) on delete cascade,
  lecturer_id uuid not null references public.lecturers(id) on delete restrict,
  room text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  actual_start timestamptz,
  actual_end timestamptz,
  topic text,
  notes text,
  created_at timestamptz not null default now(),
  constraint session_time_ck check (scheduled_end > scheduled_start),
  constraint session_actual_time_ck check (actual_end is null or actual_start is null or actual_end >= actual_start)
);

create index if not exists class_sessions_batch_course_idx on public.class_sessions(batch_course_id);
create index if not exists class_sessions_lecturer_idx on public.class_sessions(lecturer_id);
create index if not exists class_sessions_start_idx on public.class_sessions(scheduled_start);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.attendance_status not null default 'absent',
  marked_at timestamptz,
  marked_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, student_id)
);

create index if not exists attendance_student_idx on public.attendance(student_id);
create index if not exists attendance_session_idx on public.attendance(session_id);

-- ============================================================
-- 9. MARKS WORKFLOW
-- ============================================================
create table if not exists public.mark_submissions (
  id uuid primary key default gen_random_uuid(),
  batch_course_id uuid not null unique references public.batch_courses(id) on delete cascade,
  lecturer_id uuid not null references public.lecturers(id) on delete restrict,
  status public.submission_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  admin_comment text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mark_submissions_status_idx on public.mark_submissions(status);
create index if not exists mark_submissions_lecturer_idx on public.mark_submissions(lecturer_id);

create table if not exists public.marks (
  id uuid primary key default gen_random_uuid(),
  mark_submission_id uuid not null references public.mark_submissions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_score numeric(6,2) not null default 0,
  coursework_score numeric(6,2) not null default 0,
  exam_score numeric(6,2) not null default 0,
  total_score numeric(6,2) generated always as (attendance_score + coursework_score + exam_score) stored,
  grade text,
  grade_point numeric(4,2),
  lecturer_comment text,
  updated_at timestamptz not null default now(),
  unique(mark_submission_id, student_id),
  constraint attendance_score_nonnegative check (attendance_score >= 0),
  constraint coursework_score_nonnegative check (coursework_score >= 0),
  constraint exam_score_nonnegative check (exam_score >= 0)
);

create index if not exists marks_student_idx on public.marks(student_id);
create index if not exists marks_submission_idx on public.marks(mark_submission_id);

create table if not exists public.grading_scale (
  id uuid primary key default gen_random_uuid(),
  min_score numeric(5,2) not null,
  max_score numeric(5,2) not null,
  grade text not null,
  grade_point numeric(4,2) not null,
  remark text,
  unique(min_score, max_score),
  constraint grading_range_ck check (min_score >= 0 and max_score <= 100 and max_score >= min_score)
);

insert into public.grading_scale(min_score,max_score,grade,grade_point,remark)
select * from (values
  (80::numeric,100::numeric,'A'::text,4.00::numeric,'Excellent'::text),
  (70::numeric,79.99::numeric,'B'::text,3.00::numeric,'Very Good'::text),
  (60::numeric,69.99::numeric,'C'::text,2.00::numeric,'Good'::text),
  (50::numeric,59.99::numeric,'D'::text,1.00::numeric,'Pass'::text),
  (0::numeric,49.99::numeric,'F'::text,0.00::numeric,'Fail'::text)
) v(min_score,max_score,grade,grade_point,remark)
where not exists (select 1 from public.grading_scale);

-- ============================================================
-- 10. TIMETABLE / EVENTS
-- ============================================================
create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  batch_course_id uuid not null references public.batch_courses(id) on delete cascade,
  lecturer_id uuid not null references public.lecturers(id) on delete restrict,
  day_of_week smallint not null,
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamptz not null default now(),
  constraint timetable_day_ck check (day_of_week between 0 and 6),
  constraint timetable_time_ck check (end_time > start_time)
);

create index if not exists timetable_batch_idx on public.timetable_slots(batch_course_id);
create index if not exists timetable_lecturer_idx on public.timetable_slots(lecturer_id);

create table if not exists public.academic_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  batch_id uuid references public.batches(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint academic_event_time_ck check (end_at is null or end_at >= start_at)
);

-- ============================================================
-- 11. ANNOUNCEMENTS / RESOURCES / NOTIFICATIONS / AUDIT
-- ============================================================
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  batch_id uuid references public.batches(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  course_id uuid references public.courses(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete cascade,
  file_path text not null,
  file_name text,
  mime_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'general',
  related_table text,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications(recipient_id, is_read, created_at desc);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log(actor_id);

-- ============================================================
-- 12. HELPER FUNCTIONS
-- ============================================================
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_frontdesk_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','frontdesk'));
$$;

create or replace function public.current_lecturer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.lecturers where profile_id = auth.uid() limit 1;
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.students where profile_id = auth.uid() limit 1;
$$;

-- ============================================================
-- 13. GENERATE CODES
-- ============================================================
create or replace function public.set_department_code()
returns trigger
language plpgsql
as $$
declare
  school_abbr text;
begin
  select school_abbreviation into school_abbr from public.settings limit 1;
  if new.code is null or btrim(new.code) = '' then
    new.code := upper(coalesce(school_abbr,'UNH') || '-' || upper(new.abbreviation));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_department_code on public.departments;
create trigger trg_department_code
before insert or update of abbreviation on public.departments
for each row execute function public.set_department_code();

create or replace function public.set_batch_code()
returns trigger
language plpgsql
as $$
declare
  school_abbr text;
  dept_abbr text;
  year_suffix text;
begin
  select school_abbreviation into school_abbr from public.settings limit 1;
  select abbreviation into dept_abbr from public.departments where id = new.department_id;
  select right(name,2) into year_suffix from public.academic_years where id = new.academic_year_id;

  if new.code is null or btrim(new.code) = '' then
    new.code := upper(coalesce(school_abbr,'UNH') || '-' || coalesce(dept_abbr,'DEP') || '-' || coalesce(year_suffix,'00'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_batch_code on public.batches;
create trigger trg_batch_code
before insert or update of department_id, academic_year_id on public.batches
for each row execute function public.set_batch_code();

-- ============================================================
-- 14. GENERIC UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated before update on public.settings for each row execute function public.touch_updated_at();
drop trigger if exists trg_departments_updated on public.departments;
create trigger trg_departments_updated before update on public.departments for each row execute function public.touch_updated_at();
drop trigger if exists trg_batches_updated on public.batches;
create trigger trg_batches_updated before update on public.batches for each row execute function public.touch_updated_at();
drop trigger if exists trg_students_updated on public.students;
create trigger trg_students_updated before update on public.students for each row execute function public.touch_updated_at();
drop trigger if exists trg_lecturers_updated on public.lecturers;
create trigger trg_lecturers_updated before update on public.lecturers for each row execute function public.touch_updated_at();
drop trigger if exists trg_courses_updated on public.courses;
create trigger trg_courses_updated before update on public.courses for each row execute function public.touch_updated_at();
drop trigger if exists trg_shifts_updated on public.lecturer_shifts;
create trigger trg_shifts_updated before update on public.lecturer_shifts for each row execute function public.touch_updated_at();
drop trigger if exists trg_attendance_updated on public.attendance;
create trigger trg_attendance_updated before update on public.attendance for each row execute function public.touch_updated_at();
drop trigger if exists trg_submissions_updated on public.mark_submissions;
create trigger trg_submissions_updated before update on public.mark_submissions for each row execute function public.touch_updated_at();
drop trigger if exists trg_marks_updated on public.marks;
create trigger trg_marks_updated before update on public.marks for each row execute function public.touch_updated_at();
drop trigger if exists trg_announcements_updated on public.announcements;
create trigger trg_announcements_updated before update on public.announcements for each row execute function public.touch_updated_at();

-- ============================================================
-- 15. AUTH PROFILE AUTO-CREATION
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_name text;
  requested_login text;
begin
  -- SECURITY RULE: never trust a client-supplied role during signup.
  -- Every newly-created Auth user starts as a student. The administrator
  -- provisions lecturers, front-desk staff and administrators separately.
  requested_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  requested_login := new.raw_user_meta_data->>'login_id';

  insert into public.profiles(id, role, login_id, full_name)
  values(new.id, 'student', requested_login, requested_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- 16. CREATE MARK SUBMISSION FOR EACH BATCH COURSE
-- ============================================================
create or replace function public.create_mark_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  lid := new.lecturer_id;
  if lid is null then
    return new;
  end if;

  insert into public.mark_submissions(batch_course_id, lecturer_id)
  values(new.id, lid)
  on conflict(batch_course_id) do update set lecturer_id = excluded.lecturer_id;

  return new;
end;
$$;

drop trigger if exists trg_create_mark_submission on public.batch_courses;
create trigger trg_create_mark_submission
after insert or update of lecturer_id on public.batch_courses
for each row execute function public.create_mark_submission();

-- ============================================================
-- 17. SEED ATTENDANCE WHEN SESSION IS CREATED
-- ============================================================
create or replace function public.seed_session_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b_id uuid;
begin
  select batch_id into b_id
  from public.batch_courses
  where id = new.batch_course_id;

  insert into public.attendance(session_id, student_id)
  select new.id, s.id
  from public.students s
  where s.batch_id = b_id
    and s.is_active = true
  on conflict(session_id, student_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_seed_attendance on public.class_sessions;
create trigger trg_seed_attendance
after insert on public.class_sessions
for each row execute function public.seed_session_attendance();

-- ============================================================
-- 18. VALIDATE MARKS
-- ============================================================
create or replace function public.validate_mark_values()
returns trigger
language plpgsql
as $$
declare
  amax numeric;
  cmax numeric;
  emax numeric;
begin
  select attendance_max, coursework_max, exam_max into amax, cmax, emax
  from public.settings limit 1;

  if new.attendance_score > amax then
    raise exception 'Attendance score cannot exceed %', amax;
  end if;
  if new.coursework_score > cmax then
    raise exception 'Coursework score cannot exceed %', cmax;
  end if;
  if new.exam_score > emax then
    raise exception 'Exam score cannot exceed %', emax;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_marks on public.marks;
create trigger trg_validate_marks
before insert or update on public.marks
for each row execute function public.validate_mark_values();

-- ============================================================
-- 19. APPLY GRADE / GRADE POINT
-- ============================================================
create or replace function public.apply_grade()
returns trigger
language plpgsql
as $$
declare
  g record;
begin
  select grade, grade_point into g
  from public.grading_scale
  where new.total_score between min_score and max_score
  order by min_score desc
  limit 1;

  new.grade := g.grade;
  new.grade_point := g.grade_point;
  return new;
end;
$$;

drop trigger if exists trg_apply_grade on public.marks;
create trigger trg_apply_grade
before insert or update of attendance_score, coursework_score, exam_score on public.marks
for each row execute function public.apply_grade();

-- ============================================================
-- 20. SUBMISSION WORKFLOW GUARD
-- ============================================================
create or replace function public.guard_submission_workflow()
returns trigger
language plpgsql
as $$
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

drop trigger if exists trg_guard_submission on public.mark_submissions;
create trigger trg_guard_submission
before update on public.mark_submissions
for each row execute function public.guard_submission_workflow();

-- ============================================================
-- 21. NOTIFY LECTURER WHEN MARKS ARE RETURNED / APPROVED
-- ============================================================
create or replace function public.notify_mark_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  course_name text;
begin
  select p.id into recipient
  from public.lecturers l
  join public.profiles p on p.id = l.profile_id
  where l.id = new.lecturer_id;

  select c.name into course_name
  from public.batch_courses bc
  join public.courses c on c.id = bc.course_id
  where bc.id = new.batch_course_id;

  if recipient is not null and new.status = 'returned' and old.status <> 'returned' then
    insert into public.notifications(recipient_id,title,message,notification_type,related_table,related_id)
    values(recipient,'Marks returned','Your marks for ' || coalesce(course_name,'the course') || ' were returned for correction.','marks_returned','mark_submissions',new.id);
  elsif recipient is not null and new.status = 'approved' and old.status <> 'approved' then
    insert into public.notifications(recipient_id,title,message,notification_type,related_table,related_id)
    values(recipient,'Marks approved','Your marks for ' || coalesce(course_name,'the course') || ' were approved.','marks_approved','mark_submissions',new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_mark_submission on public.mark_submissions;
create trigger trg_notify_mark_submission
after update on public.mark_submissions
for each row execute function public.notify_mark_submission();

-- ============================================================
-- 22. TIMETABLE CLASH DETECTION
-- ============================================================
create or replace function public.prevent_timetable_clash()
returns trigger
language plpgsql
as $$
declare
  conflict_count integer;
  batch_id_a uuid;
  batch_id_b uuid;
begin
  select batch_id into batch_id_a from public.batch_courses where id = new.batch_course_id;

  select count(*) into conflict_count
  from public.timetable_slots t
  join public.batch_courses bc on bc.id = t.batch_course_id
  where t.id <> new.id
    and t.day_of_week = new.day_of_week
    and t.start_time < new.end_time
    and new.start_time < t.end_time
    and (t.lecturer_id = new.lecturer_id or bc.batch_id = batch_id_a)
    and (
      t.lecturer_id = new.lecturer_id
      or bc.batch_id = batch_id_a
    );

  if conflict_count > 0 then
    raise exception 'Timetable clash detected for the lecturer or batch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_timetable_clash on public.timetable_slots;
create trigger trg_prevent_timetable_clash
before insert or update on public.timetable_slots
for each row execute function public.prevent_timetable_clash();

-- ============================================================
-- 23. AUDIT TRIGGER
-- ============================================================
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if tg_op = 'DELETE' then
    rid := old.id;
    insert into public.audit_log(actor_id,action,table_name,record_id,old_data)
    values(auth.uid(),tg_op,tg_table_name,rid,to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    rid := new.id;
    insert into public.audit_log(actor_id,action,table_name,record_id,old_data,new_data)
    values(auth.uid(),tg_op,tg_table_name,rid,to_jsonb(old),to_jsonb(new));
    return new;
  else
    rid := new.id;
    insert into public.audit_log(actor_id,action,table_name,record_id,new_data)
    values(auth.uid(),tg_op,tg_table_name,rid,to_jsonb(new));
    return new;
  end if;
end;
$$;

-- Audit the sensitive academic/admin tables.
drop trigger if exists trg_audit_marks on public.marks;
create trigger trg_audit_marks after insert or update or delete on public.marks for each row execute function public.write_audit_log();
drop trigger if exists trg_audit_attendance on public.attendance;
create trigger trg_audit_attendance after insert or update or delete on public.attendance for each row execute function public.write_audit_log();
drop trigger if exists trg_audit_shifts on public.lecturer_shifts;
create trigger trg_audit_shifts after insert or update or delete on public.lecturer_shifts for each row execute function public.write_audit_log();
drop trigger if exists trg_audit_submissions on public.mark_submissions;
create trigger trg_audit_submissions after insert or update or delete on public.mark_submissions for each row execute function public.write_audit_log();
drop trigger if exists trg_audit_students on public.students;
create trigger trg_audit_students after insert or update or delete on public.students for each row execute function public.write_audit_log();

-- ============================================================
-- 24. VIEWS
-- ============================================================
create or replace view public.lecturer_hours_monthly
with (security_invoker = true)
as
select
  ls.lecturer_id,
  l.staff_id,
  l.first_name,
  l.last_name,
  date_trunc('month', ls.clock_in) as month,
  round(sum(extract(epoch from (coalesce(ls.clock_out, now()) - ls.clock_in))) / 3600.0, 2) as hours_taught
from public.lecturer_shifts ls
join public.lecturers l on l.id = ls.lecturer_id
group by ls.lecturer_id,l.staff_id,l.first_name,l.last_name,date_trunc('month',ls.clock_in);

create or replace view public.attendance_summary
with (security_invoker = true)
as
select
  a.student_id,
  bc.course_id,
  count(*) as total_sessions,
  count(*) filter (where a.status in ('present','late')) as attended_sessions,
  round(
    100.0 * count(*) filter (where a.status in ('present','late')) / nullif(count(*),0),
    2
  ) as attendance_percentage
from public.attendance a
join public.class_sessions cs on cs.id = a.session_id
join public.batch_courses bc on bc.id = cs.batch_course_id
group by a.student_id, bc.course_id;

create or replace view public.results
with (security_invoker = true)
as
select
  s.id as student_id,
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
  ms.status as result_status
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

create or replace view public.student_semester_gpa
with (security_invoker = true)
as
select
  r.student_id,
  r.academic_year_id,
  r.semester_id,
  round(sum(r.grade_point * r.credit_units) / nullif(sum(r.credit_units),0), 2) as semester_gpa,
  round(sum(r.credit_units), 2) as attempted_credits
from public.results r
group by r.student_id,r.academic_year_id,r.semester_id;

create or replace view public.student_overall_gpa
with (security_invoker = true)
as
select
  r.student_id,
  round(sum(r.grade_point * r.credit_units) / nullif(sum(r.credit_units),0), 2) as overall_gpa,
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
  round(avg(r.total_score),2) as average_score,
  count(*) filter (where r.grade <> 'F') as passes,
  count(*) filter (where r.grade = 'F') as failures
from public.results r
group by r.course_id,r.course_code,r.course_name;

-- ============================================================
-- 25. PUBLIC RESULT LOOKUP RPC
-- IMPORTANT: this exposes ONLY published result rows for a supplied
-- matricule. The frontend must not query the results view anonymously.
-- ============================================================
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

revoke all on function public.public_result_lookup(text) from public;
grant execute on function public.public_result_lookup(text) to anon, authenticated;

-- ============================================================
-- 26. ENABLE RLS
-- ============================================================

alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;
alter table public.departments enable row level security;
alter table public.batches enable row level security;
alter table public.students enable row level security;
alter table public.lecturers enable row level security;
alter table public.student_transfers enable row level security;
alter table public.courses enable row level security;
alter table public.batch_courses enable row level security;
alter table public.lecturer_shifts enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.mark_submissions enable row level security;
alter table public.marks enable row level security;
alter table public.grading_scale enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.academic_events enable row level security;
alter table public.announcements enable row level security;
alter table public.resources enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- ============================================================
-- 27. DROP POLICIES SO THE SCRIPT CAN BE RE-RUN SAFELY
-- ============================================================

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'settings','profiles','academic_years','semesters','departments','batches',
        'students','lecturers','student_transfers','courses','batch_courses',
        'lecturer_shifts','class_sessions','attendance','mark_submissions','marks',
        'grading_scale','timetable_slots','academic_events','announcements','resources',
        'notifications','audit_log'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ============================================================
-- 28. RLS POLICIES: SETTINGS
-- ============================================================
create policy settings_select_authenticated on public.settings
for select to authenticated using (true);
create policy settings_admin_update on public.settings
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 29. RLS POLICIES: PROFILES
-- ============================================================
create policy profiles_select_self on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_admin_insert on public.profiles
for insert to authenticated with check (public.is_admin() or id = auth.uid());
create policy profiles_admin_update on public.profiles
for update to authenticated using (public.is_admin() or id = auth.uid()) with check (public.is_admin() or id = auth.uid());
create policy profiles_admin_delete on public.profiles
for delete to authenticated using (public.is_admin());

-- ============================================================
-- 30. RLS: ACADEMIC STRUCTURE
-- ============================================================
create policy academic_years_select on public.academic_years
for select to authenticated using (true);
create policy academic_years_admin_insert on public.academic_years
for insert to authenticated with check (public.is_admin());
create policy academic_years_admin_update on public.academic_years
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy academic_years_admin_delete on public.academic_years
for delete to authenticated using (public.is_admin());

create policy semesters_select on public.semesters
for select to authenticated using (true);
create policy semesters_admin_insert on public.semesters
for insert to authenticated with check (public.is_admin());
create policy semesters_admin_update on public.semesters
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy semesters_admin_delete on public.semesters
for delete to authenticated using (public.is_admin());

create policy departments_select on public.departments
for select to authenticated using (true);
create policy departments_admin_insert on public.departments
for insert to authenticated with check (public.is_admin());
create policy departments_admin_update on public.departments
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy departments_admin_delete on public.departments
for delete to authenticated using (public.is_admin());

create policy batches_select on public.batches
for select to authenticated using (true);
create policy batches_admin_insert on public.batches
for insert to authenticated with check (public.is_admin());
create policy batches_admin_update on public.batches
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy batches_admin_delete on public.batches
for delete to authenticated using (public.is_admin());

-- ============================================================
-- 31. RLS: STUDENTS / LECTURERS
-- ============================================================
create policy students_select_self_admin_frontdesk on public.students
for select to authenticated
using (
  public.is_admin()
  or public.is_frontdesk_or_admin()
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.batch_courses bc
    join public.lecturers l on l.id = bc.lecturer_id
    where l.profile_id = auth.uid()
      and bc.batch_id = students.batch_id
  )
);

create policy students_admin_insert on public.students
for insert to authenticated with check (public.is_admin() or public.is_frontdesk_or_admin());
create policy students_admin_update on public.students
for update to authenticated using (public.is_admin() or public.is_frontdesk_or_admin()) with check (public.is_admin() or public.is_frontdesk_or_admin());
create policy students_admin_delete on public.students
for delete to authenticated using (public.is_admin());

create policy lecturers_select_authenticated on public.lecturers
for select to authenticated using (true);
create policy lecturers_admin_insert on public.lecturers
for insert to authenticated with check (public.is_admin());
create policy lecturers_admin_update on public.lecturers
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lecturers_admin_delete on public.lecturers
for delete to authenticated using (public.is_admin());

create policy transfers_admin_select on public.student_transfers
for select to authenticated using (public.is_admin() or public.is_frontdesk_or_admin());
create policy transfers_admin_insert on public.student_transfers
for insert to authenticated with check (public.is_admin() or public.is_frontdesk_or_admin());
create policy transfers_admin_update on public.student_transfers
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 32. RLS: COURSES / BATCH COURSES
-- ============================================================
create policy courses_select_authenticated on public.courses
for select to authenticated using (true);
create policy courses_admin_insert on public.courses
for insert to authenticated with check (public.is_admin());
create policy courses_admin_update on public.courses
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy courses_admin_delete on public.courses
for delete to authenticated using (public.is_admin());

create policy batch_courses_select_authenticated on public.batch_courses
for select to authenticated using (true);
create policy batch_courses_admin_insert on public.batch_courses
for insert to authenticated with check (public.is_admin());
create policy batch_courses_admin_update on public.batch_courses
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy batch_courses_admin_delete on public.batch_courses
for delete to authenticated using (public.is_admin());

-- ============================================================
-- 33. RLS: LECTURER SHIFTS
-- ============================================================
create policy shifts_select on public.lecturer_shifts
for select to authenticated
using (public.is_frontdesk_or_admin() or lecturer_id = public.current_lecturer_id());

create policy shifts_frontdesk_insert on public.lecturer_shifts
for insert to authenticated
with check (public.is_frontdesk_or_admin());

create policy shifts_frontdesk_update on public.lecturer_shifts
for update to authenticated
using (public.is_frontdesk_or_admin())
with check (public.is_frontdesk_or_admin());

create policy shifts_admin_delete on public.lecturer_shifts
for delete to authenticated using (public.is_admin());

-- ============================================================
-- 34. RLS: CLASS SESSIONS
-- ============================================================
create policy class_sessions_select on public.class_sessions
for select to authenticated
using (
  public.is_admin()
  or public.is_frontdesk_or_admin()
  or lecturer_id = public.current_lecturer_id()
  or exists (
    select 1
    from public.batch_courses bc
    join public.students s on s.batch_id = bc.batch_id
    where bc.id = class_sessions.batch_course_id
      and s.profile_id = auth.uid()
  )
);

create policy class_sessions_admin_insert on public.class_sessions
for insert to authenticated with check (public.is_admin() or public.current_lecturer_id() = lecturer_id);
create policy class_sessions_admin_update on public.class_sessions
for update to authenticated using (public.is_admin() or lecturer_id = public.current_lecturer_id())
with check (public.is_admin() or lecturer_id = public.current_lecturer_id());
create policy class_sessions_admin_delete on public.class_sessions
for delete to authenticated using (public.is_admin());

-- ============================================================
-- 35. RLS: ATTENDANCE
-- ============================================================
create policy attendance_select on public.attendance
for select to authenticated
using (
  public.is_admin()
  or public.is_frontdesk_or_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.class_sessions cs
    where cs.id = attendance.session_id
      and cs.lecturer_id = public.current_lecturer_id()
  )
);

create policy attendance_lecturer_insert on public.attendance
for insert to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.class_sessions cs
    where cs.id = attendance.session_id
      and cs.lecturer_id = public.current_lecturer_id()
  )
);

create policy attendance_lecturer_update on public.attendance
for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.class_sessions cs
    where cs.id = attendance.session_id
      and cs.lecturer_id = public.current_lecturer_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.class_sessions cs
    where cs.id = attendance.session_id
      and cs.lecturer_id = public.current_lecturer_id()
  )
);

create policy attendance_admin_delete on public.attendance
for delete to authenticated using (public.is_admin());

-- ============================================================
-- 36. RLS: MARK SUBMISSIONS
-- ============================================================
create policy mark_submissions_select on public.mark_submissions
for select to authenticated
using (
  public.is_admin()
  or lecturer_id = public.current_lecturer_id()
  or exists (
    select 1
    from public.batch_courses bc
    join public.students s on s.batch_id = bc.batch_id
    where bc.id = mark_submissions.batch_course_id
      and s.profile_id = auth.uid()
  )
);

create policy mark_submissions_lecturer_update on public.mark_submissions
for update to authenticated
using (public.is_admin() or lecturer_id = public.current_lecturer_id())
with check (public.is_admin() or lecturer_id = public.current_lecturer_id());

-- ============================================================
-- 37. RLS: MARKS
-- ============================================================
create policy marks_select on public.marks
for select to authenticated
using (
  public.is_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.mark_submissions ms
    where ms.id = marks.mark_submission_id
      and ms.lecturer_id = public.current_lecturer_id()
  )
);

create policy marks_lecturer_insert on public.marks
for insert to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.mark_submissions ms
    where ms.id = marks.mark_submission_id
      and ms.lecturer_id = public.current_lecturer_id()
      and ms.status in ('draft','returned')
  )
);

create policy marks_lecturer_update on public.marks
for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.mark_submissions ms
    where ms.id = marks.mark_submission_id
      and ms.lecturer_id = public.current_lecturer_id()
      and ms.status in ('draft','returned')
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.mark_submissions ms
    where ms.id = marks.mark_submission_id
      and ms.lecturer_id = public.current_lecturer_id()
      and ms.status in ('draft','returned')
  )
);

create policy marks_admin_delete on public.marks
for delete to authenticated using (public.is_admin());

-- ============================================================
-- 38. RLS: GRADING / TIMETABLE / EVENTS
-- ============================================================
create policy grading_scale_select on public.grading_scale
for select to authenticated using (true);
create policy grading_scale_admin_insert on public.grading_scale
for insert to authenticated with check (public.is_admin());
create policy grading_scale_admin_update on public.grading_scale
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy grading_scale_admin_delete on public.grading_scale
for delete to authenticated using (public.is_admin());

create policy timetable_select on public.timetable_slots
for select to authenticated using (true);
create policy timetable_admin_insert on public.timetable_slots
for insert to authenticated with check (public.is_admin());
create policy timetable_admin_update on public.timetable_slots
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy timetable_admin_delete on public.timetable_slots
for delete to authenticated using (public.is_admin());

create policy events_select on public.academic_events
for select to authenticated using (true);
create policy events_admin_insert on public.academic_events
for insert to authenticated with check (public.is_admin());
create policy events_admin_update on public.academic_events
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy events_admin_delete on public.academic_events
for delete to authenticated using (public.is_admin());

-- ============================================================
-- 39. RLS: ANNOUNCEMENTS
-- ============================================================
create policy announcements_select on public.announcements
for select to authenticated
using (
  is_published = true
  or public.is_admin()
);
create policy announcements_admin_insert on public.announcements
for insert to authenticated with check (public.is_admin());
create policy announcements_admin_update on public.announcements
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy announcements_admin_delete on public.announcements
for delete to authenticated using (public.is_admin());

-- ============================================================
-- 40. RLS: RESOURCES
-- ============================================================
create policy resources_select on public.resources
for select to authenticated using (true);
create policy resources_admin_insert on public.resources
for insert to authenticated with check (public.is_admin());
create policy resources_admin_update on public.resources
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy resources_admin_delete on public.resources
for delete to authenticated using (public.is_admin());

-- ============================================================
-- 41. RLS: NOTIFICATIONS
-- ============================================================
create policy notifications_select_own on public.notifications
for select to authenticated using (recipient_id = auth.uid() or public.is_admin());
create policy notifications_update_own on public.notifications
for update to authenticated using (recipient_id = auth.uid() or public.is_admin())
with check (recipient_id = auth.uid() or public.is_admin());
create policy notifications_admin_insert on public.notifications
for insert to authenticated with check (public.is_admin() or recipient_id = auth.uid());

-- ============================================================
-- 42. RLS: AUDIT LOG
-- ============================================================
create policy audit_log_admin_select on public.audit_log
for select to authenticated using (public.is_admin());

-- No normal INSERT/UPDATE/DELETE policy is intentionally provided.
-- The SECURITY DEFINER audit trigger writes the records.

-- ============================================================
-- 43. STORAGE: PRIVATE RESOURCE BUCKET
-- ============================================================
insert into storage.buckets (id, name, public)
values ('resources','resources',false)
on conflict (id) do update set public = false;

-- Remove existing policies with these names if the script is re-run.
drop policy if exists resources_storage_select on storage.objects;
drop policy if exists resources_storage_insert on storage.objects;
drop policy if exists resources_storage_update on storage.objects;
drop policy if exists resources_storage_delete on storage.objects;

create policy resources_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'resources'
  and (
    public.is_admin()
    or exists (
      select 1 from public.resources r
      where r.file_path = storage.objects.name
    )
  )
);

create policy resources_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'resources'
  and public.is_admin()
);

create policy resources_storage_update on storage.objects
for update to authenticated
using (bucket_id = 'resources' and public.is_admin())
with check (bucket_id = 'resources' and public.is_admin());

create policy resources_storage_delete on storage.objects
for delete to authenticated
using (bucket_id = 'resources' and public.is_admin());

-- ============================================================
-- 44. GRANTS
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select on public.settings to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;

-- Views need explicit grants.
grant select on public.lecturer_hours_monthly to authenticated;
grant select on public.attendance_summary to authenticated;
grant select on public.results to authenticated;
grant select on public.student_semester_gpa to authenticated;
grant select on public.student_overall_gpa to authenticated;
grant select on public.course_performance to authenticated;

-- ============================================================
-- 45. FINAL NOTES
-- ============================================================
-- 1. Create the first admin through Supabase Auth, then set the
--    corresponding profile role to 'admin' from a trusted/admin context.
-- 2. Never expose the service-role key in React.
-- 3. RLS is enabled above on every application table.
-- 4. The public result page should call public_result_lookup(),
--    not select directly from tables anonymously.
-- 5. Attendance contributes 5/30 marks by default; coursework is
--    25/30 and exam is 70/100. Change settings if required.
-- 6. Front desk records lecturer clock-in/out; the system reports
--    hours but does not calculate salary.
-- 7. Lecturers only work with their assigned batch courses.
-- ============================================================