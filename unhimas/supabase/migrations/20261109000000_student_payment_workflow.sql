-- Student self-service resit invoices and per-course resit charges.

alter table public.invoice_items
  add column if not exists batch_course_id uuid
  references public.batch_courses(id) on delete restrict;

create unique index if not exists invoice_items_resit_course_uidx
  on public.invoice_items (invoice_id, batch_course_id)
  where batch_course_id is not null;

insert into public.fee_categories (code, name, description, sort_order)
values ('RESIT', 'Resit Fees', 'Resit examination fee per eligible course', 50)
on conflict (code) do nothing;

create or replace function public.create_student_resit_invoice(
  p_batch_course_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_batch_id uuid;
  v_semester_id uuid;
  v_academic_year_id uuid;
  v_invoice_id uuid;
  v_invoice_number text;
  v_fee_category_id uuid;
  v_course_ids uuid[];
  v_valid_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select s.id, s.batch_id
    into v_student_id, v_batch_id
  from public.students s
  where s.profile_id = auth.uid()
    and s.is_active = true
  for update;
  if not found then
    raise exception 'An active student profile is required.';
  end if;

  select sem.id, sem.academic_year_id
    into v_semester_id, v_academic_year_id
  from public.semesters sem
  where sem.is_current = true
    and sem.semester_type = 'resit'
    and sem.registration_open = true
    and (sem.registration_closes_at is null or sem.registration_closes_at >= now())
  limit 1;
  if not found then
    raise exception 'Resit registration is not currently open.';
  end if;

  select array_agg(distinct requested.id order by requested.id)
    into v_course_ids
  from unnest(coalesce(p_batch_course_ids, '{}'::uuid[])) as requested(id)
  where requested.id is not null;
  if coalesce(cardinality(v_course_ids), 0) = 0 then
    raise exception 'Select at least one resit course.';
  end if;
  if cardinality(v_course_ids) > 20 then
    raise exception 'A maximum of 20 resit courses may be paid at once.';
  end if;

  select count(*)
    into v_valid_count
  from public.batch_courses bc
  where bc.id = any(v_course_ids)
    and bc.batch_id = v_batch_id
    and bc.semester_id = v_semester_id
    and public.is_student_resit_eligible(v_student_id, bc.id);
  if v_valid_count <> cardinality(v_course_ids) then
    raise exception 'One or more selected courses are not eligible for resit.';
  end if;

  if exists (
    select 1
    from public.invoice_items ii
    join public.student_invoices si on si.id = ii.invoice_id
    where si.student_id = v_student_id
      and ii.batch_course_id = any(v_course_ids)
  ) then
    raise exception 'A resit invoice already exists for one or more selected courses.';
  end if;

  select id into v_fee_category_id
  from public.fee_categories
  where code = 'RESIT';
  if v_fee_category_id is null then
    raise exception 'The resit fee category is not configured.';
  end if;

  v_invoice_number := public.generate_invoice_number();
  insert into public.student_invoices (
    invoice_number, student_id, academic_year_id, semester_id,
    status, issue_date, notes
  )
  values (
    v_invoice_number, v_student_id, v_academic_year_id, v_semester_id,
    'issued', current_date, 'Student-created resit invoice'
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id, fee_category_id, batch_course_id,
    description, quantity, unit_amount
  )
  select
    v_invoice_id,
    v_fee_category_id,
    bc.id,
    'Resit fee: ' || c.code || ' - ' || c.name,
    1,
    2500
  from public.batch_courses bc
  join public.courses c on c.id = bc.course_id
  where bc.id = any(v_course_ids);

  return v_invoice_id;
end;
$$;

revoke all on function public.create_student_resit_invoice(uuid[])
  from public, anon;
grant execute on function public.create_student_resit_invoice(uuid[])
  to authenticated;

grant select on public.invoice_items to authenticated;
