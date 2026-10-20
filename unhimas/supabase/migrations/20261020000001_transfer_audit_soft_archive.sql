-- ============================================================
-- UNHIMAS: transfer audit + soft-archive for students with marks
-- Safe to re-run. Builds on 20261020000000_schema_improvements.
-- ============================================================

-- 1. Harden transfer_student: explicit audit_log row for the transfer event
create or replace function public.transfer_student(
  p_student_id uuid,
  p_to_batch_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_batch uuid;
  v_transfer_id uuid;
  v_matricule text;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may transfer students.';
  end if;

  select batch_id, matricule into v_from_batch, v_matricule
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'Student not found.';
  end if;

  if v_from_batch = p_to_batch_id then
    raise exception 'Student is already in the target batch.';
  end if;

  if not exists (select 1 from public.batches where id = p_to_batch_id and is_active = true) then
    raise exception 'Target batch does not exist or is inactive.';
  end if;

  update public.students
     set batch_id = p_to_batch_id,
         updated_at = now()
   where id = p_student_id;

  insert into public.student_transfers (
    student_id, from_batch_id, to_batch_id, reason, transferred_by
  ) values (
    p_student_id, v_from_batch, p_to_batch_id, p_reason, auth.uid()
  )
  returning id into v_transfer_id;

  -- Explicit audit entry for the transfer (in addition to students UPDATE trigger)
  insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    'TRANSFER',
    'student_transfers',
    v_transfer_id,
    jsonb_build_object(
      'student_id', p_student_id,
      'matricule', v_matricule,
      'from_batch_id', v_from_batch
    ),
    jsonb_build_object(
      'student_id', p_student_id,
      'matricule', v_matricule,
      'to_batch_id', p_to_batch_id,
      'reason', p_reason
    )
  );

  return v_transfer_id;
end;
$$;

revoke all on function public.transfer_student(uuid, uuid, text)
  from public, anon;
grant execute on function public.transfer_student(uuid, uuid, text)
  to authenticated;

-- 2. Soft-archive student (preserves marks / historical data)
create or replace function public.archive_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_matricule text;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may archive students.';
  end if;

  select profile_id, matricule into v_profile_id, v_matricule
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'Student not found.';
  end if;

  update public.students
     set is_active = false,
         updated_at = now()
   where id = p_student_id;

  if v_profile_id is not null then
    update public.profiles
       set is_active = false
     where id = v_profile_id;
  end if;

  insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    'ARCHIVE',
    'students',
    p_student_id,
    jsonb_build_object('matricule', v_matricule, 'is_active', true),
    jsonb_build_object('matricule', v_matricule, 'is_active', false)
  );
end;
$$;

revoke all on function public.archive_student(uuid)
  from public, anon;
grant execute on function public.archive_student(uuid)
  to authenticated;

-- 3. Block hard-delete when the student has marks (protect transcripts)
create or replace function public.delete_school_account(
  p_record_type text,
  p_record_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_deleted_count integer;
  v_marks_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only an active administrator may delete a school account.';
  end if;

  if p_record_type = 'student' then
    select profile_id into v_profile_id
      from public.students
     where id = p_record_id
     for update;

    if not found then
      raise exception 'Student record not found.';
    end if;

    select count(*) into v_marks_count
      from public.marks
     where student_id = p_record_id;

    if v_marks_count > 0 then
      raise exception
        'This student has % mark record(s). Hard delete would erase historical grades. Use archive_student instead to deactivate while preserving transcripts.',
        v_marks_count;
    end if;

    delete from public.students where id = p_record_id;

  elsif p_record_type = 'lecturer' then
    select profile_id into v_profile_id
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

-- 4. Helper: does this student have any marks? (for UI decisions)
create or replace function public.student_has_marks(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.marks where student_id = p_student_id);
$$;

revoke all on function public.student_has_marks(uuid) from public, anon;
grant execute on function public.student_has_marks(uuid) to authenticated;
