-- Programmes are system defaults (Cameroon model). There is no programmes admin page.
-- HND = 2 years, Bachelor of Technology = 1 year, Masters of Technology = 2 years.
-- B.Sc / M.Sc stay as the science-track exits already seeded.
-- An admin-selected student programme must be kept; only inherit the batch programme when none was chosen.

insert into public.programmes (code, name, award, track, duration_years, description, sort_order, is_active)
values
  ('HND',   'Higher National Diploma', 'HND',   'technology', 2.0,
   'Two-year HND for most departments; three years for Biomedical.', 10, true),
  ('BTECH', 'Bachelor of Technology',  'BTECH', 'technology', 1.0,
   'One-year top-up after successful completion of HND.', 20, true),
  ('MTECH', 'Masters of Technology',   'MTECH', 'technology', 2.0,
   'Two-year masters on the technology track after B.Tech.', 30, true),
  ('BSC',   'Bachelor of Science',     'BSC',   'science',    3.0,
   'Science-track bachelor; available after unsuccessful / exit from HND or as direct entry.', 40, true),
  ('MSC',   'Masters of Science',      'MSC',   'science',    2.0,
   'Two-year masters on the science track after B.Sc.', 50, true)
on conflict (code) do update set
  name = excluded.name,
  award = excluded.award,
  track = excluded.track,
  duration_years = excluded.duration_years,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

create or replace function public.sync_student_programme_from_batch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Honour the programme chosen when the student account is created.
  if new.programme_id is null and new.batch_id is not null then
    select programme_id into new.programme_id
    from public.batches
    where id = new.batch_id;
  end if;
  return new;
end;
$$;
