-- Remove front-desk role; allow up to three administrator accounts.
-- Apply after backup. Does not drop business tables.

-- 1) Drop the single-admin unique index
drop index if exists public.profiles_single_admin_idx;

-- 2) Promote existing frontdesk users to admin (only while under the cap of 3)
do $$
declare
  admin_count int;
  r record;
begin
  select count(*) into admin_count from public.profiles where role = 'admin';
  for r in
    select id from public.profiles where role = 'frontdesk' order by created_at
  loop
    exit when admin_count >= 3;
    update public.profiles set role = 'admin' where id = r.id;
    admin_count := admin_count + 1;
  end loop;
  -- Any remaining frontdesk accounts become inactive lecturer-less staff: deactivate
  update public.profiles
  set role = 'admin', is_active = false
  where role = 'frontdesk';
end;
$$;

-- 3) Guard: max 3 admins; no new frontdesk; cannot delete last admin
create or replace function public.guard_profile_security_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  admin_count int;
begin
  if tg_op = 'UPDATE' then
    if auth.uid() is not null
      and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
      if not public.is_admin() then
        raise exception 'Only an administrator can change account role or status';
      end if;

      if auth.uid() = old.id then
        raise exception 'You cannot change your own account role or status';
      end if;

      if new.role = 'frontdesk' then
        raise exception 'The front desk role has been removed. Use administrator instead.';
      end if;

      if new.role = 'admin' and old.role is distinct from 'admin' then
        select count(*) into admin_count from public.profiles where role = 'admin';
        if admin_count >= 3 then
          raise exception 'A maximum of three administrator accounts is allowed';
        end if;
      end if;

      -- Demoting an admin when it would leave zero admins
      if old.role = 'admin' and new.role is distinct from 'admin' then
        select count(*) into admin_count from public.profiles where role = 'admin' and id is distinct from old.id;
        if admin_count < 1 then
          raise exception 'At least one administrator account must remain';
        end if;
      end if;

      if old.role = 'admin' and new.is_active is distinct from old.is_active and new.is_active = false then
        select count(*) into admin_count
        from public.profiles
        where role = 'admin' and is_active = true and id is distinct from old.id;
        if admin_count < 1 then
          raise exception 'At least one active administrator account must remain';
        end if;
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' and old.role = 'admin' then
    select count(*) into admin_count from public.profiles where role = 'admin' and id is distinct from old.id;
    if admin_count < 1 then
      raise exception 'The last administrator account cannot be deleted';
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_guard_profile_security_fields on public.profiles;
create trigger trg_guard_profile_security_fields
before update of role, is_active or delete on public.profiles
for each row execute function public.guard_profile_security_fields();

-- 4) Also block INSERT of a 4th admin or of frontdesk via trigger on insert
create or replace function public.guard_profile_insert_roles()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  admin_count int;
begin
  if new.role = 'frontdesk' then
    raise exception 'The front desk role has been removed. Use administrator instead.';
  end if;
  if new.role = 'admin' then
    select count(*) into admin_count from public.profiles where role = 'admin';
    if admin_count >= 3 then
      raise exception 'A maximum of three administrator accounts is allowed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_insert_roles on public.profiles;
create trigger trg_guard_profile_insert_roles
before insert on public.profiles
for each row execute function public.guard_profile_insert_roles();
