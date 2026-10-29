-- Attendance submission workflow (mirror marks: draft → submitted → approved/returned)
-- Session-level status so lecturer marks locally, then submits for admin approval.

do $$ begin
  create type public.attendance_submission_status as enum ('draft','submitted','returned','approved');
exception when duplicate_object then null;
end $$;

alter table public.class_sessions
  add column if not exists attendance_status public.attendance_submission_status not null default 'draft';

alter table public.class_sessions
  add column if not exists attendance_submitted_at timestamptz;

alter table public.class_sessions
  add column if not exists attendance_reviewed_at timestamptz;

alter table public.class_sessions
  add column if not exists attendance_reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.class_sessions
  add column if not exists attendance_admin_comment text;

create index if not exists class_sessions_attendance_status_idx
  on public.class_sessions(attendance_status);

comment on column public.class_sessions.attendance_status is
  'Lecturer marks attendance while draft/returned; submit for admin approve or return.';
