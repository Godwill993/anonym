-- Allow active administrators to delete student/lecturer records together
-- with their linked Auth account, without exposing a service-role key.

create or replace function public.delete_school_account(
  p_record_type text,
  p_record_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_deleted_count integer;
begin
  if not exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and role = 'admin'
       and is_active = true
  ) then
    raise exception 'Only an active administrator may delete a school account.';
  end if;

  if p_record_type = 'student' then
    select profile_id
      into v_profile_id
      from public.students
     where id = p_record_id
     for update;

    if not found then
      raise exception 'Student record not found.';
    end if;

    delete from public.students where id = p_record_id;

  elsif p_record_type = 'lecturer' then
    select profile_id
      into v_profile_id
      from public.lecturers
     where id = p_record_id
     for update;

    if not found then
      raise exception 'Lecturer record not found.';
    end if;

    if exists (select 1 from public.lecturer_shifts where lecturer_id = p_record_id)
      or exists (select 1 from public.class_sessions where lecturer_id = p_record_id)
      or exists (select 1 from public.mark_submissions where lecturer_id = p_record_id)
      or exists (select 1 from public.timetable_slots where lecturer_id = p_record_id) then
      raise exception 'This lecturer has linked sessions, attendance shifts, mark submissions, or timetable slots. Remove or reassign those records before deleting the lecturer.';
    end if;

    delete from public.lecturers where id = p_record_id;

  else
    raise exception 'Unsupported record type. Expected student or lecturer.';
  end if;

  if v_profile_id is not null then
    delete from auth.users where id = v_profile_id;
    get diagnostics v_deleted_count = row_count;

    if v_deleted_count = 0 then
      raise exception 'The school record was deleted, but its linked Auth user was not found. The transaction has been cancelled.';
    end if;
  end if;
end;
$$;

revoke all on function public.delete_school_account(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_school_account(text, uuid)
  to authenticated;
