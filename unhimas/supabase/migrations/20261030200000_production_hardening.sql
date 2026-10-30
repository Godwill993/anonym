-- ============================================================
-- Production hardening: public catalog read for /apply
-- ============================================================

-- Allow anonymous and authenticated users to list active departments
-- (needed for the public application form dropdowns).
drop policy if exists departments_public_select on public.departments;
create policy departments_public_select on public.departments
  for select to anon, authenticated
  using (true);

drop policy if exists academic_years_public_select on public.academic_years;
create policy academic_years_public_select on public.academic_years
  for select to anon, authenticated
  using (true);

-- Ensure grants exist
grant select on public.departments to anon, authenticated;
grant select on public.academic_years to anon, authenticated;

-- Optional: system_settings for feature flags (fee clearance, etc.)
create table if not exists public.system_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.system_settings enable row level security;

drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings
  for select to authenticated
  using (true);

drop policy if exists system_settings_admin on public.system_settings;
create policy system_settings_admin on public.system_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.system_settings to authenticated;
grant insert, update, delete on public.system_settings to authenticated;

-- Default: block results/transcript when outstanding fees > 0
insert into public.system_settings (key, value)
values
  ('fee_clearance_required', '{"enabled": true}'::jsonb),
  ('payments_auto_complete', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;
