-- ============================================================
-- UNHIMAS: Direct Account Creation Flow
-- Replaces the magic-link invitation flow.
-- Run this migration after 20261005000000_secure_account_provisioning.sql
-- ============================================================

-- 1. Add must_reset_password flag to students
alter table public.students
  add column if not exists must_reset_password boolean not null default false;

-- 2. Add must_reset_password flag to lecturers
alter table public.lecturers
  add column if not exists must_reset_password boolean not null default false;

-- 3. Drop the old invitation-only RPC (it was service_role-only anyway).
drop function if exists public.link_provisioned_school_account(uuid, text, uuid);

-- 4. New RPC: atomically link a freshly-created Auth user to a school record,
--    set the correct role on the profile, and mark must_reset_password = true.
--    Only callable by the service_role (Edge Function).
create or replace function public.provision_school_account_direct(
  p_user_id     uuid,
  p_record_type text,   -- 'student' | 'lecturer'
  p_record_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard: only the service_role may call this
  if auth.role() is distinct from 'service_role' then
    raise exception 'This operation is restricted to the account provisioning service.';
  end if;

  -- Guard: the auth trigger must have already created the profile row
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Auth profile row has not been created for this user.';
  end if;

  if p_record_type = 'student' then
    update public.students
       set profile_id          = p_user_id,
           must_reset_password = true
     where id = p_record_id
       and profile_id is null
       and is_active = true;

    if not found then
      raise exception 'Student record not found, is inactive, or already linked to an account.';
    end if;

    update public.profiles
       set role = 'student'
     where id = p_user_id;

  elsif p_record_type = 'lecturer' then
    update public.lecturers
       set profile_id          = p_user_id,
           must_reset_password = true
     where id = p_record_id
       and profile_id is null
       and is_active = true;

    if not found then
      raise exception 'Lecturer record not found, is inactive, or already linked to an account.';
    end if;

    update public.profiles
       set role = 'lecturer'
     where id = p_user_id;

  else
    raise exception 'Unsupported record type: %. Expected ''student'' or ''lecturer''.', p_record_type;
  end if;
end;
$$;

revoke all on function public.provision_school_account_direct(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.provision_school_account_direct(uuid, text, uuid)
  to service_role;

-- 5. RPC for clearing must_reset_password once the user sets their new password.
create or replace function public.clear_must_reset_password()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  update public.students
     set must_reset_password = false
   where profile_id = v_user_id
     and must_reset_password = true;

  update public.lecturers
     set must_reset_password = false
   where profile_id = v_user_id
     and must_reset_password = true;
end;
$$;

grant execute on function public.clear_must_reset_password() to authenticated;
