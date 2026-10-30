-- Public application status lookup (number + email) without exposing other rows

create or replace function public.lookup_admission_application(
  p_number text,
  p_email text
)
returns table (
  application_number text,
  status public.admission_status,
  first_name text,
  last_name text,
  submitted_at timestamptz,
  department_name text,
  preferred_level text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    a.application_number,
    a.status,
    a.first_name,
    a.last_name,
    a.submitted_at,
    d.name,
    a.preferred_level
  from public.admission_applications a
  left join public.departments d on d.id = a.department_id
  where upper(trim(a.application_number)) = upper(trim(p_number))
    and lower(trim(a.email)) = lower(trim(p_email))
  limit 1;
end;
$$;

grant execute on function public.lookup_admission_application(text, text) to anon, authenticated;
