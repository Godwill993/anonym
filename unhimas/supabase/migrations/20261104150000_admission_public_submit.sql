-- ============================================================
-- Public admission submit via SECURITY DEFINER RPC
-- Fixes: "new row violates row-level security policy for table admission_applications"
-- Cause: anon can INSERT but has no SELECT policy, so insert().select() fails under RLS.
-- ============================================================

-- Re-assert insert policy (idempotent)
alter table public.admission_applications enable row level security;

drop policy if exists admission_insert_public on public.admission_applications;
create policy admission_insert_public on public.admission_applications
  for insert to anon, authenticated
  with check (status = 'submitted');

grant insert on public.admission_applications to anon, authenticated;
grant usage, select on sequence public.admission_number_seq to anon, authenticated;
grant execute on function public.generate_application_number() to anon, authenticated;

-- Public submit: insert + return row without requiring anon SELECT policy
create or replace function public.submit_admission_application(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  v_row public.admission_applications%rowtype;
  v_dept uuid;
  v_prog uuid;
  v_year uuid;
begin
  -- Basic required fields
  if nullif(trim(coalesce(p_payload->>'first_name', '')), '') is null
     or nullif(trim(coalesce(p_payload->>'last_name', '')), '') is null
     or nullif(trim(coalesce(p_payload->>'email', '')), '') is null then
    raise exception 'first_name, last_name and email are required';
  end if;

  begin
    v_number := public.generate_application_number();
  exception when others then
    v_number := 'APP-' || to_char(current_date, 'YYYY') || '-' || lpad((extract(epoch from now())::bigint % 100000)::text, 5, '0');
  end;

  v_dept := nullif(trim(coalesce(p_payload->>'department_id', '')), '')::uuid;
  v_prog := nullif(trim(coalesce(p_payload->>'programme_id', '')), '')::uuid;
  v_year := nullif(trim(coalesce(p_payload->>'academic_year_id', '')), '')::uuid;

  insert into public.admission_applications (
    application_number,
    status,
    first_name,
    middle_name,
    last_name,
    email,
    phone,
    date_of_birth,
    gender,
    nationality,
    department_id,
    programme_id,
    preferred_level,
    academic_year_id,
    previous_school,
    previous_qualification
  ) values (
    v_number,
    'submitted',
    trim(p_payload->>'first_name'),
    nullif(trim(coalesce(p_payload->>'middle_name', '')), ''),
    trim(p_payload->>'last_name'),
    lower(trim(p_payload->>'email')),
    nullif(trim(coalesce(p_payload->>'phone', '')), ''),
    nullif(trim(coalesce(p_payload->>'date_of_birth', '')), '')::date,
    nullif(trim(coalesce(p_payload->>'gender', '')), ''),
    coalesce(nullif(trim(coalesce(p_payload->>'nationality', '')), ''), 'Cameroonian'),
    v_dept,
    v_prog,
    nullif(trim(coalesce(p_payload->>'preferred_level', '')), ''),
    v_year,
    nullif(trim(coalesce(p_payload->>'previous_school', '')), ''),
    nullif(trim(coalesce(p_payload->>'previous_qualification', '')), '')
  )
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'application_number', v_row.application_number,
    'status', v_row.status,
    'first_name', v_row.first_name,
    'middle_name', v_row.middle_name,
    'last_name', v_row.last_name,
    'email', v_row.email,
    'phone', v_row.phone,
    'submitted_at', v_row.submitted_at,
    'preferred_level', v_row.preferred_level,
    'department_id', v_row.department_id,
    'programme_id', v_row.programme_id
  );
end;
$$;

grant execute on function public.submit_admission_application(jsonb) to anon, authenticated;
